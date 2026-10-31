import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { i18n } from "../i18n";
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
      ["insights"], // conversations say who ghosted you
      ["search"],
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

/**
 * Where a conversation with someone stands: you replied and are waiting (`awaiting_reply_since`),
 * or they replied and you need to read it (`reply_to_read_since`); null clears either.
 */
export function useSetPersonReply() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async (args: {
      id: string;
      body: Pick<
        Schemas["ContactPatch"],
        "awaiting_reply_since" | "reply_to_read_since" | "chased_on" | "closed_as" | "closed_on" | "favourite"
      >;
    }) =>
      unwrap(
        await api.PATCH("/api/v1/contacts/{contact_id}", {
          params: { path: { contact_id: args.id } },
          body: args.body,
        }),
      ),
    onSuccess: refresh, // people, next actions, the timeline…
    onError: notifyError,
  });
}

export function useSaveContact() {
  const refresh = useRefreshPeople();
  return useMutation({
    mutationFn: async (args: {
      id?: string;
      body: Omit<Schemas["ContactIn"], "favourite"> & { favourite?: boolean };
    }) =>
      args.id
        ? unwrap(
            await api.PATCH("/api/v1/contacts/{contact_id}", {
              params: { path: { contact_id: args.id } },
              body: args.body,
            }),
          )
        : unwrap(await api.POST("/api/v1/contacts", { body: { favourite: false, ...args.body } })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

/** Fold another record of the same person (`fromId`) into `id`; the other record is deleted. */
export function useMergeContact() {
  const refresh = useRefreshPeople();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; fromId: string }) =>
      unwrap(
        await api.POST("/api/v1/contacts/{contact_id}/merge", {
          params: { path: { contact_id: args.id } },
          body: { from_id: args.fromId },
        }),
      ),
    onSuccess: () => {
      refresh();
      for (const key of [
        ["links"],
        ["notes"],
        ["note"],
        ["attachments"],
        ["interviews"],
        ["roles"],
        ["insights"],
        ["search"],
        ["duplicates"],
      ]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
    onError: notifyError,
  });
}

export type Relation = Schemas["ApplicationContactIn"]["relation"];

/** How a person is involved in an application (the "As" choices). */
const RELATION_TEXT = {
  recruiter: () => i18n.t("people:relations.recruiter"),
  internal_recruiter: () => i18n.t("people:relations.internal_recruiter"),
  hiring_manager: () => i18n.t("people:relations.hiring_manager"),
  interviewer: () => i18n.t("people:relations.interviewer"),
  referrer: () => i18n.t("people:relations.referrer"),
  other: () => i18n.t("people:relations.other"),
} satisfies Record<Relation, () => string>;

/** The choices when linking someone to an application, in the current language. */
export const relationOptions = () =>
  (Object.keys(RELATION_TEXT) as Relation[]).map((value) => ({ value, label: RELATION_TEXT[value]() }));

export function relationLabel(relation: string): string {
  return relation in RELATION_TEXT ? RELATION_TEXT[relation as Relation]() : relation;
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
