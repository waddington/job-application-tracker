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
import { Link, useNavigate, useRouter, useRouterState } from "@tanstack/react-router";
import dayjs from "dayjs";
import type { TFunction } from "i18next";
import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { PersonName } from "../components/GhostMark";
import { timelineTitle } from "../components/timelineTitle";
import { useAgencies, useCompanies, useContacts } from "../api/hooks";
import {
  CATEGORIES,
  categoryOf,
  useTimeline,
  type TimelineCategory,
  type TimelineFilters,
  type TimelineItem,
} from "../api/timelineHooks";
import { formatDay } from "../utils/format";

const PERIODS = [
  { value: "30", label: "timeline:period.days30" },
  { value: "90", label: "timeline:period.days90" },
  { value: "365", label: "timeline:period.days365" },
  { value: "all", label: "timeline:period.all" },
] as const;

// A role's row runs from the pitch (and the call it came from) through its application to the
// outcome, or to passing on it; a person's row has their calls and everything they're part of.
type LaneBy = "role" | "person" | "company" | "agency";
const LANE_BY = [
  { value: "role", label: "timeline:lanes.by.role", empty: "timeline:lanes.empty.role" },
  { value: "person", label: "timeline:lanes.by.person", empty: "timeline:lanes.empty.person" },
  { value: "company", label: "timeline:lanes.by.company", empty: "timeline:lanes.empty.company" },
  { value: "agency", label: "timeline:lanes.by.agency", empty: "timeline:lanes.empty.agency" },
] as const satisfies readonly { value: LaneBy; label: string; empty: string }[];

// Companies, agencies and people being added is bookkeeping: off unless you ask for it.
const DEFAULT_CATEGORIES = CATEGORIES.filter((c) => c.value !== "added").map((c) => c.value as string);

/** The calendar day an item belongs to, in your time zone (all-day items keep their date). */
export const dayOf = (item: TimelineItem) =>
  item.all_day ? item.at.slice(0, 10) : dayjs(item.at).format("YYYY-MM-DD");

/** Is it still ahead of `now`? (Compare instants, not strings: the formats differ.) */
const isAhead = (item: TimelineItem, now: string) => new Date(item.at).getTime() > new Date(now).getTime();

const timeOf = (item: TimelineItem, t: TFunction<"timeline">, lang: string) =>
  item.all_day ? t("allDay") : formatDay(item.at, "time", lang);

function dayHeading(day: string, t: TFunction<"timeline">, lang: string): string {
  const d = dayjs(day);
  const today = dayjs().startOf("day");
  const diff = d.diff(today, "day");
  const date = formatDay(
    d,
    d.year() === today.year() ? "shortWeekdayDayMonth" : "shortWeekdayDayMonthYear",
    lang,
  );
  if (diff === 0) return t("day.today", { date });
  if (diff === -1) return t("day.yesterday", { date });
  if (diff === 1) return t("day.tomorrow", { date });
  return date;
}

/** What it's about: company and role, agency, people, each a link to its page. */
export function ItemContext({ item }: { item: TimelineItem }) {
  const { t } = useTranslation("timeline");
  const parts = [];
  if (item.application_id) {
    parts.push(
      <Anchor key="app" component={Link} to={`/applications/${item.application_id}`} size="xs">
        {t("context.roleAt", { role: item.role_title ?? "", company: item.company_name ?? "" })}
      </Anchor>,
    );
  } else if (item.company_id) {
    if (item.role_id)
      parts.push(
        <Anchor key="role" component={Link} to={`/roles/${item.role_id}`} size="xs">
          {item.role_title}
        </Anchor>,
      );
    parts.push(
      <Anchor key="co" component={Link} to={`/companies/${item.company_id}`} size="xs">
        {item.company_name}
      </Anchor>,
    );
  }
  if (item.agency_id) {
    parts.push(
      <Anchor key="ag" component={Link} to={`/agencies/${item.agency_id}`} size="xs">
        {t("context.via", { agency: item.agency_name ?? "" })}
      </Anchor>,
    );
  }
  for (const p of item.people) {
    parts.push(
      <Anchor key={p.id} component={Link} to={`/people/${p.id}`} size="xs">
        <PersonName id={p.id} name={p.name} size={12} />
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
          {t("context.archived")}
        </Badge>
      )}
    </Group>
  );
}

