import type { ApplicationRow } from "../api/client";
import type { Workflow, WorkflowStage } from "../api/hooks";
import { i18n } from "../i18n";

export interface Column {
  stage: WorkflowStage;
  rows: ApplicationRow[];
  // Set when a stage is split into a column per interview round: the round (null for "no round
  // yet"), and a key telling the columns apart (a drop on any of them means the stage).
  round?: number | null;
  key?: string;
}

/** The stage a column (or a drop on it) stands for: round columns are "<stage>#round-<n>". */
export const stageOfColumn = (key: string) => key.replace(/#round-(none|\d+)$/, "");

export const columnKey = (column: Column) => column.key ?? column.stage.id;

const MAX_GAP_FILLED = 6;

/** The column's heading: the stage, and its round when split ("Interviewing · Round 2"). */
export function columnTitle(column: Column): string {
  const stage = column.stage.name;
  if (column.round === undefined) return stage;
  return column.round === null
    ? i18n.t("applications:board.noRoundYet", { stage })
    : i18n.t("applications:board.round", { stage, round: column.round });
}

/** A drop on a round's own column: rounds follow the interviews you add, so cards can't be put there. */
export const isRoundColumn = (key: string) => /#round-\d+$/.test(key);

/**
 * An interviewing stage (its id says "interview": names are yours, and may be in any language)
 * becomes a column per round, Round 1
 * up to the furthest any application has got (the current or next round), so you can see how
 * far each has got. "No round yet" always comes first:
 * it's where an application moving into the stage lands (rounds go in order, from the
 * interviews you add, so you can't drop straight into Round 2).
 */
export function splitByRound(columns: Column[]): Column[] {
  return columns.flatMap((column) => {
    const roundOf = (row: ApplicationRow) => row.current_round?.round ?? null;
    const interviewing = /interview/i.test(column.stage.id);
    if (column.stage.kind !== "active" || !interviewing) return [column];
    // Every round up to the furthest, so progress reads left to right; past MAX_GAP_FILLED,
    // only rounds someone's at (a mistyped "Round 12" doesn't add a dozen empty columns).
    const at = new Set(column.rows.map(roundOf).filter((n): n is number => n !== null));
    const furthest = Math.max(0, ...at);
    const rounds = [
      null,
      ...Array.from({ length: furthest }, (_, i) => i + 1).filter((n) => n <= MAX_GAP_FILLED || at.has(n)),
    ];
    return rounds.map((round) => ({
      stage: column.stage,
      rows: column.rows.filter((r) => roundOf(r) === round),
      round,
      key: `${column.stage.id}#round-${round ?? "none"}`,
    }));
  });
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
