import {
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  Group,
  Loader,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconTimeline } from "@tabler/icons-react";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import dayjs from "dayjs";
import { Fragment, useMemo, useState } from "react";

import { useAgencies, useCompanies, useContacts } from "../api/hooks";
import {
  CATEGORIES,
  categoryOf,
  useTimeline,
  type TimelineCategory,
  type TimelineFilters,
  type TimelineItem,
} from "../api/timelineHooks";

const PERIODS = [
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 3 months" },
  { value: "365", label: "Last year" },
  { value: "all", label: "All time" },
];

type LaneBy = "application" | "company" | "agency" | "person";
const LANE_BY: { value: LaneBy; label: string }[] = [
  { value: "application", label: "Application" },
  { value: "company", label: "Company" },
  { value: "agency", label: "Agency" },
  { value: "person", label: "Person" },
];

/** The calendar day an item belongs to, in your time zone (all-day items keep their date). */
export const dayOf = (item: TimelineItem) =>
  item.all_day ? item.at.slice(0, 10) : dayjs(item.at).format("YYYY-MM-DD");

/** Is it still ahead of `now`? (Compare instants, not strings: the formats differ.) */
const isAhead = (item: TimelineItem, now: string) => new Date(item.at).getTime() > new Date(now).getTime();

const timeOf = (item: TimelineItem) => (item.all_day ? "All day" : dayjs(item.at).format("HH:mm"));

function dayHeading(day: string): string {
  const d = dayjs(day);
  const today = dayjs().startOf("day");
  const diff = d.diff(today, "day");
  const label = d.format(d.year() === today.year() ? "ddd D MMM" : "ddd D MMM YYYY");
  if (diff === 0) return `Today · ${label}`;
  if (diff === -1) return `Yesterday · ${label}`;
  if (diff === 1) return `Tomorrow · ${label}`;
  return label;
}

/** What it's about: company and role, agency, people, each a link to its page. */
export function ItemContext({ item }: { item: TimelineItem }) {
  const parts = [];
  if (item.application_id) {
    parts.push(
      <Anchor key="app" component={Link} to={`/applications/${item.application_id}`} size="xs">
        {item.role_title} at {item.company_name}
      </Anchor>,
    );
  } else if (item.company_id) {
    parts.push(
      <Anchor key="co" component={Link} to={`/companies/${item.company_id}`} size="xs">
        {item.company_name}
      </Anchor>,
    );
  }
  if (item.agency_id) {
    parts.push(
      <Anchor key="ag" component={Link} to={`/agencies/${item.agency_id}`} size="xs">
        via {item.agency_name}
      </Anchor>,
    );
  }
  for (const p of item.people) {
    parts.push(
      <Anchor key={p.id} component={Link} to={`/people/${p.id}`} size="xs">
        {p.name}
      </Anchor>,
    );
  }
  if (!parts.length) return null;
  return (
    <Group gap={6} wrap="wrap">
      {parts.map((part, n) => (
        <Fragment key={n}>
          {n > 0 && (
            <Text size="xs" c="dimmed" aria-hidden>
              ·
            </Text>
          )}
          {part}
        </Fragment>
      ))}
      {item.archived && (
        <Badge size="xs" variant="outline" color="gray">
          Archived
        </Badge>
      )}
    </Group>
  );
}

export function TimelineRow({ item, showDate }: { item: TimelineItem; showDate?: boolean }) {
  const cat = categoryOf(item.category);
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start" py={6}>
      <Text size="xs" c="dimmed" w={showDate ? 92 : 52} style={{ flexShrink: 0 }} pt={2}>
        {showDate
          ? `${dayjs(dayOf(item)).format("D MMM")} ${item.all_day ? "" : timeOf(item)}`
          : timeOf(item)}
      </Text>
      <Badge size="sm" variant="light" color={cat.color} w={112} style={{ flexShrink: 0 }}>
        {cat.one}
      </Badge>
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text size="sm" fw={500}>
          {item.title}
        </Text>
        {item.detail && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {item.detail}
          </Text>
        )}
        <ItemContext item={item} />
      </Stack>
    </Group>
  );
}

