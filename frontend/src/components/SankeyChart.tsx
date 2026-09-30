import { Text } from "@mantine/core";
import { useElementSize } from "@mantine/hooks";
import { sankey, sankeyLinkHorizontal, type SankeyLink, type SankeyNode } from "d3-sankey";
import { useMemo, useState } from "react";

import type { Flow, FlowLink, FlowNode } from "../api/insightHooks";

type Node = SankeyNode<FlowNode, FlowLink>;
type Link = SankeyLink<FlowNode, FlowLink>;

const HEIGHT = 440;
const LABEL_SPACE = 150; // room for the last column's labels on the right

const colour = (name: string) => `var(--mantine-color-${name}-6)`;
const plural = (n: number) => `${n} application${n === 1 ? "" : "s"}`;

function nodeText(n: FlowNode) {
  const still = n.current ? `, ${n.current} still there` : "";
  return `${n.name}: ${plural(n.reached)} reached${still}`;
}

function linkText(l: Link) {
  const source = l.source as Node;
  const target = l.target as Node;
  const share = source.reached ? Math.round((100 * l.value) / source.reached) : 0;
  return `${source.name} → ${target.name}: ${plural(l.value)} (${share}% of ${source.name})`;
}

/** Stage-to-stage flows, left to right. Outcomes (success and closed stages) sit in the last column. */
export function SankeyChart({ flow }: { flow: Flow }) {
  const { ref, width: measured } = useElementSize();
  const width = Math.max(measured || 900, 480);
  const [hover, setHover] = useState<string | null>(null);

  const layout = useMemo(() => {
    const order = new Map(flow.nodes.map((n, i) => [n.id, i]));
    return (
      sankey<FlowNode, FlowLink>()
        .nodeId((n) => n.id)
        .nodeWidth(14)
        .nodePadding(22)
        // Active stages by how far along they are; outcomes line up on the right.
        .nodeAlign((n, columns) =>
          n.kind === "active" || n.sourceLinks?.length ? (n.depth ?? 0) : columns - 1,
        )
        .nodeSort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
        .extent([
          [1, 8],
          [width - LABEL_SPACE, HEIGHT - 8],
        ])({
        // d3 mutates what it's given. A node is as tall as the applications that reached it,
        // including those still there, not just the ones that flowed through.
        nodes: flow.nodes.map((n) => ({ ...n, fixedValue: n.reached })),
        links: flow.links.map((l) => ({ ...l })),
      })
    );
  }, [flow, width]);

  const path = sankeyLinkHorizontal();
  const hoveredLink = layout.links.find((l) => linkKey(l) === hover);
  const hoveredNode = layout.nodes.find((n) => n.id === hover);
  const caption = hoveredLink ? linkText(hoveredLink) : hoveredNode ? nodeText(hoveredNode) : null;

  return (
    <div ref={ref}>
      <svg
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        role="img"
        aria-label={`Sankey diagram of ${plural(flow.applications)} moving through the stages`}
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
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
                dy="0.35em"
                fontSize={12}
                fill="var(--mantine-color-text)"
                style={{ pointerEvents: "none" }}
              >
                {n.name}{" "}
                <tspan fill="var(--mantine-color-dimmed)" fontWeight={600}>
                  {n.reached}
                </tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <Text size="sm" c={caption ? undefined : "dimmed"} mt="xs">
        {caption ?? "Hover over a stage or a flow to see its numbers."}
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
