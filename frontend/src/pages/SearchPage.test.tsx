import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  const router = makeRouter(createMemoryHistory({ initialEntries: [path] }));
  render(<App router={router} />);
  return router;
}

const hit = (overrides: Record<string, unknown>) => ({
  subtitle: null,
  snippet: null,
  updated: "2026-09-28T10:00:00Z",
  ...overrides,
});

const HITS = [
  hit({ kind: "company", id: "co1", title: "Contoso", link: "/companies/co1" }),
  hit({
    kind: "interview",
    id: "i1",
    title: "Round 2 · System design",
    subtitle: "Contoso · Backend Engineer",
    link: "/applications/a1",
    snippet: "…asked about Contoso's payments ledger…",
  }),
  hit({ kind: "link", id: "l1", title: "Take-home brief", link: "https://docs.example.com/d/brief" }),
];

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("search", () => {
  it("searches from the header and shows grouped, linked results", async () => {
    const calls = mockApi({
      "/api/v1/search": HITS,
      "/api/v1/next-actions": {
        follow_ups: [],
        stale: [],
        upcoming: [],
        awaiting_outcome: [],
        today: "2026-09-30",
      },
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/health": {},
    });
    const router = renderAt("/");
    const box = await screen.findByRole("textbox", { name: "Search everything" });
    fireEvent.change(box, { target: { value: "contoso payments" } });
    fireEvent.submit(box.closest("form")!);

    expect(
      await screen.findByRole("heading", { name: "Results for “contoso payments”" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/search");
    await waitFor(() =>
      expect(
        calls.some((c) => new URL(c.path, "http://x").searchParams.get("q") === "contoso payments"),
      ).toBe(true),
    );
    const card = (await screen.findByText("3 results")).closest(".mantine-Card-root") as HTMLElement;
    expect(within(card).getByRole("link", { name: "Contoso" })).toHaveAttribute("href", "/companies/co1");
    expect(within(card).getByRole("link", { name: "Round 2 · System design" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    // External links open in a new tab.
    expect(within(card).getByRole("link", { name: "Take-home brief" })).toHaveAttribute("target", "_blank");
    // Matching words are highlighted in snippets.
    expect(within(card).getByText("payments", { selector: "mark" })).toBeInTheDocument();
  });

  it("keeps numbers as text and explains no results", async () => {
    const calls = mockApi({ "/api/v1/search": [], "/api/v1/health": {} });
    renderAt("/search?q=2026");
    expect(await screen.findByText(/Nothing matches every word of “2026”/)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search everything" })).toHaveValue("2026");
    expect(calls.some((c) => new URL(c.path, "http://x").searchParams.get("q") === "2026")).toBe(true);
  });
});
