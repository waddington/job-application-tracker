import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const round2 = {
  id: "i2",
  round: 2,
  title: "Engineering manager chat",
  kind: "hiring_manager",
  status: "scheduled",
  label: "Round 2 · Engineering manager chat",
  starts_at: new Date(Date.now() + 2 * 86_400_000).toISOString(), // in two days
  deadline_at: null,
};
const interview = (overrides: Record<string, unknown> = {}) => ({
  ...round2,
  application_id: "a1",
  ends_at: null,
  format: "video",
  location: null,
  meeting_url: "https://meet.example.com/abc",
  prep: null,
  debrief: null,
  questions: null,
  task_instructions: null,
  task_repo_url: null,
  interviewer_ids: ["c1"],
  company_name: "Contoso",
  role_title: "Backend Engineer",
  created_at: "2026-09-25T10:00:00Z",
  updated_at: "2026-09-25T10:00:00Z",
  ...overrides,
});
const screenRound = interview({
  id: "i1",
  round: 1,
  title: "Recruiter screen",
  kind: "screen",
  status: "done",
  label: "Round 1 · Recruiter screen",
  starts_at: new Date(Date.now() - 6 * 86_400_000).toISOString(),
  debrief: "Friendly, salary range confirmed.",
});
const detail = {
  ...row({ stage: "interviewing", stage_name: "Interviewing", current_round: round2 }),
  events: [],
  contacts: [],
  allowed_next: [],
  can_undo: false,
  duplicates: [],
};
const contacts = [
  {
    id: "c1",
    name: "Riley Chen",
    title: null,
    agency_id: null,
    company_id: "co1",
    details: [],
    created_at: "",
    updated_at: "",
  },
];

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("interviews", () => {
  it("lists an application's rounds and adds the next one", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail,
      "/api/v1/interviews": [interview(), screenRound],
      "/api/v1/interviews/titles": ["System design test", "Recruiter screen"],
      "POST /api/v1/applications/a1/interviews": interview({ id: "i3", round: 3 }),
      "/api/v1/contacts": contacts,
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    const card = (await screen.findByRole("heading", { name: "Interviews" })).closest(".mantine-Card-root")!;
    const items = await within(card as HTMLElement).findAllByText(/^Round \d · /);
    expect(items.map((i) => i.textContent)).toEqual([
      "Round 1 · Recruiter screen",
      "Round 2 · Engineering manager chat",
    ]);
    expect(within(card as HTMLElement).getAllByText(/with Riley Chen/)).toHaveLength(2);
    expect(within(card as HTMLElement).getByText("Friendly, salary range confirmed.")).toBeInTheDocument();
    // The header shows where the application is up to, with the date of the next round.
    expect(screen.getByText(/^Round 2 · Engineering manager chat · \w+/)).toBeInTheDocument();

    fireEvent.click(within(card as HTMLElement).getByRole("button", { name: "Add round 3" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Round")).toHaveValue("3");
    fireEvent.change(within(dialog).getByLabelText("What is it?"), {
      target: { value: "System design test" },
    });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add round" }));
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/applications/a1/interviews");
      expect(post?.body).toMatchObject({
        round: 3,
        title: "System design test",
        kind: "technical",
        status: "scheduled",
        interviewer_ids: [],
      });
    });
  });

  it("shows the current round in the applications list", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [
        row({ stage: "interviewing", stage_name: "Interviewing", current_round: round2 }),
        // After an offer the last round is history: no badge.
        row({
          id: "a2",
          company_name: "Fabrikam",
          stage: "offer",
          stage_name: "Offer",
          stage_kind: "success",
          current_round: { ...round2, id: "i9", label: "Round 3 · Final", status: "done" },
        }),
      ],
      "/api/v1/health": {},
    });
    renderAt("/applications");
    expect(await screen.findByText(/^Round 2 · Engineering manager chat · /)).toBeInTheDocument();
    expect(screen.getByText("Fabrikam")).toBeInTheDocument();
    expect(screen.queryByText(/Round 3 · Final/)).not.toBeInTheDocument();
  });

  it("marks a past round that's still scheduled as awaiting outcome", async () => {
    const past = interview({ starts_at: new Date(Date.now() - 86_400_000).toISOString() });
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/interviews": (url: URL) => (url.searchParams.get("upcoming") ? [] : [past]),
      "/api/v1/health": {},
    });
    renderAt("/interviews");
    expect(await screen.findByText("Awaiting outcome")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing booked. Add interview rounds from an application's page."),
    ).toBeInTheDocument();
  });

  it("lists upcoming and earlier interviews across applications", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/interviews": (url: URL) =>
        url.searchParams.get("upcoming") ? [interview()] : [screenRound, interview()],
      "/api/v1/health": {},
    });
    renderAt("/interviews");
    const upcoming = (await screen.findByRole("heading", { name: "Coming up" })).closest(
      ".mantine-Card-root",
    )!;
    expect(
      await within(upcoming as HTMLElement).findByText("Round 2 · Engineering manager chat"),
    ).toBeInTheDocument();
    expect(within(upcoming as HTMLElement).getByRole("link", { name: "Contoso" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    const earlier = screen
      .getByRole("heading", { name: "Earlier and cancelled" })
      .closest(".mantine-Card-root")!;
    expect(await within(earlier as HTMLElement).findByText("Round 1 · Recruiter screen")).toBeInTheDocument();
  });
});
