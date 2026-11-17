import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApiAnswering, row, WORKFLOW } from "../test/mockApi";

// loading-state-card-spinners: a card that loads its own data shows a skeleton shaped like it while its
// request is out, never a spinner; a failed load says so with Retry (these had no failed line: they spun
// for ever or showed nothing); a loaded one shows its content.

const APP = {
  ...row(),
  events: [],
  contacts: [],
  allowed_next: [],
  suggested_next: [],
  can_undo: false,
  documents: [],
  duplicates: [],
};
const NOTE = {
  id: "n1",
  title: "Screen prep",
  links: [],
  path: "notes/screen-prep.md",
  excerpt: "Questions",
  created_at: "2026-10-01T10:00:00Z",
  updated_at: "2026-10-01T10:00:00Z",
};
const VERSION = {
  id: "v1",
  label: "v2",
  notes: null,
  created_at: "2026-10-02T12:00:00",
  used_in: 1,
  file: null,
};
const USED = {
  link_id: "l1",
  application_id: "a1",
  company_name: "Contoso",
  role_title: "Engineer",
  version_label: "v2",
  sent_on: "2026-10-03",
  stage: "applied",
  stage_name: "Applied",
};
const ROUTES = {
  "/api/v1/workflow": WORKFLOW,
  "/api/v1/health": {},
  "/api/v1/applications": [row()],
  "/api/v1/applications/a1": APP,
  "/api/v1/offers": [],
  "/api/v1/notes": [NOTE],
  "/api/v1/notes/n1": { ...NOTE, body: "Ask about the on-call rota." },
  "/api/v1/documents": [{ id: "d1", kind: "cv", name: "Backend CV", versions: [VERSION] }],
  "/api/v1/documents/d1": { used_in: [USED] },
  "/api/v1/cv-files": [],
};

const card = (title: string) =>
  screen.getByRole("heading", { name: title }).closest<HTMLElement>(".mantine-Card-root")!;

/** Each card: where it is, the request it waits on, what opens it, where it shows and what it shows loaded. */
const CARDS = [
  {
    name: "the Offer card",
    path: "/applications/a1",
    request: "/api/v1/offers",
    open: async () => void (await screen.findByRole("heading", { name: "Offer" })),
    where: () => card("Offer"),
    loaded: /^No offer yet\./,
  },
  {
    name: "the Notes card",
    path: "/applications/a1",
    request: "/api/v1/notes",
    open: async () => void (await screen.findByRole("heading", { name: "Notes" })),
    where: () => card("Notes"),
    loaded: "Screen prep",
  },
  {
    name: "an opened note's text",
    path: "/notes",
    request: "/api/v1/notes/n1",
    open: async () => fireEvent.click(await screen.findByRole("button", { name: /^Screen prep/ })),
    where: () =>
      screen.getByRole("button", { name: /^Screen prep/ }).closest<HTMLElement>(".mantine-Card-root")!,
    loaded: "Ask about the on-call rota.",
  },
  {
    name: "where a document was used",
    path: "/documents",
    request: "/api/v1/documents/d1",
    open: async () => fireEvent.click(await screen.findByRole("button", { name: "Where it was used (1)" })),
    where: () => card("Backend CV"),
    loaded: "v2 · 3 Oct 2026 · Applied",
  },
];

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe.each(CARDS)("$name", ({ path, request, open, where, loaded }) => {
  // Only this request: the others (the application, the note list…) answer at once.
  const answering = (how: () => "hang" | "fail" | "ok") =>
    mockApiAnswering(ROUTES, request, (sent) => (sent.split("?")[0] === request ? how() : "ok"));

  it("shows a skeleton while it loads, not a spinner", async () => {
    answering(() => "hang");
    renderAt(path);
    await open();
    const busy = await within(where()).findByTestId("query-loading");
    expect(busy).toHaveAttribute("aria-busy", "true");
    expect(busy.querySelectorAll(".mantine-Skeleton-root").length).toBeGreaterThan(0);
    expect(where().querySelectorAll(".mantine-Loader-root")).toHaveLength(0);
    expect(within(where()).queryByText(loaded)).toBeNull();
  });

  it("says a failed load failed, and Retry loads it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let how: "fail" | "ok" = "fail";
    answering(() => how);
    renderAt(path);
    await open();
    await vi.advanceTimersByTimeAsync(10_000); // past React Query's retries
    const failed = (await within(where()).findByText("Couldn't load this.")).closest<HTMLElement>(
      '[role="status"]',
    )!;
    expect(where().querySelectorAll(".mantine-Loader-root")).toHaveLength(0);
    expect(within(where()).queryByTestId("query-loading")).toBeNull();
    how = "ok";
    fireEvent.click(within(failed).getByRole("button", { name: "Retry" }));
    expect(await within(where()).findByText(loaded)).toBeInTheDocument();
    expect(within(where()).queryByText("Couldn't load this.")).toBeNull();
  });

  it("shows its content once it loads, with no skeleton left", async () => {
    answering(() => "ok");
    renderAt(path);
    await open();
    expect(await within(where()).findByText(loaded)).toBeInTheDocument();
    await waitFor(() => expect(within(where()).queryByTestId("query-loading")).toBeNull());
  });
});

describe("the application quick view", () => {
  const answering = (how: "hang" | "fail" | "ok") =>
    mockApiAnswering(ROUTES, "/api/v1/applications/a1", (sent) =>
      sent.split("?")[0] === "/api/v1/applications/a1" ? how : "ok",
    );
  const openDrawer = async () => {
    renderAt("/applications");
    fireEvent.click(await screen.findByRole("row", { name: "Open Backend Engineer at Contoso" }));
    return screen.findByRole("dialog");
  };

  it("shows a skeleton of the summary and its first cards while it loads, not a spinner", async () => {
    answering("hang");
    const drawer = await openDrawer();
    const busy = await within(drawer).findByTestId("query-loading");
    expect(busy.querySelectorAll(".mantine-Skeleton-root").length).toBeGreaterThan(8);
    expect(drawer.querySelectorAll(".mantine-Loader-root")).toHaveLength(0);
    expect(within(drawer).queryByRole("heading", { name: "Backend Engineer" })).toBeNull();
  });

  it("keeps its own message when the application can't load", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    answering("fail");
    const drawer = await openDrawer();
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await within(drawer).findByText("Couldn't load this application")).toBeInTheDocument();
    expect(within(drawer).queryByTestId("query-loading")).toBeNull();
  });

  it("shows the application once it loads", async () => {
    answering("ok");
    const drawer = await openDrawer();
    expect(await within(drawer).findByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect(within(drawer).queryByTestId("query-loading")).toBeNull();
  });
});
