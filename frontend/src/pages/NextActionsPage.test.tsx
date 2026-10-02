import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, todo, WORKFLOW } from "../test/mockApi";

function renderHome() {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/next-actions"] }))} />);
}

const interview = (overrides: Record<string, unknown> = {}) => ({
  id: "i1",
  round: 2,
  title: "System design test",
  kind: "system_design",
  status: "scheduled",
  label: "Round 2 · System design test",
  starts_at: "2026-10-02T13:00:00Z",
  deadline_at: null,
  application_id: "a1",
  ends_at: null,
  format: null,
  location: null,
  meeting_url: null,
  prep: null,
  debrief: null,
  questions: null,
  task_instructions: null,
  task_repo_url: null,
  interviewer_ids: [],
  company_name: "Contoso",
  role_title: "Backend Engineer",
  created_at: "2026-09-25T10:00:00Z",
  updated_at: "2026-09-25T10:00:00Z",
  ...overrides,
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("next actions", () => {
  it("shows what to chase, what's coming up and what needs an outcome", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/next-actions": {
        follow_ups: [row({ id: "a2", company_name: "Fabrikam", follow_up_on: "2026-09-30" })],
        stale: [row({ id: "a3", company_name: "Litware", days_since_activity: 12 })],
        upcoming: [interview()],
        awaiting_outcome: [
          interview({
            id: "i0",
            round: 1,
            label: "Round 1 · Recruiter screen",
            starts_at: "2026-09-29T09:00:00Z",
          }),
        ],
        today: "2026-09-30",
      },
      "PATCH /api/v1/applications/a2": row({ id: "a2" }),
      "POST /api/v1/applications/a2/activities": {
        id: "e1",
        application_id: "a2",
        kind: "manual",
        occurred_at: "2026-09-30T10:00:00Z",
        from_stage: null,
        to_stage: null,
        summary: "Followed up",
        data: {},
        created_at: "2026-09-30T10:00:00Z",
      },
      "PATCH /api/v1/interviews/i0": interview({ id: "i0", status: "done" }),
      "/api/v1/health": {},
    });
    renderHome();
    const followUps = (await screen.findByRole("heading", { name: "Follow up" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(within(followUps).getByText("Fabrikam")).toBeInTheDocument();
    const quiet = screen
      .getByRole("heading", { name: "Gone quiet" })
      .closest(".mantine-Card-root") as HTMLElement;
    expect(within(quiet).getByText("Litware")).toBeInTheDocument();
    expect(within(quiet).getByText(/12 days ago/)).toBeInTheDocument();
    expect(screen.getByText("Round 2 · System design test")).toBeInTheDocument();

    // The request asks for "today" from local midnight.
    const request = calls.find((c) => c.path.startsWith("/api/v1/next-actions"))!;
    expect(new URL(request.path, "http://x").searchParams.get("since")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(new URL(request.path, "http://x").searchParams.get("today")).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    fireEvent.click(within(followUps).getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH" && c.path.endsWith("/a2"))?.body).toEqual({
        follow_up_on: null,
      }),
    );
    // Chasing counts as activity, so it doesn't land in "Gone quiet" straight away.
    expect(calls.find((c) => c.path.endsWith("/a2/activities"))?.body).toMatchObject({
      summary: "Followed up",
    });
    const outcome = screen
      .getByRole("heading", { name: "How did it go?" })
      .closest(".mantine-Card-root") as HTMLElement;
    fireEvent.click(within(outcome).getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH" && c.path.endsWith("/i0"))?.body).toEqual({
        status: "done",
      }),
    );
  });

  it("says when there's nothing to do", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/next-actions": {
        follow_ups: [],
        stale: [],
        upcoming: [],
        awaiting_outcome: [],
        today: "2026-09-30",
      },
      "/api/v1/health": {},
    });
    renderHome();
    expect(await screen.findByText("All caught up")).toBeInTheDocument();
  });

  it("snoozes, sets a follow-up or marks a quiet application ghosted in one click", async () => {
    const ghosted = {
      id: "ghosted",
      name: "Ghosted",
      kind: "closed",
      stale_after_days: null,
      color: "dark",
      next: [],
      allowed_next: [],
      suggested_next: [],
    };
    vi.stubGlobal("confirm", () => true);
    const calls = mockApi({
      "/api/v1/workflow": { ...WORKFLOW, transitions: "any", stages: [...WORKFLOW.stages, ghosted] },
      "/api/v1/next-actions": {
        follow_ups: [],
        stale: [row({ id: "a3", company_name: "Litware", days_since_activity: 12 })],
        upcoming: [],
        awaiting_outcome: [],
        today: "2026-09-30",
      },
      "PATCH /api/v1/applications/a3": row({ id: "a3" }),
      "POST /api/v1/applications/a3/move": { ...row({ id: "a3", stage: "ghosted" }), events: [] },
      "/api/v1/health": {},
    });
    renderHome();
    fireEvent.click(await screen.findByRole("button", { name: "Snooze Litware" }));
    fireEvent.click(await screen.findByText("1 week"));
    await waitFor(() => {
      const patch = calls.find((c) => c.method === "PATCH");
      expect((patch?.body as { snoozed_until: string }).snoozed_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    fireEvent.click(screen.getByRole("button", { name: "Follow up on Litware" }));
    fireEvent.click(await screen.findByText("Tomorrow"));
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(2));
    expect(calls.filter((c) => c.method === "PATCH")[1]!.body).toHaveProperty("follow_up_on");

    fireEvent.click(screen.getByRole("button", { name: "Mark Litware as Ghosted" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({ to_stage: "ghosted", note: "No reply" }),
    );
  });

  it("only offers Ghosted where the workflow allows that move", async () => {
    const ghosted = {
      id: "ghosted",
      name: "Ghosted",
      kind: "closed",
      stale_after_days: null,
      color: "dark",
      next: [],
      allowed_next: [],
      suggested_next: [],
    };
    mockApi({
      // Configured transitions, and "applied" can't go to "ghosted".
      "/api/v1/workflow": { ...WORKFLOW, transitions: "configured", stages: [...WORKFLOW.stages, ghosted] },
      "/api/v1/next-actions": {
        follow_ups: [],
        stale: [row({ id: "a3", company_name: "Litware", stage: "applied" })],
        upcoming: [],
        awaiting_outcome: [],
        today: "2026-09-30",
      },
      "/api/v1/health": {},
    });
    renderHome();
    expect(await screen.findByRole("button", { name: "Snooze Litware" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /as Ghosted/ })).not.toBeInTheDocument();
  });

  it("lists your to-dos and adds one about a person", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/next-actions": {
        follow_ups: [],
        stale: [],
        upcoming: [],
        awaiting_outcome: [],
        todos: [
          todo({ due_on: "2026-09-29" }),
          todo({ id: "t2", text: "Update my CV", entity_type: null, entity_id: null, about: null }),
        ],
        today: "2026-09-30",
      },
      "GET /api/v1/contacts": [{ id: "c2", name: "Riley Chen", details: [] }],
      "GET /api/v1/companies": [],
      "GET /api/v1/agencies": [],
      "GET /api/v1/role-summaries": [],
      "GET /api/v1/applications": [],
      "POST /api/v1/todos": todo({ id: "t3" }),
      "GET /api/v1/todos": [todo({ id: "t9", text: "Update my portfolio", done_at: "2026-09-29T10:00:00Z" })],
      "/api/v1/health": {},
    });
    renderHome();
    expect(await screen.findByText("Reply to their message")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alex Morgan" })).toHaveAttribute("href", "/people/c1");
    expect(screen.getByText(/^Overdue/)).toBeInTheDocument();
    expect(screen.getByText("Update my CV")).toBeInTheDocument();
    // Only to-dos: you're not "all caught up".
    expect(screen.queryByText("All caught up")).not.toBeInTheDocument();
    // Ticked-off ones can be found again.
    fireEvent.click(screen.getByRole("button", { name: "Done recently" }));
    expect(await screen.findByRole("checkbox", { name: "Update my portfolio" })).toBeChecked();

    fireEvent.change(screen.getByLabelText("New to-do"), { target: { value: "They messaged me: reply" } });
    fireEvent.click(screen.getAllByLabelText("About")[0]!);
    fireEvent.click(await screen.findByRole("option", { name: "Riley Chen", hidden: true }));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({
        text: "They messaged me: reply",
        due_on: null,
        entity_type: "contact",
        entity_id: "c2",
      }),
    );
  });
});
