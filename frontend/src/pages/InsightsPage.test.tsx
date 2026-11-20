import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, mockApiAnswering } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const node = (id: string, name: string, kind: string, color: string, reached: number, current: number) => ({
  id,
  name,
  kind,
  color,
  reached,
  current,
});

const FLOW = {
  applications: 3,
  nodes: [
    node("applied", "Applied", "active", "blue", 3, 1),
    node("screen", "Screen", "active", "cyan", 2, 0),
    node("offer", "Offer", "success", "green", 1, 1),
    node("rejected", "Rejected", "closed", "red", 1, 1),
  ],
  links: [
    { source: "applied", target: "screen", value: 2 },
    { source: "screen", target: "offer", value: 1 },
    { source: "screen", target: "rejected", value: 1 },
  ],
};

const WHOLE = {
  applications: 4,
  nodes: [
    node("source:recruiter", "Through a recruiter", "active", "indigo", 3, 0),
    node("source:found", "You found it", "active", "teal", 1, 0),
    node("interested", "Interested", "active", "gray", 3, 0),
    node("applied", "Applied", "active", "blue", 2, 2),
    node("deciding", "Deciding whether to apply", "holding", "yellow", 1, 0),
    node("holding:applied", "Waiting to hear back", "holding", "blue", 2, 0),
    node("passed", "Decided not to apply", "outcome", "gray", 1, 1),
  ],
  links: [
    { source: "source:recruiter", target: "interested", value: 2 },
    { source: "source:recruiter", target: "passed", value: 1 },
    { source: "source:found", target: "interested", value: 1 },
    { source: "interested", target: "applied", value: 2 },
    { source: "interested", target: "deciding", value: 1 },
    { source: "applied", target: "holding:applied", value: 2 },
  ],
};

const stage = (id: string, name: string, kind: string, extra: Record<string, unknown>) => ({
  id,
  name,
  kind,
  color: "blue",
  reached: 0,
  moved_on: 0,
  conversion: null,
  median_days: null,
  stays: 0,
  ...extra,
});

const STATS = {
  applications: 3,
  stages: [
    stage("applied", "Applied", "active", {
      reached: 3,
      moved_on: 2,
      conversion: 0.667,
      median_days: 4.5,
      stays: 2,
    }),
    stage("screen", "Screen", "active", {
      reached: 2,
      moved_on: 1,
      conversion: 0.5,
      median_days: 0.2,
      stays: 2,
    }),
    stage("offer", "Offer", "success", { reached: 1 }),
    stage("rejected", "Rejected", "closed", { reached: 1 }),
  ],
  routes: [
    { route: "direct", applications: 2, reached: { applied: 2, screen: 1, offer: 1 } },
    { route: "agency", applications: 1, reached: { applied: 1, screen: 1, rejected: 1 } },
  ],
};

const week = (
  start: string,
  counts: Partial<Record<"added" | "applied" | "moves" | "interviews" | "calls" | "pitched", number>>,
) => ({
  start,
  added: 0,
  applied: 0,
  moves: 0,
  interviews: 0,
  calls: 0,
  pitched: 0,
  ...counts,
});

const ACTIVITY = [
  week("2026-09-21", { added: 2, applied: 1, calls: 2, pitched: 3 }),
  week("2026-09-28", { moves: 3, interviews: 1 }),
];

const score = (overrides: Record<string, unknown>) => ({
  agency_id: null,
  agency_name: null,
  interviewed: 0,
  active: 0,
  success: 0,
  closed: 0,
  ghosted: 0,
  median_first_update_days: null,
  last_contact: null,
  ...overrides,
});

const SCORECARD = {
  recruiters: [
    score({
      id: "c1",
      name: "Alex Recruiter",
      agency_id: "ag1",
      agency_name: "Northwind Talent",
      roles: 4,
      interviewed: 2,
      active: 2,
      ghosted: 1,
      closed: 1,
      median_first_update_days: 2.5,
      last_contact: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    }),
    score({ id: "c2", name: "Sam Recruiter", roles: 1, active: 1, median_first_update_days: 0.2 }),
  ],
  agencies: [score({ id: "ag1", name: "Northwind Talent", roles: 5, interviewed: 2, active: 3, ghosted: 1 })],
};

