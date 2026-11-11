import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Popover,
  Progress,
  SegmentedControl,
  Stack,
  Text,
  Title,
  UnstyledButton,
  type FloatingPosition,
} from "@mantine/core";
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { IconChevronLeft, IconChevronRight, IconRepeat } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
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
import classes from "./InterviewCalendar.module.css";
import {
  DayClusters,
  DotMonthLarge,
  DotMonths,
  MANY_MONTHS,
  WeekClusters,
  type Design,
} from "./CalendarConcepts";
import { roundStatus } from "./Interviews";
import { RecruiterLine } from "./RecruiterLine";
import { RescheduledBadge } from "./Reschedule";
import { RoundActions } from "./RoundActions";

const FORMATS = {
  video: "form.formats.video",
  phone: "form.formats.phone",
  onsite: "form.formats.onsite",
  take_home: "form.formats.take_home",
} as const;

/** How many rounds a month's day shows before "+N more". */
const MONTH_FITS = 3;

/** A round's time on the calendar: its start, else its deadline. */
export const whenOf = (r: Interview) => (r.starts_at ?? r.deadline_at)!;

/** Everything about a round, shown on hover or focus, and kept open with a click, with its actions. */
export function RoundDetails({ round, people }: { round: Interview; people: string[] }) {
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

/** What a hover target spreads onto its button: open on hover or focus, keep open on click. */
export interface HoverTargetProps {
  "aria-expanded": boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: () => void;
}

/**
 * Details on hover or keyboard focus; a click keeps them open until you click elsewhere or press
 * Escape. The details stay mounted once shown, so a dialog opened from their actions (Edit, Done,
 * Reschedule) survives the card closing.
 */
export function HoverDetails({
  target,
  details,
  width = 340,
  position = "right-start",
}: {
  target: (props: HoverTargetProps) => ReactElement;
  details: () => ReactNode;
  width?: number;
  position?: FloatingPosition;
}) {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const hover = (on: boolean, delay: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setHovered(on);
      if (on) setShown(true);
    }, delay);
  };
  const keep = () => window.clearTimeout(timer.current);
  return (
    <Popover
      opened={hovered || pinned}
      onChange={(open) => {
        if (!open) {
          setPinned(false);
          setHovered(false);
        }
      }}
      position={position}
      width={width}
      withArrow
      shadow="md"
      keepMounted
    >
      <Popover.Target>
        {/* The handlers read the timer ref when they run, not during render. */}
        {/* eslint-disable-next-line react-hooks/refs */}
        {target({
          "aria-expanded": hovered || pinned,
          onMouseEnter: () => hover(true, 120),
          onMouseLeave: () => hover(false, 200),
          onFocus: () => hover(true, 0),
          onBlur: () => hover(false, 200),
          onClick: () => {
            keep();
            setShown(true);
            setHovered(false);
            setPinned((p) => !p);
          },
        })}
      </Popover.Target>
      <Popover.Dropdown
        onMouseEnter={keep}
        onMouseLeave={() => hover(false, 200)}
        onFocusCapture={keep}
        onBlurCapture={() => hover(false, 200)}
      >
        {shown && details()}
      </Popover.Dropdown>
    </Popover>
  );
}

/** A round on its day: a ticket in its status's colour, with its details on hover, focus or click. */
export function RoundChip({ round, people, full }: { round: Interview; people: string[]; full: boolean }) {
  const { t, i18n } = useTranslation("interviews");
  const status = roundStatus(round);
  // A take-home's deadline reads "Due 18:00".
  const at = formatDay(whenOf(round), "time", i18n.language);
  const time = round.starts_at ? at : t("due", { when: at });
  const label = roundLabel(round);
  const style = {
    "--chip-edge": `var(--mantine-color-${status.color}-filled)`,
    "--chip-bg": `var(--mantine-color-${status.color}-light)`,
    "--chip-text": `var(--mantine-color-${status.color}-light-color)`,
  } as CSSProperties;
  return (
    <HoverDetails
      details={() => <RoundDetails round={round} people={people} />}
      target={(props) => (
        <UnstyledButton
          className={classes.chip}
          style={style}
          data-status={round.status}
          aria-label={t("calendar.roundLabel", { label, company: round.company_name, when: time })}
          {...props}
        >
          <span className={classes.chipLine}>
            <span className={classes.chipTime}>{time}</span>
            <span className={classes.chipText}>{round.company_name}</span>
            {round.rescheduled_count > 0 && <IconRepeat size={11} stroke={2.2} className={classes.moved} />}
          </span>
          {full && <span className={`${classes.chipText} ${classes.chipSub}`}>{label}</span>}
        </UnstyledButton>
      )}
    />
  );
}

