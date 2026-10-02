import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews, keys } from "./hooks";

export type RoleSummary = Schemas["RoleSummary"];
export type RoleStatus = RoleSummary["status"];

export interface RoleFilters {
  status?: RoleStatus;
  company_id?: string;
  contact_id?: string;
  meeting_id?: string;
}

export const ROLE_STATUS: Record<RoleStatus, { label: string; color: string }> = {
  to_decide: { label: "To decide", color: "yellow" },
  applied: { label: "Applied", color: "blue" },
  passed: { label: "Passed", color: "gray" },
};

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

/** Roles with where they came from and where they stand, oldest first. */
export function useRoleSummaries(filters: RoleFilters) {
  return useQuery({
    queryKey: ["role-summaries", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/role-summaries", { params: { query: filters } })),
  });
}

function useRefreshRoles() {
  const qc = useQueryClient();
  return () => {
    for (const key of [["role-summaries"], keys.roles, ["company-summary"], ["search"]])
      void qc.invalidateQueries({ queryKey: key });
    invalidateApplicationViews(qc); // next actions, timeline, insights…
  };
}

export function useSaveRole() {
  const refresh = useRefreshRoles();
  return useMutation({
    mutationFn: async (args: { id: string; body: Schemas["RolePatch"] } | { body: Schemas["RoleIn"] }) =>
      "id" in args
        ? unwrap(
            await api.PATCH("/api/v1/roles/{item_id}", {
              params: { path: { item_id: args.id } },
              body: args.body,
            }),
          )
        : unwrap(await api.POST("/api/v1/roles", { body: args.body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

/** Apply for a role: an application for it, through whoever told you about it. */
export function useApplyForRole() {
  const refresh = useRefreshRoles();
  return useMutation({
    mutationFn: async (body: Schemas["ApplicationIn"]) =>
      unwrap(await api.POST("/api/v1/applications", { body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}
