import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type Flow = Schemas["FlowOut"];
export type FlowNode = Schemas["FlowNode"];
export type FlowLink = Schemas["FlowLink"];
export type Stats = Schemas["StatsOut"];
export type Week = Schemas["WeekOut"];

export interface FlowFilters {
  since?: string;
  route?: "direct" | "agency" | "referral";
}

/** Stage-to-stage flows for applications added since `since` (and by `route`). */
export function useFlow(filters: FlowFilters) {
  return useQuery({
    queryKey: ["insights", "flow", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/insights/flow", { params: { query: filters } })),
    placeholderData: keepPreviousData, // keep the diagram up while a filter change loads
  });
}

/** Conversion and time per stage, and outcomes by route, for applications added since `since`. */
export function useStats(since?: string) {
  return useQuery({
    queryKey: ["insights", "stats", since],
    queryFn: async () => unwrap(await api.GET("/api/v1/insights/stats", { params: { query: { since } } })),
    placeholderData: keepPreviousData,
  });
}

/** Activity per week, oldest first: `start` is the first week's Monday, `tz` your IANA time zone. */
export function useActivity(start: string, weeks: number, tz: string) {
  return useQuery({
    queryKey: ["insights", "activity", start, weeks, tz],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/insights/activity", { params: { query: { start, weeks, tz } } })),
  });
}
