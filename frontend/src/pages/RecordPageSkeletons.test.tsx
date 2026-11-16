import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApiAnswering, roleSummary, row, WORKFLOW } from "../test/mockApi";

// loading-state-page-skeletons-records: while a record's page waits for its record it shows a skeleton
// of the page under its back link, never a spinner; a failed load keeps the page's own message; a loaded
// one shows the record.

const contact = {
  id: "c9",
  name: "Riley Chen",
  title: null,
  agency_id: null,
  company_id: "co1",
  details: [],
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};
const place = {
  id: "co1",
  name: "Contoso",
  website: null,
  description: null,
  created_at: "",
  updated_at: "",
};

const ROUTES = {
  "/api/v1/workflow": WORKFLOW,
  "/api/v1/health": {},
  "/api/v1/applications": [],
  "/api/v1/applications/a1": {
    ...row(),
    events: [],
    contacts: [],
    allowed_next: [],
    suggested_next: [],
    can_undo: false,
    documents: [],
    duplicates: [],
  },
  "/api/v1/role-summaries/r1": roleSummary(),
  "/api/v1/contacts/c9/summary": {
    contact,
    agency_name: null,
    company_name: "Contoso",
    applications: [],
    interviews: [],
  },
  "/api/v1/companies/co1/summary": { company: place, roles: [], applications: [], contacts: [] },
  "/api/v1/agencies/ag1/summary": {
    agency: { ...place, id: "ag1", name: "Northwind Talent" },
    recruiters: [],
    applications: [],
  },
};

/** Each record's page, the request it waits on, its back link, its own failed text and its loaded heading. */
const PAGES = [
  {
    path: "/applications/a1",
    request: "/api/v1/applications/a1",
    back: "All applications",
    failed: "Couldn't load this application",
    loaded: "Backend Engineer",
  },
  {
    path: "/roles/r1",
    request: "/api/v1/role-summaries/r1",
    back: "All roles",
    failed: "Couldn't load this role. It may have been deleted.",
    loaded: "Backend Engineer",
  },
  {
    path: "/people/c9",
    request: "/api/v1/contacts/c9/summary",
    back: "All people",
    failed: "Couldn't load this person.",
    loaded: "Riley Chen",
  },
  {
    path: "/companies/co1",
    request: "/api/v1/companies/co1/summary",
    back: "All companies",
    failed: "Couldn't load this company.",
    loaded: "Contoso",
  },
  {
    path: "/agencies/ag1",
    request: "/api/v1/agencies/ag1/summary",
    back: "All recruiters",
    failed: "Couldn't load this agency.",
    loaded: "Northwind Talent",
  },
];

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}
const spinners = () => document.querySelectorAll("main .mantine-Loader-root");
/** The record's own skeleton: the busy block right under the back link. */
const skeleton = (back: string) =>
  screen
    .getByRole("link", { name: back })
    .closest(".mantine-Stack-root")!
    .querySelector(':scope > [aria-busy="true"]');

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each(PAGES)("$path", ({ path, request, back, failed, loaded }) => {
  // Only the record itself: /applications/a1 is also the start of its own sub-requests.
  const answering = (how: "hang" | "fail" | "ok") =>
    mockApiAnswering(ROUTES, request, (sent) => (sent === request ? how : "ok"));

  it("shows a skeleton of the page under its back link while it loads, not a spinner", async () => {
    answering("hang");
    renderAt(path);
    expect(await screen.findByRole("link", { name: back })).toBeInTheDocument();
    expect(skeleton(back)).toHaveAttribute("data-testid", "query-loading");
    expect(skeleton(back)!.querySelectorAll(".mantine-Skeleton-root").length).toBeGreaterThan(3);
    expect(spinners()).toHaveLength(0);
    expect(screen.queryByRole("heading", { name: loaded })).toBeNull();
  });

  it("keeps its own message when the record can't load", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    answering("fail");
    renderAt(path);
    await vi.advanceTimersByTimeAsync(10_000); // past React Query's retries
    expect(await screen.findByText(failed)).toBeInTheDocument();
    expect(document.querySelector('main [aria-busy="true"]')).toBeNull();
    expect(spinners()).toHaveLength(0);
  });

  it("shows the record once it loads, with no skeleton left in its place", async () => {
    answering("ok");
    renderAt(path);
    expect(await screen.findByRole("heading", { name: loaded })).toBeInTheDocument();
    await waitFor(() => expect(skeleton(back)).toBeNull());
  });
});
