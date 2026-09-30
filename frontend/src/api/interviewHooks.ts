import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";

export type Interview = Schemas["InterviewOut"];
export type InterviewKind = Schemas["InterviewIn"]["kind"];

export const KIND_OPTIONS: { value: NonNullable<InterviewKind>; label: string }[] = [
  { value: "screen", label: "Screen" },
  { value: "hiring_manager", label: "Hiring manager" },
  { value: "technical", label: "Technical" },
  { value: "coding_task", label: "Coding task" },
  { value: "system_design", label: "System design" },
  { value: "pairing", label: "Pairing" },
  { value: "behavioural", label: "Behavioural" },
  { value: "onsite", label: "Onsite" },
  { value: "final", label: "Final" },
  { value: "other", label: "Other" },
];

export interface InterviewFilters {
  application_id?: string;
  status?: "scheduled" | "done" | "cancelled";
  upcoming?: boolean;
}

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
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
      if (error) throw new Error("Couldn't delete the interview");
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}
