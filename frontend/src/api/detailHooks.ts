import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews, keys } from "./hooks";

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

export function useCompanySummary(id: string) {
  return useQuery({
    queryKey: ["company-summary", id],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/companies/{company_id}/summary", { params: { path: { company_id: id } } }),
      ),
  });
}

export function useAgencySummary(id: string) {
  return useQuery({
    queryKey: ["agency-summary", id],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/agencies/{agency_id}/summary", { params: { path: { agency_id: id } } })),
  });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Schemas["CompanyIn"]) => unwrap(await api.POST("/api/v1/companies", { body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: keys.companies }),
    onError: notifyError,
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; body: Schemas["CompanyPatch"] }) =>
      unwrap(
        await api.PATCH("/api/v1/companies/{item_id}", {
          params: { path: { item_id: args.id } },
          body: args.body,
        }),
      ),
    onSuccess: (_data, args) => {
      void qc.invalidateQueries({ queryKey: keys.companies });
      void qc.invalidateQueries({ queryKey: ["company-summary", args.id] });
      void qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: notifyError,
  });
}

type Relation = Schemas["ApplicationContactIn"]["relation"];

export function useLinkContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { appId: string; contactId: string; relation: Relation }) =>
      unwrap(
        await api.POST("/api/v1/applications/{app_id}/contacts", {
          params: { path: { app_id: args.appId } },
          body: { contact_id: args.contactId, relation: args.relation },
        }),
      ),
    onSuccess: (_d, args) => {
      void qc.invalidateQueries({ queryKey: keys.application(args.appId) });
      invalidateApplicationViews(qc); // company pages list linked people
    },
    onError: notifyError,
  });
}

export function useUnlinkContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { appId: string; linkId: string }) => {
      const { error } = await api.DELETE("/api/v1/applications/{app_id}/contacts/{link_id}", {
        params: { path: { app_id: args.appId, link_id: args.linkId } },
      });
      if (error) throw new Error("Couldn't remove that contact");
    },
    onSuccess: (_d, args) => {
      void qc.invalidateQueries({ queryKey: keys.application(args.appId) });
      invalidateApplicationViews(qc);
    },
    onError: notifyError,
  });
}