/** A day's rounds; a month's day shows the first few, then "+N more" opens the rest. */
function DayRounds({ day, rounds, full, fits, names }: DayProps & { fits: number }) {
  const { t, i18n } = useTranslation("interviews");
  const shown = rounds.length > fits ? rounds.slice(0, fits - 1) : rounds;
  const hidden = rounds.length - shown.length;
  return (
    <>
      {shown.map((r) => (
        <RoundChip key={r.id} round={r} people={names(r)} full={full} />
      ))}
      {hidden > 0 && (
        <Popover position="bottom-start" width={260} shadow="md" withArrow>
          <Popover.Target>
            <UnstyledButton
              className={classes.more}
              aria-label={t("calendar.moreLabel", {
                count: hidden,
                day: formatDay(day, "weekdayDayMonth", i18n.language),
              })}
            >
              {t("calendar.more", { count: hidden })}
            </UnstyledButton>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap={4}>
              <Text size="xs" fw={600} c="dimmed">
                {formatDay(day, "weekdayDayMonth", i18n.language)}
              </Text>
              {rounds.map((r) => (
                <RoundChip key={r.id} round={r} people={names(r)} full />
              ))}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      )}
    </>
  );
}

interface DayProps {
  day: string;
  rounds: Interview[];
  full: boolean;
  names: (r: Interview) => string[];
}