const tally = (overrides: Record<string, unknown> = {}) => ({
  calls_held: 0,
  calls_booked: 0,
  calls_cancelled: 0,
  last_call: null,
  pitched: 0,
  applied: 0,
  passed: 0,
  deciding: 0,
  apply_rate: null,
  interviewed: 0,
  offers: 0,
  in_progress: 0,
  closed: 0,
  ghosted: 0,
  median_decide_days: null,
  ...overrides,
});

const CONVERSATIONS = {
  total: tally({
    calls_held: 3,
    calls_booked: 1,
    pitched: 5,
    applied: 2,
    passed: 2,
    deciding: 1,
    apply_rate: 0.5,
    interviewed: 1,
    offers: 1,
    ghosted: 1,
    median_decide_days: 1.5,
  }),
  people_talked_to: 2,
  flow: {
    applications: 5,
    nodes: [
      { id: "pitched", name: "Pitched to you", kind: "active", color: "indigo", reached: 5, current: 0 },
      { id: "applied", name: "Applied", kind: "active", color: "blue", reached: 2, current: 0 },
      {
        id: "deciding",
        name: "Deciding whether to apply",
        kind: "holding",
        color: "yellow",
        reached: 1,
        current: 0,
      },
      { id: "passed", name: "Decided not to apply", kind: "outcome", color: "gray", reached: 2, current: 0 },
      { id: "offer", name: "Offer", kind: "outcome", color: "green", reached: 1, current: 0 },
      { id: "ghosted", name: "Ghosted", kind: "outcome", color: "dark", reached: 1, current: 0 },
    ],
    links: [
      { source: "pitched", target: "applied", value: 2 },
      { source: "pitched", target: "passed", value: 2 },
      { source: "pitched", target: "deciding", value: 1 },
      { source: "applied", target: "offer", value: 1 },
      { source: "applied", target: "ghosted", value: 1 },
    ],
  },
  people: [
    {
      ...tally({
        calls_held: 2,
        pitched: 4,
        applied: 2,
        passed: 1,
        deciding: 1,
        apply_rate: 0.667,
        interviewed: 1,
        offers: 1,
        ghosted: 1,
      }),
      id: "c1",
      name: "Alex Morgan",
      agency_id: "ag1",
      agency_name: "Northwind Talent",
      company_name: null,
      closed_as: null,
    },
    {
      ...tally({ calls_held: 1, pitched: 1, passed: 1, apply_rate: 0 }),
      id: "c2",
      name: "Riley Chen",
      agency_id: null,
      agency_name: null,
      company_name: null,
      closed_as: "not_interested",
    },
  ],
  agencies: [
    {
      ...tally({ calls_held: 2, pitched: 4, applied: 2, passed: 1, deciding: 1, apply_rate: 0.667 }),
      id: "ag1",
      name: "Northwind Talent",
      people: 1,
    },
  ],
  pass_reasons: [
    {
      role_id: "r9",
      role_title: "Frontend Engineer",
      company_name: "Fabrikam",
      person_name: "Alex Morgan",
      reason: "Office five days a week",
      decided_on: "2026-10-02",
    },
  ],
};

const docTally = (sent: number, heard: number, interviewed: number, extra: Record<string, unknown> = {}) => ({
  sent,
  heard_back: heard,
  interviewed,
  offers: 0,
  open: sent - heard,
  ghosted: 0,
  closed: heard,
  reply_rate: sent ? heard / sent : null,
  interview_rate: sent ? interviewed / sent : null,
  interview_low: sent ? Math.max(0, interviewed / sent - 0.2) : null,
  interview_high: sent ? Math.min(1, interviewed / sent + 0.2) : null,
  median_reply_days: sent ? 4 : null,
  ...extra,
});

const DOCUMENTS = {
  applications: 23,
  kinds: [
    {
      kind: "cv",
      documents: [
        {
          id: "d1",
          name: "Backend CV",
          ...docTally(20, 14, 11),
          versions: [
            { id: "v1", label: "v1", created_at: "2026-09-01T00:00:00Z", ...docTally(10, 7, 2) },
            {
              id: "v2",
              label: "v2 (impact first)",
              created_at: "2026-09-20T00:00:00Z",
              ...docTally(10, 7, 9),
            },
          ],
        },
      ],
      none: docTally(3, 1, 0),
    },
    {
      kind: "cover_letter",
      documents: [
        {
          id: "d2",
          name: "Short letter",
          ...docTally(4, 2, 1),
          versions: [{ id: "l1", label: "plain", created_at: "2026-09-01T00:00:00Z", ...docTally(4, 2, 1) }],
        },
      ],
      none: docTally(19, 13, 10),
    },
  ],
};

