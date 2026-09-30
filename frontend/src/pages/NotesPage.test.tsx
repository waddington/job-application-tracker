import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const note = (overrides: Record<string, unknown> = {}) => ({
  id: "n1",
  title: "Call with Alex",
  links: ["application:a1"],
  path: "2026/09/n1-call-with-alex.md",
  excerpt: "Salary £650/day",
  created_at: "2026-09-29T10:00:00Z",
  updated_at: "2026-09-29T10:00:00Z",
  ...overrides,
});
const detail = {
  ...row(),
  events: [],
  contacts: [],
  allowed_next: [],
  suggested_next: [],
  can_undo: false,
  duplicates: [],
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("notes", () => {
  it("shows an application's notes as Markdown and adds one linked to it", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail,
      "GET /api/v1/notes": [note()],
      "GET /api/v1/notes/n1": {
        ...note(),
        body: "## Salary\n\n**£650/day**, outside IR35\n\n<script>alert(1)</script>\n",
      },
      "POST /api/v1/notes": note({ id: "n2", title: "Prep" }),
      "/api/v1/interviews": [],
      "/api/v1/applications": [],
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [],
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    const card = (await screen.findByRole("heading", { name: "Notes" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(calls.some((c) => c.path === "/api/v1/notes?entity=application%3Aa1")).toBe(true);
    expect(await within(card).findByText("Salary £650/day")).toBeInTheDocument();

    fireEvent.click(within(card).getByRole("button", { name: /^Call with Alex/ }));
    expect(await within(card).findByRole("heading", { name: "Salary" })).toBeInTheDocument();
    expect(within(card).getByText("£650/day").tagName).toBe("STRONG");
    expect(card.querySelector("script")).toBeNull(); // raw HTML is never rendered

    fireEvent.click(within(card).getByRole("button", { name: "Add note" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Title"), { target: { value: "Prep" } });
    fireEvent.change(within(dialog).getByLabelText("Note"), { target: { value: "- queues\n- caching" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add note" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST" && c.path === "/api/v1/notes")?.body).toEqual({
        title: "Prep",
        body: "- queues\n- caching",
        links: ["application:a1"],
      }),
    );
  });

  it("lists and searches every note, or just general ones", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/notes": (url: URL) =>
        url.searchParams.get("entity") === "none"
          ? [note({ id: "g1", title: "Job search plan", links: [] })]
          : [note(), note({ id: "g1", title: "Job search plan", links: [] })],
      "/api/v1/health": {},
    });
    renderAt("/notes");
    expect(await screen.findByText("Call with Alex")).toBeInTheDocument();
    expect(screen.getByText("Job search plan")).toBeInTheDocument();

    fireEvent.click(screen.getByText("General only"));
    await waitFor(() => expect(screen.queryByText("Call with Alex")).not.toBeInTheDocument());

    fireEvent.change(screen.getByLabelText("Search notes"), { target: { value: "plan" } });
    await waitFor(() => expect(calls.some((c) => c.path.includes("q=plan"))).toBe(true));
  });
});
