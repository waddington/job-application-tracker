import { Card, Group, Loader, SegmentedControl, Select, Stack, Table, Text, Title } from "@mantine/core";
import { IconChartSankey } from "@tabler/icons-react";
import { useState } from "react";

import { useFlow, type FlowFilters } from "../api/insightHooks";
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

/** How applications flow through the stages (PRD FR19). */
export function InsightsPage() {
  // `since` is fixed when the range is picked, so the query key doesn't change on every render.
  const [range, setRange] = useState<{ range: Range; since?: string }>({ range: "all" });
  const [route, setRoute] = useState("any");
  const filters: FlowFilters = {
    since: range.since,
    route: route === "any" ? undefined : (route as FlowFilters["route"]),
  };
  const { data: flow, isLoading, isError } = useFlow(filters);

  return (
    <Stack maw={1200}>
      <Group gap="sm">
        <IconChartSankey size={26} stroke={1.6} />
        <Title order={2}>Insights</Title>
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
          <Group gap="sm">
            <SegmentedControl
              aria-label="Date range"
              size="xs"
              data={RANGES}
              value={range.range}
              onChange={(value) => setRange({ range: value as Range, since: sinceFor(value as Range) })}
            />
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
      {flow && flow.nodes.length > 0 && (
        <Card withBorder>
          <Title order={4} mb="sm">
            By stage
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Stage</Table.Th>
                <Table.Th>Reached</Table.Th>
                <Table.Th>Still there</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {flow.nodes.map((n) => (
                <Table.Tr key={n.id}>
                  <Table.Td>{n.name}</Table.Td>
                  <Table.Td>{n.reached}</Table.Td>
                  <Table.Td>{n.current}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