/** The figures for the month or week on screen, a bar of how they split, and the period before. */
export function PeriodSummary({
  now,
  prev,
  period,
  anchor,
}: {
  now: Summary;
  prev: Summary;
  period: Period;
  anchor: string;
}) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  if (!now.total) {
    return (
      <Text size="sm" c="dimmed">
        {period === "month" ? t("calendar.noRoundsMonth") : t("calendar.noRoundsWeek")}
      </Text>
    );
  }
  const stats = [
    { id: "held", n: now.held, color: "teal", text: t("calendar.summary.held", { count: now.held }) },
    {
      id: "awaiting",
      n: now.awaiting,
      color: "orange",
      text: t("calendar.summary.awaiting", { count: now.awaiting }),
    },
    {
      id: "comingUp",
      n: now.comingUp,
      color: "blue",
      text: t("calendar.summary.comingUp", { count: now.comingUp }),
    },
    {
      id: "cancelled",
      n: now.cancelled,
      color: "gray",
      text: t("calendar.summary.cancelled", { count: now.cancelled }),
    },
    {
      id: "rescheduled",
      n: now.rescheduled,
      color: "yellow",
      text: t("calendar.summary.rescheduled", { count: now.rescheduled }),
    },
    {
      id: "companies",
      n: now.companies,
      color: null,
      text: t("calendar.summary.companies", { count: now.companies }),
    },
  ].filter((s) => s.n > 0 || s.id === "held" || s.id === "comingUp" || s.id === "companies");
  const diff = activeRounds(now) - activeRounds(prev);
  const month = formatDay(shiftPeriod(anchor, "month", -1), "monthName", lang);
  const compare =
    period === "month"
      ? diff > 0
        ? t("calendar.summary.moreThanMonth", { count: diff, month })
        : diff < 0
          ? t("calendar.summary.fewerThanMonth", { count: -diff, month })
          : t("calendar.summary.sameAsMonth", { month })
      : diff > 0
        ? t("calendar.summary.moreThanWeek", { count: diff })
        : diff < 0
          ? t("calendar.summary.fewerThanWeek", { count: -diff })
          : t("calendar.summary.sameAsWeek");
  const bar = stats.filter((s) => ["held", "awaiting", "comingUp", "cancelled"].includes(s.id) && s.n > 0);
  return (
    <Stack gap={8}>
      <Group gap="lg" style={{ rowGap: 8 }}>
        {stats.map((s) => (
          <div key={s.id} className={classes.stat} data-stat={s.id}>
            {s.color && (
              <span
                className={classes.statDot}
                style={{ "--dot": `var(--mantine-color-${s.color}-filled)` } as CSSProperties}
              />
            )}
            <span className={classes.statNumber}>{s.n}</span>
            <Text span size="sm" c="dimmed">
              {s.text}
            </Text>
          </div>
        ))}
      </Group>
      <Progress.Root size={6} aria-hidden>
        {bar.map((s) => (
          <Progress.Section key={s.id} value={(s.n / now.total) * 100} color={s.color!} />
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

/** The month or week as a grid of days. */
function Grid({ anchor, period, days, today, names }: GridProps) {
  const { i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const cells = gridDays(anchor, period);
  const month = anchor.slice(0, 7);
  return (
    <div className={`${classes.grid} ${period === "week" ? classes.week : ""}`}>
      {period === "month" &&
        cells.slice(0, 7).map((d) => (
          <div key={`h${d}`} className={classes.weekday} aria-hidden>
            {formatDay(d, "shortWeekday", lang)}
          </div>
        ))}
      {cells.map((d, i) => (
        <div
          key={d}
          className={classes.day}
          data-day={d}
          data-today={d === today || undefined}
          data-weekend={i % 7 >= 5 || undefined}
          data-outside={(period === "month" && d.slice(0, 7) !== month) || undefined}
        >
          <span className={classes.dayNumber}>
            {formatDay(d, period === "month" ? "dayOfMonth" : "shortWeekdayDayMonth", lang)}
          </span>
          <DayRounds
            day={d}
            rounds={days.get(d) ?? []}
            full={period === "week"}
            fits={period === "week" ? 99 : MONTH_FITS}
            names={names}
          />
        </div>
      ))}
    </div>
  );
}

interface GridProps {
  anchor: string;
  period: Period;
  days: Map<string, Interview[]>;
  today: string;
  names: (r: Interview) => string[];
}

/** On a phone: only the days with rounds, one under another, each with its rounds in full. */
function Agenda({ anchor, period, days, today, names }: GridProps) {
  const { i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const { first, last } = periodRange(anchor, period);
  const list = [...days.entries()].filter(([d]) => d >= first && d <= last);
  if (!list.length) return null;
  return (
    <div>
      {list.map(([d, rounds]) => (
        <div key={d} className={classes.agendaDay} data-day={d} data-today={d === today || undefined}>
          <div className={classes.agendaDate}>
            <Text size="xs" c="dimmed">
              {formatDay(d, "shortWeekday", lang)}
            </Text>
            <span className={classes.dayNumber}>{formatDay(d, "dayOfMonth", lang)}</span>
          </div>
          <Stack gap={4}>
            {rounds.map((r) => (
              <RoundChip key={r.id} round={r} people={names(r)} full />
            ))}
          </Stack>
        </div>
      ))}
    </div>
  );
}

/**
 * The Interviews page's calendar: a month (or a week) of rounds on their days, the period's figures
 * above it, and previous, next and today. Rounds not booked yet are listed by the page, under it.
 */
export function InterviewCalendar({ rounds, design = "current" }: { rounds: Interview[]; design?: Design }) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const today = useToday();
  const now = useNow();
  const phone = useMediaQuery("(max-width: 48em)");
  const [anchor, setAnchor] = useState(today);
  const [chosenPeriod, setPeriod] = useLocalStorage<Period>({
    key: "jat.interviews.period",
    defaultValue: "month",
    getInitialValueInEffect: false,
  });
  // The design concepts (dev only) work on months, apart from the week of clusters.
  const period: Period = design === "current" ? chosenPeriod : design === "clustersD" ? "week" : "month";
  const { data: contacts } = useContacts();
  const contactNames = new Map((contacts ?? []).map((c) => [c.id, c.name]));
  const names = (r: Interview) => r.interviewer_ids.flatMap((id) => contactNames.get(id) ?? []);
  const days = byDay(rounds);
  const concept = { rounds, days, today, now, names, anchor, period };

  if (MANY_MONTHS.includes(design)) {
    return (
      <Card withBorder padding="lg" className={classes.root}>
        <DotMonths {...concept} design={design} />
      </Card>
    );
  }

  const { first, last } = periodRange(anchor, period);
  const before = periodRange(shiftPeriod(anchor, period, -1), period);
  const summary = summarise(rounds, first, last, now);
  const previous = summarise(rounds, before.first, before.last, now);
  const heading =
    period === "month"
      ? formatDay(anchor, "monthNameYear", lang)
      : t("calendar.weekRange", {
          from: formatDay(first, first.slice(0, 4) === last.slice(0, 4) ? "dayMonth" : "dayMonthYear", lang),
          to: formatDay(last, "dayMonthYear", lang),
        });
  const props = { anchor, period, days, today, names };

  return (
    <Card withBorder padding="lg" className={classes.root}>
      <Stack gap="md">
        <Group justify="space-between" gap="sm">
          <Group gap={6} wrap="nowrap">
            <ActionIcon
              variant="default"
              aria-label={period === "month" ? t("calendar.previousMonth") : t("calendar.previousWeek")}
              onClick={() => setAnchor(shiftPeriod(anchor, period, -1))}
            >
              <IconChevronLeft size={16} />
            </ActionIcon>
            <ActionIcon
              variant="default"
              aria-label={period === "month" ? t("calendar.nextMonth") : t("calendar.nextWeek")}
              onClick={() => setAnchor(shiftPeriod(anchor, period, 1))}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
            <Title order={3} ml={6} fz={phone ? "h4" : "h3"} aria-live="polite">
              {heading}
            </Title>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <Button size="xs" variant="default" onClick={() => setAnchor(today)}>
              {t("calendar.today")}
            </Button>
            {design === "current" && (
              <SegmentedControl
                size="xs"
                value={period}
                onChange={(v) => setPeriod(v as Period)}
                data={[
                  { value: "month", label: t("calendar.month") },
                  { value: "week", label: t("calendar.week") },
                ]}
                aria-label={t("calendar.period")}
              />
            )}
          </Group>
        </Group>
        <section aria-label={t("calendar.summary.label", { period: heading })}>
          <PeriodSummary now={summary} prev={previous} period={period} anchor={anchor} />
        </section>
        {design === "monthsB" ? (
          <DotMonthLarge {...concept} />
        ) : design === "clustersA" ? (
          <DayClusters {...concept} look="dots" />
        ) : design === "clustersB" ? (
          <DayClusters {...concept} look="initials" />
        ) : design === "clustersC" ? (
          <DayClusters {...concept} look="tint" />
        ) : design === "clustersD" ? (
          <WeekClusters {...concept} />
        ) : phone ? (
          <Agenda {...props} />
        ) : (
          <Grid {...props} />
        )}
      </Stack>
    </Card>
  );
}
