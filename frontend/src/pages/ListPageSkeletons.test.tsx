import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApiAnswering, row, WORKFLOW } from "../test/mockApi";

// loading-state-page-skeletons: while a list page's main request is out it shows a skeleton under its
// own heading, never a spinner or its empty text; a failed load says so; a loaded one shows the list.

const NOTHING = {
  overdue: [],
  due_soon: [],
  stale: [],
  upcoming: [],
  needs_outcome: [],
  meetings_upcoming: [],
  meetings_to_close: [],
  meetings_needs_new_time: [],
  offer_deadlines: [],
  roles_to_decide: [],
  todos: [],
};
const ROUTES = {
  "/api/v1/workflow": WORKFLOW,
  "/api/v1/health": {},
  "/api/v1/applications": [],
  "/api/v1/companies": [],
  "/api/v1/agencies": [],
  "/api/v1/contacts": [],
  "/api/v1/role-summaries": [],
  "/api/v1/interviews": [],
  "/api/v1/offers": [],
  "/api/v1/notes": [],
  "/api/v1/documents": [],
  "/api/v1/documents/cv-files": [],
  "/api/v1/meetings": [],
  "/api/v1/todos": [],
  "/api/v1/next-actions": NOTHING,
  "/api/v1/timeline": { items: [], now: "2026-10-02T10:00:00Z" },
};

/** Each list page, the request it waits on, its heading and the text it shows once it loads (empty). */
const PAGES = [
  {
    path: "/applications",
    request: "/api/v1/applications",
    heading: "Applications",
    loaded: "No applications yet",
  },
  { path: "/companies", request: "/api/v1/companies", heading: "Companies", loaded: /^No companies yet/ },
  { path: "/roles", request: "/api/v1/role-summaries", heading: "Roles", loaded: /^Nothing to decide/ },
  { path: "/recruiters", request: "/api/v1/contacts", heading: "Recruiters", loaded: /^No one yet/ },
  { path: "/interviews", request: "/api/v1/interviews", heading: "Interviews", loaded: /^Nothing booked/ },
  { path: "/offers", request: "/api/v1/offers", heading: "Offers", loaded: /^No offers yet/ },
  { path: "/notes", request: "/api/v1/notes", heading: "Notes", loaded: /^No notes yet\. Notes are/ },
  { path: "/documents", request: "/api/v1/documents", heading: "Documents", loaded: /^Add your CV/ },
];

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}
const spinners = () => document.querySelectorAll(".mantine-Loader-root");

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("jat.interviews.view", JSON.stringify("list")); // the calendar has no empty text
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each(PAGES)("$path", ({ path, request, heading, loaded }) => {
  // /documents is also the start of /documents/cv-files: hold only the list itself.
  const answering = (how: () => "hang" | "fail" | "ok") =>
    mockApiAnswering(ROUTES, request, (sent) => (sent.startsWith("/api/v1/documents/") ? "ok" : how()));

  it("shows a skeleton under its heading while it loads, not a spinner or its empty text", async () => {
    answering(() => "hang");
    renderAt(path);
    expect(await screen.findByRole("heading", { name: heading, level: 2 })).toBeInTheDocument();
    expect(await screen.findByTestId("query-loading")).toHaveAttribute("aria-busy", "true");
    expect(spinners()).toHaveLength(0);
    expect(screen.queryByText(loaded)).toBeNull();
  });

  it("says a failed load failed, not that there's nothing, and Retry loads it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let how: "fail" | "ok" = "fail";
    answering(() => how);
    renderAt(path);
    await screen.findByTestId("query-loading");
    await vi.advanceTimersByTimeAsync(10_000); // past React Query's retries
    const failed = (await screen.findByText("Couldn't load this.")).closest<HTMLElement>('[role="status"]')!;
    expect(screen.queryByText(loaded)).toBeNull();
    how = "ok";
    fireEvent.click(within(failed).getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(loaded)).toBeInTheDocument();
    expect(screen.queryByTestId("query-loading")).toBeNull();
  });
});

describe("Today", () => {
  const answering = (how: () => "hang" | "fail") =>
    mockApiAnswering({ ...ROUTES, "/api/v1/applications": [row()] }, "/api/v1/next-actions", how);

  it("shows a skeleton under its heading while it loads, not a spinner", async () => {
    answering(() => "hang");
    renderAt("/");
    expect(await screen.findByRole("heading", { name: "Today", level: 2 })).toBeInTheDocument();
    expect(await screen.findByTestId("query-loading")).toHaveAttribute("aria-busy", "true");
    expect(spinners()).toHaveLength(0);
  });

  it("keeps its own text when it can't load", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    answering(() => "fail");
    renderAt("/");
    await screen.findByTestId("query-loading");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(
      await screen.findByText("Couldn't load what's next. Is the tracker still running?"),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("query-loading")).toBeNull();
  });
});

describe("Insights", () => {
  /** The whole picture's card, its flow answering as `how` says (the other Insights requests fail). */
  async function wholePicture(how: "hang" | "fail") {
    mockApiAnswering(ROUTES, "/api/v1/insights/", (sent) =>
      sent.startsWith("/api/v1/insights/whole-flow") ? how : "fail",
    );
    renderAt("/insights");
    const title = await screen.findByRole("heading", { name: "The whole picture" });
    return title.closest<HTMLElement>(".mantine-Card-root")!;
  }

  it("shows the whole picture's skeleton while it loads, not a spinner", async () => {
    const card = await wholePicture("hang");
    expect(await within(card).findByTestId("query-loading")).toHaveAttribute("aria-busy", "true");
    expect(card.querySelectorAll(".mantine-Loader-root")).toHaveLength(0);
  });

  it("keeps its own text when the whole picture can't load", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const card = await wholePicture("fail");
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await within(card).findByText("Couldn't load the whole picture.")).toBeInTheDocument();
    expect(within(card).queryByTestId("query-loading")).toBeNull();
  });
});
