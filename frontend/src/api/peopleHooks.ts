import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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
      ["application"],
      ["contact-summary"],
      ["timeline"],
      ["meetings"],
      ["role-summaries"],
      ["next-actions"], // names in waiting, calls and to-dos
      ["todos"],
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

export function useUpdateAgency() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async (args: { id: string; body: Schemas["AgencyPatch"] }) =>
      unwrap(
        await api.PATCH("/api/v1/agencies/{item_id}", {
          params: { path: { item_id: args.id } },
          body: args.body,
        }),
      ),
    onSuccess: refresh,
    onError: notifyError,
  });
}

/** Mark that you replied to someone and are waiting (a date), or that you heard back (null). */
export function useSetPersonWaiting() {
  const qc = useQueryClient();
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async (args: { id: string; since: string | null }) =>
      unwrap(
        await api.PATCH("/api/v1/contacts/{contact_id}", {
          params: { path: { contact_id: args.id } },
          body: { awaiting_reply_since: args.since },
        }),
      ),
    onSuccess: () => {
      refresh();
      void qc.invalidateQueries({ queryKey: ["next-actions"] });
    },
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

export type Relation = Schemas["ApplicationContactIn"]["relation"];

/** How a person is involved in an application (the "As" choices). */
export const RELATIONS: { value: Relation; label: string }[] = [
  { value: "recruiter", label: "Recruiter (agency)" },
  { value: "internal_recruiter", label: "Internal recruiter / talent" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "interviewer", label: "Interviewer" },
  { value: "referrer", label: "Referrer" },
  { value: "other", label: "Other" },
];

const RELATION_LABELS = new Map<string, string>(RELATIONS.map((r) => [r.value, r.label]));

export function relationLabel(relation: string): string {
  return RELATION_LABELS.get(relation) ?? relation;
}

/** One person's page: details, the applications they're part of and their interviews. */
export function useContactSummary(id: string) {
  return useQuery({
    queryKey: ["contact-summary", id],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/contacts/{contact_id}/summary", { params: { path: { contact_id: id } } }),
      ),
  });
}