function ListView({ items, now }: { items: TimelineItem[]; now: string }) {
  const ahead = items.filter((i) => isAhead(i, now)).reverse(); // soonest first
  const past = items.filter((i) => !isAhead(i, now));
  const days = new Map<string, TimelineItem[]>();
  for (const item of past) {
    const day = dayOf(item);
    days.set(day, [...(days.get(day) ?? []), item]);
  }
  return (
    <Stack gap="md">
      {ahead.length > 0 && (
        <Card withBorder padding="md">
          <Title order={3} size="h5" mb={4}>
            Coming up
          </Title>
          {ahead.map((item) => (
            <TimelineRow key={item.id} item={item} showDate />
          ))}
        </Card>
      )}
      {[...days].map(([day, dayItems]) => (
        <Box key={day}>
          <Title order={3} size="h6" c="dimmed" mb={2}>
            {dayHeading(day)}
          </Title>
          {dayItems.map((item) => (
            <TimelineRow key={item.id} item={item} />
          ))}
        </Box>
      ))}
    </Stack>
  );
}

/** Where a dot goes: its application or role, else the person, company or agency it's about. */
function hrefOf(item: TimelineItem): string {
  if (item.application_id) return `/applications/${item.application_id}`;
  const role = /^role(?:-passed)?:(.+)$/.exec(item.id);
  if (role) return `/roles/${role[1]}`;
  if (item.people[0]) return `/people/${item.people[0].id}`;
  if (item.company_id) return `/companies/${item.company_id}`;
  if (item.agency_id) return `/agencies/${item.agency_id}`;
  return "/timeline";
}

interface Lane {
  key: string;
  label: string;
  href: string;
  items: TimelineItem[];
}

function lanesOf(items: TimelineItem[], by: LaneBy): Lane[] {
  const lanes = new Map<string, Lane>();
  const add = (key: string | null | undefined, label: string, href: string, item: TimelineItem) => {
    if (!key) return;
    const lane = lanes.get(key) ?? { key, label, href, items: [] };
    lane.items.push(item);
    lanes.set(key, lane);
  };
  for (const item of items) {
    if (by === "application")
      add(
        item.application_id,
        `${item.company_name} · ${item.role_title}`,
        `/applications/${item.application_id}`,
        item,
      );
    if (by === "company")
      add(item.company_id, item.company_name ?? "", `/companies/${item.company_id}`, item);
    if (by === "agency") add(item.agency_id, item.agency_name ?? "", `/agencies/${item.agency_id}`, item);
    if (by === "person") for (const p of item.people) add(p.id, p.name, `/people/${p.id}`, item);
  }
  // Items arrive newest first, so a lane's first item is its latest: busiest-lately on top.
  return [...lanes.values()].sort(
    (a, b) => dayjs(b.items[0]!.at).valueOf() - dayjs(a.items[0]!.at).valueOf(),
  );
}

const LANE_LIMIT = 30;

