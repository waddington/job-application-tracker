import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";

export type SearchHit = Schemas["SearchHit"];

/** Everything matching every word of `q` (empty `q`: nothing, no request). */
export function useSearchResults(q: string) {
  const query = q.trim();
  return useQuery({
    queryKey: ["search", query],
    queryFn: async () => unwrap(await api.GET("/api/v1/search", { params: { query: { q: query } } })),
    enabled: query.length > 0,
    placeholderData: keepPreviousData,
  });
}
