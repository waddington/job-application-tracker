import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderHome() {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/"] }))} />);
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

    fireEvent.click(within(followUps).getByRole("button", { name: "Done" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH" && c.path.endsWith("/a2"))?.body).toEqual({
        follow_up_on: null,
      }),
    );
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
});
