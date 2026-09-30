import type { ApplicationRow } from "../api/client";
import type { Workflow, WorkflowStage } from "../api/hooks";

export interface Column {
  stage: WorkflowStage;
  rows: ApplicationRow[];
}

/** One column per workflow stage, in workflow order. Unknown stages (removed from config) go last. */
export function buildColumns(workflow: Workflow, rows: ApplicationRow[]): Column[] {
  const byStage = new Map<string, ApplicationRow[]>();
  for (const row of rows) {
    const list = byStage.get(row.stage) ?? [];
    list.push(row);
    byStage.set(row.stage, list);
  }
  const columns: Column[] = workflow.stages.map((stage) => ({ stage, rows: byStage.get(stage.id) ?? [] }));
  for (const [id, list] of byStage) {
    if (!workflow.stages.some((s) => s.id === id)) {
      columns.push({
        stage: {
          id,
          name: id,
          kind: "active",
          stale_after_days: null,
          color: "gray",
          next: [],
          // A stage since removed from config.toml: with any-to-any moves, it can go anywhere.
          allowed_next: workflow.transitions === "any" ? workflow.stages.map((s) => s.id) : [],
          suggested_next: [],
        },
        rows: list,
      });
    }
  }
  return columns;
}

export function canDrop(workflow: Workflow, from: string, to: string): boolean {
  if (from === to) return false;
  // Any-to-any: fine even from a stage since removed from config.toml.
  if (workflow.transitions === "any") return workflow.stages.some((s) => s.id === to);
  return workflow.stages.find((s) => s.id === from)?.allowed_next.includes(to) ?? false;
}

/** Is `to` one of the usual next stages from `from` (highlighted while dragging)? */
export function isSuggested(workflow: Workflow, from: string, to: string): boolean {
  return workflow.stages.find((s) => s.id === from)?.suggested_next.includes(to) ?? false;
}

/** Closed stages are tucked away unless a drag is in progress or the user asked to see them. */
export function visibleColumns(
  columns: Column[],
  opts: { showClosed: boolean; dragging: boolean },
): Column[] {
  return columns.filter((c) => c.stage.kind !== "closed" || opts.showClosed || opts.dragging);
}