const ROUTES = {
  "/api/v1/insights/flow": FLOW,
  "/api/v1/insights/whole-flow": WHOLE,
  "/api/v1/insights/stats": STATS,
  "/api/v1/insights/activity": ACTIVITY,
  "/api/v1/insights/scorecard": SCORECARD,
  "/api/v1/insights/conversations": CONVERSATIONS,
  "/api/v1/insights/documents": DOCUMENTS,
  "/api/v1/health": {},
};

function mockInsights(overrides: Record<string, unknown> = {}) {
  return mockApi({ ...ROUTES, ...overrides });
}

const rows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((r) => r.textContent);

afterEach(() => vi.unstubAllGlobals());

async function openApplications() {
  fireEvent.click(await screen.findByRole("tab", { name: "Applications" }));
}

describe("insights", () => {
  it("opens on the whole picture: where roles came from to where they're waiting", async () => {
    const calls = mockInsights();
    renderAt("/insights");
    const chart = await screen.findByRole("img", {
      name: "Sankey diagram of 4 roles, from where they came from to where they are now",
    });
    expect(chart.querySelectorAll("rect")).toHaveLength(7);
    const rect = (name: RegExp) =>
      [...chart.querySelectorAll("rect")].find((r) =>
        name.test(r.querySelector("title")?.textContent ?? ""),
      )!;
    // Where things are waiting, and sources, count what's there: no "reached".
    fireEvent.mouseEnter(rect(/^Waiting to hear back/));
    expect(screen.getByText("Waiting to hear back: 2 roles", { selector: "p" })).toBeInTheDocument();
    fireEvent.mouseEnter(rect(/^Through a recruiter/));
    expect(screen.getByText("Through a recruiter: 3 roles", { selector: "p" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Last 30 days"));
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith("/api/v1/insights/whole-flow")).at(-1)!;
      expect(new URL(last.path, "http://localhost").searchParams.get("since")).not.toBeNull();
    });
  });

  it("draws the flow and shows counts on hover", async () => {
    mockInsights();
    renderAt("/insights");
    await openApplications();
    const chart = await screen.findByRole("img", { name: /Sankey diagram of 3 applications/ });
    expect(chart.querySelectorAll("path")).toHaveLength(3);
    expect(chart.querySelectorAll("rect")).toHaveLength(4);
    // Stage colours come from the workflow.
    expect(chart.querySelector("rect")).toHaveAttribute(
      "fill",
      "var(--jat-chart-blue, var(--mantine-color-blue-6, var(--jat-chart-gray)))",
    );

    fireEvent.mouseEnter(chart.querySelectorAll("path")[1]!);
    expect(
      screen.getByText("Screen → Offer: 1 application (50% of Screen)", { selector: "p" }),
    ).toBeInTheDocument();
    fireEvent.mouseEnter(chart.querySelectorAll("rect")[0]!);
    expect(
      screen.getByText("Applied: 3 applications reached, 1 still there", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("shows conversion and time per stage, routes side by side, and weekly activity", async () => {
    mockInsights();
    renderAt("/insights");
    await openApplications();
    const stages = (await screen.findByRole("heading", { name: "Stage by stage" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(rows(within(stages).getByRole("table"))).toEqual([
      "StageReachedMoved onConversionMedian time in stage",
      "Applied3267%4.5 daysfrom 2 stays",
      "Screen2150%under a dayfrom 2 stays",
      "Offer1——\u2014",
      "Rejected1——\u2014",
    ]);

    const routes = screen
      .getByRole("heading", { name: "Direct vs recruiter" })
      .closest(".mantine-Card-root") as HTMLElement;
    // Progress stages after the first: Screen and Offer (closed ones aren't progress).
    expect(rows(within(routes).getByRole("table"))).toEqual([
      "RouteApplicationsScreenOffer",
      "Direct250% (1)50% (1)",
      "Via an agency1100% (1)0% (0)",
    ]);

    const weeks = await screen.findAllByRole("listitem");
    expect(weeks.map((w) => w.getAttribute("aria-label"))).toEqual([
      "Week of 21 Sep: 2 added, 1 applied, 0 stage moves, 0 interviews, 2 calls, 3 roles pitched",
      "Week of 28 Sep: 0 added, 0 applied, 3 stage moves, 1 interview, 0 calls, 0 roles pitched",
    ]);
  });

  it("filters by date range and route", async () => {
    const calls = mockInsights();
    renderAt("/insights");
    await openApplications();
    await screen.findByRole("img", { name: /Sankey diagram/ });
    // Activity asks for twelve weeks from a local Monday, in the browser's time zone.
    const activity = calls.find((c) => c.path.startsWith("/api/v1/insights/activity"))!;
    const params = new URL(activity.path, "http://localhost").searchParams;
    expect(params.get("weeks")).toBe("12");
    expect(params.get("tz")).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
    const start = params.get("start")!;
    expect(start).toMatch(/^\d{4}-\d\d-\d\d$/);
    expect(new Date(`${start}T12:00:00`).getDay()).toBe(1);

    fireEvent.click(screen.getByText("Last 30 days"));
    await waitFor(() => {
      for (const path of ["/api/v1/insights/flow", "/api/v1/insights/stats"]) {
        const last = calls.filter((c) => c.path.startsWith(path)).at(-1)!;
        const since = new URL(last.path, "http://localhost").searchParams.get("since");
        expect(since).not.toBeNull();
        const days = (Date.now() - Date.parse(since!)) / 86_400_000;
        expect(days).toBeGreaterThan(29.9);
        expect(days).toBeLessThan(30.1);
      }
    });

    fireEvent.click(screen.getAllByLabelText("Route")[0]!);
    fireEvent.click(await screen.findByRole("option", { name: "Via an agency", hidden: true }));
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith("/api/v1/insights/flow")).at(-1)!;
      expect(last.path).toContain("route=agency");
    });
  });

  it("explains an empty flow", async () => {
    mockInsights({
      "/api/v1/insights/flow": { applications: 0, nodes: [], links: [] },
      "/api/v1/insights/stats": { applications: 0, stages: [], routes: [] },
    });
    renderAt("/insights");
    await openApplications();
    expect(await screen.findByText("No applications match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stage by stage" })).not.toBeInTheDocument();
  });

  it("scores recruiters and agencies", async () => {
    const calls = mockInsights();
    renderAt("/insights");
    await openApplications();
    const card = (await screen.findByRole("heading", { name: "Recruiter scorecard" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    const table = await within(card).findByRole("table");
    expect(rows(table)).toEqual([
      "RecruiterRolesInterviewedWhere they are nowFirst updateLast contact",
      "Alex RecruiterNorthwind Talent42 (50%)2 active1 ghosted1 closed2.5 days3 days ago",
      "Sam Recruiter10 (0%)1 activesame day—",
    ]);
    expect(within(table).getByRole("link", { name: "Northwind Talent" })).toHaveAttribute(
      "href",
      "/agencies/ag1",
    );

    fireEvent.click(within(card).getByText("Agencies"));
    expect(rows(within(card).getByRole("table"))).toEqual([
      "AgencyRolesInterviewedWhere they are nowFirst updateLast contact",
      "Northwind Talent52 (40%)3 active1 ghosted——",
    ]);

    // The date range applies to the scorecard too.
    fireEvent.click(screen.getByText("Last 90 days"));
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith("/api/v1/insights/scorecard")).at(-1)!;
      expect(last.path).toContain("since=");
    });
  });

  it("shows recruiter conversations: calls, pitched roles, who pitches them, and why you passed", async () => {
    const calls = mockInsights();
    renderAt("/insights");
    fireEvent.click(await screen.findByRole("tab", { name: "Recruiter conversations" }));
    const card = (await screen.findByRole("heading", { name: "Recruiter conversations" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(within(card).getByText("Calls held").nextSibling).toHaveTextContent("3");
    expect(within(card).getByText("1 booked ahead")).toBeInTheDocument();
    expect(within(card).getByText("50% of roles decided")).toBeInTheDocument();
    expect(within(card).getByText("1.5 days")).toBeInTheDocument();
    expect(within(card).getByRole("img", { name: /5 roles pitched to you/ })).toBeInTheDocument();

    const who = (await screen.findByRole("heading", { name: "Who you talk to" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(rows(within(who).getByRole("table")).slice(1)).toEqual([
      "Alex MorganNorthwind Talent2—421167%11 offer1 ghosted",
      "Riley ChenNot interestedIndependent1—10100%0—",
    ]);
    expect(within(who).getByRole("link", { name: "Alex Morgan" })).toHaveAttribute("href", "/people/c1");
    fireEvent.click(within(who).getByText("Agencies"));
    expect(within(who).getByRole("link", { name: "Northwind Talent" })).toHaveAttribute(
      "href",
      "/agencies/ag1",
    );

    expect(screen.getByText("Office five days a week")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Frontend Engineer" })).toHaveAttribute("href", "/roles/r9");

    // The date range applies here too.
    fireEvent.click(screen.getByText("Last 30 days"));
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith("/api/v1/insights/conversations")).at(-1)!;
      expect(last.path).toContain("since=");
    });
  });

  it("compares CV versions, and says whether a gap is likely real", async () => {
    const calls = mockInsights();
    renderAt("/insights");
    fireEvent.click(await screen.findByRole("tab", { name: "CVs and cover letters" }));
    const card = (await screen.findByRole("heading", { name: "Which CV works best" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(rows(within(card).getByRole("table")).slice(1)).toEqual([
      "Backend CV2014 (70%)11 (55%)06 · 0 · 144 days",
      "v1107 (70%)2 (20%)03 · 0 · 74 days",
      "v2 (impact first)107 (70%)9 (90%)03 · 0 · 74 days",
      "No CV recorded31 (33%)0 (0%)02 · 0 · 14 days",
    ]);
    expect(within(card).getByRole("img", { name: "Likely between 70% and 100%" })).toBeInTheDocument();

    // The two most-sent versions, on screens and interviews: 9 of 10 against 2 of 10.
    expect(within(card).getByText("Likely real")).toBeInTheDocument();
    expect(
      within(card).getByText(
        "Likely a real difference: Backend CV · v2 (impact first): 9 of 10 got a screen or interview (90%) and Backend CV · v1: 2 of 10 got a screen or interview (20%).",
      ),
    ).toBeInTheDocument();
    // A CV can't be compared with one of its own versions: they share applications.
    const withBox = within(card).getAllByLabelText("With")[0]!;
    fireEvent.click(withBox);
    const withList = document.getElementById(withBox.getAttribute("aria-controls")!)!;
    expect(within(withList).getByRole("option", { name: "Backend CV", hidden: true })).toHaveAttribute(
      "data-combobox-disabled",
    );
    expect(
      within(withList).getByRole("option", { name: "No CV recorded", hidden: true }),
    ).not.toHaveAttribute("data-combobox-disabled");
    fireEvent.keyDown(within(card).getAllByLabelText("With")[0]!, { key: "Escape" });

    // Heard back is 7 of 10 each: nothing to see.
    fireEvent.click(within(card).getByRole("radio", { name: "Heard back" }));
    expect(await within(card).findByText("Could be chance")).toBeInTheDocument();

    // Cover letters, with and without; four sent is too few to tell.
    fireEvent.click(within(card).getByRole("radio", { name: "Cover letters" }));
    expect(await within(card).findByText("Short letter")).toBeInTheDocument();
    expect(within(card).getByText("No cover letter recorded")).toBeInTheDocument();
    expect(within(card).getByText("Too few to tell")).toBeInTheDocument();

    // The route narrows it.
    fireEvent.click(within(card).getAllByLabelText("Route")[0]!);
    fireEvent.click(await screen.findByRole("option", { name: "Direct", hidden: true }));
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith("/api/v1/insights/documents")).at(-1)!;
      expect(last.path).toContain("route=direct");
    });
  });

  it("says how to start when no CV has been recorded", async () => {
    mockInsights({
      "/api/v1/cv-files": [
        {
          sha256: "a".repeat(64),
          name: "cv.pdf",
          size: 1,
          content_type: "application/pdf",
          applications: [],
          version: null,
        },
      ],
      "/api/v1/insights/documents": {
        applications: 4,
        kinds: [{ kind: "cv", documents: [], none: docTally(4, 1, 0) }],
      },
    });
    renderAt("/insights");
    fireEvent.click(await screen.findByRole("tab", { name: "CVs and cover letters" }));
    expect(await screen.findByText(/Nothing to compare yet/)).toBeInTheDocument();
    expect(screen.getByText(/1 CV file you've attached isn't a version yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sort them out on Documents" })).toHaveAttribute(
      "href",
      "/documents",
    );
    expect(screen.getByText(/Nothing to compare yet/).querySelector("a")).toHaveAttribute(
      "href",
      "/documents",
    );
  });
});

// loading-state-card-spinners: each Insights part that loads on its own shows a skeleton shaped like it
// while its request is out, never a spinner; a failed load keeps its own text; a loaded one its content.
describe("each part's loading and failed states", () => {
  const card = (title: string) =>
    screen.getByRole("heading", { name: title }).closest<HTMLElement>(".mantine-Card-root")!;
  const panel = () => screen.getByRole("tabpanel");
  const PARTS = [
    {
      name: "the scorecard",
      tab: "Applications",
      request: "/api/v1/insights/scorecard",
      where: () => card("Recruiter scorecard"),
      failed: "Couldn't load the scorecard.",
      loaded: "Alex Recruiter",
    },
    {
      name: "rescheduling",
      tab: "Applications",
      request: "/api/v1/insights/rescheduling",
      where: () => card("Rescheduling"),
      failed: "Couldn't load the rescheduling numbers.",
      loaded: "No booked rounds on applications added in this period.",
    },
    {
      name: "recruiter conversations",
      tab: "Recruiter conversations",
      request: "/api/v1/insights/conversations",
      where: panel,
      failed: "Couldn't load recruiter conversations.",
      loaded: "Who you talk to",
    },
    {
      name: "CVs and cover letters",
      tab: "CVs and cover letters",
      request: "/api/v1/insights/documents",
      where: panel,
      failed: "Couldn't load how your CVs are doing.",
      loaded: "Which CV works best",
    },
    {
      name: "which round rejections came after",
      tab: "Rejections",
      request: "/api/v1/insights/rejections/rounds",
      where: () => card("Which round rejections came after"),
      failed:
        "Couldn't load which round rejections came after. If you've just updated the tracker, restart it.",
      loaded: "No rejections yet.",
    },
    {
      name: "rejection feedback",
      tab: "Rejections",
      request: "/api/v1/insights/rejections",
      where: () => card("Rejection feedback"),
      failed: "Couldn't load the rejection feedback. If you've just updated the tracker, restart it.",
      loaded: /^No rejection feedback yet\./,
    },
  ];
  const routes = {
    ...ROUTES,
    "/api/v1/insights/rescheduling": { booked_rounds: 0, moved_rounds: 0 },
    "/api/v1/insights/rejections": [],
    "/api/v1/insights/rejections/rounds": {
      rejections: 0,
      no_rounds: 0,
      unnumbered: 0,
      by_kind: [],
      by_number: [],
    },
    "/api/v1/cv-files": [],
  };

  afterEach(() => vi.useRealTimers());

  describe.each(PARTS)("$name", ({ tab, request, where, failed, loaded }) => {
    // Only this part's request (by its path, so the rounds don't hold the feedback); the rest answer.
    const open = async (how: "hang" | "fail" | "ok") => {
      mockApiAnswering(routes, request, (sent) => (sent.split("?")[0] === request ? how : "ok"));
      renderAt("/insights");
      fireEvent.click(await screen.findByRole("tab", { name: tab }));
    };

    it("shows a skeleton while it loads, not a spinner", async () => {
      await open("hang");
      const busy = await within(await waitFor(where)).findByTestId("query-loading");
      expect(busy).toHaveAttribute("aria-busy", "true");
      expect(busy.querySelectorAll(".mantine-Skeleton-root").length).toBeGreaterThan(0);
      expect(where().querySelectorAll(".mantine-Loader-root")).toHaveLength(0);
      expect(within(where()).queryByText(loaded)).toBeNull();
    });

    it("keeps its own text when it can't load", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open("fail");
      await vi.advanceTimersByTimeAsync(10_000); // past React Query's retries
      expect(await within(await waitFor(where)).findByText(failed)).toBeInTheDocument();
      expect(within(where()).queryByTestId("query-loading")).toBeNull();
    });

    it("shows what it found once it loads, with no skeleton left", async () => {
      await open("ok");
      expect(await within(await waitFor(where)).findByText(loaded)).toBeInTheDocument();
      expect(within(where()).queryByTestId("query-loading")).toBeNull();
    });
  });
});
