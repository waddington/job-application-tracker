import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { notifyError } from "./notifyError";

export type Meeting = Schemas["MeetingOut"];
export type MeetingKind = Schemas["MeetingIn"]["kind"];

export const MEETING_KINDS = [
  { value: "call", key: "calls:kinds.call" },
  { value: "video", key: "calls:kinds.video" },
  { value: "in_person", key: "calls:kinds.in_person" },
] as const satisfies readonly { value: NonNullable<MeetingKind>; key: string }[];

export interface MeetingFilters {
  contact_id?: string;
  agency_id?: string;
  company_id?: string;
  application_id?: string;
}

/** Calls and meetings, soonest first. */
export function useMeetings(filters: MeetingFilters, enabled = true) {
  return useQuery({
    enabled,
    queryKey: ["meetings", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/meetings", { params: { query: filters } })),
  });
}

function useRefreshMeetings() {
  const qc = useQueryClient();
  return () => {
    for (const key of [["meetings"], ["next-actions"], ["timeline"], ["search"], ["role-summaries"]])
      void qc.invalidateQueries({ queryKey: key });
  };
}

export function useSaveMeeting() {
  const refresh = useRefreshMeetings();
  return useMutation({
    mutationFn: async (
      args: { id: string; body: Schemas["MeetingPatch"] } | { body: Schemas["MeetingIn"] },
    ) =>
      "id" in args
        ? unwrap(
            await api.PATCH("/api/v1/meetings/{meeting_id}", {
              params: { path: { meeting_id: args.id } },
              body: args.body,
            }),
          )
        : unwrap(await api.POST("/api/v1/meetings", { body: args.body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useDeleteMeeting() {
  const refresh = useRefreshMeetings();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/meetings/{meeting_id}", {
        params: { path: { meeting_id: id } },
      });
      if (error) throw new Error("Couldn't delete the call");
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}
