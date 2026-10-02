import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { item, mockApi } from "../test/mockApi";

function renderTimeline() {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/timeline"] }))} />);
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

    fireEvent.click(screen.getByRole("checkbox", { name: "Interviews" }));
    await waitFor(() =>
      expect(
        calls.some((c) => c.path.startsWith("/api/v1/timeline") && c.path.includes("category=interview")),
      ).toBe(true),
    );
  });

  it("draws a lane per application, company or person", async () => {
    mockApi({
      "/api/v1/timeline": { items: ITEMS, now },
      "/api/v1/companies": [],
      "/api/v1/agencies": [],
      "/api/v1/contacts": [],
      "/api/v1/health": {},
    });
    renderTimeline();
    fireEvent.click(await screen.findByText("Lanes"));
    const lane = await screen.findByRole("list", { name: "Contoso · Backend Engineer" });
    expect(within(lane).getAllByRole("button")).toHaveLength(2);
    fireEvent.click(screen.getByText("Company"));
    expect(await screen.findByRole("list", { name: "Fabrikam" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Contoso" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Person"));
    expect(
      within(await screen.findByRole("list", { name: "Alex Recruiter" })).getAllByRole("button"),
    ).toHaveLength(2);
  });
});
