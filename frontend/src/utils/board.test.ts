import { describe, expect, it } from "vitest";

import type { ApplicationRow } from "../api/client";
import type { Workflow } from "../api/hooks";
import { row, WORKFLOW } from "../test/mockApi";
import {
  buildColumns,
  canDrop,
  columnKey,
  columnTitle,
  isRoundColumn,
  isSuggested,
  splitByRound,
  stageOfColumn,
  visibleColumns,
} from "./board";

const wf = WORKFLOW as unknown as Workflow;
const rows = [
  row({ id: "a", stage: "applied" }),
  row({ id: "b", stage: "applied" }),
  row({ id: "c", stage: "rejected" }),
  row({ id: "d", stage: "removed-stage" }),
] as unknown as ApplicationRow[];

describe("board helpers", () => {
  it("groups rows into workflow-ordered columns, unknown stages last", () => {
    const cols = buildColumns(wf, rows);
    expect(cols.map((c) => c.stage.id)).toEqual([
      "interested",
      "applied",
      "screen",
      "rejected",
      "removed-stage",
    ]);
    expect(cols.find((c) => c.stage.id === "applied")!.rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("only allows the workflow's moves when transitions are configured", () => {
    expect(canDrop(wf, "applied", "screen")).toBe(true);
    expect(canDrop(wf, "applied", "interested")).toBe(false);
    expect(canDrop(wf, "applied", "applied")).toBe(false);
    expect(canDrop(wf, "rejected", "applied")).toBe(false);
  });

  it("allows any move, and suggests the usual ones, when transitions are any", () => {
    const any = { ...wf, transitions: "any" } as Workflow;
    expect(canDrop(any, "applied", "interested")).toBe(true);
    expect(canDrop(any, "rejected", "applied")).toBe(true);
    expect(canDrop(any, "removed-stage", "applied")).toBe(true); // a stage since removed
    expect(canDrop(any, "applied", "applied")).toBe(false);
    expect(canDrop(any, "applied", "nowhere")).toBe(false);
    expect(isSuggested(any, "applied", "screen")).toBe(true);
    expect(isSuggested(any, "applied", "interested")).toBe(false);
  });

  it("hides closed stages unless asked or dragging", () => {
    const cols = buildColumns(wf, rows);
    const ids = (opts: { showClosed: boolean; dragging: boolean }) =>
      visibleColumns(cols, opts).map((c) => c.stage.id);
    expect(ids({ showClosed: false, dragging: false })).not.toContain("rejected");
    expect(ids({ showClosed: true, dragging: false })).toContain("rejected");
    expect(ids({ showClosed: false, dragging: true })).toContain("rejected");
  });

  it("finds the interviewing stage by its id, whatever its name says", () => {
    const stages = [
      ...wf.stages,
      { ...wf.stages[2]!, id: "interviewing", name: "Entretiens" }, // a name in another language
      { ...wf.stages[2]!, id: "panel", name: "Interviews" }, // "interview" only in the name
    ];
    const cols = splitByRound(buildColumns({ ...wf, stages } as Workflow, rows));
    expect(cols.filter((c) => c.stage.id === "interviewing").map(columnTitle)).toEqual([
      "Entretiens · No round yet",
    ]);
    expect(cols.filter((c) => c.stage.id === "panel").map(columnTitle)).toEqual(["Interviews"]);
  });

  it("splits a stage into a column per interview round, No round yet first", () => {
    const round = (n: number) => ({ round: n, label: `Round ${n}` });
    const stages = [...wf.stages, { ...wf.stages[2]!, id: "interviewing", name: "Interviewing" }];
    const withInterviewing = { ...wf, stages } as Workflow;
    const going = [
      row({ id: "i1", stage: "interviewing", current_round: round(3) }),
      row({ id: "i2", stage: "interviewing", current_round: round(1) }),
      row({ id: "i3", stage: "interviewing" }),
      row({ id: "s1", stage: "screen", current_round: round(1) }), // not an interviewing stage
    ] as unknown as ApplicationRow[];
    const cols = splitByRound(buildColumns(withInterviewing, [...rows, ...going]));
    const interviewing = cols.filter((c) => c.stage.id === "interviewing");
    // No round yet, then every round up to the furthest (Round 2 empty but shown).
    expect(interviewing.map(columnTitle)).toEqual([
      "Interviewing · No round yet",
      "Interviewing · Round 1",
      "Interviewing · Round 2",
      "Interviewing · Round 3",
    ]);
    expect(interviewing.map((c) => c.rows.map((r) => r.id))).toEqual([["i3"], ["i2"], [], ["i1"]]);
    // Other stages stay as they were, even with rounds.
    expect(cols.find((c) => c.stage.id === "screen")!.round).toBeUndefined();
    expect(columnTitle(cols.find((c) => c.stage.id === "applied")!)).toBe("Applied");
    // Drops: any column means its stage, but only "No round yet" takes a card.
    const keys = interviewing.map(columnKey);
    expect(keys).toEqual([
      "interviewing#round-none",
      "interviewing#round-1",
      "interviewing#round-2",
      "interviewing#round-3",
    ]);
    expect(keys.map(stageOfColumn)).toEqual(["interviewing", "interviewing", "interviewing", "interviewing"]);
    expect(keys.map(isRoundColumn)).toEqual([false, true, true, true]);
    // A far-off round (a typo, say) doesn't fill in a dozen empty columns.
    const far = splitByRound(
      buildColumns(withInterviewing, [
        row({ id: "f1", stage: "interviewing", current_round: round(12) }),
      ] as unknown as ApplicationRow[]),
    ).filter((c) => c.stage.id === "interviewing");
    expect(far.map((c) => c.round)).toEqual([null, 1, 2, 3, 4, 5, 6, 12]);
    // A stage id with a "#" in it still reads as itself.
    expect(stageOfColumn("odd#stage")).toBe("odd#stage");
    expect(stageOfColumn("odd#stage#round-3")).toBe("odd#stage");
    expect(isRoundColumn("applied")).toBe(false);
  });
});
