import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { item, mockApi } from "../test/mockApi";

function renderTimeline(url = "/timeline") {
  const router = makeRouter(createMemoryHistory({ initialEntries: [url] }));
  render(<App router={router} />);
  return router;
}

const now = new Date().toISOString();
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const ITEMS = [
  item({
    id: "interview:i1",
    at: inDays(3),
    category: "interview",
    title: "Round 2 · System design (booked)",
  }),
  item({ id: "event:e2", at: inDays(-1), category: "stage", title: "Applied → Screen" }),
  item({
    id: "contact:c2",
    at: inDays(-2),
    category: "added",
    title: "Added Riley Chen",
    application_id: null,
    role_id: null,
    role_title: null,
    agency_id: null,
    agency_name: null,
    company_id: "co2",
    company_name: "Fabrikam",
    people: [{ id: "c2", name: "Riley Chen" }],
  }),
];

afterEach(() => vi.unstubAllGlobals());

describe("timeline", () => {
  it("lists what's coming up, then each day, with links to what it's about", async () => {
    const calls = mockApi({
      "/api/v1/timeline": { items: ITEMS, now },
      "/api/v1/companies": [{ id: "co2", name: "Fabrikam" }],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [],
      "/api/v1/health": {},
    });
    renderTimeline();
    const ahead = (await screen.findByRole("heading", { name: "Coming up" })).parentElement!;
    expect(within(ahead).getByText("Round 2 · System design (booked)")).toBeInTheDocument();
    expect(within(ahead).queryByText("Applied → Screen")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Yesterday/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Riley Chen" })).toHaveAttribute("href", "/people/c2");
    expect(screen.getAllByRole("link", { name: "Backend Engineer at Contoso" })[0]).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    // Three months by default.
    const first = new URL(calls.find((c) => c.path.startsWith("/api/v1/timeline"))!.path, "http://localhost");
    expect(first.searchParams.get("since")).toBeTruthy();

    // Unticking a kind asks for the rest without it.
    fireEvent.click(screen.getByRole("checkbox", { name: "Interviews" }));
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith("/api/v1/timeline")).at(-1)!.path;
      expect(last).toContain("category=stage");
      expect(last).not.toContain("category=interview");
    });
  });

  it("draws a lane per role (by default), company or person", async () => {
    mockApi({
      "/api/v1/timeline": { items: ITEMS, now },
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [{ id: "c1", name: "Alex Recruiter", closed_as: "ghosted" }],
      "/api/v1/health": {},
    });
    renderTimeline();
    fireEvent.click(await screen.findByText("Lanes"));
    const lane = await screen.findByRole("list", { name: "Contoso · Backend Engineer" });
    expect(within(lane).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("link", { name: "Contoso · Backend Engineer" })).toHaveAttribute(
      "href",
      "/roles/r1",
    );
    fireEvent.click(screen.getByText("Company"));
    expect(await screen.findByRole("list", { name: "Fabrikam" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Contoso" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Person"));
    expect(
      within(await screen.findByRole("list", { name: "Alex Recruiter" })).getAllByRole("button"),
    ).toHaveLength(2);
    // Alex ghosted you: their row says so.
    expect(
      within(screen.getByRole("link", { name: /Alex Recruiter/ })).getByRole("img", { name: "Ghosted" }),
    ).toBeInTheDocument();
  });

  it("opens on one person over all time from a link, and keeps the filters in the URL", async () => {
    const calls = mockApi({
      "/api/v1/timeline": { items: ITEMS, now },
      "/api/v1/companies": [{ id: "co2", name: "Fabrikam" }],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [{ id: "c2", name: "Riley Chen" }],
      "/api/v1/health": {},
    });
    const router = renderTimeline("/timeline?about=contact%3Ac2&period=all");
    await screen.findByText("Applied → Screen");
    const timelineCalls = () =>
      calls
        .filter((c) => c.path.startsWith("/api/v1/timeline"))
        .map((c) => new URL(c.path, "http://localhost"));
    expect(timelineCalls()[0]!.searchParams.get("contact_id")).toBe("c2");
    expect(timelineCalls()[0]!.searchParams.get("since")).toBeNull();
    expect(await screen.findByDisplayValue("Riley Chen")).toBeInTheDocument();
    fireEvent.click(screen.getByDisplayValue("All time"));

    // Choosing a period writes it back to the URL, keeping the person.
    fireEvent.click(await screen.findByRole("option", { name: "Last 30 days", hidden: true }));
    await waitFor(() => expect(router.state.location.search).toEqual({ about: "contact:c2", period: 30 }));
    const last = timelineCalls().at(-1)!;
    expect(last.searchParams.get("contact_id")).toBe("c2");
    expect(last.searchParams.get("since")).toBeTruthy();

    // Lanes keep the person and the period; clearing About takes it out of the address.
    fireEvent.click(screen.getByText("Lanes"));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ about: "contact:c2", period: 30, view: "lanes" }),
    );
    fireEvent.click(screen.getByDisplayValue("Riley Chen").parentElement!.querySelector("button")!);
    await waitFor(() => expect(router.state.location.search).toEqual({ period: 30, view: "lanes" }));
    expect(timelineCalls().at(-1)!.searchParams.get("contact_id")).toBeNull();
  });

  it("falls back to the defaults for values it doesn't know, and drops them on the next change", async () => {
    const calls = mockApi({
      "/api/v1/timeline": { items: ITEMS, now },
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [{ id: "c2", name: "Riley Chen" }],
      "/api/v1/health": {},
    });
    const router = renderTimeline("/timeline?period=foo&view=bar&about=contact%3Agone&keep=1");
    await screen.findByText("Applied → Screen");
    expect(screen.getByDisplayValue("Last 3 months")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /^Yesterday/ })).toBeInTheDocument(); // the list
    // Someone who's gone filters nothing (once the people have loaded).
    await waitFor(() => {
      const last = new URL(
        calls.filter((c) => c.path.startsWith("/api/v1/timeline")).at(-1)!.path,
        "http://x",
      );
      expect(last.searchParams.get("contact_id")).toBeNull();
    });
    fireEvent.click(screen.getByText("Lanes"));
    await waitFor(() => expect(router.state.location.search).toEqual({ keep: 1, view: "lanes" }));
  });

  it("leaves bookkeeping out until you ask for it", async () => {
    const calls = mockApi({
      "/api/v1/timeline": { items: ITEMS, now },
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [],
      "/api/v1/health": {},
    });
    renderTimeline();
    await screen.findByText("Applied → Screen");
    const timelineCalls = () => calls.filter((c) => c.path.startsWith("/api/v1/timeline"));
    const first = timelineCalls()[0]!.path;
    expect(first).toContain("category=role");
    expect(first).not.toContain("category=added");
    expect(screen.getByRole("checkbox", { name: "Companies, agencies and people added" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Roles pitched or passed" })).toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Everything" }));
    await waitFor(() => expect(timelineCalls().at(-1)!.path).not.toContain("category="));

    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(await screen.findByText("Tick at least one kind of thing to show.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usual" }));
    await screen.findByText("Applied → Screen");
    expect(screen.getByRole("checkbox", { name: "Companies, agencies and people added" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Interviews" })).toBeChecked();
  });

  it("puts a call on the row of each role that came up on it", async () => {
    const call = item({
      id: "meeting:m1",
      at: inDays(-5),
      category: "meeting",
      title: "Call with Alex Recruiter: Catch-up (done)",
      application_id: null,
      role_id: null,
      role_title: null,
      roles: [
        { id: "r1", title: "Backend Engineer", company_name: "Contoso" },
        { id: "r2", title: "SRE", company_name: "Contoso" },
      ],
      people: [{ id: "c1", name: "Alex Recruiter" }],
    });
    const pitch = item({
      id: "role:r2",
      at: inDays(-5),
      category: "role",
      title: "Alex Recruiter pitched SRE at Contoso",
      application_id: null,
      role_id: "r2",
      role_title: "SRE",
    });
    mockApi({
      "/api/v1/timeline": { items: [...ITEMS, pitch, call], now },
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [],
      "/api/v1/health": {},
    });
    renderTimeline();
    fireEvent.click(await screen.findByText("Lanes"));
    const applied = await screen.findByRole("list", { name: "Contoso · Backend Engineer" });
    expect(within(applied).getAllByRole("button")).toHaveLength(3); // its two items and the call
    const pitched = screen.getByRole("list", { name: "Contoso · SRE" });
    expect(within(pitched).getAllByRole("button")).toHaveLength(2); // the pitch and the call
  });
});

