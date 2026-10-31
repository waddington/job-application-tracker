import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type TimelineItem = Schemas["TimelineItem"];
export type TimelineCategory = TimelineItem["category"];

export interface TimelineFilters {
  since?: string;
  category?: TimelineCategory[];
  company_id?: string;
  agency_id?: string;
  contact_id?: string;
  application_id?: string;
}

export const CATEGORIES = [
  {
    value: "stage",
    label: "timeline:categories.stage.label",
    one: "timeline:categories.stage.one",
    color: "blue",
  },
  {
    value: "message",
    label: "timeline:categories.message.label",
    one: "timeline:categories.message.one",
    color: "cyan",
  },
  {
    value: "meeting",
    label: "timeline:categories.meeting.label",
    one: "timeline:categories.meeting.one",
    color: "pink",
  },
  {
    value: "interview",
    label: "timeline:categories.interview.label",
    one: "timeline:categories.interview.one",
    color: "violet",
  },
  {
    value: "offer",
    label: "timeline:categories.offer.label",
    one: "timeline:categories.offer.one",
    color: "teal",
  },
  {
    value: "role",
    label: "timeline:categories.role.label",
    one: "timeline:categories.role.one",
    color: "lime",
  },
  {
    value: "note",
    label: "timeline:categories.note.label",
    one: "timeline:categories.note.one",
    color: "yellow",
  },
  {
    value: "document",
    label: "timeline:categories.document.label",
    one: "timeline:categories.document.one",
    color: "grape",
  },
  {
    value: "file",
    label: "timeline:categories.file.label",
    one: "timeline:categories.file.one",
    color: "orange",
  },
  {
    value: "added",
    label: "timeline:categories.added.label",
    one: "timeline:categories.added.one",
    color: "gray",
  },
  {
    value: "other",
    label: "timeline:categories.other.label",
    one: "timeline:categories.other.one",
    color: "dark",
  },
] as const satisfies readonly { value: TimelineCategory; label: string; one: string; color: string }[];

export const categoryOf = (value: TimelineCategory) => CATEGORIES.find((c) => c.value === value)!;

/** Everything that happened (and is booked ahead), newest first, across the whole search. */
export function useTimeline(filters: TimelineFilters, enabled = true) {
  return useQuery({
    queryKey: ["timeline", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/timeline", { params: { query: filters } })),
    placeholderData: keepPreviousData,
    enabled,
  });
}