export function TimelineRow({ item, showDate }: { item: TimelineItem; showDate?: boolean }) {
  const { t, i18n } = useTranslation("timeline");
  const lang = i18n.language;
  const cat = categoryOf(item.category);
  const date = formatDay(dayOf(item), "dayMonth", lang);
  const dated = item.all_day ? date : t("dateTime", { date, time: timeOf(item, t, lang) });
  return (
    <Group gap="sm" wrap="nowrap" align="flex-start" py={6}>
      <Text size="xs" c="dimmed" w={showDate ? 92 : 52} style={{ flexShrink: 0 }} pt={2}>
        {showDate ? dated : timeOf(item, t, lang)}
      </Text>
      <Badge size="sm" variant="light" color={cat.color} w={112} style={{ flexShrink: 0 }}>
        {i18n.t(cat.one)}
      </Badge>
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text size="sm" fw={500}>
          {timelineTitle(item)}
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
  const { t, i18n } = useTranslation("timeline");
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
            {t("comingUp")}
          </Title>
          {ahead.map((item) => (
            <TimelineRow key={item.id} item={item} showDate />
          ))}
        </Card>
      )}
      {[...days].map(([day, dayItems]) => (
        <Box key={day}>
          <Title order={3} size="h6" c="dimmed" mb={2}>
            {dayHeading(day, t, i18n.language)}
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
  if (item.role_id) return `/roles/${item.role_id}`;
  if (item.people[0]) return `/people/${item.people[0].id}`;
  if (item.company_id) return `/companies/${item.company_id}`;
  if (item.agency_id) return `/agencies/${item.agency_id}`;
  return "/timeline";
}

interface Lane {
  key: string;
  label: string;
  personId?: string;
  href: string;
  items: TimelineItem[];
}

function lanesOf(items: TimelineItem[], by: LaneBy, t: TFunction<"timeline">): Lane[] {
  const roleRow = (company: string | null | undefined, role: string | null | undefined) =>
    t("lanes.roleRow", { company: company ?? "", role: role ?? "" });
  const lanes = new Map<string, Lane>();
  const add = (key: string | null | undefined, label: string, href: string, item: TimelineItem) => {
    if (!key) return;
    const lane = lanes.get(key) ?? { key, label, href, items: [] };
    lane.items.push(item);
    lanes.set(key, lane);
  };
  for (const item of items) {
    if (by === "role") {
      if (item.role_id)
        add(item.role_id, roleRow(item.company_name, item.role_title), `/roles/${item.role_id}`, item);
      // A call joins the row of every role that came up on it.
      for (const r of item.roles ?? [])
        if (r.id !== item.role_id) add(r.id, roleRow(r.company_name, r.title), `/roles/${r.id}`, item);
    }
    if (by === "company")
      add(item.company_id, item.company_name ?? "", `/companies/${item.company_id}`, item);
    if (by === "agency") add(item.agency_id, item.agency_name ?? "", `/agencies/${item.agency_id}`, item);
    if (by === "person")
      for (const p of item.people) {
        add(p.id, p.name, `/people/${p.id}`, item);
        lanes.get(p.id)!.personId = p.id;
      }
  }
  // Items arrive newest first, so a lane's first item is its latest: busiest-lately on top.
  return [...lanes.values()].sort(
    (a, b) => dayjs(b.items[0]!.at).valueOf() - dayjs(a.items[0]!.at).valueOf(),
  );
}

const LANE_LIMIT = 30;

function LanesView({ items, now, since }: { items: TimelineItem[]; now: string; since?: string }) {
  const [by, setBy] = useState<LaneBy>("role");
  const [all, setAll] = useState(false);
  const router = useRouter();
  const { t, i18n } = useTranslation("timeline");
  const lang = i18n.language;
  const lanes = useMemo(() => lanesOf(items, by, t), [items, by, t]);
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
    let tick = dayjs(start)
      .startOf(short ? "week" : "month")
      .add(1, short ? "week" : "month");
    tick.valueOf() < end;
    tick = tick.add(1, short ? "week" : "month")
  ) {
    ticks.push(tick);
  }
  const shown = all ? lanes : lanes.slice(0, LANE_LIMIT);
  const label = 220;

  return (
    <Stack gap="sm">
      <Group gap="xs">
        <Text size="sm">{t("lanes.rowPer")}</Text>
        <SegmentedControl
          size="xs"
          value={by}
          onChange={(v) => setBy(v as LaneBy)}
          data={LANE_BY.map((b) => ({ value: b.value, label: i18n.t(b.label) }))}
          aria-label={t("lanes.rowPer")}
        />
      </Group>
      {lanes.length === 0 ? (
        <Text c="dimmed" size="sm">
          {i18n.t(LANE_BY.find((b) => b.value === by)!.empty)}
        </Text>
      ) : (
        <Card withBorder padding="sm" style={{ overflowX: "auto" }}>
          <Box style={{ minWidth: 640 }}>
            <Box style={{ display: "flex" }}>
              <Box w={label} style={{ flexShrink: 0 }} />
              <Box style={{ position: "relative", flex: 1, height: 18 }}>
                {ticks.map((tick) => (
                  <Text
                    key={tick.valueOf()}
                    size="xs"
                    c="dimmed"
                    style={{
                      position: "absolute",
                      left: `${pct(tick.toISOString())}%`,
                      transform: "translateX(-50%)",
                    }}
                  >
                    {formatDay(tick, short ? "dayMonth" : "monthYear", lang)}
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
                    {lane.personId ? (
                      <PersonName id={lane.personId} name={lane.label} size={12} />
                    ) : (
                      lane.label
                    )}
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
                        const date = formatDay(dayOf(item), "dayMonthYear", lang);
                        const when = item.all_day
                          ? date
                          : t("dateTime", { date, time: timeOf(item, t, lang) });
                        const title = timelineTitle(item);
                        return (
                          <li key={item.id}>
                            <Tooltip label={t("lanes.dotHover", { when, title })} withArrow>
                              <Box
                                component="button"
                                aria-label={t("lanes.dot", {
                                  when,
                                  kind: i18n.t(cat.one),
                                  title,
                                })}
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
          {all ? t("lanes.showRecent", { count: LANE_LIMIT }) : t("lanes.showAll", { count: lanes.length })}
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
              {i18n.t(c.label)}
            </Text>
          </Group>
        ))}
        <Text size="xs" c="dimmed">
          {t("lanes.legend")}
        </Text>
      </Group>
    </Stack>
  );
}

/** The view, period and "about" filter live in the URL, so a person's page can link straight to
 * their timeline (?about=contact:<id>&period=all), and a bookmark or Back keeps them. */
function useTimelineSearch() {
  const search: Record<string, unknown> = useRouterState({ select: (s) => s.location.search });
  const navigate = useNavigate();
  const view: "list" | "lanes" = search.view === "lanes" ? "lanes" : "list";
  // The router reads ?period=30 as a number.
  const period = PERIODS.some((p) => p.value === String(search.period)) ? String(search.period) : "90";
  const about =
    typeof search.about === "string" && /^(company|agency|contact):./.test(search.about)
      ? search.about
      : null;
  const set = (patch: { view?: string; period?: string; about?: string | null }) => {
    // From the cleaned-up values, so a bad one in the address doesn't survive a change.
    const merged = { view, period, about, ...patch };
    const next: Record<string, unknown> = { ...search };
    delete next.view;
    delete next.period;
    delete next.about;
    if (merged.view === "lanes") next.view = "lanes";
    if (merged.period !== "90") next.period = merged.period === "all" ? "all" : Number(merged.period);
    if (merged.about) next.about = merged.about;
    void navigate({ to: ".", search: next as never, replace: true });
  };
  return { view, period, about, set };
}

export function TimelinePage() {
  const { t, i18n } = useTranslation("timeline");
  const { view, period, about: asked, set } = useTimelineSearch();
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
  const { data: companies } = useCompanies();
  const { data: agencies } = useAgencies();
  const { data: contacts } = useContacts();

  const aboutOptions = [
    {
      group: t("about.companies"),
      items: (companies ?? []).map((c) => ({ value: `company:${c.id}`, label: c.name })),
    },
    {
      group: t("about.agencies"),
      items: (agencies ?? []).map((a) => ({ value: `agency:${a.id}`, label: a.name })),
    },
    {
      group: t("about.people"),
      items: (contacts ?? []).map((c) => ({ value: `contact:${c.id}`, label: c.name })),
    },
  ].filter((g) => g.items.length);
  // Someone who's gone (deleted, or merged into someone else) filters nothing, rather than
  // filtering everything away under an empty box.
  const loaded = Boolean(companies && agencies && contacts);
  const about =
    asked && loaded && !aboutOptions.some((g) => g.items.some((i) => i.value === asked)) ? null : asked;

  const since = useMemo(
    () => (period === "all" ? undefined : dayjs().startOf("day").subtract(Number(period), "day").format()),
    [period],
  );
  const filters: TimelineFilters = { since };
  // Every kind ticked needs no filter; none ticked shows nothing (and says so).
  if (categories.length < CATEGORIES.length) filters.category = categories as TimelineCategory[];
  const nothingTicked = categories.length === 0;
  if (about) {
    const colon = about.indexOf(":");
    const [kind, id] = [about.slice(0, colon), about.slice(colon + 1)];
    if (kind === "company") filters.company_id = id;
    if (kind === "agency") filters.agency_id = id;
    if (kind === "contact") filters.contact_id = id;
  }
  const { data, isLoading, isFetching } = useTimeline(filters, !nothingTicked);
  const items = data?.items ?? [];

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {t("description")}
          </Text>
        </div>
        <SegmentedControl
          value={view}
          onChange={(v) => set({ about, view: v })}
          data={[
            { value: "list", label: t("views.list") },
            { value: "lanes", label: t("views.lanes") },
          ]}
          aria-label={t("views.label")}
        />
      </Group>

      <Group gap="sm" align="flex-end">
        <Select
          label={t("period.label")}
          data={PERIODS.map((p) => ({ value: p.value, label: i18n.t(p.label) }))}
          value={period}
          onChange={(v) => set({ about, period: v ?? "90" })}
          allowDeselect={false}
          w={170}
        />
        <Select
          label={t("about.label")}
          placeholder={t("about.placeholder")}
          data={aboutOptions}
          value={about}
          onChange={(v) => set({ about: v })}
          searchable
          clearable
          w={260}
        />
        {isFetching && !isLoading && <Loader size="xs" />}
      </Group>
      <Stack gap={4}>
        <Group gap="xs">
          <Text size="sm" fw={500} id="timeline-show">
            {t("show.label")}
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => setCategories(CATEGORIES.map((c) => c.value))}
            disabled={categories.length === CATEGORIES.length}
          >
            {t("show.everything")}
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => setCategories(DEFAULT_CATEGORIES)}
            disabled={
              categories.length === DEFAULT_CATEGORIES.length &&
              DEFAULT_CATEGORIES.every((c) => categories.includes(c))
            }
          >
            {t("show.usual")}
          </Button>
          <Button
            size="compact-xs"
            variant="subtle"
            onClick={() => setCategories([])}
            disabled={nothingTicked}
          >
            {t("show.none")}
          </Button>
        </Group>
        <Chip.Group multiple value={categories} onChange={setCategories}>
          <Group gap={6} role="group" aria-labelledby="timeline-show">
            {CATEGORIES.map((c) => (
              <Chip key={c.value} value={c.value} size="xs" color={c.color} variant="outline">
                {i18n.t(c.label)}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      </Stack>

      {nothingTicked ? (
        <Text c="dimmed" size="sm" py="xl" ta="center">
          {t("empty.nothingTicked")}
        </Text>
      ) : isLoading ? (
        <Loader />
      ) : items.length === 0 ? (
        <Stack align="center" gap="xs" py="xl">
          <IconTimeline size={32} stroke={1.4} />
          <Text fw={600}>{t("empty.title")}</Text>
          <Text c="dimmed" size="sm">
            {about || period !== "all" || categories.length < DEFAULT_CATEGORIES.length
              ? t("empty.filtered")
              : t("empty.start")}
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
