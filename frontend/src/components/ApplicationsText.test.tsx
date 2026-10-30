import { MantineProvider } from "@mantine/core";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import type { ApplicationRow } from "../api/client";
import type { Workflow } from "../api/hooks";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import { columnTitle, planDrop, splitByRound } from "../utils/board";
import { ApplicationLoadError } from "./ApplicationDrawer";
import { announcements } from "./Board";

// The applications area's text comes from locales/en/applications.ts (i18n-applications). A
// before/after snapshot of every page showed no change; these pin the strings that snapshot
// couldn't reach (drags, other routes and event kinds, states the demo data doesn't have).

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const detail = (overrides: Record<string, unknown> = {}) => ({
  ...row(),
  events: [],
  contacts: [],
  allowed_next: ["screen"],
  suggested_next: ["screen"],
  can_undo: false,
  documents: [],
  duplicates: [],
  ...overrides,
});

function showApplication(overrides: Record<string, unknown> = {}, more: Record<string, unknown> = {}) {
  mockApi({
    "/api/v1/workflow": WORKFLOW,
    "GET /api/v1/applications/a1": detail(overrides),
    "/api/v1/contacts": [],
    "/api/v1/roles": [],
    "/api/v1/documents": [],
    "/api/v1/health": {},
    ...more,
  });
  renderAt("/applications/a1");
}