function LanesView({ items, now, since }: { items: TimelineItem[]; now: string; since?: string }) {
  const [by, setBy] = useState<LaneBy>("application");
  const [all, setAll] = useState(false);
  const router = useRouter();
  const lanes = useMemo(() => lanesOf(items, by), [items, by]);
  if (!items.length) return null;

  const times = items.map((i) => dayjs(i.at).valueOf());
  const start = since ? dayjs(since).valueOf() : Math.min(...times);
  const end = Math.max(dayjs(now).valueOf(), ...times);
  const span = Math.max(end - start, 86_400_000);
  const pct = (iso: string) => ((dayjs(iso).valueOf() - start) / span) * 100;
  // Month ticks along the top (weeks when the range is short).
  const short = span < 62 * 86_400_000;
  const ticks: dayjs.Dayjs[] = [];
  for (
    let t = dayjs(start)
      .startOf(short ? "week" : "month")
      .add(1, short ? "week" : "month");
    t.valueOf() < end;
    t = t.add(1, short ? "week" : "month")
  ) {
    ticks.push(t);
  }
  const shown = all ? lanes : lanes.slice(0, LANE_LIMIT);
  const label = 220;

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="sm">One row per</Text>
        <SegmentedControl
          size="xs"
          value={by}
          onChange={(v) => setBy(v as LaneBy)}
          data={LANE_BY}
          aria-label="One row per"
        />
      </Group>
      {lanes.length === 0 ? (
        <Text c="dimmed" size="sm">
          Nothing here is linked to {by === "person" ? "a person" : `an ${by}`}.
        </Text>
      ) : (
        <Card withBorder padding="sm" style={{ overflowX: "auto" }}>
          <Box style={{ minWidth: 640 }}>
            <Box style={{ display: "flex" }}>
              <Box w={label} style={{ flexShrink: 0 }} />
              <Box style={{ position: "relative", flex: 1, height: 18 }}>
                {ticks.map((t) => (
                  <Text
                    key={t.valueOf()}
                    size="xs"
                    c="dimmed"
                    style={{
                      position: "absolute",
                      left: `${pct(t.toISOString())}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {t.format(short ? "D MMM" : "MMM YYYY")}
                  </Text>
                ))}
              </Box>
            </Box>
            {shown.map((lane) => {
              const first = lane.items.at(-1)!;
              const last = lane.items[0]!;
              return (
                <Box key={lane.key} style={{ display: "flex", alignItems: "center", minHeight: 28 }}>
                  <Anchor
                    component={Link}
                    to={lane.href}
                    size="sm"
                    w={label}
                    pr="sm"
                    truncate
                    style={{ flexShrink: 0 }}
                    title={lane.label}
                  >
                    {lane.label}
                  </Anchor>
                  <Box style={{ position: "relative", flex: 1, height: 28 }}>
                    <Box
                      style={{
                        position: "absolute",
                        top: 13,
                        height: 2,
                        left: `${pct(first.at)}%`,
                        width: `${Math.max(pct(last.at) - pct(first.at), 0)}%`,
                        background: "var(--mantine-color-default-border)",
                      }}
                    />
                    <Box
                      aria-hidden
                      style={{
                        position: "absolute",
                        top: 0,
                        bottom: 0,
                        left: `${pct(now)}%`,
                        borderLeft: "1px dashed var(--mantine-color-red-5)",
                      }}
                    />
                    <Box
                      component="ul"
                      aria-label={lane.label}
                      style={{ position: "absolute", inset: 0, margin: 0, padding: 0, listStyle: "none" }}
                    >
                      {lane.items.map((item) => {
                        const cat = categoryOf(item.category);
                        const when = `${dayjs(dayOf(item)).format("D MMM YYYY")}${item.all_day ? "" : ` ${timeOf(item)}`}`;
                        return (
                          <li key={item.id}>
                            <Tooltip label={`${when} · ${item.title}`} withArrow>
                              <Box
                                component="button"
                                aria-label={`${when} · ${cat.one}: ${item.title}`}
                                onClick={() => router.history.push(hrefOf(item))}
                                style={{
                                  position: "absolute",
                                  top: 8,
                                  left: `calc(${pct(item.at)}% - 6px)`,
                                  width: 12,
                                  height: 12,
                                  padding: 0,
                                  borderRadius: "50%",
                                  border: isAhead(item, now)
                                    ? `2px solid var(--mantine-color-${cat.color}-6)`
                                    : "2px solid var(--mantine-color-body)",
                                  background: isAhead(item, now)
                                    ? "var(--mantine-color-body)"
                                    : `var(--mantine-color-${cat.color}-6)`,
                                  cursor: "pointer",
                                }}
                              />
                            </Tooltip>
                          </li>
                        );
                      })}
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Card>
      )}
      {lanes.length > LANE_LIMIT && (
        <Button variant="subtle" size="xs" onClick={() => setAll(!all)} style={{ alignSelf: "flex-start" }}>
          {all ? `Show the ${LANE_LIMIT} most recent` : `Show all ${lanes.length} rows`}
        </Button>
      )}
      <Group gap="md">
        {CATEGORIES.filter((c) => items.some((i) => i.category === c.value)).map((c) => (
          <Group key={c.value} gap={4}>
            <Box
              w={10}
              h={10}
              style={{ borderRadius: "50%", background: `var(--mantine-color-${c.color}-6)` }}
            />
            <Text size="xs" c="dimmed">
              {c.label}
            </Text>
          </Group>
        ))}
        <Text size="xs" c="dimmed">
          Hollow dots are ahead; the dashed line is now.
        </Text>
      </Group>
    </Stack>
  );
}

export function TimelinePage() {
  // ?view=lanes opens straight into lanes (handy for a bookmark).
  const search: Record<string, unknown> = useRouterState({ select: (s) => s.location.search });
  const [view, setView] = useState<"list" | "lanes">(search.view === "lanes" ? "lanes" : "list");
  const [period, setPeriod] = useState("90");
  const [categories, setCategories] = useState<string[]>([]);
  const [about, setAbout] = useState<string | null>(null);
  const { data: companies } = useCompanies();
  const { data: agencies } = useAgencies();
  const { data: contacts } = useContacts();

  const since = useMemo(
    () => (period === "all" ? undefined : dayjs().startOf("day").subtract(Number(period), "day").format()),
    [period],
  );
  const filters: TimelineFilters = { since };
  if (categories.length) filters.category = categories as TimelineCategory[];
  if (about) {
    const [kind, id] = about.split(":") as [string, string];
    if (kind === "company") filters.company_id = id;
    if (kind === "agency") filters.agency_id = id;
    if (kind === "contact") filters.contact_id = id;
  }
  const { data, isLoading, isFetching } = useTimeline(filters);
  const items = data?.items ?? [];

  const aboutOptions = [
    {
      group: "Companies",
      items: (companies ?? []).map((c) => ({ value: `company:${c.id}`, label: c.name })),
    },
    { group: "Agencies", items: (agencies ?? []).map((a) => ({ value: `agency:${a.id}`, label: a.name })) },
    { group: "People", items: (contacts ?? []).map((c) => ({ value: `contact:${c.id}`, label: c.name })) },
  ].filter((g) => g.items.length);

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Timeline</Title>
          <Text c="dimmed" size="sm">
            Everything that happened, across every application, company, agency and person.
          </Text>
        </div>
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v as "list" | "lanes")}
          data={[
            { value: "list", label: "List" },
            { value: "lanes", label: "Lanes" },
          ]}
          aria-label="View"
        />
      </Group>

      <Group gap="sm" align="flex-end">
        <Select
          label="Period"
          data={PERIODS}
          value={period}
          onChange={(v) => setPeriod(v ?? "90")}
          allowDeselect={false}
          w={170}
        />
        <Select
          label="About"
          placeholder="Everyone and everything"
          data={aboutOptions}
          value={about}
          onChange={setAbout}
          searchable
          clearable
          w={260}
        />
        {isFetching && !isLoading && <Loader size="xs" />}
      </Group>
      <Chip.Group multiple value={categories} onChange={setCategories}>
        <Group gap={6}>
          {CATEGORIES.map((c) => (
            <Chip key={c.value} value={c.value} size="xs" color={c.color} variant="light">
              {c.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>

      {isLoading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <IconTimeline size={32} stroke={1.4} />
          <Text fw={600}>Nothing here yet</Text>
          <Text c="dimmed" size="sm">
            {categories.length || about || period !== "all"
              ? "Try a longer period or clear a filter."
              : "Add an application and what happens to it shows up here."}
          </Text>
        </Stack>
      ) : view === "list" ? (
        <ListView items={items} now={data!.now} />
      ) : (
        <LanesView items={items} now={data!.now} since={since} />
      )}
    </Stack>
  );
}
