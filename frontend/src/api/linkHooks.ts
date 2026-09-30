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
  return (link?: { entity_type: string; entity_id: string }) => {
    void qc.invalidateQueries({ queryKey: link ? ["links", link.entity_type, link.entity_id] : ["links"] });
    // Adding a link to an application puts it on the timeline.
    if (link?.entity_type === "application") invalidateApplicationViews(qc);
  };
}

export function useAddLink() {
  const refresh = useRefreshLinks();
  return useMutation({
    mutationFn: async (body: Schemas["LinkIn"]) => unwrap(await api.POST("/api/v1/links", { body })),
    onSuccess: (link) => refresh(link),
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
    onSuccess: () => refresh(),
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
    onSuccess: () => refresh(),
    onError: notifyError,
  });
}
