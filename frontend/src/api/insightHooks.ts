import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type Flow = Schemas["FlowOut"];
export type FlowNode = Schemas["FlowNode"];
export type FlowLink = Schemas["FlowLink"];

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
