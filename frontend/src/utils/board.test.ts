import { describe, expect, it } from "vitest";

import type { ApplicationRow } from "../api/client";
import type { Workflow } from "../api/hooks";
import { row, WORKFLOW } from "../test/mockApi";
import { buildColumns, canDrop, visibleColumns } from "./board";

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

  it("only allows the workflow's moves", () => {
    expect(canDrop(wf, "applied", "screen")).toBe(true);
    expect(canDrop(wf, "applied", "interested")).toBe(false);
    expect(canDrop(wf, "applied", "applied")).toBe(false);
    expect(canDrop(wf, "rejected", "applied")).toBe(false);
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
