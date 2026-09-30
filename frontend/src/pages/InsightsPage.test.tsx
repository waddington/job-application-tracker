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

afterEach(() => vi.unstubAllGlobals());

describe("insights", () => {
  it("draws the flow and shows counts on hover", async () => {
    mockApi({ "/api/v1/insights/flow": FLOW, "/api/v1/health": {} });
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

    const table = screen.getByRole("table");
    expect(
      within(table)
        .getAllByRole("row")
        .map((r) => r.textContent),
    ).toEqual(["StageReachedStill there", "Applied31", "Screen20", "Offer11", "Rejected11"]);
  });

  it("filters by date range and route", async () => {
    const calls = mockApi({ "/api/v1/insights/flow": FLOW, "/api/v1/health": {} });
    renderAt("/insights");
    await screen.findByRole("img", { name: /Sankey diagram/ });

    fireEvent.click(screen.getByText("Last 30 days"));
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith("/api/v1/insights/flow")).at(-1)!;
      const since = new URL(last.path, "http://localhost").searchParams.get("since");
      expect(since).not.toBeNull();
      const days = (Date.now() - Date.parse(since!)) / 86_400_000;
      expect(days).toBeGreaterThan(29.9);
      expect(days).toBeLessThan(30.1);
    });

    fireEvent.click(screen.getAllByLabelText("Route")[0]!);
    fireEvent.click(await screen.findByText("Via an agency"));
    await waitFor(() => {
      const last = calls.filter((c) => c.path.startsWith("/api/v1/insights/flow")).at(-1)!;
      expect(last.path).toContain("route=agency");
    });
  });

  it("explains an empty flow", async () => {
    mockApi({ "/api/v1/insights/flow": { applications: 0, nodes: [], links: [] }, "/api/v1/health": {} });
    renderAt("/insights");
    expect(await screen.findByText("No applications match these filters.")).toBeInTheDocument();
  });
});
