import { Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import type { Flow, FlowLink, FlowNode } from "../api/insightHooks";
import { i18n } from "../i18n";
import { stageName } from "../utils/stageName";

type Node = SankeyNode<FlowNode, FlowLink>;
type Link = SankeyLink<FlowNode, FlowLink>;

const HEIGHT = 440;
const LABEL_SPACE = 200; // room for the last column's labels on the right ("Deciding on the offer 12")
const COLUMN_SPACE = 110; // room per column for a label beside a node mid-chart (with its halo, it may cross a flow)

const ROW_SPACE = 64; // height per node in the busiest column, so small nodes and their labels don't pile up
const CHAR_WIDTH = 6.6; // roughly, at 12px

/** How many columns the diagram has (the longest chain of links, plus one), and the most nodes in one. */
export function shape(flow: Flow): { columns: number; busiest: number } {
  const depth = new Map(flow.nodes.map((n) => [n.id, 0]));
  for (let i = 0; i < flow.nodes.length; i++) {
    for (const l of flow.links)
      depth.set(l.target, Math.max(depth.get(l.target) ?? 0, (depth.get(l.source) ?? 0) + 1));
  }
  const perColumn = new Map<number, number>();
  for (const d of depth.values()) perColumn.set(d, (perColumn.get(d) ?? 0) + 1);
  return { columns: Math.max(0, ...depth.values()) + 1, busiest: Math.max(0, ...perColumn.values()) };
}

/** A label split into lines that fit in `room` pixels, the count on the last line with the last
 * word (a single word too long for the room gets a line of its own and runs over). */
export function wrap(name: string, count: number, room: number): string[] {
  const words = name.split(" ").filter(Boolean);
  words.push(`${words.pop() ?? ""} ${count}`.trim()); // the count never sits alone
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.at(-1);
    if (last !== undefined && (last.length + 1 + word.length) * CHAR_WIDTH <= room)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

type Layout = { nodes: Node[]; links: Link[] };

/** Where a link is at `x`, between its two ends (straight-line, which is close enough). */
function yAt(l: Link, x: number): number {
  const x0 = (l.source as Node).x1 ?? 0;
  const x1 = (l.target as Node).x0 ?? 0;
  const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
  return (l.y0 ?? 0) + t * ((l.y1 ?? 0) - (l.y0 ?? 0));
}

/** How tangled a layout is: flows crossing each other, and flows running through a node, each
 * weighted by the sizes involved. */
export function tangle(layout: Layout): number {
  let score = 0;
  const span = (l: Link) => [(l.source as Node).x1 ?? 0, (l.target as Node).x0 ?? 0] as const;
  for (let i = 0; i < layout.links.length; i++) {
    const a = layout.links[i]!;
    const [a0, a1] = span(a);
    for (let k = i + 1; k < layout.links.length; k++) {
      const b = layout.links[k]!;
      const [b0, b1] = span(b);
      const left = Math.max(a0, b0);
      const right = Math.min(a1, b1);
      if (right - left < 1) continue;
      if (Math.sign(yAt(a, left) - yAt(b, left)) * Math.sign(yAt(a, right) - yAt(b, right)) < 0)
        score += a.value * b.value;
    }
    for (const n of layout.nodes) {
      const x = ((n.x0 ?? 0) + (n.x1 ?? 0)) / 2;
      if (n === a.source || n === a.target || x <= a0 || x >= a1) continue;
      const y = yAt(a, x);
      if (y > (n.y0 ?? 0) && y < (n.y1 ?? 0)) score += a.value * (n.value ?? 1) * 2;
    }
  }
  return score;
}

/** Every ordering of up to four items; for more, each one swapped with its neighbour. */
export function orderings<T>(items: T[]): T[][] {
  if (items.length > 4) {
    return items.slice(1).map((_, i) => {
      const swapped = [...items];
      [swapped[i], swapped[i + 1]] = [swapped[i + 1]!, swapped[i]!];
      return swapped;
    });
  }
  if (items.length <= 1) return [items];
  return items.flatMap((item, i) =>
    orderings([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]),
  );
}

const MAX_LAYOUTS = 300; // the search stops here: a few hundred layouts take a blink

/**
 * The order of nodes in each column that tangles least, as far as we can find: starting from
 * d3's own layout, try each column's nodes in other orders (a few sweeps across the columns),
 * keeping whichever crosses least. Undefined if d3's own can't be beaten.
 */
export function untangle(build: (order?: Map<string, number>) => Layout): Map<string, number> | undefined {
  const first = build();
  let bestScore = tangle(first);
  let best: Map<string, number> | undefined;
  let tries = 1;
  const columns = new Map<number, string[]>();
  for (const n of [...first.nodes].sort((a, b) => (a.y0 ?? 0) - (b.y0 ?? 0)))
    columns.set(Math.round(n.x0 ?? 0), [...(columns.get(Math.round(n.x0 ?? 0)) ?? []), n.id]);
  const orderOf = () => new Map([...columns.values()].flatMap((ids) => ids.map((id, i) => [id, i] as const)));
  for (let sweep = 0; sweep < 3 && bestScore > 0; sweep++) {
    let improved = false;
    // Left to right.
    for (const [layer, ids] of [...columns].sort(([a], [b]) => a - b)) {
      let keep = ids;
      for (const candidate of orderings(ids)) {
        if (tries++ >= MAX_LAYOUTS) break;
        columns.set(layer, candidate);
        const order = orderOf();
        const score = tangle(build(order));
        if (score < bestScore) [best, bestScore, keep, improved] = [order, score, candidate, true];
      }
      columns.set(layer, keep);
    }
    if (!improved) break;
  }
  return best;
}

/** How things ended: a node nothing flows on from that isn't an active stage, somewhere things
 * are waiting, or a role you decided against (that's a choice before applying, beside Deciding). */
function endsOnTheRight(n: FlowNode & { sourceLinks?: unknown[] }): boolean {
  return n.kind !== "active" && n.kind !== "holding" && n.id !== "passed" && !n.sourceLinks?.length;
}

/** The diagram laid out in `width` by `height`, in d3's own order or the one given. */
function layoutAt(flow: Flow, width: number, height: number, order?: Map<string, number>): Layout {
  return (
    sankey<FlowNode, FlowLink>()
      .nodeId((n) => n.id)
      .nodeWidth(14)
      .nodePadding(22)
      // Stages by how far along they are, and what's waiting (or a role you decided against) just
      // after the stage it came from. How things ended (Rejected, Withdrawn, Accepted…) can follow
      // any stage, so it lines up on the right, where every stage can reach it.
      .nodeAlign((n, columns) => (endsOnTheRight(n) ? columns - 1 : (n.depth ?? 0)))
      // Without an order, d3 moves nodes up and down to untangle the flows itself.
      .nodeSort(order ? (a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0) : undefined)
      .iterations(32)
      .extent([
        [1, 8],
        [width - LABEL_SPACE, height - 8],
      ])({
      // d3 mutates what it's given. A node is as tall as the applications that reached it,
      // including those still there, not just the ones that flowed through.
      nodes: flow.nodes.map((n) => ({ ...n, fixedValue: n.reached })),
      links: flow.links.map((l) => ({ ...l })),
    })
  );
}

const colour = (name: string) => `var(--mantine-color-${name}-6)`;

// A code the API adds without text here is a type error.
const NODE_NAMES = {
  source_recruiter: "insights:sankey.nodes.source_recruiter",
  source_referral: "insights:sankey.nodes.source_referral",
  source_found: "insights:sankey.nodes.source_found",
  deciding: "insights:sankey.nodes.deciding",
  passed: "insights:sankey.nodes.passed",
  holding_applied: "insights:sankey.nodes.holding_applied",
  holding_screen: "insights:sankey.nodes.holding_screen",
  holding_interviewing: "insights:sankey.nodes.holding_interviewing",
  holding_final: "insights:sankey.nodes.holding_final",
  holding_offer: "insights:sankey.nodes.holding_offer",
  pitched: "insights:sankey.nodes.pitched",
  applied: "insights:sankey.nodes.applied",
  in_progress: "insights:sankey.nodes.in_progress",
  offer: "insights:sankey.nodes.offer",
  closed: "insights:sankey.nodes.closed",
  ghosted: "insights:sankey.nodes.ghosted",
} as const satisfies Record<Exclude<NonNullable<FlowNode["code"]>, "holding_other">, string>;

/** A node's name in your language. A stage has no code and its node's id is its own: a default stage
 * shows translated, any other as you wrote it. "Still at" nodes' ids are `holding:<stage id>`. */
export function nodeName(node: FlowNode, lng = i18n.language): string {
  if (!node.code) return stageName(node, lng);
  if (node.code === "holding_other") {
    const stage = stageName({ id: node.id.replace(/^holding:/, ""), name: node.stage_name ?? "" }, lng);
    return i18n.t("insights:sankey.nodes.holding_other", { stage, lng });
  }
  return i18n.t(NODE_NAMES[node.code], { lng });
}

/**
 * Stage-to-stage flows, left to right. Each node sits one column after the furthest thing that
 * leads to it, so outcomes and what's waiting follow their stage. `unit` is what the flow counts:
 * applications, or roles.
 */
export function SankeyChart({
  flow: rawFlow,
  unit = "application",
  label,
}: {
  flow: Flow;
  unit?: "application" | "role";
  label?: string; // what the diagram shows, for screen readers
}) {
  const {
    t,
    i18n: { language },
  } = useTranslation("insights");
  // Everything below, wrapping labels included, reads the name in your language.
  const flow = useMemo(
    () => ({ ...rawFlow, nodes: rawFlow.nodes.map((n) => ({ ...n, name: nodeName(n, language) })) }),
    [rawFlow, language],
  );
  const nodeText = (n: FlowNode) => {
    const count = n.reached;
    const name = n.name;
    if (unit === "role") return t("sankey.nodeRoles", { name, count });
    // Sources, and where things are waiting, count what's there rather than what "reached" it.
    if (n.kind === "holding" || n.id.startsWith("source:"))
      return t("sankey.nodeApplications", { name, count });
    return n.current
      ? t("sankey.nodeReachedStill", { name, count, still: n.current })
      : t("sankey.nodeReached", { name, count });
  };
  const linkText = (l: Link) => {
    const source = l.source as Node;
    const target = l.target as Node;
    const share = source.reached ? Math.round((100 * l.value) / source.reached) : 0;
    const values = { source: source.name, target: target.name, count: l.value, share };
    return unit === "role" ? t("sankey.linkRoles", values) : t("sankey.linkApplications", values);
  };
  const { ref, width: measured } = useElementSize();
  // Never so narrow that labels run into the next column: on a phone it scrolls sideways instead.
  const { columns, busiest } = shape(flow);
  const width = Math.max(measured || 900, columns * COLUMN_SPACE + LABEL_SPACE);
  const height = Math.max(HEIGHT, busiest * ROW_SPACE);
  const [hover, setHover] = useState<string | null>(null);

  // The search for the least tangled order runs once per diagram, at a typical size (the order
  // hardly depends on width), so resizing the window only lays it out again.
  const order = useMemo(() => {
    const nominal = Math.max(900, columns * 160 + LABEL_SPACE);
    return untangle((o) => layoutAt(flow, nominal, height, o));
  }, [flow, columns, height]);
  const layout = useMemo(() => layoutAt(flow, width, height, order), [flow, width, height, order]);

  const path = sankeyLinkHorizontal();
  const hoveredLink = layout.links.find((l) => linkKey(l) === hover);
  const hoveredNode = layout.nodes.find((n) => n.id === hover);
  const caption = hoveredLink ? linkText(hoveredLink) : hoveredNode ? nodeText(hoveredNode) : null;

  return (
    <div ref={ref} style={{ overflowX: "auto" }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={
          label ??
          (unit === "role"
            ? t("sankey.chartRoles", { count: flow.applications })
            : t("sankey.chartApplications", { count: flow.applications }))
        }
        style={{ display: "block" }}
      >
        <g fill="none">
          {layout.links.map((l) => {
            const key = linkKey(l);
            const dim = hover !== null && hover !== key && !touches(l, hover);
            return (
              <path
                key={key}
                d={path(l) ?? undefined}
                stroke={colour((l.source as Node).color)}
                strokeWidth={Math.max(1, l.width ?? 1)}
                strokeOpacity={dim ? 0.12 : hover === key ? 0.6 : 0.35}
                onMouseEnter={() => setHover(key)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{linkText(l)}</title>
              </path>
            );
          })}
        </g>
        {layout.nodes.map((n) => {
          const x0 = n.x0 ?? 0;
          const x1 = n.x1 ?? 0;
          const y0 = n.y0 ?? 0;
          const y1 = n.y1 ?? 0;
          // Labels sit to the right of each node; LABEL_SPACE keeps the last column's on screen.
          // One that won't fit before the next column wraps onto more lines.
          const next = Math.min(...layout.nodes.map((m) => m.x0 ?? 0).filter((x) => x > x1));
          const lines = wrap(n.name, n.reached, (Number.isFinite(next) ? next - x1 : LABEL_SPACE) - 14);
          return (
            <g key={n.id} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)}>
              <rect
                x={x0}
                y={y0}
                width={x1 - x0}
                height={Math.max(2, y1 - y0)}
                fill={colour(n.color)}
                rx={2}
                opacity={hover !== null && hover !== n.id && !nodeTouches(n, hover) ? 0.4 : 1}
              >
                <title>{nodeText(n)}</title>
              </rect>
              <text
                x={x1 + 6}
                y={(y0 + y1) / 2}
                fontSize={12}
                fill="var(--mantine-color-text)"
                // A halo in the page colour keeps a label readable where it crosses a flow.
                stroke="var(--mantine-color-body)"
                strokeWidth={3}
                paintOrder="stroke"
                style={{ pointerEvents: "none" }}
              >
                {lines.map((line, i) => {
                  const count = i === lines.length - 1 ? ` ${n.reached}` : "";
                  const text = count ? line.slice(0, line.length - count.length) : line;
                  return (
                    <tspan key={i} x={x1 + 6} dy={i === 0 ? `${0.35 - (lines.length - 1) * 0.6}em` : "1.2em"}>
                      {text}
                      {count && (
                        <tspan fill="var(--mantine-color-dimmed)" fontWeight={600}>
                          {count}
                        </tspan>
                      )}
                    </tspan>
                  );
                })}
              </text>
            </g>
          );
        })}
      </svg>
      <Text size="sm" c={caption ? undefined : "dimmed"} mt="xs">
        {caption ?? t("sankey.hint")}
      </Text>
    </div>
  );
}

function linkKey(l: Link) {
  return `${(l.source as Node).id}→${(l.target as Node).id}`;
}

/** Is the hovered node at either end of this link? */
function touches(l: Link, hover: string) {
  return (l.source as Node).id === hover || (l.target as Node).id === hover;
}

/** Is this node the hovered node, or at an end of the hovered link? */
function nodeTouches(n: Node, hover: string) {
  return hover.split("→").includes(n.id);
}