/** The "Route: …" line's whole text. */
async function routeLine() {
  const label = await screen.findByText("Route:");
  return label.parentElement?.textContent;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("how an application came about", () => {
  it("names the recruiter and the agency", async () => {
    showApplication();
    expect(await routeLine()).toBe("Route: Through Alex Recruiter at Northwind Talent");
  });

  it("names whichever of the two it has", async () => {
    showApplication({ recruiter_id: null, recruiter_name: null });
    expect(await routeLine()).toBe("Route: Through Northwind Talent");
  });

  it("says an agency when it knows neither", async () => {
    showApplication({ recruiter_id: null, recruiter_name: null, agency_id: null, agency_name: null });
    expect(await routeLine()).toBe("Route: Through an agency");
  });

  it("links an in-house recruiter on a direct application", async () => {
    showApplication({ route: "direct", agency_id: null, agency_name: null });
    expect(await routeLine()).toBe("Route: Directly, via Alex Recruiter at Contoso");
    const line = (await screen.findByText("Route:")).parentElement as HTMLElement;
    expect(within(line).getByRole("link", { name: "Contoso" })).toHaveAttribute("href", "/companies/co1");
    expect(within(line).getByRole("link", { name: "Alex Recruiter" })).toHaveAttribute("href", "/people/c1");
  });

  it("says when to follow up", async () => {
    showApplication({ follow_up_on: "2026-11-05" });
    expect((await screen.findByText("Follow up on:")).parentElement?.textContent).toBe(
      "Follow up on: 5 Nov 2026",
    );
  });
});

describe("the application's timeline", () => {
  const event = (id: string, at: string, fields: Record<string, unknown>) => ({
    id,
    application_id: "a1",
    occurred_at: at,
    summary: null,
    from_stage: null,
    to_stage: null,
    data: {},
    ...fields,
  });

  it("titles each kind of event", async () => {
    showApplication({
      events: [
        event("e1", "2026-09-01T10:00:00Z", { kind: "stage_change", to_stage: "interested" }),
        event("e2", "2026-09-02T10:00:00Z", {
          kind: "stage_change",
          from_stage: "interested",
          to_stage: "applied",
        }),
        event("e3", "2026-09-03T10:00:00Z", {
          kind: "stage_change",
          from_stage: "applied",
          to_stage: "interested",
          data: { undo_of: "e2" },
        }),
        event("e4", "2026-09-04T10:00:00Z", { kind: "email" }),
        event("e5", "2026-09-05T10:00:00Z", { kind: "message" }),
        event("e6", "2026-09-06T10:00:00Z", { kind: "file" }),
        event("e7", "2026-09-07T10:00:00Z", { kind: "interview" }),
        event("e8", "2026-09-08T10:00:00Z", { kind: "manual" }),
        event("e9", "2026-09-09T10:00:00Z", { kind: "something_new" }),
      ],
    });
    const timeline = (await screen.findByRole("heading", { name: "Timeline" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    for (const title of [
      "Added as Interested",
      "Interested → Applied",
      "Undone: back to Interested",
      "Email",
      "Message",
      "File",
      "Interview",
      "Manual",
      "Something_new",
    ])
      expect(await within(timeline).findByText(title)).toBeInTheDocument();
  });

  it("names the kind on the log button", async () => {
    showApplication();
    expect(await screen.findByRole("button", { name: "Log call" })).toBeInTheDocument();
    for (const [kind, button] of [
      ["Email", "Log email"],
      ["Message", "Log message"],
      ["Note", "Log note"],
    ]) {
      fireEvent.click(screen.getByRole("radio", { name: kind }));
      expect(await screen.findByRole("button", { name: button })).toBeInTheDocument();
    }
    expect(screen.getByPlaceholderText("What happened?")).toBeInTheDocument();
  });
});

describe("the application page", () => {
  it("says it couldn't load the application", () => {
    const { rerender } = render(
      <MantineProvider>
        <ApplicationLoadError error={new Error("No such application")} />
      </MantineProvider>,
    );
    expect(screen.getByText("Couldn't load this application")).toBeInTheDocument();
    expect(screen.getByText("No such application")).toBeInTheDocument();
    rerender(
      <MantineProvider>
        <ApplicationLoadError error="gone" />
      </MantineProvider>,
    );
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });

  it("shows how the role is worked", async () => {
    showApplication(
      {},
      { "/api/v1/roles": [{ id: "r1", title: "Backend Engineer", work_mode: "office", url: null }] },
    );
    expect(await screen.findByText("Office")).toBeInTheDocument();
  });

  it("shows a work mode it doesn't know as it was saved", async () => {
    showApplication(
      {},
      { "/api/v1/roles": [{ id: "r1", title: "Backend Engineer", work_mode: "4-day week" }] },
    );
    expect(await screen.findByText("4-day week")).toBeInTheDocument();
  });

  it("names each linked person, and someone it can't find", async () => {
    showApplication(
      {
        contacts: [
          { id: "l1", application_id: "a1", contact_id: "c1", relation: "recruiter" },
          { id: "l2", application_id: "a1", contact_id: "gone", relation: "interviewer" },
        ],
      },
      {
        "/api/v1/contacts": [
          {
            id: "c1",
            name: "Alex Recruiter",
            title: null,
            agency_id: "ag1",
            company_id: null,
            details: [{ id: "d1", kind: "email", value: "alex@example.com", label: "work", position: 0 }],
          },
        ],
      },
    );
    expect(await screen.findByText("Recruiter (agency) · alex@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Alex Recruiter" })).toBeInTheDocument();
    expect(screen.getByText("Unknown contact")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove contact" })).toBeInTheDocument();
    expect(screen.getByText("Interviewer", { selector: "p" })).toBeInTheDocument();
  });

  it("asks before deleting, naming what goes with it", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    showApplication();
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(confirm).toHaveBeenCalledWith(
      "Delete your application to Contoso (Backend Engineer)? Its interviews, offer, timeline and record of documents sent go with it; notes and files stay. To keep it but hide it, archive it instead.",
    );
  });
});

describe("documents sent", () => {
  const sent = {
    id: "s1",
    version_id: "v3",
    document_name: "Main CV",
    version_label: "v3",
    kind: "cv",
    sent_on: "2026-10-06",
    file_url: null,
  };

  it("lists what was sent and when", async () => {
    showApplication(
      { documents: [sent] },
      {
        "/api/v1/documents": [
          {
            id: "d1",
            name: "Cover letter",
            kind: "cover_letter",
            versions: [{ id: "v9", label: "Fintech" }],
          },
        ],
      },
    );
    expect(await screen.findByText("CV · sent 6 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Main CV v3" })).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Remove Main CV v3" }));
    expect(await screen.findByText("Not sent with this one")).toBeInTheDocument();
    fireEvent.click(screen.getByPlaceholderText("Pick a CV or cover letter"));
    expect(await screen.findByText("Cover letter (Cover letter)")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Cover letter · Fintech", hidden: true })).toBeInTheDocument();
  });

  it("says what to record, and to add a CV first", async () => {
    showApplication();
    expect(
      await screen.findByText("Record which CV and cover letter you sent, so you know what they've seen."),
    ).toBeInTheDocument();
    const link = await screen.findByRole("link", { name: "Add your CV on the Documents page" });
    expect(link.parentElement?.textContent).toBe("Add your CV on the Documents page first.");
  });

  it("keeps the kind on its own when there's no date", async () => {
    showApplication({ documents: [{ ...sent, sent_on: null }] });
    expect(await screen.findByText("CV")).toBeInTheDocument();
  });
});

describe("New application", () => {
  it("asks for the agency or recruiter, and says when it's added", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [],
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [],
      "/api/v1/health": {},
      "/api/v1/applications/duplicates": [],
      "POST /api/v1/applications/quick": detail({
        id: "a9",
        role_title: "Data Engineer",
        company_name: "Fabrikam",
      }),
      "GET /api/v1/applications/a9": detail({ id: "a9" }),
    });
    renderAt("/applications");
    fireEvent.click((await screen.findAllByRole("button", { name: "New application" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("Through a recruiter"));
    fireEvent.change(within(dialog).getByLabelText("Company"), { target: { value: "Fabrikam" } });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "Data Engineer" } });
    fireEvent.change(within(dialog).getByLabelText("Job ad link"), { target: { value: "jobs.example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add application" }));
    expect(await within(dialog).findByText("Add the agency or recruiter")).toBeInTheDocument();
    expect(within(dialog).getByText("Links start with http:// or https://")).toBeInTheDocument();
    expect(within(dialog).getByText("New company: it's added for you")).toBeInTheDocument();

    fireEvent.change(within(dialog).getByLabelText("Job ad link"), { target: { value: "" } });
    fireEvent.change(within(dialog).getByLabelText("Recruiter"), { target: { value: "Jordan Lee" } });
    expect(within(dialog).getByText("New person: they're added for you")).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Agency"), {
      target: { value: "Blue Yonder Recruitment" },
    });
    expect(within(dialog).getByText("New agency: it's added for you")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Add application" }));
    expect(await screen.findByText("Application added")).toBeInTheDocument();
    expect(screen.getByText("Data Engineer at Fabrikam")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("says when the in-house person is new", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [],
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [],
      "/api/v1/health": {},
      "/api/v1/applications/duplicates": [],
    });
    renderAt("/applications");
    fireEvent.click((await screen.findAllByRole("button", { name: "New application" }))[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Who reached out? (optional)"), {
      target: { value: "Riley Chen" },
    });
    expect(within(dialog).getByText("New person at the company")).toBeInTheDocument();
  });
});

