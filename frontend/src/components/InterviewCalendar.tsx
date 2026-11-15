import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  Progress,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import {
  IconBuilding,
  IconChevronLeft,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconHourglassHigh,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { useTranslation } from "react-i18next";

import { useContacts } from "../api/hooks";
import type { Interview } from "../api/interviewHooks";
import {
  activeRounds,
  byDay,
  gridDays,
  periodRange,
  shiftPeriod,
  summarise,
  type Period,
  type Summary,
} from "../utils/calendar";
import { formatDay } from "../utils/format";
import { joinList } from "../utils/list";
import { roundLabel } from "../utils/rounds";
import { useNow, useToday } from "../utils/useToday";
import text from "../text.module.css";
import { barColor } from "../theme";
import look from "../theme.module.css";
import classes from "./InterviewCalendar.module.css";
import { roundStatus } from "./Interviews";
import { RecruiterLine } from "./RecruiterLine";
import { RescheduledBadge } from "./Reschedule";
import { RoundActions } from "./RoundActions";

type Names = (r: Interview) => string[];
type Days = Map<string, Interview[]>;

const FORMATS = {
  video: "form.formats.video",
  phone: "form.formats.phone",
  onsite: "form.formats.onsite",
  take_home: "form.formats.take_home",
} as const;

/** A round's time on the calendar: its start, else its deadline. */
const whenOf = (r: Interview) => (r.starts_at ?? r.deadline_at)!;

const dotColor = (color: string) => ({ "--dot": `var(--mantine-color-${color}-filled)` }) as CSSProperties;

/**
 * A day's colour, the status badges' colours, from the same sums as its label (so both use one clock):
 * what most needs you first (orange, awaiting an outcome), then blue (coming up), teal (held), grey
 * (all cancelled).
 */
function toneOf(s: Summary): string {
  return s.awaiting ? "orange" : s.comingUp ? "blue" : s.held ? "teal" : "gray";
}

/** The period's figures in the summary bar, in order, with each one's colour (none for companies). */
const STATS = [
  { id: "held", color: "teal", key: "calendar.summary.held", always: true },
  { id: "awaiting", color: "orange", key: "calendar.summary.awaiting", always: false },
  { id: "comingUp", color: "blue", key: "calendar.summary.comingUp", always: true },
  { id: "cancelled", color: "gray", key: "calendar.summary.cancelled", always: false },
  { id: "rescheduled", color: "yellow", key: "calendar.summary.rescheduled", always: false },
  { id: "companies", color: null, key: "calendar.summary.companies", always: true },
] as const satisfies readonly { id: keyof Summary; color: string | null; key: string; always: boolean }[];

/** The statuses a day's rounds are in, for its label ("1 awaiting outcome, 1 coming up"). */
const DAY_STATUSES = [
  { id: "awaiting", key: "calendar.counts.awaiting" },
  { id: "comingUp", key: "calendar.counts.comingUp" },
  { id: "held", key: "calendar.counts.held" },
  { id: "cancelled", key: "calendar.counts.cancelled" },
] as const satisfies readonly { id: keyof Summary; key: string }[];

/**
 * What a day's dot says to a screen reader and on hover, as its colour can't: "Thursday 12 November,
 * today: 2 rounds, 1 awaiting outcome, 1 coming up".
 */
function dayLabel(t: TFunction<"interviews">, lang: string, day: string, s: Summary, today: string) {
  const parts = [
    t("calendar.counts.rounds", { count: s.total }),
    ...DAY_STATUSES.filter((d) => s[d.id] > 0).map((d) => t(d.key, { count: s[d.id] })),
  ];
  const name = formatDay(day, "weekdayDayMonth", lang);
  const counts = joinList(parts);
  return day === today
    ? t("calendar.dayLabelToday", { day: name, counts })
    : t("calendar.dayLabel", { day: name, counts });
}

/** Everything about a round, with its actions: a card in the day panel. */
function RoundDetails({ round, people }: { round: Interview; people: string[] }) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const status = roundStatus(round);
  const from = formatDay(whenOf(round), "shortWeekdayDayMonthYearTime", lang);
  const when = round.starts_at
    ? round.ends_at
      ? t("calendar.timeRange", { from, to: formatDay(round.ends_at, "time", lang) })
      : from
    : t("due", { when: from });
  const format =
    round.format && Object.hasOwn(FORMATS, round.format)
      ? FORMATS[round.format as keyof typeof FORMATS]
      : null;
  return (
    <Stack gap={6}>
      <Group gap={4}>
        <Badge size="sm" variant="light" color={status.color}>
          {status.label}
        </Badge>
        <RescheduledBadge interview={round} />
      </Group>
      <div>
        <Text fw={650} size="sm">
          {roundLabel(round)}
        </Text>
        <Text size="sm">{when}</Text>
      </div>
      <div>
        <Anchor component={Link} to={`/applications/${round.application_id}`} size="sm" fw={600}>
          {round.company_name}
        </Anchor>
        <Text size="xs" c="dimmed">
          <RecruiterLine id={round.recruiter_id} name={round.recruiter_name}>
            {round.role_title}
          </RecruiterLine>
        </Text>
      </div>
      {(people.length > 0 || format) && (
        <div>
          {people.length > 0 && (
            <Text size="xs" c="dimmed">
              {t("calendar.with", { people: joinList(people) })}
            </Text>
          )}
          {format && (
            <Text size="xs" c="dimmed">
              {t(format)}
            </Text>
          )}
        </div>
      )}
      <Group justify="space-between" gap="xs" mt={4} wrap="nowrap">
        <Anchor
          component={Link}
          to={`/applications/${round.application_id}`}
          size="xs"
          className={text.keepWords}
        >
          {t("calendar.openApplication")}
        </Anchor>
        <RoundActions interview={round} />
      </Group>
    </Stack>
  );
}

