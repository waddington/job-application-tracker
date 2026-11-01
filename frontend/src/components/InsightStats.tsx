import { Badge, Box, Card, Group, Loader, Progress, Stack, Table, Text, Title, Tooltip } from "@mantine/core";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import { useActivity, type Stats, type Week } from "../api/insightHooks";
import { i18n } from "../i18n";
import { formatDay } from "../utils/format";
import { stageName } from "../utils/stageName";

function routeLabel(route: string) {
  if (route === "direct") return i18n.t("insights:routes.direct");
  if (route === "agency") return i18n.t("insights:routes.agency");
  if (route === "referral") return i18n.t("insights:routes.referral");
  return route;
}

const percent = (x: number) => i18n.t("insights:percent", { percent: Math.round(100 * x) });

function days(d: number | null | undefined) {
  if (d == null) return "—";
  if (d < 1) return i18n.t("insights:stages.underADay");
  return i18n.t("insights:stages.days", { count: d, value: d % 1 === 0 ? d : d.toFixed(1) });
}

/** Per stage: how many got there, how many went on, and how long they usually stayed. */
export function StageTable({ stats }: { stats: Stats }) {
  const { t } = useTranslation("insights");
  const rows = stats.stages.filter((s) => s.reached > 0);
  return (
    <Card withBorder>
      <Title order={4}>{t("stages.title")}</Title>
      <Text size="sm" c="dimmed" mb="sm">
        {t("stages.intro")}
      </Text>
      <Table.ScrollContainer minWidth={560}>
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("stages.stage")}</Table.Th>
              <Table.Th>{t("stages.reached")}</Table.Th>
              <Table.Th>{t("stages.movedOn")}</Table.Th>
              <Table.Th w={180}>{t("stages.conversion")}</Table.Th>
              <Table.Th>{t("stages.median")}</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((s) => (
              <Table.Tr key={s.id}>
                <Table.Td>
                  <Badge variant="light" color={s.color}>
                    {stageName(s)}
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
                      {t("stages.from", { count: s.stays })}
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
  const { t } = useTranslation("insights");
  // Stages past the first that aren't closed: the ones that mean progress.
  const stages = stats.stages.filter((s) => s.kind !== "closed" && s.kind !== "unknown").slice(1);
  return (
    <Card withBorder>
      <Title order={4}>{t("routeTable.title")}</Title>
      <Text size="sm" c="dimmed" mb="sm">
        {t("routeTable.intro")}
      </Text>
      {stats.routes.length < 2 ? (
        <Text size="sm" c="dimmed">
          {t("routeTable.same")}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={480}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("routeTable.route")}</Table.Th>
                <Table.Th>{t("routeTable.applications")}</Table.Th>
                {stages.map((s) => (
                  <Table.Th key={s.id}>{stageName(s)}</Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {stats.routes.map((r) => (
                <Table.Tr key={r.route}>
                  <Table.Td>{routeLabel(r.route)}</Table.Td>
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
  label: () => string;
  count: (n: number) => string;
  color: string;
}[] = [
  {
    key: "added",
    label: () => i18n.t("insights:weekly.added"),
    count: (count) => i18n.t("insights:weekly.countAdded", { count }),
    color: "gray",
  },
  {
    key: "applied",
    label: () => i18n.t("insights:weekly.applied"),
    count: (count) => i18n.t("insights:weekly.countApplied", { count }),
    color: "blue",
  },
  {
    key: "moves",
    label: () => i18n.t("insights:weekly.moves"),
    count: (count) => i18n.t("insights:weekly.countMoves", { count }),
    color: "teal",
  },
  {
    key: "interviews",
    label: () => i18n.t("insights:weekly.interviews"),
    count: (count) => i18n.t("insights:weekly.countInterviews", { count }),
    color: "violet",
  },
  {
    key: "calls",
    label: () => i18n.t("insights:weekly.calls"),
    count: (count) => i18n.t("insights:weekly.countCalls", { count }),
    color: "orange",
  },
  {
    key: "pitched",
    label: () => i18n.t("insights:weekly.pitched"),
    count: (count) => i18n.t("insights:weekly.countPitched", { count }),
    color: "grape",
  },
];

const WEEKS = 12;
const BAR_HEIGHT = 120;

/** The Monday `WEEKS - 1` weeks before this week's, as YYYY-MM-DD in local time. */
export function activityStart(now = dayjs()) {
  const monday = now.startOf("day").subtract((now.day() + 6) % 7, "day");
  return monday.subtract(WEEKS - 1, "week").format("YYYY-MM-DD");
}

/** Twelve weeks of activity as grouped bars. */
export function WeeklyActivity() {
  const {
    t,
    i18n: { language },
  } = useTranslation("insights");
  const start = activityStart();
  // The server works out local midnights itself, so weeks with a clock change come out right.
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { data: weeks, isLoading } = useActivity(start, WEEKS, tz);
  const max = Math.max(1, ...(weeks ?? []).flatMap((w) => SERIES.map((s) => w[s.key])));
  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm" wrap="wrap">
        <Title order={4}>{t("weekly.title")}</Title>
        <Group gap="md">
          {SERIES.map((s) => (
            <Group key={s.key} gap={6}>
              <Box w={10} h={10} bg={`${s.color}.6`} style={{ borderRadius: 2 }} />
              <Text size="xs">{s.label()}</Text>
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
            aria-label={t("weekly.title")}
          >
            {weeks.map((w) => {
              const label = t("weekly.week", {
                date: formatDay(w.start, "dayMonth", language),
                counts: SERIES.map((s) => s.count(w[s.key])).join(", "),
              });
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
                {(WEEKS - 1 - i) % 2 === 0 ? formatDay(w.start, "dayMonth", language) : ""}
              </Text>
            ))}
          </Group>
        </Stack>
      )}
    </Card>
  );
}