describe("the board", () => {
  const workflow = {
    ...WORKFLOW,
    stages: [
      ...WORKFLOW.stages,
      {
        id: "interviewing",
        name: "Interviewing",
        kind: "active",
        stale_after_days: 7,
        color: "violet",
        next: [],
        allowed_next: [],
        suggested_next: [],
      },
    ],
  } as unknown as Workflow;
  const card = (overrides: Record<string, unknown> = {}) => row(overrides) as unknown as ApplicationRow;

  it("titles round columns", () => {
    const columns = splitByRound([{ stage: workflow.stages[4]!, rows: [card({ stage: "interviewing" })] }]);
    expect(columns.map(columnTitle)).toEqual(["Interviewing · No round yet"]);
    expect(columnTitle({ ...columns[0]!, round: 2 })).toBe("Interviewing · Round 2");
  });

  it("explains a drop it won't make", () => {
    const applied = card();
    expect(planDrop(workflow, applied, "screen", "applied")).toEqual({ do: "move", to: "screen" });
    expect(planDrop(workflow, applied, "interested", "applied")).toEqual({
      do: "refuse",
      title: "That move isn't allowed",
      message: "Applied can't go to Interested.",
    });
    expect(planDrop(workflow, applied, "interviewing#round-2", "applied")).toEqual({
      do: "refuse",
      title: "Rounds go in order",
      message: "Drop it on Interviewing · No round yet; it moves along as you add its interview rounds.",
    });
    const interviewing = card({ stage: "interviewing" });
    expect(planDrop(workflow, interviewing, "interviewing#round-none", "interviewing#round-1")).toEqual({
      do: "refuse",
      title: "Rounds go in order",
      message:
        "A card's round comes from its interviews: add or finish a round on the application to move it along.",
    });
    expect(planDrop(workflow, applied, "applied", "applied")).toEqual({ do: "nothing" });
    expect(planDrop(workflow, applied, undefined, "applied")).toEqual({ do: "nothing" });
  });

  it("says where a card went when it leaves the active stages", () => {
    expect(planDrop(workflow, card(), "rejected", "applied")).toEqual({
      do: "move",
      to: "rejected",
      notice: "Contoso moved to Rejected",
    });
  });

  it("reads out a keyboard drag", () => {
    const say = announcements([card()], new Map([["screen", "Screen"]]));
    const active = { id: "a1" } as never;
    const over = { id: "screen" } as never;
    expect(say.onDragStart({ active })).toBe("Picked up Contoso. Use arrow keys to move, Space to drop.");
    expect(say.onDragOver({ active, over })).toBe("Contoso is over Screen.");
    expect(say.onDragOver({ active, over: null })).toBe("Contoso isn't over a stage.");
    expect(say.onDragEnd({ active, over })).toBe("Contoso dropped on Screen.");
    expect(say.onDragEnd({ active, over: null })).toBe("Contoso dropped.");
    expect(say.onDragCancel({ active, over: null })).toBe("Cancelled. Contoso stays where it was.");
    expect(announcements([], new Map()).onDragStart({ active })).toBe(
      "Picked up Application. Use arrow keys to move, Space to drop.",
    );
  });
});
