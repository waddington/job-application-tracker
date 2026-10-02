import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

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

export const item = (overrides: Record<string, unknown> = {}) => ({
  id: "event:e1",
  at: "2026-10-01T09:30:00Z",
  all_day: false,
  category: "message",
  title: "Call with Alex",
  detail: null,
  application_id: "a1",
  role_title: "Backend Engineer",
  company_id: "co1",
  company_name: "Contoso",
  agency_id: "ag1",
  agency_name: "Northwind Talent",
  people: [{ id: "c1", name: "Alex Recruiter" }],
  archived: false,
  ...overrides,
});

afterEach(() => vi.unstubAllGlobals());

describe("overview", () => {
  it("walks you through getting started when there are no applications", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [],
      "/api/v1/next-actions": NOTHING,
      "/api/v1/timeline": { items: [], now: "2026-10-02T10:00:00Z" },
      "/api/v1/health": {},
    });
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Getting started" })).toBeInTheDocument();
    expect(screen.getByText("Add an application")).toBeInTheDocument();
    // One in the header, one in the card.
    expect(screen.getAllByRole("button", { name: "New application" })).toHaveLength(2);
  });

  it("sums up where things stand", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/applications": [
        row({ id: "a1", stage: "applied" }),
        row({ id: "a2", stage: "applied", company_name: "Fabrikam" }),
        row({ id: "a3", stage: "screen", company_name: "Litware" }),
      ],
      "/api/v1/next-actions": {
        ...NOTHING,
        stale: [row({ id: "a2", company_name: "Fabrikam", days_since_activity: 12 })],
        waiting: [row({ id: "a3", awaiting_reply_since: "2026-09-30" })],
      },
      "/api/v1/timeline": { items: [item()], now: "2026-10-02T10:00:00Z" },
      "/api/v1/health": {},
    });
    renderAt("/");
    expect(await screen.findByRole("link", { name: "Active: 3" })).toHaveAttribute("href", "/applications");
    expect(screen.getByRole("link", { name: "Needs attention: 1" })).toHaveAttribute("href", "/next-actions");
    expect(screen.getByRole("link", { name: "Waiting: 1" })).toBeInTheDocument();
    expect(screen.getByText(/Gone quiet: last activity 12 days ago/)).toBeInTheDocument();
    expect(screen.getByText("Applied 2")).toBeInTheDocument();
    expect(screen.getByText("Screen 1")).toBeInTheDocument();
    const recent = screen.getByRole("heading", { name: "Recent activity" }).closest("div")!.parentElement!;
    expect(within(recent).getByText("Call with Alex")).toBeInTheDocument();
    expect(within(recent).getByRole("link", { name: "Full timeline" })).toHaveAttribute("href", "/timeline");
  });
});
