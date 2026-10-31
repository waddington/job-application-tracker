import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { i18n } from "../i18n";
import { api, ApiError, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";
import { errorText, notifyError } from "./notifyError";

export type AttachmentItem = Schemas["AttachmentOut"];

export function useAttachments(entityType: string, entityId: string, enabled = true) {
  return useQuery({
    queryKey: ["attachments", entityType, entityId],
    enabled,
    queryFn: async () =>
      unwrap(
        await api.GET("/api/v1/attachments", {
          params: { query: { entity_type: entityType, entity_id: entityId } },
        }),
      ),
  });
}

/** Every role's files in one request, for the paperclips on role rows. */
export function useRoleFiles() {
  return useQuery({
    queryKey: ["attachments", "role", "*"],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/attachments", { params: { query: { entity_type: "role" } } })),
  });
}

/** Upload files onto one thing, one request per file, so one that's too big doesn't sink the rest. */
export async function uploadFiles(files: File[], entityType: string, entityId: string) {
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
      failed.push(
        i18n.t("errors:uploadFileFailed", { name: file.name, reason: errorText(new ApiError(body)) }),
      );
    }
  }
  if (failed.length) throw new Error(failed.join(i18n.t("errors:uploadFailedSeparator")));
}

function useRefreshFiles() {
  const qc = useQueryClient();
  return (entityType: string) => {
    // ["attachments", type] covers one thing's files and every role's at once.
    void qc.invalidateQueries({ queryKey: ["attachments", entityType] });
    void qc.invalidateQueries({ queryKey: ["search"] });
    if (entityType === "application") {
      invalidateApplicationViews(qc); // "File added" on the timeline
      void qc.invalidateQueries({ queryKey: ["attachments", "cv-files"] }); // a CV file to make a version
    }
  };
}

export function useUploadAttachments(entityType: string, entityId: string) {
  const refresh = useRefreshFiles();
  return useMutation({
    mutationFn: (files: File[]) => uploadFiles(files, entityType, entityId),
    onSettled: () => refresh(entityType),
    onError: notifyError,
  });
}

/** The same, for a thing that's only just been made (a new role's job description). */
export function useUploadFilesTo() {
  const refresh = useRefreshFiles();
  return useMutation({
    mutationFn: (args: { files: File[]; entityType: string; entityId: string }) =>
      uploadFiles(args.files, args.entityType, args.entityId),
    onSettled: (_data, _error, args) => refresh(args.entityType),
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
      if (error) throw new Error(i18n.t("errors:own.deleteFile"));
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["attachments"] });
      void qc.invalidateQueries({ queryKey: ["search"] });
    },
    onError: notifyError,
  });
}
