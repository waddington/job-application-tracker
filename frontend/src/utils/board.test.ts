import { describe, expect, it } from "vitest";

import type { ApplicationRow } from "../api/client";
import type { Workflow } from "../api/hooks";
import { row, WORKFLOW } from "../test/mockApi";
import { buildColumns, canDrop, isSuggested, visibleColumns } from "./board";

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
});