/** The figures for the month or year on screen, a bar of how they split, and the one before. */
function PeriodSummary({
  now,
  prev,
  view,
  anchor,
}: {
  now: Summary;
  prev: Summary;
  view: Period;
  anchor: string;
}) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  if (!now.total) {
    return (
      <Text size="sm" c="dimmed">
        {view === "month" ? t("calendar.noRoundsMonth") : t("calendar.noRoundsYear")}
      </Text>
    );
  }
  const stats = STATS.filter((s) => s.always || now[s.id] > 0);
  const diff = activeRounds(now) - activeRounds(prev);
  const month = formatDay(shiftPeriod(anchor, "month", -1), "monthName", lang);
  const year = formatDay(shiftPeriod(anchor, "year", -1), "yearOnly", lang);
  const compare =
    view === "month"
      ? diff > 0
        ? t("calendar.summary.moreThanMonth", { count: diff, month })
        : diff < 0
          ? t("calendar.summary.fewerThanMonth", { count: -diff, month })
          : t("calendar.summary.sameAsMonth", { month })
      : diff > 0
        ? t("calendar.summary.moreThanYear", { count: diff, year })
        : diff < 0
          ? t("calendar.summary.fewerThanYear", { count: -diff, year })
          : t("calendar.summary.sameAsYear", { year });
  const bar = stats.filter(
    (s) =>
      (s.id === "held" || s.id === "awaiting" || s.id === "comingUp" || s.id === "cancelled") &&
      now[s.id] > 0,
  );
  return (
    <Stack gap={8}>
      <Group gap="lg" style={{ rowGap: 8 }}>
        {stats.map((s) => (
          <div key={s.id} className={classes.stat} data-stat={s.id}>
            {s.color && (
              <span className={look.keyDot} style={{ "--key-dot": barColor(s.color) } as CSSProperties} />
            )}
            <span className={classes.statNumber}>{now[s.id]}</span>
            <Text span size="sm" c="dimmed">
              {t(s.key, { count: now[s.id] })}
            </Text>
          </div>
        ))}
      </Group>
      <Progress.Root size={6} aria-hidden>
        {bar.map((s) => (
          <Progress.Section key={s.id} value={(now[s.id] / now.total) * 100} color={s.color!} />
        ))}
      </Progress.Root>
      {(prev.total > 0 || diff !== 0) && (
        <Text size="xs" c="dimmed">
          {compare}
        </Text>
      )}
    </Stack>
  );
}

