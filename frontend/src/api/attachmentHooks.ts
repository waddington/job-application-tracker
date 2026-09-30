import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, errorMessage, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";

export type AttachmentItem = Schemas["AttachmentOut"];

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

export function useAttachments(entityType: string, entityId: string) {
  return useQuery({
    queryKey: ["attachments", entityType, entityId],
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/attachments", {
          params: { query: { entity_type: entityType, entity_id: entityId } },
        }),
      ),
  });
}

export function useUploadAttachments(entityType: string, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    // One request per file, so one that's too big doesn't sink the rest.
    mutationFn: async (files: File[]) => {
      const failed: string[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append("file", file);
        form.append("entity_type", entityType);
        form.append("entity_id", entityId);
        const response = await globalThis.fetch(new URL("/api/v1/attachments", globalThis.location?.origin), {
          method: "POST",
          body: form,
        });
        if (!response.ok) {
          const body: unknown = await response.json().catch(() => null);
          failed.push(`${file.name}: ${errorMessage(body)}`);
        }
      }
      if (failed.length) throw new Error(failed.join("; "));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: ["attachments", entityType, entityId] });
      if (entityType === "application") invalidateApplicationViews(qc); // "File added" on the timeline
    },
    onError: notifyError,
  });
}

export function useDeleteAttachment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/attachments/{attachment_id}", {
        params: { path: { attachment_id: id } },
      });
      if (error) throw new Error("Couldn't delete the file");
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["attachments"] }),
    onError: notifyError,
  });
}
