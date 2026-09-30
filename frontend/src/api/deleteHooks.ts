import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, errorMessage } from "./client";
import { invalidateApplicationViews, keys } from "./hooks";

export type Deletable = "application" | "company" | "agency" | "contact" | "role";

async function remove(kind: Deletable, id: string) {
  const { error } =
    kind === "application"
      ? await api.DELETE("/api/v1/applications/{app_id}", { params: { path: { app_id: id } } })
      : kind === "contact"
        ? await api.DELETE("/api/v1/contacts/{contact_id}", { params: { path: { contact_id: id } } })
        : kind === "company"
          ? await api.DELETE("/api/v1/companies/{item_id}", { params: { path: { item_id: id } } })
          : kind === "agency"
            ? await api.DELETE("/api/v1/agencies/{item_id}", { params: { path: { item_id: id } } })
            : await api.DELETE("/api/v1/roles/{item_id}", { params: { path: { item_id: id } } });
  // A refusal says why ("Contoso has 2 applications. Delete them first…").
  if (error !== undefined) throw new Error(errorMessage(error));
}

/** Delete an application, company, agency, person or role, then refresh everything that shows them. */
export function useDeleteEntity(kind: Deletable) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => remove(kind, id),
    onSuccess: () => {
      for (const key of [
        keys.companies,
        keys.agencies,
        keys.contacts,
        keys.roles,
        ["search"],
        ["insights"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
      invalidateApplicationViews(qc);
    },
    onError: (error: Error) =>
      notifications.show({ color: "red", title: "Couldn't delete it", message: error.message }),
  });
}
