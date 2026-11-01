import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Workflow, WorkflowStage } from "../api/hooks";
import type { FlowNode } from "../api/insightHooks";
import type { RoleSummary } from "../api/roleHooks";
import { roleBadge } from "../api/roleHooks";
import type { TimelineItem } from "../api/timelineHooks";
import { ChaseActions } from "../components/ChaseActions";
import { nodeName } from "../components/SankeyChart";
import { StageBadge } from "../components/StageBadge";
import { timelineTitle } from "../components/timelineTitle";
import { i18n } from "../i18n";
import { PSEUDO } from "../i18n/language";
import { pseudo } from "../i18n/pseudo";
import defaults from "../locales/defaultStages.json";
import stages from "../locales/en/stages";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import { columnTitle, planDrop } from "./board";
import { stageName } from "./stageName";

const APPLIED = pseudo("Applied");
const moved = (m: object) => ({ kind: "stage-event", people: [], stage_move: m }) as unknown as TimelineItem;
const node = (over: Partial<FlowNode>) =>
  ({ id: "x", name: "x", kind: "active", color: "blue", reached: 1, current: 0, ...over }) as FlowNode;
const stage = (id: string, name: string) => ({ ...WORKFLOW.stages[0]!, id, name }) as WorkflowStage;
const closedRole = (closed_stage: string | undefined, closed_as: string) =>
  ({ status: "closed", closed_stage, closed_as }) as RoleSummary;

function wrap(children: ReactNode) {
  return (
    <MantineProvider>
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    </MantineProvider>
  );
}

describe("in English", () => {
  it("names every default stage exactly as the default workflow does", () => {
    expect(stages).toEqual(defaults);
    for (const [id, name] of Object.entries(defaults)) expect(stageName({ id, name })).toBe(name);
    expect(defaults.screen).toBe("Screen");
  });

  it("leaves everything else as written", () => {
    expect(stageName({ id: "applied", name: "Sent" })).toBe("Sent");
  });
});

describe("in another language", () => {
  beforeEach(async () => {
    await i18n.changeLanguage(PSEUDO);
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    await i18n.changeLanguage("en");
  });

  it("translates only a stage with both its default id and its default name", () => {
    expect(stageName({ id: "applied", name: "Applied" })).toBe(APPLIED);
    expect(stageName({ id: "applied", name: "Sent" })).toBe("Sent"); // renamed
    expect(stageName({ id: "take_home", name: "Take-home task" })).toBe("Take-home task"); // added
    expect(stageName({ id: "sent", name: "Applied" })).toBe("Applied"); // another stage, with that name
    expect(stageName({ id: "applied", name: "applied" })).toBe("applied"); // removed: its id, shown
    expect(stageName({ id: "constructor", name: "Applied" })).toBe("Applied");
    expect(stageName({ name: "Applied" })).toBe("Applied"); // an older server sends no id
    expect(stageName({ id: "applied", name: "Applied" }, "en")).toBe("Applied");
  });

  it("does so on a badge, whether or not the workflow has loaded", () => {
    render(
      wrap(
        <>
          <StageBadge id="applied" stage={stage("applied", "Applied")} fallback="Applied" />
          <StageBadge id="screen" stage={undefined} fallback="Screen" />
          <StageBadge id="applied" stage={stage("applied", "Sent")} fallback="Sent" />
          <StageBadge id="take_home" stage={undefined} fallback="Take-home task" />
        </>,
      ),
    );
    expect(screen.getByText(APPLIED)).toBeInTheDocument();
    expect(screen.getByText(pseudo("Screen"))).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
    expect(screen.getByText("Take-home task")).toBeInTheDocument();
  });

  it("does so in board columns, round columns and what a drop says", () => {
    const interviewing = stage("interviewing", "Interviewing");
    expect(columnTitle({ stage: stage("applied", "Applied"), rows: [] })).toBe(APPLIED);
    expect(columnTitle({ stage: stage("applied", "Sent"), rows: [] })).toBe("Sent");
    expect(columnTitle({ stage: interviewing, rows: [], round: 2 })).toContain(pseudo("Interviewing"));
    expect(columnTitle({ stage: stage("take_home", "Take-home task"), rows: [], round: null })).toContain(
      "Take-home task",
    );
    const flow = (transitions: "any" | "configured") =>
      ({
        ...WORKFLOW,
        transitions,
        stages: [{ ...stage("applied", "Applied"), allowed_next: [] }, stage("screen", "Sifted")],
      }) as Workflow;
    const drop = (w: Workflow) => planDrop(w, row({ stage: "applied" }), "screen", "applied");
    // The words are translated; what's moved to stays the id.
    expect(drop(flow("any"))).toMatchObject({ do: "move", to: "screen" });
    const refused = drop(flow("configured"));
    expect(refused.do === "refuse" && refused.message).toContain(APPLIED);
    expect(refused.do === "refuse" && refused.message).toContain("Sifted");
  });

  it("does so in Sankey nodes, Still at included, and leaves a coded node alone", () => {
    const lng = PSEUDO;
    expect(nodeName(node({ id: "applied", name: "Applied" }), lng)).toBe(APPLIED);
    expect(nodeName(node({ id: "applied", name: "Sent" }), lng)).toBe("Sent");
    expect(nodeName(node({ id: "take_home", name: "Take-home task" }), lng)).toBe("Take-home task");
    const still = (id: string, stage_name: string) =>
      nodeName(node({ id: `holding:${id}`, code: "holding_other", stage_name }), lng);
    expect(still("interested", "Interested")).toContain(pseudo("Interested"));
    expect(still("take_home", "Take-home task")).toContain("Take-home task");
  });

  it("does so in timeline titles and a closed role's badge", () => {
    const title = timelineTitle(
      moved({ from_name: "Applied", to_name: "Sifted", from_stage: "applied", to_stage: "screen" }),
    );
    expect(title).toContain(APPLIED);
    expect(title).toContain("Sifted");
    // An older server sends only the names.
    expect(timelineTitle(moved({ from_name: null, to_name: "Applied" }))).toContain("Applied");
    expect(roleBadge(closedRole("withdrawn", "Withdrawn")).label).toBe(pseudo("Withdrawn"));
    expect(roleBadge(closedRole("withdrawn", "Gave up")).label).toBe("Gave up");
    expect(roleBadge(closedRole(undefined, "Withdrawn")).label).toBe("Withdrawn");
  });

  it("shows the Ghosted button translated, but moves by id and keeps the name as written", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const calls = mockApi({
      "/api/v1/workflow": {
        ...WORKFLOW,
        transitions: "any",
        stages: [...WORKFLOW.stages, stage("ghosted", "Ghosted")],
      },
      "POST /api/v1/applications/a1/move": row({ id: "a1", stage: "ghosted" }),
    });
    render(wrap(<ChaseActions row={row({ id: "a1", stage: "applied" })} />));
    fireEvent.click(await screen.findByText(pseudo("Ghosted")));
    await waitFor(() => expect(calls.some((c) => c.method === "POST")).toBe(true));
    const body = calls.find((c) => c.method === "POST")?.body as Record<string, unknown>;
    expect(body.to_stage).toBe("ghosted");
    expect(JSON.stringify(body)).not.toContain(pseudo("Ghosted"));
  });
});
