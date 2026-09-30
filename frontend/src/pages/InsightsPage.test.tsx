import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi } from "../test/mockApi";

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
  counts: Partial<Record<"added" | "applied" | "moves" | "interviews", number>>,
) => ({
  start,
  added: 0,
  applied: 0,
  moves: 0,
  interviews: 0,
  ...counts,
});

const ACTIVITY = [
  week("2026-09-21", { added: 2, applied: 1 }),
  week("2026-09-28", { moves: 3, interviews: 1 }),
];

function mockInsights(overrides: Record<string, unknown> = {}) {
  return mockApi({
    "/api/v1/insights/flow": FLOW,
    "/api/v1/insights/stats": STATS,
    "/api/v1/insights/activity": ACTIVITY,
    "/api/v1/health": {},
    ...overrides,
  });
}

const rows = (table: HTMLElement) =>
  within(table)
    .getAllByRole("row")
    .map((r) => r.textContent);

afterEach(() => vi.unstubAllGlobals());

describe("insights", () => {
  it("draws the flow and shows counts on hover", async () => {
    mockInsights();
    renderAt("/insights");
    const chart = await screen.findByRole("img", { name: /Sankey diagram of 3 applications/ });
    expect(chart.querySelectorAll("path")).toHaveLength(3);
    expect(chart.querySelectorAll("rect")).toHaveLength(4);
    // Stage colours come from the workflow.
    expect(chart.querySelector("rect")).toHaveAttribute("fill", "var(--mantine-color-blue-6)");

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
      "Week of 21 Sep: 2 added, 1 applied, 0 stage moves, 0 interviews",
      "Week of 28 Sep: 0 added, 0 applied, 3 stage moves, 1 interview",
    ]);
  });

  it("filters by date range and route", async () => {
    const calls = mockInsights();
    renderAt("/insights");
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
    expect(await screen.findByText("No applications match these filters.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stage by stage" })).not.toBeInTheDocument();
  });
});
