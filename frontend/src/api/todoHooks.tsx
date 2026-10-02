import { Button, Group, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useToday } from "../utils/useToday";
import { api, unwrap, type Schemas } from "./client";

export type Todo = Schemas["TodoOut"];
export type TodoAbout = NonNullable<Schemas["TodoIn"]["entity_type"]>;

export interface TodoFilters {
  entity_type?: TodoAbout;
  entity_id?: string;
  status?: "open" | "done" | "all";
}

function notifyError(error: Error) {
  notifications.show({ color: "red", title: "That didn't work", message: error.message });
}

/**
 * To-dos, open ones by default, in Next actions' order: due in the next two weeks (overdue
 * first), then undated, then later; ticked-off ones after, most recently done first.
 */
export function useTodos(filters: TodoFilters = {}, enabled = true) {
  const today = useToday(); // your local day decides what's "in the next two weeks"
  return useQuery({
    queryKey: ["todos", filters, today],
    queryFn: async () => unwrap(await api.GET("/api/v1/todos", { params: { query: { ...filters, today } } })),
    enabled,
  });
}

/** Where a to-do's subject lives in the app (a role opens its company's page). */
export function todoPath(todo: Todo): string | null {
  switch (todo.entity_type) {
    case "application":
      return `/applications/${todo.entity_id}`;
    case "company":
      return `/companies/${todo.entity_id}`;
    case "agency":
      return `/agencies/${todo.entity_id}`;
    case "contact":
      return `/people/${todo.entity_id}`;
    case "role":
      return todo.company_id ? `/companies/${todo.company_id}` : "/roles";
    default:
      return null;
  }
}

function useRefreshTodos() {
  const qc = useQueryClient();
  return () => {
    for (const key of [["todos"], ["next-actions"], ["search"]]) void qc.invalidateQueries({ queryKey: key });
  };
}

/** "Ticked off: …" or "Deleted: …", with an Undo button. */
function notifyUndo(message: string, undo: () => Promise<unknown>) {
  const id = notifications.show({
    message: (
      <Group justify="space-between" wrap="nowrap" gap="xs">
        <Text size="sm" truncate="end">
          {message}
        </Text>
        <Button
          size="compact-xs"
          variant="light"
          onClick={() => {
            notifications.hide(id);
            void undo();
          }}
        >
          Undo
        </Button>
      </Group>
    ),
  });
}

export function useAddTodo() {
  const refresh = useRefreshTodos();
  return useMutation({
    mutationFn: async (body: Schemas["TodoIn"]) => unwrap(await api.POST("/api/v1/todos", { body })),
    onSuccess: refresh,
    onError: notifyError,
  });
}

export function useUpdateTodo() {
  const refresh = useRefreshTodos();
  return useMutation({
    mutationFn: async (args: { id: string; body: Schemas["TodoPatch"] }) =>
      unwrap(
        await api.PATCH("/api/v1/todos/{todo_id}", {
          params: { path: { todo_id: args.id } },
          body: args.body,
        }),
      ),
    onSuccess: refresh,
    onError: notifyError,
  });
}

/** Tick a to-do off (or back on). Ticking off offers an Undo, since it leaves the list. */
export function useTickTodo() {
  const refresh = useRefreshTodos();
  const setDone = async (id: string, done: boolean) =>
    unwrap(await api.PATCH("/api/v1/todos/{todo_id}", { params: { path: { todo_id: id } }, body: { done } }));
  return useMutation({
    mutationFn: (args: { todo: Todo; done: boolean }) => setDone(args.todo.id, args.done),
    onSuccess: (_data, { todo, done }) => {
      refresh();
      if (done) notifyUndo(`Ticked off: ${todo.text}`, () => setDone(todo.id, false).then(refresh));
    },
    onError: notifyError,
  });
}

/** Delete a to-do, with an Undo that adds it back (as it was, about the same thing). */
export function useDeleteTodo() {
  const refresh = useRefreshTodos();
  return useMutation({
    mutationFn: async (todo: Todo) => {
      const { error } = await api.DELETE("/api/v1/todos/{todo_id}", {
        params: { path: { todo_id: todo.id } },
      });
      if (error) throw new Error("Couldn't delete the to-do");
    },
    onSuccess: (_data, todo) => {
      refresh();
      notifyUndo(`Deleted: ${todo.text}`, async () => {
        const body = {
          text: todo.text,
          due_on: todo.due_on,
          entity_type: todo.entity_type,
          entity_id: todo.entity_id,
        };
        const added = unwrap(await api.POST("/api/v1/todos", { body: body as Schemas["TodoIn"] }));
        if (todo.done_at)
          await api.PATCH("/api/v1/todos/{todo_id}", {
            params: { path: { todo_id: added.id } },
            body: { done: true },
          });
        refresh();
      });
    },
    onError: notifyError,
  });
}
