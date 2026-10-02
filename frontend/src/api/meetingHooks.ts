import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type Meeting = Schemas["MeetingOut"];
export type MeetingKind = Schemas["MeetingIn"]["kind"];

export const MEETING_KINDS: { value: NonNullable<MeetingKind>; label: string }[] = [
  { value: "call", label: "Phone call" },
  { value: "video", label: "Video call" },
  { value: "in_person", label: "In person" },
];

export interface MeetingFilters {
  contact_id?: string;
  agency_id?: string;
  company_id?: string;
  application_id?: string;
}

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

/** Calls and meetings, soonest first. */
export function useMeetings(filters: MeetingFilters) {
  return useQuery({
    queryKey: ["meetings", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/meetings", { params: { query: filters } })),
  });
}

function useRefreshMeetings() {
  const qc = useQueryClient();
  return () => {
    for (const key of [["meetings"], ["next-actions"], ["timeline"]])
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