describe("timeline: loading, failed and empty", () => {
  const OTHERS = {
    "/api/v1/companies": [],
    "/api/v1/agencies": [],
    "/api/v1/contacts": [],
    "/api/v1/health": {},
  };
  /** The timeline request answers as `answer` says; everything else goes to mockApi. */
  function timelineAnswers(answer: () => "hang" | "fail" | "ok") {
    mockApi({ ...OTHERS, "/api/v1/timeline": { items: ITEMS, now } });
    const others = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (!url.includes("/api/v1/timeline")) return others(input, init);
      const how = answer();
      if (how === "hang") return new Promise<Response>(() => {});
      if (how === "fail")
        return Promise.resolve(
          new Response('{"detail":"Failed"}', {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }),
        );
      return others(input, init);
    });
  }

  afterEach(() => vi.useRealTimers());

  it("shows a skeleton while it loads, not the empty text", async () => {
    timelineAnswers(() => "hang");
    renderTimeline();
    expect(await screen.findByTestId("query-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText("Nothing here yet")).toBeNull();
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
  });

  it("says a failed load failed, not that there's nothing, and Retry loads it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let how: "fail" | "ok" = "fail";
    timelineAnswers(() => how);
    renderTimeline();
    await screen.findByTestId("query-loading");
    await vi.advanceTimersByTimeAsync(10_000); // past React Query's retries
    const failed = (await screen.findByText("Couldn't load this.")).closest<HTMLElement>('[role="status"]')!;
    expect(screen.queryByText("Nothing here yet")).toBeNull();
    expect(screen.queryByText(/Try a longer period/)).toBeNull();
    how = "ok";
    fireEvent.click(within(failed).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Applied → Screen")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
  });

  it("says there's nothing, with the filter advice, only when it loaded empty", async () => {
    mockApi({ ...OTHERS, "/api/v1/timeline": { items: [], now } });
    renderTimeline();
    expect(await screen.findByText("Nothing here yet")).toBeInTheDocument();
    expect(screen.getByText("Try a longer period, tick more kinds, or clear a filter.")).toBeInTheDocument();
    expect(screen.queryByTestId("query-loading")).toBeNull();
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
  });

  it("shows the list once it loads, without the skeleton", async () => {
    mockApi({ ...OTHERS, "/api/v1/timeline": { items: ITEMS, now } });
    renderTimeline();
    expect(await screen.findByText("Applied → Screen")).toBeInTheDocument();
    expect(screen.queryByTestId("query-loading")).toBeNull();
    expect(screen.queryByText("Nothing here yet")).toBeNull();
  });
});
