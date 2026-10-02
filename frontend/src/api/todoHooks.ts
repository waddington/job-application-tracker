import { notifications } from "@mantine/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

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

/** To-dos: open ones by default, dated first (soonest first), then the rest oldest first. */
export function useTodos(filters: TodoFilters = {}) {
  return useQuery({
    queryKey: ["todos", filters],
    queryFn: async () => unwrap(await api.GET("/api/v1/todos", { params: { query: filters } })),
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

export function useDeleteTodo() {
  const refresh = useRefreshTodos();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await api.DELETE("/api/v1/todos/{todo_id}", { params: { path: { todo_id: id } } });
      if (error) throw new Error("Couldn't delete the to-do");
    },
    onSuccess: refresh,
    onError: notifyError,
  });
}
