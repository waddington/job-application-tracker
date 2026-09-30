import { notifications } from "@mantine/notifications";
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type ApplicationDetail, type ApplicationRow, type Schemas } from "./client";

export interface WorkflowStage {
  id: string;
  name: string;
  kind: "active" | "success" | "closed";
  stale_after_days: number | null;
  color: string;
  next: string[];
  allowed_next: string[];
  /** The usual next stages. With transitions "any", allowed_next is every other stage. */
  suggested_next: string[];
}

export interface Workflow {
  initial: string;
  transitions: "any" | "configured";
  skip_forward: boolean;
  reopen_from: string[];
  stages: WorkflowStage[];
}

export interface ApplicationFilters {
  q?: string;
  stage?: string[];
  route?: "direct" | "agency" | "referral";
  agency_id?: string;
  recruiter_id?: string;
  company_id?: string;
  tag?: string;
  archived?: boolean;
  stale?: boolean;
  sort?: "last_activity" | "-last_activity" | "created" | "-created" | "company" | "stage";
}

export const keys = {
  workflow: ["workflow"] as const,
  applications: (filters: ApplicationFilters = {}) => ["applications", filters] as const,
  application: (id: string) => ["application", id] as const,
  companies: ["companies"] as const,
  agencies: ["agencies"] as const,
  contacts: ["contacts"] as const,
  roles: ["roles"] as const,
};

/** Everything that shows applications: lists, the board, company and agency pages. */
export function invalidateApplicationViews(qc: QueryClient) {
  // ["application"] too: other applications list this one as a possible duplicate.
  for (const key of [
    ["applications"],
    ["application"],
    ["company-summary"],
    ["agency-summary"],
    ["duplicates"],
    ["insights"],
    ["interviews"],
    ["next-actions"],
  ]) {
    void qc.invalidateQueries({ queryKey: key });
  }
}

export function useWorkflow() {
  return useQuery({
    queryKey: keys.workflow,
    queryFn: async () => unwrap(await api.GET("/api/v1/workflow")) as unknown as Workflow,
    staleTime: 60_000,
  });
}

export function stageLookup(workflow: Workflow | undefined) {
  const map = new Map<string, WorkflowStage>();
  workflow?.stages.forEach((s) => map.set(s.id, s));
  return map;
}

export function useApplications(filters: ApplicationFilters) {
  return useQuery({
    queryKey: keys.applications(filters),
    queryFn: async () => {
      const query = Object.fromEntries(
        Object.entries(filters).filter(
          ([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && !v.length),
        ),
      );
      return unwrap(await api.GET("/api/v1/applications", { params: { query } }));
    },
    placeholderData: (previous) => previous,
  });
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: keys.application(id ?? ""),
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/applications/{app_id}", { params: { path: { app_id: id! } } })),
    enabled: !!id,
  });
}

export function useCompanies() {
  return useQuery({
    queryKey: keys.companies,
    queryFn: async () => unwrap(await api.GET("/api/v1/companies")),
  });
}

export function useAgencies() {
  return useQuery({
    queryKey: keys.agencies,
    queryFn: async () => unwrap(await api.GET("/api/v1/agencies")),
  });
}

export function useContacts() {
  return useQuery({
    queryKey: keys.contacts,
    queryFn: async () => unwrap(await api.GET("/api/v1/contacts")),
  });
}

/** Existing applications that look like the same job (same company, same or similar title). */
export function useDuplicates(args: { companyId?: string; companyName: string; roleTitle: string }) {
  const companyName = args.companyName.trim();
  const roleTitle = args.roleTitle.trim();
  const query = args.companyId
    ? { company_id: args.companyId, role_title: roleTitle }
    : { company_name: companyName, role_title: roleTitle };
  return useQuery({
    queryKey: ["duplicates", query],
    queryFn: async () => unwrap(await api.GET("/api/v1/applications/duplicates", { params: { query } })),
    enabled: !!roleTitle && (!!args.companyId || !!companyName),
  });
}

export function useRoles() {
  return useQuery({ queryKey: keys.roles, queryFn: async () => unwrap(await api.GET("/api/v1/roles")) });
}

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

/** After any application change, refresh lists and the changed application. */
function useApplicationInvalidation() {
  const qc = useQueryClient();
  return (detail?: ApplicationDetail) => {
    invalidateApplicationViews(qc);
    if (detail) qc.setQueryData(keys.application(detail.id), detail);
  };
}

export function useMoveApplication() {
  const qc = useQueryClient();
  const refresh = useApplicationInvalidation();
  return useMutation({
    mutationFn: async (args: { id: string; to_stage: string; note?: string; stageName?: string }) =>
      unwrap(
        await api.POST("/api/v1/applications/{app_id}/move", {
          params: { path: { app_id: args.id } },
          body: { to_stage: args.to_stage, note: args.note ?? null },
        }),
      ),
    // Move the card straight away (the board would otherwise snap back until the refetch).
    onMutate: async (args) => {
      await qc.cancelQueries({ queryKey: ["applications"] });
      const previous = qc.getQueriesData<ApplicationRow[]>({ queryKey: ["applications"] });
      qc.setQueriesData<ApplicationRow[]>({ queryKey: ["applications"] }, (rows) =>
        rows?.map((r) =>
          r.id === args.id ? { ...r, stage: args.to_stage, stage_name: args.stageName ?? r.stage_name } : r,
        ),
      );
      return { previous };
    },
    onError: (error, _args, context) => {
      context?.previous.forEach(([key, data]) => qc.setQueryData(key, data));
      notifyError(error);
    },
    onSuccess: refresh,
  });
}

export function useUndoMove() {
  const refresh = useApplicationInvalidation();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.POST("/api/v1/applications/{app_id}/undo", { params: { path: { app_id: id } } })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useUpdateApplication() {
  const refresh = useApplicationInvalidation();
  return useMutation({
    mutationFn: async (args: { id: string; body: Schemas["ApplicationPatch"] }) =>
      unwrap(
        await api.PATCH("/api/v1/applications/{app_id}", {
          params: { path: { app_id: args.id } },
          body: args.body,
        }),
      ),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useLogActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; body: Schemas["ActivityIn"] }) =>
      unwrap(
        await api.POST("/api/v1/applications/{app_id}/activities", {
          params: { path: { app_id: args.id } },
          body: args.body,
        }),
      ),
    onSuccess: (_event, args) => {
      invalidateApplicationViews(qc);
      void qc.invalidateQueries({ queryKey: keys.application(args.id) });
    },
    onError: notifyError,
  });
}

/** Create an application (and any new company, role, agency or recruiter) in one server transaction. */
export function useCreateApplication() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["QuickApplicationIn"]) =>
      unwrap(await api.POST("/api/v1/applications/quick", { body })),
    // Settled, not just success: keep pick-lists fresh whatever happened.
    onSettled: () => {
      for (const key of [["applications"], keys.companies, keys.agencies, keys.contacts, keys.roles]) {
        void qc.invalidateQueries({ queryKey: key });
      }
    },
    onError: notifyError,
  });
}
