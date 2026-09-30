import { Badge, Box, Card, Group, Loader, Progress, Stack, Table, Text, Title, Tooltip } from "@mantine/core";
import dayjs from "dayjs";

import { useActivity, type Stats, type Week } from "../api/insightHooks";

const ROUTE_LABELS: Record<string, string> = {
  direct: "Direct",
  agency: "Via an agency",
  referral: "Referral",
};

const percent = (x: number) => `${Math.round(100 * x)}%`;

function days(d: number | null | undefined) {
  if (d == null) return "—";
  if (d < 1) return "under a day";
  return `${d % 1 === 0 ? d : d.toFixed(1)} day${d === 1 ? "" : "s"}`;
}

/** Per stage: how many got there, how many went on, and how long they usually stayed. */
export function StageTable({ stats }: { stats: Stats }) {
  const rows = stats.stages.filter((s) => s.reached > 0);
  return (
    <Card withBorder>
      <Title order={4}>Stage by stage</Title>
      <Text size="sm" c="dimmed" mb="sm">
        "Moved on" means reaching a later stage that isn't a closed one. Time in stage counts every finished
        stay, including ones before a move back.
      </Text>
      <Table.ScrollContainer minWidth={560}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Stage</Table.Th>
              <Table.Th>Reached</Table.Th>
              <Table.Th>Moved on</Table.Th>
              <Table.Th w={180}>Conversion</Table.Th>
              <Table.Th>Median time in stage</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Badge variant="light" color={s.color}>
                    {s.name}
                  </Badge>
                </Table.Td>
                <Table.Td>{s.reached}</Table.Td>
                <Table.Td>{s.conversion == null ? "—" : s.moved_on}</Table.Td>
                <Table.Td>
                  {s.conversion == null ? (
                    <Text size="sm" c="dimmed">
                      —
                    </Text>
                  ) : (
                    <Group gap="xs" wrap="nowrap">
                      <Progress value={100 * s.conversion} color={s.color} w={90} aria-hidden />
                      <Text size="sm">{percent(s.conversion)}</Text>
                    </Group>
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{days(s.median_days)}</Text>
                  {s.stays > 0 && (
                    <Text size="xs" c="dimmed">
                      from {s.stays} stay{s.stays === 1 ? "" : "s"}
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

/** Direct vs recruiter vs referral: what share of each route got to each stage. */
export function RouteTable({ stats }: { stats: Stats }) {
  // Stages past the first that aren't closed: the ones that mean progress.
  const stages = stats.stages.filter((s) => s.kind !== "closed" && s.kind !== "unknown").slice(1);
  return (
    <Card withBorder>
      <Title order={4}>Direct vs recruiter</Title>
      <Text size="sm" c="dimmed" mb="sm">
        The share of each route's applications that got at least as far as each stage.
      </Text>
      {stats.routes.length < 2 ? (
        <Text size="sm" c="dimmed">
          Every application so far came the same way. Nothing to compare yet.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Route</Table.Th>
                <Table.Th>Applications</Table.Th>
                {stages.map((s) => (
                  <Table.Th key={s.id}>{s.name}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.routes.map((r) => (
                <Table.Tr key={r.route}>
                  <Table.Td>{ROUTE_LABELS[r.route] ?? r.route}</Table.Td>
                  <Table.Td>{r.applications}</Table.Td>
                  {stages.map((s) => {
                    const n = r.reached[s.id] ?? 0;
                    return (
                      <Table.Td key={s.id}>
                        <Text size="sm" span fw={n ? 600 : undefined} c={n ? undefined : "dimmed"}>
                          {percent(n / r.applications)}
                        </Text>{" "}
                        <Text size="xs" c="dimmed" span>
                          ({n})
                        </Text>
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}

const SERIES: {
  key: keyof Omit<Week, "start">;
  label: string;
  count: (n: number) => string;
  color: string;
}[] = [
  { key: "added", label: "Added", count: (n) => `${n} added`, color: "gray" },
  { key: "applied", label: "Applied", count: (n) => `${n} applied`, color: "blue" },
  { key: "moves", label: "Stage moves", count: (n) => `${n} stage move${n === 1 ? "" : "s"}`, color: "teal" },
  {
    key: "interviews",
    label: "Interviews",
    count: (n) => `${n} interview${n === 1 ? "" : "s"}`,
    color: "violet",
  },
];

const WEEKS = 12;
const BAR_HEIGHT = 120;

/** Local midnight on the Monday `WEEKS - 1` weeks before this week's, with its offset. */
export function activityStart(now = dayjs()) {
  const monday = now.startOf("day").subtract((now.day() + 6) % 7, "day");
  return monday.subtract(WEEKS - 1, "week").format();
}

/** Twelve weeks of activity as grouped bars. */
export function WeeklyActivity() {
  const start = activityStart();
  const { data: weeks, isLoading } = useActivity(start, WEEKS);
  const max = Math.max(1, ...(weeks ?? []).flatMap((w) => SERIES.map((s) => w[s.key])));
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm" wrap="wrap">
        <Title order={4}>Weekly activity</Title>
        <Group gap="md">
          {SERIES.map((s) => (
            <Group key={s.key} gap={6}>
              <Box w={10} h={10} bg={`${s.color}.6`} style={{ borderRadius: 2 }} />
              <Text size="xs">{s.label}</Text>
            </Group>
          ))}
        </Group>
      </Group>
      {isLoading || !weeks ? (
        <Loader />
      ) : (
        <Stack gap={4}>
          <Group
            gap={0}
            align="flex-end"
            wrap="nowrap"
            h={BAR_HEIGHT}
            role="list"
            aria-label="Weekly activity"
          >
            {weeks.map((w) => {
              const label = `Week of ${dayjs(w.start).format("D MMM")}: ${SERIES.map((s) => s.count(w[s.key])).join(", ")}`;
              return (
                <Tooltip key={w.start} label={label} withinPortal>
                  <Group
                    gap={1}
                    align="flex-end"
                    wrap="nowrap"
                    justify="center"
                    h="100%"
                    style={{ flex: 1 }}
                    role="listitem"
                    aria-label={label}
                  >
                    {SERIES.map((s) => (
                      <Box
                        key={s.key}
                        w="18%"
                        maw={12}
                        h={`${(100 * w[s.key]) / max}%`}
                        mih={w[s.key] ? 2 : 0}
                        bg={`${s.color}.6`}
                        style={{ borderRadius: "2px 2px 0 0" }}
                      />
                    ))}
                  </Group>
                </Tooltip>
              );
            })}
          </Group>
          <Group gap={0} wrap="nowrap">
            {weeks.map((w, i) => (
              <Text key={w.start} size="xs" c="dimmed" ta="center" style={{ flex: 1 }}>
                {(WEEKS - 1 - i) % 2 === 0 ? dayjs(w.start).format("D MMM") : ""}
              </Text>
            ))}
          </Group>
        </Stack>
      )}
    </Card>
  );
}
