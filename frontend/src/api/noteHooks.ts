import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap, type Schemas } from "./client";
import { invalidateApplicationViews } from "./hooks";

export type NoteSummary = Schemas["NoteSummary"];
export type Note = Schemas["NoteOut"];

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

/** Notes, newest first. `entity` is "application:<id>", "company:<id>"…, or "none" for general notes. */
export function useNotes(filters: { entity?: string; q?: string }) {
  const query = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
  return useQuery({
    queryKey: ["notes", query],
    queryFn: async () => unwrap(await api.GET("/api/v1/notes", { params: { query } })),
    placeholderData: (previous) => previous,
  });
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: ["note", id],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/notes/{note_id}", { params: { path: { note_id: id! } } })),
    enabled: !!id,
  });
}

function useRefreshNotes() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["notes"] });
    void qc.invalidateQueries({ queryKey: ["note"] });
    invalidateApplicationViews(qc); // notes on an application go on its timeline
  };
}

export function useSaveNote() {
  const refresh = useRefreshNotes();
  return useMutation({
    mutationFn: async (args: { id?: string; body: Schemas["NoteIn"] }) =>
      args.id
        ? unwrap(
            await api.PATCH("/api/v1/notes/{note_id}", {
              params: { path: { note_id: args.id } },
              body: args.body,
            }),
          )
        : unwrap(await api.POST("/api/v1/notes", { body: args.body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useDeleteNote() {
  const refresh = useRefreshNotes();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/notes/{note_id}", { params: { path: { note_id: id } } });
      if (error) throw new Error("Couldn't delete the note");
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}
