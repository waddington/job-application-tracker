import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, errorMessage, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";

export type DocumentItem = Schemas["DocumentOut"];
export type DocumentVersion = Schemas["VersionOut"];
export type SentDocument = Schemas["SentDocumentOut"];

export const KIND_LABEL: Record<string, string> = { cv: "CV", cover_letter: "Cover letter", other: "Other" };

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents"],
    queryFn: async () => unwrap(await api.GET("/api/v1/documents")),
  });
}

/** One document with where each version was used. */
export function useDocument(id: string | null) {
  return useQuery({
    queryKey: ["document", id],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/documents/{document_id}", { params: { path: { document_id: id! } } })),
    enabled: !!id,
  });
}

function useRefreshDocuments() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["documents"] });
    void qc.invalidateQueries({ queryKey: ["document"] });
    void qc.invalidateQueries({ queryKey: ["attachments"] }); // versions keep their files as attachments
    invalidateApplicationViews(qc); // applications list the versions they were sent with
  };
}

export function useCreateDocument() {
  const refresh = useRefreshDocuments();
  return useMutation({
    mutationFn: async (body: Schemas["DocumentIn"]) => unwrap(await api.POST("/api/v1/documents", { body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useDeleteDocument() {
  const refresh = useRefreshDocuments();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/documents/{document_id}", {
        params: { path: { document_id: id } },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}

/** Add a version: a label, optional notes and (usually) the file itself. */
export function useAddVersion(documentId: string) {
  const refresh = useRefreshDocuments();
  return useMutation({
    mutationFn: async (args: { label: string; notes?: string; file?: File | null }) => {
      const form = new FormData();
      form.append("label", args.label);
      if (args.notes) form.append("notes", args.notes);
      if (args.file) form.append("file", args.file);
      const url = new URL(`/api/v1/documents/${documentId}/versions`, globalThis.location?.origin);
      const response = await globalThis.fetch(url, { method: "POST", body: form });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(body));
      return body as DocumentVersion;
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useDeleteVersion() {
  const refresh = useRefreshDocuments();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/documents/versions/{version_id}", {
        params: { path: { version_id: id } },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useSendDocument(appId: string) {
  const refresh = useRefreshDocuments();
  return useMutation({
    mutationFn: async (body: Schemas["SentDocumentIn"]) =>
      unwrap(
        await api.POST("/api/v1/applications/{app_id}/documents", {
          params: { path: { app_id: appId } },
          body,
        }),
      ),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useUnsendDocument(appId: string) {
  const refresh = useRefreshDocuments();
  return useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await api.DELETE("/api/v1/applications/{app_id}/documents/{link_id}", {
        params: { path: { app_id: appId, link_id: linkId } },
      });
      if (error) throw new Error(errorMessage(error));
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}
