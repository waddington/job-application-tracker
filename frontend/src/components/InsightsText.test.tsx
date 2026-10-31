import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import type { Stats } from "../api/insightHooks";
import { makeRouter } from "../router";
import { mockApi, WORKFLOW } from "../test/mockApi";
import { RouteTable, StageTable, WeeklyActivity } from "./InsightStats";

// Insights' text comes from locales/en/insights.ts (i18n-insights-tabs). A before/after snapshot
// of each tab showed no change; these pin most of the counts and states the demo data can't reach.

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>{node}</MantineProvider>
    </QueryClientProvider>,
  );

const stage = (over: Record<string, unknown>) => ({
  id: "applied",
  name: "Applied",
  kind: "active",
  color: "blue",
  reached: 3,
  moved_on: 1,
  conversion: 1 / 3,
  median_days: 2.5,
  stays: 2,
  ...over,
});

const stats = (over: Record<string, unknown> = {}) =>
  ({ applications: 3, stages: [stage({})], routes: [], ...over }) as unknown as Stats;

afterEach(() => vi.unstubAllGlobals());

describe("stage by stage", () => {
  it("says how long, from how many stays, in every case", () => {
    wrap(
      <StageTable
        stats={stats({
          stages: [
            stage({ id: "a", name: "A" }),
            stage({ id: "b", name: "B", median_days: 1, stays: 1 }),
            stage({ id: "c", name: "C", median_days: 0.5, stays: 0 }),
            stage({ id: "d", name: "D", median_days: 3, stays: 3 }),
            stage({ id: "e", name: "E", median_days: null, conversion: null }),
          ],
        })}
      />,
    );
    const row = (name: string) => screen.getByText(name).closest("tr")!;
    expect(row("A")).toHaveTextContent("33%");
    expect(within(row("A")).getByText("2.5 days")).toBeInTheDocument();
    expect(within(row("A")).getByText("from 2 stays")).toBeInTheDocument();
    expect(within(row("B")).getByText("1 day")).toBeInTheDocument();
    expect(within(row("B")).getByText("from 1 stay")).toBeInTheDocument();
    expect(within(row("C")).getByText("under a day")).toBeInTheDocument();
    expect(within(row("D")).getByText("3 days")).toBeInTheDocument();
    expect(within(row("E")).getAllByText("—").length).toBe(3);
    expect(
      screen.getByText(
        '"Moved on" means reaching a later stage that isn\'t a closed one. Time in stage counts every finished stay, including ones before a move back.',
      ),
    ).toBeInTheDocument();
  });
});

describe("direct vs recruiter", () => {
  it("says when there's nothing to compare", () => {
    wrap(<RouteTable stats={stats()} />);
    expect(
      screen.getByText("Every application so far came the same way. Nothing to compare yet."),
    ).toBeInTheDocument();
  });

  it("names each route, and keeps one it doesn't know", () => {
    const route = (name: string) => ({ route: name, applications: 2, reached: {} });
    wrap(
      <RouteTable
        stats={stats({
          routes: [route("direct"), route("agency"), route("referral"), route("carrier")],
        })}
      />,
    );
    for (const name of ["Direct", "Via an agency", "Referral", "carrier"]) {
      expect(screen.getByRole("cell", { name })).toBeInTheDocument();
    }
  });
});

describe("weekly activity", () => {
  it("counts each kind of thing in a week, singular and plural", async () => {
    const week = (added: number, n: number, start: string) => ({
      start,
      added,
      applied: n,
      moves: n,
      interviews: n,
      calls: n,
      pitched: n,
    });
    mockApi({
      "/api/v1/insights/activity": [week(1, 1, "2026-10-05"), week(2, 2, "2026-10-12")],
    });
    wrap(<WeeklyActivity />);
    expect(
      await screen.findByRole("listitem", {
        name: "Week of 5 Oct: 1 added, 1 applied, 1 stage move, 1 interview, 1 call, 1 role pitched",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("listitem", {
        name: "Week of 12 Oct: 2 added, 2 applied, 2 stage moves, 2 interviews, 2 calls, 2 roles pitched",
      }),
    ).toBeInTheDocument();
  });
});

describe("the Insights page", () => {
  function renderPage(routes: Record<string, unknown>) {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/health": {},
      "/api/v1/contacts": [],
      "/api/v1/insights/activity": [],
      "/api/v1/insights/stats": stats({ applications: 0, stages: [] }),
      ...routes,
    });
    render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/insights"] }))} />);
  }
  const flow = (applications: number) => ({ applications, nodes: [], links: [] });
  const applicationsTab = async () =>
    fireEvent.click(await screen.findByRole("tab", { name: "Applications" }));

  it("says how many roles, and when there's nothing yet", async () => {
    renderPage({ "/api/v1/insights/whole-flow": flow(1) });
    expect(await screen.findByText(/^1 role by the date they were added: where each/)).toBeInTheDocument();
    expect(
      screen.getByText("Nothing here yet: add a role or an application and it shows up."),
    ).toBeInTheDocument();
  });

  it("says how many applications, and why there's no flow", async () => {
    renderPage({
      "/api/v1/insights/whole-flow": flow(0),
      "/api/v1/insights/flow": flow(1),
      "/api/v1/insights/scorecard": { recruiters: [], agencies: [] },
    });
    await applicationsTab();
    expect(
      await screen.findByText(
        "1 application by the date they were added. Moves back to an earlier stage count as staying at the furthest one reached.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "No application has moved on from its first stage yet. Come back once things get going.",
      ),
    ).toBeInTheDocument();
  });

  it("says no applications match, and no one's on the scorecard, in each view", async () => {
    renderPage({
      "/api/v1/insights/whole-flow": flow(0),
      "/api/v1/insights/flow": flow(0),
      "/api/v1/insights/scorecard": { recruiters: [], agencies: [] },
    });
    await applicationsTab();
    expect(await screen.findByText("No applications match these filters.")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "No roles from recruiters in this period. Add a recruiter or agency to an application to see it here.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Agencies"));
    expect(
      await screen.findByText(
        "No roles from agencies in this period. Add a recruiter or agency to an application to see it here.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a scorecard's outcomes and how soon the first update came", async () => {
    const score = (id: string, over: Record<string, unknown>) => ({
      id,
      name: `Person ${id}`,
      agency_id: null,
      agency_name: null,
      roles: 4,
      interviewed: 1,
      active: 1,
      success: 1,
      ghosted: 1,
      closed: 1,
      median_first_update_days: null,
      last_contact: null,
      ...over,
    });
    renderPage({
      "/api/v1/insights/whole-flow": flow(0),
      "/api/v1/insights/flow": flow(0),
      "/api/v1/insights/scorecard": {
        recruiters: [
          score("a", { median_first_update_days: 0.5 }),
          score("b", { median_first_update_days: 1 }),
          score("c", { median_first_update_days: 2.5 }),
        ],
        agencies: [],
      },
    });
    await applicationsTab();
    const row = (await screen.findByText("Person a")).closest("tr")!;
    expect(row).toHaveTextContent("25%");
    for (const text of ["1 active", "1 accepted", "1 ghosted", "1 closed", "same day"]) {
      expect(within(row).getByText(text)).toBeInTheDocument();
    }
    expect(within(screen.getByText("Person b").closest("tr")!).getByText("1 day")).toBeInTheDocument();
    expect(within(screen.getByText("Person c").closest("tr")!).getByText("2.5 days")).toBeInTheDocument();
  });
});
