import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";

export type LinkItem = Schemas["LinkOut"];
export type EntityType = Schemas["LinkIn"]["entity_type"];

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

export function useLinks(entityType: EntityType, entityId: string) {
  return useQuery({
    queryKey: ["links", entityType, entityId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/links", {
          params: { query: { entity_type: entityType, entity_id: entityId } },
        }),
      ),
  });
}

function useRefreshLinks() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["links"] });
    invalidateApplicationViews(qc); // a link on an application goes on its timeline
  };
}

export function useAddLink() {
  const refresh = useRefreshLinks();
  return useMutation({
    mutationFn: async (body: Schemas["LinkIn"]) => unwrap(await api.POST("/api/v1/links", { body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useUpdateLink() {
  const refresh = useRefreshLinks();
  return useMutation({
    mutationFn: async (args: { id: string; body: Schemas["LinkPatch"] }) =>
      unwrap(
        await api.PATCH("/api/v1/links/{link_id}", {
          params: { path: { link_id: args.id } },
          body: args.body,
        }),
      ),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useDeleteLink() {
  const refresh = useRefreshLinks();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/links/{link_id}", { params: { path: { link_id: id } } });
      if (error) throw new Error("Couldn't remove the link");
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}
