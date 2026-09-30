import { Card, Group, Loader, SegmentedControl, Select, Stack, Text, Title } from "@mantine/core";
import { IconChartSankey } from "@tabler/icons-react";
import { useState } from "react";

import { useFlow, useStats, type FlowFilters } from "../api/insightHooks";
import { RouteTable, StageTable, WeeklyActivity } from "../components/InsightStats";
import { ScorecardCard } from "../components/Scorecard";
import { SankeyChart } from "../components/SankeyChart";

type Range = "all" | "90" | "30";

const RANGES: { value: Range; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "90", label: "Last 90 days" },
  { value: "30", label: "Last 30 days" },
];

const ROUTES = [
  { value: "any", label: "Any route" },
  { value: "direct", label: "Direct" },
  { value: "agency", label: "Via an agency" },
  { value: "referral", label: "Referral" },
];

function sinceFor(range: Range) {
  if (range === "all") return undefined;
  return new Date(Date.now() - Number(range) * 86_400_000).toISOString();
}

/** How the search is going (PRD FR19, FR20): the Sankey diagram, stage stats, routes, activity. */
export function InsightsPage() {
  // `since` is fixed when the range is picked, so the query key doesn't change on every render.
  const [range, setRange] = useState<{ range: Range; since?: string }>({ range: "all" });
  const [route, setRoute] = useState("any");
  const filters: FlowFilters = {
    since: range.since,
    route: route === "any" ? undefined : (route as FlowFilters["route"]),
  };
  const { data: flow, isLoading, isError } = useFlow(filters);
  const { data: stats, isError: statsError } = useStats(range.since);

  return (
    <Stack maw={1200}>
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <IconChartSankey size={26} stroke={1.6} />
          <Title order={2}>Insights</Title>
        </Group>
        <SegmentedControl
          aria-label="Date range"
          size="xs"
          data={RANGES}
          value={range.range}
          onChange={(value) => setRange({ range: value as Range, since: sinceFor(value as Range) })}
        />
      </Group>
      <Card withBorder>
        <Group justify="space-between" mb="md" wrap="wrap">
          <div>
            <Title order={4}>Where applications go</Title>
            <Text size="sm" c="dimmed">
              {flow ? `${flow.applications} application${flow.applications === 1 ? "" : "s"}` : "…"} by the
              date they were added. Moves back to an earlier stage count as staying at the furthest one
              reached.
            </Text>
          </div>
          <Select
            aria-label="Route"
            size="xs"
            w={150}
            data={ROUTES}
            value={route}
            onChange={(value) => setRoute(value ?? "any")}
            allowDeselect={false}
          />
        </Group>
        {isLoading ? (
          <Loader />
        ) : isError || !flow ? (
          <Text c="red">Couldn't load the flow.</Text>
        ) : !flow.links.length ? (
          <Text size="sm" c="dimmed">
            {flow.applications
              ? "No application has moved on from its first stage yet. Come back once things get going."
              : "No applications match these filters."}
          </Text>
        ) : (
          <SankeyChart flow={flow} />
        )}
      </Card>
      {statsError && <Text c="red">Couldn't load the stats.</Text>}
      {stats && stats.applications > 0 && (
        <>
          <StageTable stats={stats} />
          <RouteTable stats={stats} />
        </>
      )}
      <ScorecardCard since={range.since} />
      <WeeklyActivity />
    </Stack>
  );
}
