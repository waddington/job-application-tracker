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

export const CATEGORIES: { value: TimelineCategory; label: string; color: string }[] = [
  { value: "stage", label: "Stage moves", color: "blue" },
  { value: "message", label: "Messages", color: "cyan" },
  { value: "interview", label: "Interviews", color: "violet" },
  { value: "offer", label: "Offers", color: "teal" },
  { value: "note", label: "Notes", color: "yellow" },
  { value: "document", label: "Documents sent", color: "grape" },
  { value: "file", label: "Files", color: "orange" },
  { value: "added", label: "Added", color: "gray" },
  { value: "other", label: "Other", color: "dark" },
];

export const categoryOf = (value: TimelineCategory) => CATEGORIES.find((c) => c.value === value)!;

/** Everything that happened (and is booked ahead), newest first, across the whole search. */
export function useTimeline(filters: TimelineFilters) {
  return useQuery({
    queryKey: ["timeline", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/timeline", { params: { query: filters } })),
    placeholderData: keepPreviousData,
  });
}
