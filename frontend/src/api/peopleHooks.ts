import { notifications } from "@mantine/notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { keys } from "./hooks";

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

/** After any contact or agency change, refresh everything that shows people. */
function useRefreshPeople() {
  const qc = useQueryClient();
  return () => {
    for (const key of [
      keys.contacts,
      keys.agencies,
      ["agency-summary"],
      ["company-summary"],
      ["applications"],
    ]) {
      void qc.invalidateQueries({ queryKey: key });
    }
  };
}

export function useCreateAgency() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async (body: Schemas["AgencyIn"]) => unwrap(await api.POST("/api/v1/agencies", { body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useSaveContact() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async (args: { id?: string; body: Schemas["ContactIn"] }) =>
      args.id
        ? unwrap(
            await api.PATCH("/api/v1/contacts/{contact_id}", {
              params: { path: { contact_id: args.id } },
              body: args.body,
            }),
          )
        : unwrap(await api.POST("/api/v1/contacts", { body: args.body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}
