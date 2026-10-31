import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { i18n } from "../i18n";
import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";
import { notifyError } from "./notifyError";

export type Interview = Schemas["InterviewOut"];
export type InterviewKind = Schemas["InterviewIn"]["kind"];

export const KIND_OPTIONS = [
  { value: "screen", key: "interviews:kinds.screen" },
  { value: "hiring_manager", key: "interviews:kinds.hiring_manager" },
  { value: "technical", key: "interviews:kinds.technical" },
  { value: "coding_task", key: "interviews:kinds.coding_task" },
  { value: "system_design", key: "interviews:kinds.system_design" },
  { value: "pairing", key: "interviews:kinds.pairing" },
  { value: "behavioural", key: "interviews:kinds.behavioural" },
  { value: "onsite", key: "interviews:kinds.onsite" },
  { value: "final", key: "interviews:kinds.final" },
  { value: "other", key: "interviews:kinds.other" },
] as const satisfies readonly { value: NonNullable<InterviewKind>; key: string }[];

export interface InterviewFilters {
  application_id?: string;
  status?: "scheduled" | "done" | "cancelled";
  upcoming?: boolean;
  since?: string;
}

export function useInterviews(filters: InterviewFilters) {
  return useQuery({
    queryKey: ["interviews", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/interviews", { params: { query: filters } })),
  });
}

/** Round descriptions used before, most used first. */
export function useInterviewTitles() {
  return useQuery({
    queryKey: ["interview-titles"],
    queryFn: async () => unwrap(await api.GET("/api/v1/interviews/titles")),
    staleTime: 60_000,
  });
}

function useRefreshInterviews() {
  const qc = useQueryClient();
  return () => {
    for (const key of [["interviews"], ["interview-titles"]]) void qc.invalidateQueries({ queryKey: key });
    // Rows show the current round, and the timeline logs every change.
    invalidateApplicationViews(qc);
  };
}

export function useSaveInterview() {
  const refresh = useRefreshInterviews();
  return useMutation({
    mutationFn: async (
      args:
        | { id: string; body: Schemas["InterviewPatch"] }
        | { applicationId: string; body: Schemas["InterviewIn"] },
    ) =>
      "id" in args
        ? unwrap(
            await api.PATCH("/api/v1/interviews/{interview_id}", {
              params: { path: { interview_id: args.id } },
              body: args.body,
            }),
          )
        : unwrap(
            await api.POST("/api/v1/applications/{app_id}/interviews", {
              params: { path: { app_id: args.applicationId } },
              body: args.body,
            }),
          ),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useDeleteInterview() {
  const refresh = useRefreshInterviews();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/interviews/{interview_id}", {
        params: { path: { interview_id: id } },
      });
      if (error) throw new Error(i18n.t("errors:own.deleteInterview"));
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}
