import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews, keys } from "./hooks";
import { notifyError } from "./notifyError";
import { i18n } from "../i18n";
import { stageName } from "../utils/stageName";

export type RoleSummary = Schemas["RoleSummary"];
export type RoleStatus = RoleSummary["status"];

export interface RoleFilters {
  status?: RoleStatus;
  company_id?: string;
  contact_id?: string;
  meeting_id?: string;
}

export const ROLE_STATUS: Record<RoleStatus, { label: `roles:status.${RoleStatus}`; color: string }> = {
  to_decide: { label: "roles:status.to_decide", color: "yellow" },
  interested: { label: "roles:status.interested", color: "cyan" },
  closed: { label: "roles:status.closed", color: "dark" },
  applied: { label: "roles:status.applied", color: "blue" },
  passed: { label: "roles:status.passed", color: "gray" },
};

/** A role's badge: its status, or for one closed before you applied, the stage it ended at. */
export function roleBadge(role: RoleSummary): { label: string; color: string } {
  const status = ROLE_STATUS[role.status];
  // closed_as is the stage's name, as written in config.toml; closed_stage its id.
  const label =
    role.status === "closed" && role.closed_as
      ? stageName({ id: role.closed_stage, name: role.closed_as })
      : i18n.t(status.label);
  return { label, color: status.color };
}

/** Roles with where they came from and where they stand, oldest first. */
export function useRoleSummaries(filters: RoleFilters) {
  return useQuery({
    queryKey: ["role-summaries", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/role-summaries", { params: { query: filters } })),
  });
}

/** One role, for its page. */
export function useRoleSummary(id: string) {
  return useQuery({
    queryKey: ["role-summaries", "one", id],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/role-summaries/{role_id}", { params: { path: { role_id: id } } })),
    retry: false,
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
