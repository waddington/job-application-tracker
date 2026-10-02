import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, todo } from "../test/mockApi";
import { dueLabel, TodosCard } from "./Todos";

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // TodoLine links to what a to-do is about, so it needs a router around it.
  const router = createRouter({
    routeTree: createRootRoute({ component: () => <TodosCard entityType="contact" entityId="c1" /> }),
    history: createMemoryHistory(),
  });
  render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("to-dos", () => {
  it("lists a person's to-dos, ticks one off and adds another", async () => {
    const calls = mockApi({
      "GET /api/v1/todos": [todo(), todo({ id: "t0", text: "Send my CV", done_at: "2026-10-01T09:00:00Z" })],
      "PATCH /api/v1/todos/t1": todo({ done_at: "2026-10-02T09:00:00Z" }),
      "POST /api/v1/todos": todo({ id: "t2", text: "Ask about rates" }),
      "DELETE /api/v1/todos/t0": {},
    });
    renderCard();
    expect(await screen.findByText("Reply to their message")).toBeInTheDocument();
    expect(calls[0]!.path).toBe("/api/v1/todos?entity_type=contact&entity_id=c1&status=all");
    // Done ones stay in view, ticked, so you can untick one ticked by mistake.
    expect(screen.getByRole("checkbox", { name: "Not done: Send my CV" })).toBeChecked();

    fireEvent.click(screen.getByRole("checkbox", { name: "Done: Reply to their message" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")).toMatchObject({
        path: "/api/v1/todos/t1",
        body: { done: true },
      }),
    );

    fireEvent.change(screen.getByLabelText("New to-do"), { target: { value: "  Ask about rates " } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({
        text: "Ask about rates",
        due_on: null,
        entity_type: "contact",
        entity_id: "c1",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete to-do: Send my CV" }));
    await waitFor(() => expect(calls.some((c) => c.method === "DELETE")).toBe(true));
  });

  it("edits a to-do's words and date", async () => {
    const calls = mockApi({
      "GET /api/v1/todos": [todo({ due_on: "2026-10-05" })],
      "PATCH /api/v1/todos/t1": todo({ text: "Reply to Alex" }),
    });
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Edit to-do: Reply to their message" }));
    fireEvent.change(screen.getByLabelText("What needs doing"), { target: { value: "Reply to Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Save to-do" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        text: "Reply to Alex",
        due_on: "2026-10-05",
      }),
    );
  });

  it("says when a to-do is due", () => {
    expect(dueLabel("2026-10-01", "2026-10-02").color).toBe("red");
    expect(dueLabel("2026-10-01", "2026-10-02").label).toMatch(/^Overdue/);
    expect(dueLabel("2026-10-02", "2026-10-02").label).toBe("Today");
    expect(dueLabel("2026-10-03", "2026-10-02").label).toBe("Tomorrow");
    expect(dueLabel("2026-10-09", "2026-10-02").label).toMatch(/^By /);
  });
});
