// Design concepts for the Interviews calendar, for Kai to choose from on a dev server (the page shows
// the switch only when import.meta.env.DEV). Two families, dot months and clusters, each in a few
// variations, all with a side panel of the chosen day's rounds. They share the data, the sums
// (utils/calendar.ts) and the round details with its actions (InterviewCalendar.tsx); one will survive.

import {
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { IconBuilding, IconCircleCheck, IconClock } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Interview } from "../api/interviewHooks";
import { gridDays, periodRange, shiftPeriod, summarise, type Period, type Summary } from "../utils/calendar";
import { formatDay } from "../utils/format";
import classes from "./CalendarConcepts.module.css";
import { PeriodSummary, RoundDetails, whenOf } from "./InterviewCalendar";
import { roundStatus } from "./Interviews";

export type Design =
  | "monthsA"
  | "monthsB"
  | "monthsC"
  | "monthsD"
  | "clustersA"
  | "clustersB"
  | "clustersC"
  | "clustersD"
  | "current";

/** The switch's choices, in order; ?design=1…8 picks by position. */
export const DESIGNS = [
  { value: "monthsA", key: "calendar.concepts.monthsA" },
  { value: "monthsB", key: "calendar.concepts.monthsB" },
  { value: "monthsC", key: "calendar.concepts.monthsC" },
  { value: "monthsD", key: "calendar.concepts.monthsD" },
  { value: "clustersA", key: "calendar.concepts.clustersA" },
  { value: "clustersB", key: "calendar.concepts.clustersB" },
  { value: "clustersC", key: "calendar.concepts.clustersC" },
  { value: "clustersD", key: "calendar.concepts.clustersD" },
] as const satisfies readonly { value: Design; key: string }[];

/** The variations that show several months at once, with no previous and next. */
export const MANY_MONTHS: readonly Design[] = ["monthsA", "monthsC", "monthsD"];

/**
 * The design to show, and on a dev server the switch to pick it: remembered, or chosen with
 * ?design=1…8. A production build always shows the current design and no switch. Unit tests (also
 * a dev mode) start on the current one, which is what they check.
 */
export function useDesign(): { design: Design; designSwitch: ReactNode } {
  const { t } = useTranslation("interviews");
  const phone = useMediaQuery("(max-width: 48em)");
  const [stored, setDesign] = useLocalStorage<Design>({
    key: "jat.interviews.design",
    defaultValue: import.meta.env.MODE === "test" ? "current" : "monthsA",
    getInitialValueInEffect: false,
  });
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get("design"));
    const chosen = DESIGNS[n - 1];
    if (chosen) setDesign(chosen.value);
  }, [setDesign]);
  if (!import.meta.env.DEV) return { design: "current", designSwitch: null };
  // A choice from the first round of concepts that's gone falls back to the first.
  const known = stored === "current" || DESIGNS.some((d) => d.value === stored);
  const design = known ? stored : "monthsA";
  return {
    design,
    designSwitch: (
      <Paper withBorder radius="md" p="xs" className={classes.switch}>
        <Group
          gap="sm"
          wrap="nowrap"
          style={phone ? { flexDirection: "column", alignItems: "stretch" } : undefined}
        >
          <Text size="xs" c="dimmed">
            {t("calendar.concepts.design")}
          </Text>
          <SegmentedControl
            size="xs"
            value={design}
            onChange={(v) => setDesign(v as Design)}
            orientation={phone ? "vertical" : "horizontal"}
            fullWidth={phone}
            data={DESIGNS.map((d) => ({ value: d.value, label: t(d.key) }))}
            aria-label={t("calendar.concepts.design")}
          />
        </Group>
      </Paper>
    ),
  };
}

export interface ConceptProps {
  rounds: Interview[];
  days: Map<string, Interview[]>;
  today: string;
  now: number;
  names: (r: Interview) => string[];
  anchor: string;
  period: Period;
}

const DAY = "YYYY-MM-DD";
const MONTH = "month" as const;
const EVER = { first: "0000-01-01", last: "9999-12-31" };

/** A day's colour: what most needs you first (awaiting an outcome), then coming up, held, cancelled. */
const TONES = ["orange", "blue", "teal", "red", "gray"];
function tone(rounds: Interview[]): string {
  const colors = rounds.map((r) => roundStatus(r).color);
  return TONES.find((c) => colors.includes(c)) ?? "gray";
}

const dotColor = (color: string) => ({ "--dot": `var(--mantine-color-${color}-filled)` }) as CSSProperties;

