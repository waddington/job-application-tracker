import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Flow, FlowNode } from "../api/insightHooks";
import { nodeName, SankeyChart } from "./SankeyChart";

// The Sankey's text comes from locales/en/insights.ts (i18n-sankey). Nothing here can be seen by the
// before/after snapshot: hover captions and titles aren't in the page's text.

const node = (over: Partial<FlowNode>): FlowNode => ({
  id: "x",
  name: "the API's English",
  kind: "active",
  color: "blue",
  reached: 1,
  current: 0,
  ...over,
});

const NAMES: [NonNullable<FlowNode["code"]>, string][] = [
  ["source_recruiter", "Through a recruiter"],
  ["source_referral", "Referred"],
  ["source_found", "You found it"],
  ["deciding", "Deciding whether to apply"],
  ["passed", "Decided not to apply"],
  ["holding_applied", "Waiting to hear back"],
  ["holding_screen", "Still screening"],
  ["holding_interviewing", "Still interviewing"],
  ["holding_final", "In final rounds"],
  ["holding_offer", "Deciding on the offer"],
  ["pitched", "Pitched to you"],
  ["applied", "Applied"],
  ["in_progress", "In progress"],
  ["offer", "Offer"],
  ["closed", "Closed"],
  ["ghosted", "Ghosted"],
];

describe("a node's name", () => {
  it.each(NAMES)("%s reads %s", (code, name) => {
    expect(nodeName(node({ code }))).toBe(name);
  });

  it("says which stage for one of your own, as you wrote it", () => {
    expect(nodeName(node({ code: "holding_other", stage_name: "Q&A <call>" }))).toBe("Still at Q&A <call>");
  });

  it("leaves a stage as you wrote it, whatever its id, and anything from an older server", () => {
    expect(nodeName(node({ id: "applied", name: "Sent off", code: null }))).toBe("Sent off");
    expect(nodeName(node({ name: "Older" }))).toBe("Older");
  });
});

function chart(flow: Flow, unit?: "application" | "role") {
  return render(
    <MantineProvider>
      <SankeyChart flow={flow} unit={unit} />
    </MantineProvider>,
  );
}

const flowOf = (count: number): Flow => ({
  applications: count,
  nodes: [
    node({ id: "a", name: "Applied", reached: count, current: 0 }),
    node({ id: "b", name: "Screen", reached: count, current: count }),
    node({ id: "holding:b", name: "ignored", code: "holding_screen", kind: "holding", reached: count }),
  ],
  links: [
    { source: "a", target: "b", value: count },
    { source: "b", target: "holding:b", value: count },
  ],
});

const titles = (container: HTMLElement) => [...container.querySelectorAll("title")].map((t) => t.textContent);

describe("the chart", () => {
  it("describes itself, in the singular and plural", () => {
    const one = chart(flowOf(1));
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Sankey diagram of 1 application moving through the stages",
    );
    one.unmount();
    const two = chart(flowOf(2));
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Sankey diagram of 2 applications moving through the stages",
    );
    two.unmount();
    const role = chart(flowOf(1), "role");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Sankey diagram of 1 role pitched to you, by what happened to them",
    );
    role.unmount();
    chart(flowOf(2), "role");
    expect(screen.getByRole("img")).toHaveAccessibleName(
      "Sankey diagram of 2 roles pitched to you, by what happened to them",
    );
  });

  it("gives each node's and flow's numbers for applications", () => {
    const { container } = chart(flowOf(2));
    expect(titles(container)).toEqual(
      expect.arrayContaining([
        "Applied: 2 applications reached",
        "Screen: 2 applications reached, 2 still there",
        "Still screening: 2 applications",
        "Applied → Screen: 2 applications (100% of Applied)",
      ]),
    );
  });

  it("uses the singular for one application", () => {
    const { container } = chart(flowOf(1));
    expect(titles(container)).toEqual(
      expect.arrayContaining([
        "Applied: 1 application reached",
        "Screen: 1 application reached, 1 still there",
        "Still screening: 1 application",
        "Applied → Screen: 1 application (100% of Applied)",
      ]),
    );
  });

  it("counts roles, without saying reached", () => {
    const two = chart(flowOf(2), "role");
    expect(titles(two.container)).toEqual(
      expect.arrayContaining(["Applied: 2 roles", "Applied → Screen: 2 roles (100% of Applied)"]),
    );
    two.unmount();
    const one = chart(flowOf(1), "role");
    expect(titles(one.container)).toEqual(
      expect.arrayContaining(["Applied: 1 role", "Applied → Screen: 1 role (100% of Applied)"]),
    );
  });

  it("shows the hint, then a node's numbers on hover", () => {
    const { container } = chart(flowOf(2));
    expect(screen.getByText("Hover over a stage or a flow to see its numbers.")).toBeInTheDocument();
    fireEvent.mouseEnter(container.querySelector("g[fill='none'] ~ g")!);
    // Its title and, now, the caption under the chart.
    expect(screen.getAllByText("Applied: 2 applications reached")).toHaveLength(2);
    expect(screen.queryByText("Hover over a stage or a flow to see its numbers.")).toBeNull();
  });

  it("labels a node in your language, not the API's English", () => {
    const { container } = chart(flowOf(2));
    expect(container.textContent).toContain("Still screening");
    expect(container.textContent).not.toContain("ignored");
  });
});