/**
 * The day the panel shows: the one you picked while it's on screen; else today if it has rounds, or the
 * next day that does; else the first day with rounds on screen, or today, or the first day on screen.
 */
function chosenDay(picked: string | null, days: Days, today: string, first: string, last: string) {
  if (picked && picked >= first && picked <= last) return picked;
  const busy = [...days.keys()].filter((d) => d >= first && d <= last).sort();
  return busy.find((d) => d >= today) ?? (today >= first && today <= last ? today : (busy[0] ?? first));
}

/**
 * The chosen day's rounds, each as its card with its actions. Its heading takes focus on a pick, so a
 * screen reader reads the day once (no live region). When an action takes a round off the day (moved
 * to another time), its card goes, and the focus with it: the heading takes it back from the page.
 */
function DayPanel({
  day,
  days,
  names,
  headingRef,
}: {
  day: string;
  days: Days;
  names: Names;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const { t, i18n } = useTranslation("interviews");
  const here = days.get(day) ?? [];
  const shown = useRef({ day, count: here.length });
  useEffect(() => {
    const before = shown.current;
    shown.current = { day, count: here.length };
    if (before.day !== day || here.length >= before.count) return;
    // The dialog that did it may still be closing and handing focus back to a button that's gone.
    const timers = [0, 300, 800].map((ms) =>
      window.setTimeout(() => {
        if (document.activeElement === document.body) headingRef.current?.focus({ preventScroll: true });
      }, ms),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [day, here.length, headingRef]);
  return (
    <section aria-label={t("calendar.dayPanel")}>
      <Title order={4} fz="md" mb="sm" ref={headingRef} tabIndex={-1} className={classes.panelHeading}>
        {formatDay(day, "weekdayDayMonth", i18n.language)}
      </Title>
      <Stack gap="sm">
        {here.length ? (
          here.map((r) => (
            <Paper key={r.id} withBorder radius="md" p="sm" data-round={r.id}>
              <RoundDetails round={r} people={names(r)} />
            </Paper>
          ))
        ) : (
          <Text size="sm" c="dimmed">
            {t("calendar.noRoundsDay")}
          </Text>
        )}
      </Stack>
    </section>
  );
}

/** A small figure with an icon, its words in a tooltip and for screen readers: "✓ 3". */
function IconStat({ icon, n, label }: { icon: ReactNode; n: number; label: string }) {
  return (
    <Tooltip label={label} withArrow>
      <span className={classes.iconStat} role="img" aria-label={label}>
        {icon}
        <span aria-hidden>{n}</span>
      </span>
    </Tooltip>
  );
}

/**
 * A month's held, awaiting an outcome (orange, like its dots), coming up and companies, as small
 * figures with icons (the year's months).
 */
function MonthStats({ s }: { s: Summary }) {
  const { t } = useTranslation("interviews");
  return (
    <Group gap={12} wrap="nowrap">
      <IconStat
        icon={<IconCircleCheck size={15} stroke={1.8} />}
        n={s.held}
        label={t("calendar.counts.held", { count: s.held })}
      />
      <IconStat
        icon={<IconHourglassHigh size={15} stroke={1.8} color="var(--mantine-color-orange-filled)" />}
        n={s.awaiting}
        label={t("calendar.counts.awaiting", { count: s.awaiting })}
      />
      <IconStat
        icon={<IconClock size={15} stroke={1.8} />}
        n={s.comingUp}
        label={t("calendar.counts.comingUp", { count: s.comingUp })}
      />
      <IconStat
        icon={<IconBuilding size={15} stroke={1.8} />}
        n={s.companies}
        label={t("calendar.counts.companies", { count: s.companies })}
      />
    </Group>
  );
}

/**
 * A month as a grid of dots: a small grey one for a quiet day, a bigger one in its status's colour for
 * a day with rounds (bigger again with more, the number inside). Pick a day to see its rounds. `large`
 * is the month view; the year's months are small, each with its figures.
 */
function DotMonth({
  month,
  days,
  today,
  now,
  chosen,
  onChoose,
  large,
  stats,
}: {
  month: string;
  days: Days;
  today: string;
  now: number;
  chosen: string;
  onChoose: (day: string) => void;
  large: boolean;
  stats?: Summary;
}) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const cells = gridDays(month);
  return (
    <section
      className={classes.month}
      aria-label={formatDay(month, "monthNameYear", lang)}
      data-large={large || undefined}
    >
      {stats && (
        <Stack gap={4} mb="md">
          <Text fw={650} size="lg">
            {formatDay(month, "monthName", lang)}
          </Text>
          <MonthStats s={stats} />
        </Stack>
      )}
      <div className={classes.dotGrid}>
        {cells.slice(0, 7).map((d) => (
          <span key={`h${d}`} className={classes.dotHead} aria-hidden>
            {formatDay(d, large ? "shortWeekday" : "minWeekday", lang)}
          </span>
        ))}
        {cells.map((d) => {
          if (d.slice(0, 7) !== month.slice(0, 7)) return <span key={d} className={classes.dotCell} />;
          const here = days.get(d) ?? [];
          // One sum for the dot's colour and its words, so both see the same clock.
          const s = summarise(here, d, d, now);
          return (
            <span
              key={d}
              className={classes.dotCell}
              data-today={d === today || undefined}
              data-chosen={d === chosen || undefined}
            >
              {large && <span className={classes.cellNumber}>{formatDay(d, "dayOfMonth", lang)}</span>}
              {here.length ? (
                <DayDot
                  day={d}
                  count={here.length}
                  color={toneOf(s)}
                  label={dayLabel(t, lang, d, s, today)}
                  chosen={d === chosen}
                  onChoose={onChoose}
                />
              ) : (
                <span className={classes.smallDot} />
              )}
            </span>
          );
        })}
      </div>
    </section>
  );
}

/** A day with rounds: a dot to pick it, its words on hover and for screen readers. */
function DayDot({
  day,
  count,
  color,
  label,
  chosen,
  onChoose,
}: {
  day: string;
  count: number;
  color: string;
  label: string;
  chosen: boolean;
  onChoose: (day: string) => void;
}) {
  return (
    <Tooltip label={label} withArrow openDelay={300}>
      <UnstyledButton
        className={classes.bigDot}
        style={dotColor(color)}
        data-size={String(Math.min(count, 3))}
        data-tone={color}
        data-day={day}
        aria-label={label}
        aria-pressed={chosen}
        onClick={() => onChoose(day)}
      >
        {count > 1 ? count : null}
      </UnstyledButton>
    </Tooltip>
  );
}

/**
 * The Interviews page's calendar: a month of dots or a year of small months, the period's figures above,
 * previous, next and today, and the chosen day's rounds beside. Rounds not booked yet are listed by the
 * page, under it.
 */
export function InterviewCalendar({ rounds }: { rounds: Interview[] }) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const today = useToday();
  const now = useNow();
  const phone = useMediaQuery("(max-width: 48em)");
  // The day the period on screen is around; none follows today, also past midnight.
  const [moved, setMoved] = useState<string | null>(null);
  const anchor = moved ?? today;
  const [picked, setPicked] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  // A focus move waiting for the next frame, dropped if the calendar goes first.
  const focusing = useRef(0);
  useEffect(() => () => cancelAnimationFrame(focusing.current), []);
  const [stored, setStored] = useLocalStorage<Period>({
    key: "jat.interviews.period",
    defaultValue: "month",
    getInitialValueInEffect: false,
  });
  const view: Period = stored === "year" ? "year" : "month";
  const { data: contacts } = useContacts();
  const contactNames = new Map((contacts ?? []).map((c) => [c.id, c.name]));
  const names = (r: Interview) => r.interviewer_ids.flatMap((id) => contactNames.get(id) ?? []);

  const days = useMemo(() => byDay(rounds), [rounds]);
  const { first, last } = periodRange(anchor, view);
  const before = periodRange(shiftPeriod(anchor, view, -1), view);
  const day = chosenDay(picked, days, today, first, last);
  const summary = useMemo(() => summarise(rounds, first, last, now), [rounds, first, last, now]);
  const previous = useMemo(
    () => summarise(rounds, before.first, before.last, now),
    [rounds, before.first, before.last, now],
  );
  const year = first.slice(0, 4);
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const month = `${year}-${String(i + 1).padStart(2, "0")}-01`;
        const range = periodRange(month, "month");
        return { month, stats: summarise(rounds, range.first, range.last, now) };
      }),
    [rounds, year, now],
  );
  const title = formatDay(anchor, view === "month" ? "monthNameYear" : "yearOnly", lang);

  const choose = (d: string) => {
    setPicked(d);
    // Then the chosen day's rounds, for a keyboard or a screen reader; on a phone, scrolled to.
    cancelAnimationFrame(focusing.current);
    focusing.current = requestAnimationFrame(() => heading.current?.focus({ preventScroll: !phone }));
  };
  const switchView = (v: Period) => {
    setStored(v);
    // From a year to a month: the chosen day's month.
    if (v === "month") setMoved(day === today ? null : day);
  };

  const calendar =
    view === "month" ? (
      <DotMonth month={first} days={days} today={today} now={now} chosen={day} onChoose={choose} large />
    ) : (
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={36} verticalSpacing={36}>
        {months.map((m) => (
          <DotMonth
            key={m.month}
            month={m.month}
            days={days}
            today={today}
            now={now}
            chosen={day}
            onChoose={choose}
            large={false}
            stats={m.stats}
          />
        ))}
      </SimpleGrid>
    );
  const panel = (
    <div className={classes.panel}>
      <DayPanel day={day} days={days} names={names} headingRef={heading} />
    </div>
  );
  // On a phone the panel comes first in a year, under its twelve months otherwise; the DOM follows.
  const panelFirst = !!phone && view === "year";

  return (
    <Card withBorder padding="lg" className={classes.root}>
      <Stack gap="md">
        <Group justify="space-between" gap="sm">
          <Group gap={6} wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label={view === "month" ? t("calendar.previousMonth") : t("calendar.previousYear")}
              onClick={() => setMoved(shiftPeriod(anchor, view, -1))}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <ActionIcon
              variant="default"
              aria-label={view === "month" ? t("calendar.nextMonth") : t("calendar.nextYear")}
              onClick={() => setMoved(shiftPeriod(anchor, view, 1))}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
            <Title order={3} ml={6} fz={phone ? "h4" : "h3"} aria-live="polite">
              {title}
            </Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Button
              size="xs"
              variant="default"
              onClick={() => {
                setMoved(null);
                setPicked(null); // today if it has rounds, else the next day that does
              }}
            >
              {t("calendar.today")}
            </Button>
            <SegmentedControl
              size="xs"
              value={view}
              onChange={(v) => switchView(v as Period)}
              data={[
                { value: "month", label: t("calendar.month") },
                { value: "year", label: t("calendar.year") },
              ]}
              aria-label={t("calendar.period")}
            />
          </Group>
        </Group>
        <section aria-label={t("calendar.summary.label", { period: title })}>
          <PeriodSummary now={summary} prev={previous} view={view} anchor={anchor} />
        </section>
        <div className={classes.withPanel}>
          {panelFirst && panel}
          <div className={classes.main}>{calendar}</div>
          {!panelFirst && panel}
        </div>
      </Stack>
    </Card>
  );
}