/** A dot split into a slice per status, in TONES order, for a day with rounds of more than one status. */
function splitDot(rounds: Interview[]): CSSProperties {
  const colors = rounds.map((r) => roundStatus(r).color);
  let at = 0;
  const stops = TONES.flatMap((c) => {
    const n = colors.filter((x) => x === c).length;
    if (!n) return [];
    const from = at;
    at += (n / colors.length) * 100;
    return [`var(--mantine-color-${c}-filled) ${from}% ${at}%`];
  });
  // CSS, not words: nobody reads this list.
  // eslint-disable-next-line no-restricted-syntax
  return { background: `conic-gradient(${stops.join(", ")})` };
}

/** "FA" for Fabrikam, "AW" for Adventure Works: a company's initials for a tiny chip. */
function initials(company: string): string {
  const words = company.split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? words[0]!.charAt(0) + words[1]!.charAt(0) : company.slice(0, 2);
  return letters.toUpperCase();
}

/**
 * The day the panel shows: the one you picked while it's on screen; else today if it has rounds, or the
 * next day that does; else the period's first day with rounds, or today, or the period's first day.
 */
function useChosenDay(days: Map<string, Interview[]>, today: string, first: string, last: string) {
  const [picked, setPicked] = useState<string | null>(null);
  const busy = [...days.keys()].filter((d) => d >= first && d <= last).sort();
  const fallback =
    busy.find((d) => d >= today) ?? (today >= first && today <= last ? today : (busy[0] ?? first));
  const day = picked && picked >= first && picked <= last ? picked : fallback;
  return [day, setPicked] as const;
}

/** The chosen day's rounds, each as its card with its actions. */
function DayPanel({
  day,
  days,
  names,
}: {
  day: string;
  days: Map<string, Interview[]>;
  names: ConceptProps["names"];
}) {
  const { t, i18n } = useTranslation("interviews");
  const here = days.get(day) ?? [];
  return (
    <div aria-live="polite">
      <Text fw={650} mb="sm">
        {formatDay(day, "weekdayDayMonth", i18n.language)}
      </Text>
      <Stack gap="sm">
        {here.length ? (
          here.map((r) => (
            <Paper key={r.id} withBorder radius="md" p="sm">
              <RoundDetails round={r} people={names(r)} />
            </Paper>
          ))
        ) : (
          <Text size="sm" c="dimmed">
            {t("calendar.concepts.noRoundsDay")}
          </Text>
        )}
      </Stack>
    </div>
  );
}

/** The calendar beside the panel; on a phone, the panel under it. */
function WithPanel({
  main,
  panel,
  sticky = true,
  panelFirstOnPhone = false,
}: {
  main: ReactNode;
  panel: ReactNode;
  sticky?: boolean;
  panelFirstOnPhone?: boolean;
}) {
  return (
    <div className={classes.withPanel} data-panel-first={panelFirstOnPhone || undefined}>
      <div className={classes.main}>{main}</div>
      <div className={classes.panel} data-sticky={sticky || undefined}>
        {panel}
      </div>
    </div>
  );
}

/** A figure with an icon, its words in a tooltip and for screen readers: "✓ 3". */
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

/** Held, coming up and companies, as small figures with icons. */
function Stats({ s }: { s: Summary }) {
  const { t } = useTranslation("interviews");
  return (
    <Group gap={12} wrap="nowrap">
      <IconStat
        icon={<IconCircleCheck size={15} stroke={1.8} />}
        n={s.held}
        label={t("calendar.concepts.held", { count: s.held })}
      />
      <IconStat
        icon={<IconClock size={15} stroke={1.8} />}
        n={s.comingUp + s.awaiting}
        label={t("calendar.concepts.comingUp", { count: s.comingUp + s.awaiting })}
      />
      <IconStat
        icon={<IconBuilding size={15} stroke={1.8} />}
        n={s.companies}
        label={t("calendar.concepts.companies", { count: s.companies })}
      />
    </Group>
  );
}

/** The months from the first round (at most a year back) to the later of today and the last round. */
function monthsToShow(days: Map<string, Interview[]>, today: string): string[] {
  const keys = [...days.keys()].sort();
  const floor = dayjs(today).subtract(11, "month").startOf("month");
  const first = dayjs(keys[0] ?? today).startOf("month");
  const start = first.isBefore(floor) ? floor : first;
  const lastKey = keys.at(-1);
  const end = dayjs(lastKey && lastKey > today ? lastKey : today).startOf("month");
  const months: string[] = [];
  for (let m = end; !m.isBefore(start); m = m.subtract(1, "month")) months.push(m.format(DAY));
  return months;
}

type DotStyle = "plain" | "split" | "large";

