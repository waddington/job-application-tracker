import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { item, meeting, mockApi, roleSummary, row, todo, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const renderHome = () => renderAt("/");

/** The group (Your move, Coming up, Waiting on them) a heading sits in. */
const bucket = (name: string) =>
  screen.getByRole("heading", { level: 3, name }).closest("[id]") as HTMLElement;

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

describe("today: what to do", () => {
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
      '[role="group"]',
    ) as HTMLElement;
    expect(within(followUps).getByText("Fabrikam")).toBeInTheDocument();
    const quiet = screen
      .getByRole("heading", { name: "Gone quiet" })
      .closest('[role="group"]') as HTMLElement;
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
      app_text: "followed_up",
    });
    const outcome = screen
      .getByRole("heading", { name: "How did it go?" })
      .closest('[role="group"]') as HTMLElement;
    // Didn't happen asks what happened first; cancelling it changes nothing.
    fireEvent.click(within(outcome).getByRole("button", { name: /^Didn't happen:/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Cancel" }));
    // Done asks how it went, then saves the debrief with it.
    fireEvent.click(within(outcome).getByRole("button", { name: /^Done:/ }));
    fireEvent.change(await screen.findByLabelText("Debrief"), {
      target: { value: "  Went well, met the team " },
    });
    expect(calls.some((c) => c.method === "PATCH" && c.path.endsWith("/i0"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH" && c.path.endsWith("/i0"))?.body).toEqual({
        status: "done",
        debrief: "Went well, met the team",
        questions: null,
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
      "/api/v1/applications": [row({ id: "a1" })],
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
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({
        to_stage: "ghosted",
        app_note: "no_reply",
      }),
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
      "GET /api/v1/timeline": { items: [], now: "2026-09-30T10:00:00Z" },
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

const NOTHING = {
  follow_ups: [],
  stale: [],
  upcoming: [],
  awaiting_outcome: [],
  offer_deadlines: [],
  waiting: [],
  waiting_people: [],
  today: "2026-10-02",
};

describe("today: where things stand", () => {
  it("walks you through getting started when there are no applications", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [],
      "/api/v1/contacts": [],
      "/api/v1/next-actions": NOTHING,
      "/api/v1/timeline": { items: [], now: "2026-10-02T10:00:00Z" },
      "/api/v1/health": {},
    });
    renderHome();
    expect(await screen.findByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByText("Add an application")).toBeInTheDocument();
    // The header's (full and phone-sized) and the card's.
    expect(screen.getAllByRole("button", { name: "New application" })).toHaveLength(3);
  });

  it("before the first application, shows the roles, calls and people you have", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [],
      "/api/v1/contacts": [{ id: "c1", name: "Alex Morgan", details: [] }],
      "/api/v1/next-actions": {
        ...NOTHING,
        roles_to_decide: [roleSummary({ title: "Platform Engineer", company_name: "Fabrikam" })],
        meetings: [meeting()],
        meetings_to_close: [],
      },
      "/api/v1/timeline": {
        items: [
          item({ id: "contact:c1", category: "added", title: "Added Alex Morgan", application_id: null }),
        ],
        now: "2026-10-02T10:00:00Z",
      },
      "/api/v1/health": {},
    });
    renderHome();
    expect(
      await screen.findByText(
        /So far: 1 role to decide on, 1 call coming up, 1 person added\. Apply for one of the roles and/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Getting started" })).not.toBeInTheDocument();
    expect(within(bucket("Your move")).getByRole("heading", { name: "Roles to decide" })).toBeInTheDocument();
    expect(
      within(bucket("Coming up")).getByText("Call with Alex Morgan: Market catch-up"),
    ).toBeInTheDocument();
    // Setting things up is most of what's happened so far, so it shows under Recent activity.
    fireEvent.click(screen.getByRole("button", { name: "Recent activity" }));
    expect(await screen.findByText("Added Alex Morgan")).toBeInTheDocument();
  });

  it("doesn't flash the getting-started card while the rest is still loading", async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [],
      "/api/v1/contacts": [{ id: "c1", name: "Alex Morgan", details: [] }],
      "/api/v1/next-actions": NOTHING,
      "/api/v1/timeline": { items: [], now: "2026-10-02T10:00:00Z" },
      "/api/v1/health": {},
    });
    // Hold the people request back: until it answers, the page mustn't decide it's empty.
    const fetchMock = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/api/v1/contacts")) await held;
      return fetchMock(input, init);
    });
    renderHome();
    await screen.findByRole("heading", { level: 2, name: "Today" });
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole("heading", { name: "Getting started" })).not.toBeInTheDocument();
    release();
    expect(await screen.findByText(/So far: 1 person added\./)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Getting started" })).not.toBeInTheDocument();
  });

  it("puts each thing in one group: your move, coming up or waiting on them", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [
        row({ id: "a1", stage: "applied" }),
        row({ id: "a2", stage: "applied", company_name: "Fabrikam" }),
        row({ id: "a3", stage: "screen", company_name: "Litware" }),
      ],
      "/api/v1/contacts": [],
      "/api/v1/next-actions": {
        ...NOTHING,
        stale: [row({ id: "a2", company_name: "Fabrikam", days_since_activity: 12 })],
        waiting: [row({ id: "a3", company_name: "Litware", awaiting_reply_since: "2026-09-30" })],
        to_read: [row({ id: "a1", company_name: "Contoso", reply_to_read_since: "2026-10-01" })],
        // Due today, and one for next month: the first is yours to do now, the second comes up later.
        todos: [
          todo({ due_on: "2026-10-02" }),
          todo({ id: "t2", text: "Renew my portfolio", due_on: "2026-11-01" }),
        ],
        // A round with no date yet: coming up, but not an interview "in the next two weeks".
        upcoming: [
          {
            id: "i9",
            application_id: "a1",
            company_name: "Contoso",
            role_title: "Backend Engineer",
            round: 3,
            title: "System design test",
            kind: "system_design",
            label: "Round 3 · System design test",
            starts_at: null,
            deadline_at: null,
          },
        ],
      },
      "/api/v1/timeline": { items: [item()], now: "2026-10-02T10:00:00Z" },
      "/api/v1/health": {},
    });
    renderHome();
    // The numbers are one line; each group's heading carries its own count.
    expect(await screen.findByRole("link", { name: "3 active" })).toHaveAttribute("href", "/applications");
    expect(screen.getByRole("link", { name: "0 interviews in the next two weeks" })).toHaveAttribute(
      "href",
      "/interviews",
    );
    expect(screen.getByRole("link", { name: "0 offers to answer" })).toHaveAttribute("href", "/offers");
    // A reply to read and a to-do due today; waiting to hear back and gone quiet.
    expect(screen.getByLabelText("2 in Your move")).toBeInTheDocument();
    expect(screen.getByLabelText("2 in Waiting on them")).toBeInTheDocument();
    expect(screen.getByLabelText("2 in Coming up")).toBeInTheDocument();

    const move = bucket("Your move");
    expect(within(move).getByText("Contoso")).toBeInTheDocument();
    expect(within(move).getByText("Reply to their message")).toBeInTheDocument();
    expect(within(move).queryByText("Renew my portfolio")).not.toBeInTheDocument();

    const ahead = bucket("Coming up");
    expect(within(ahead).getByText("Renew my portfolio")).toBeInTheDocument();
    expect(within(ahead).getByText("Round 3 · System design test")).toBeInTheDocument();
    expect(within(ahead).getByText("Not booked yet")).toBeInTheDocument();

    const theirs = bucket("Waiting on them");
    expect(within(theirs).getByText("Litware")).toBeInTheDocument();
    expect(within(theirs).getByText("Fabrikam")).toBeInTheDocument();
    expect(within(theirs).getByText(/12 days ago/)).toBeInTheDocument();

    expect(screen.queryByText(/1970/)).not.toBeInTheDocument();
    expect(screen.getByText("Applied 2")).toBeInTheDocument();
    expect(screen.getByText("Screen 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Recent activity" }));
    expect(await screen.findByText("Call with Alex")).toBeInTheDocument();
    expect(screen.getByText("Full timeline").closest("a")).toHaveAttribute("href", "/timeline");
  });

  it("sends old Next actions links to Today", async () => {
    mockApi({ "/api/v1/workflow": WORKFLOW, "/api/v1/next-actions": NOTHING, "/api/v1/health": {} });
    const router = makeRouter(createMemoryHistory({ initialEntries: ["/next-actions"] }));
    render(<App router={router} />);
    expect(await screen.findByRole("heading", { level: 2, name: "Today" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/");
    expect(screen.queryByRole("link", { name: "Next actions" })).not.toBeInTheDocument();
  });

  it("says so when what's next can't load, but carries on without the rest", async () => {
    mockApi({ "/api/v1/workflow": WORKFLOW, "/api/v1/health": {} });
    renderHome();
    expect(await screen.findByText(/Couldn't load what's next/, {}, { timeout: 8000 })).toBeInTheDocument();
  }, 10000);

  it("shows the groups at once even if your applications, people and timeline don't load", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/next-actions": { ...NOTHING, todos: [todo()] },
      "/api/v1/health": {},
    });
    renderHome();
    expect(await screen.findByText("Reply to their message")).toBeInTheDocument();
    expect(screen.queryByText(/Couldn't load/)).not.toBeInTheDocument();
  });
});