/** A month as a grid of dots: grey for a quiet day, a bigger coloured one for a day with rounds. */
function DotMonth({
  month,
  days,
  today,
  chosen,
  onChoose,
  look,
  stats,
}: {
  month: string;
  days: Map<string, Interview[]>;
  today: string;
  chosen: string;
  onChoose: (day: string) => void;
  look: DotStyle;
  stats?: Summary;
}) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const cells = gridDays(month, MONTH);
  return (
    <section className={classes.month} aria-label={formatDay(month, "monthNameYear", lang)} data-look={look}>
      {stats && (
        <Stack gap={4} mb="md">
          <Text fw={650} size="lg">
            {formatDay(month, "monthNameYear", lang)}
          </Text>
          <Stats s={stats} />
        </Stack>
      )}
      <div className={classes.dotGrid}>
        {cells.slice(0, 7).map((d) => (
          <span key={`h${d}`} className={classes.dotHead} aria-hidden>
            {formatDay(d, look === "large" ? "shortWeekday" : "minWeekday", lang)}
          </span>
        ))}
        {cells.map((d) => {
          if (d.slice(0, 7) !== month.slice(0, 7)) return <span key={d} className={classes.dotCell} />;
          const here = days.get(d) ?? [];
          const mixed = look === "split" && new Set(here.map((r) => roundStatus(r).color)).size > 1;
          const label = t("calendar.concepts.dayLabel", {
            count: here.length,
            day: formatDay(d, "weekdayDayMonth", lang),
          });
          return (
            <span
              key={d}
              className={classes.dotCell}
              data-today={d === today || undefined}
              data-chosen={d === chosen || undefined}
            >
              {look === "large" && (
                <span className={classes.cellNumber}>{formatDay(d, "dayOfMonth", lang)}</span>
              )}
              {here.length ? (
                <Tooltip label={label} withArrow openDelay={300}>
                  <UnstyledButton
                    className={classes.bigDot}
                    style={mixed ? { ...dotColor(tone(here)), ...splitDot(here) } : dotColor(tone(here))}
                    data-size={String(Math.min(here.length, 3))}
                    data-tone={tone(here)}
                    data-day={d}
                    aria-label={label}
                    aria-pressed={d === chosen}
                    onClick={() => onChoose(d)}
                  >
                    {here.length > 1 ? here.length : null}
                  </UnstyledButton>
                </Tooltip>
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

/**
 * Dot months A, C and D: every month of the search at once (A and D three across, C one column), the
 * chosen month's figures above, and the chosen day's rounds beside.
 */
export function DotMonths({ rounds, days, today, now, names, design }: ConceptProps & { design: Design }) {
  const { t, i18n } = useTranslation("interviews");
  const [day, setDay] = useChosenDay(days, today, EVER.first, EVER.last);
  const month = periodRange(day, MONTH);
  const before = periodRange(shiftPeriod(day, MONTH, -1), MONTH);
  const heading = formatDay(day, "monthNameYear", i18n.language);
  const column = design === "monthsC";
  const months = monthsToShow(days, today).map((m) => {
    const { first, last } = periodRange(m, MONTH);
    return (
      <DotMonth
        key={m}
        month={m}
        days={days}
        today={today}
        chosen={day}
        onChoose={setDay}
        look={design === "monthsD" ? "split" : "plain"}
        stats={summarise(rounds, first, last, now)}
      />
    );
  });
  return (
    <Stack gap="lg">
      <section aria-label={t("calendar.summary.label", { period: heading })}>
        <Text fw={650} size="sm" c="dimmed" mb={6}>
          {heading}
        </Text>
        <PeriodSummary
          now={summarise(rounds, month.first, month.last, now)}
          prev={summarise(rounds, before.first, before.last, now)}
          period={MONTH}
          anchor={day}
        />
      </section>
      <WithPanel
        main={
          column ? (
            <Stack gap={44} className={classes.column}>
              {months}
            </Stack>
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={36} verticalSpacing={40}>
              {months}
            </SimpleGrid>
          )
        }
        panel={<DayPanel day={day} days={days} names={names} />}
        panelFirstOnPhone
      />
    </Stack>
  );
}

/** Dot months B: one large month, with previous, next and today above (InterviewCalendar's header). */
export function DotMonthLarge({ days, today, names, anchor }: ConceptProps) {
  const { first, last } = periodRange(anchor, MONTH);
  const [day, setDay] = useChosenDay(days, today, first, last);
  return (
    <WithPanel
      main={<DotMonth month={first} days={days} today={today} chosen={day} onChoose={setDay} look="large" />}
      panel={<DayPanel day={day} days={days} names={names} />}
    />
  );
}

type ClusterLook = "dots" | "initials" | "tint";

/** Clusters A, B and C: a compact month, each round a small mark in its day; the day you pick, beside. */
export function DayClusters({ days, today, names, anchor, look }: ConceptProps & { look: ClusterLook }) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const { first, last } = periodRange(anchor, MONTH);
  const [day, setDay] = useChosenDay(days, today, first, last);
  const month = anchor.slice(0, 7);
  const cells = gridDays(anchor, MONTH);
  return (
    <WithPanel
      main={
        <div className={classes.clusterGrid} data-look={look}>
          {cells.slice(0, 7).map((d) => (
            <span key={`h${d}`} className={classes.dotHead} aria-hidden>
              {formatDay(d, "minWeekday", lang)}
            </span>
          ))}
          {cells.map((d) => {
            const rs = days.get(d) ?? [];
            if (!d.startsWith(month))
              return (
                <span key={d} className={classes.clusterDay} data-outside>
                  {formatDay(d, "dayOfMonth", lang)}
                </span>
              );
            return (
              <UnstyledButton
                key={d}
                className={classes.clusterDay}
                data-day={d}
                data-today={d === today || undefined}
                data-selected={d === day || undefined}
                data-busy={
                  look === "tint"
                    ? String(Math.min(rs.filter((r) => r.status !== "cancelled").length, 3))
                    : undefined
                }
                aria-pressed={d === day}
                aria-label={t("calendar.concepts.dayLabel", {
                  count: rs.length,
                  day: formatDay(d, "weekdayDayMonth", lang),
                })}
                onClick={() => setDay(d)}
              >
                <span className={classes.clusterNumber}>{formatDay(d, "dayOfMonth", lang)}</span>
                <span className={classes.clusterDots}>
                  {rs.map((r) =>
                    look === "initials" ? (
                      <span
                        key={r.id}
                        className={classes.initials}
                        data-status={r.status}
                        style={dotColor(roundStatus(r).color)}
                      >
                        {initials(r.company_name)}
                      </span>
                    ) : (
                      <span
                        key={r.id}
                        className={classes.miniDot}
                        data-status={r.status}
                        style={dotColor(roundStatus(r).color)}
                      />
                    ),
                  )}
                </span>
              </UnstyledButton>
            );
          })}
        </div>
      }
      panel={<DayPanel day={day} days={days} names={names} />}
    />
  );
}

/** Where in a day's column a time sits, from 07:00 to 21:00. */
function dayFraction(iso: string): number {
  const d = dayjs(iso);
  const minutes = d.hour() * 60 + d.minute();
  return Math.min(1, Math.max(0, (minutes - 7 * 60) / (14 * 60)));
}

/** A round's dot in its day's column: at its time, nudged sideways when it shares the day. */
function columnDotStyle(r: Interview, n: number): CSSProperties {
  return {
    ...dotColor(roundStatus(r).color),
    top: `calc(8px + (100% - 16px) * ${dayFraction(whenOf(r))})`,
    left: `calc(50% + ${((n % 3) - 1) * 14}px)`,
  } as CSSProperties;
}

/** The hours marked down a week's columns. */
const HOURS = [9, 12, 15, 18];

/** Clusters D: a week of tall day columns, each round a dot at its time; the day you pick, beside. */
export function WeekClusters({ days, today, names, anchor }: ConceptProps) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const { first, last } = periodRange(anchor, "week");
  const [day, setDay] = useChosenDay(days, today, first, last);
  const week = gridDays(anchor, "week");
  return (
    <WithPanel
      main={
        <div className={classes.weekCols}>
          <div className={classes.hours} aria-hidden>
            {HOURS.map((h) => (
              <span key={h} style={{ top: `calc(8px + (100% - 16px) * ${(h - 7) / 14})` }}>
                {formatDay(dayjs().hour(h).minute(0), "time", lang)}
              </span>
            ))}
          </div>
          {week.map((d) => {
            const rs = days.get(d) ?? [];
            return (
              <UnstyledButton
                key={d}
                className={classes.weekCol}
                data-day={d}
                data-today={d === today || undefined}
                data-selected={d === day || undefined}
                aria-pressed={d === day}
                aria-label={t("calendar.concepts.dayLabel", {
                  count: rs.length,
                  day: formatDay(d, "weekdayDayMonth", lang),
                })}
                onClick={() => setDay(d)}
              >
                <span className={classes.weekColHead}>
                  <span>{formatDay(d, "minWeekday", lang)}</span>
                  <span className={classes.clusterNumber}>{formatDay(d, "dayOfMonth", lang)}</span>
                </span>
                <span className={classes.weekColBody}>
                  {HOURS.map((h) => (
                    <span
                      key={h}
                      className={classes.hourLine}
                      style={{ top: `calc(8px + (100% - 16px) * ${(h - 7) / 14})` }}
                    />
                  ))}
                  {rs.map((r, n) => (
                    <span
                      key={r.id}
                      className={classes.columnDot}
                      data-status={r.status}
                      style={columnDotStyle(r, n)}
                    />
                  ))}
                </span>
              </UnstyledButton>
            );
          })}
        </div>
      }
      panel={<DayPanel day={day} days={days} names={names} />}
    />
  );
}
