// Design concepts for the Interviews calendar, for Kai to choose from on a dev server (the page shows
// the switch only when import.meta.env.DEV). They share the data, the sums (utils/calendar.ts) and the
// round details with its actions (InterviewCalendar.tsx); only one is meant to survive.

import {
  Group,
  Paper,
  ScrollArea,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { useLocalStorage, useMediaQuery } from "@mantine/hooks";
import { IconBuilding, IconCalendarEvent, IconCircleCheck, IconClock } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import type { Interview } from "../api/interviewHooks";
import { gridDays, periodRange, summarise, type Summary } from "../utils/calendar";
import { formatDay } from "../utils/format";
import { roundLabel } from "../utils/rounds";
import classes from "./CalendarConcepts.module.css";
import { HoverDetails, RoundChip, RoundDetails, whenOf } from "./InterviewCalendar";
import { roundStatus } from "./Interviews";

export type Design = "dotMonths" | "dotYear" | "clusters" | "weekStrip" | "current";

/** The switch's choices, in order; ?design=1…5 picks by position. */
export const DESIGNS = [
  { value: "dotMonths", key: "calendar.concepts.dotMonths" },
  { value: "dotYear", key: "calendar.concepts.dotYear" },
  { value: "clusters", key: "calendar.concepts.clusters" },
  { value: "weekStrip", key: "calendar.concepts.weekStrip" },
  { value: "current", key: "calendar.concepts.current" },
] as const satisfies readonly { value: Design; key: string }[];

/**
 * The design to show, and on a dev server the switch to pick it: remembered, or chosen with
 * ?design=1…5. A production build always shows the current design and no switch. Unit tests (also
 * a dev mode) start on the current one, which is what they check.
 */
export function useDesign(): { design: Design; designSwitch: ReactNode } {
  const { t } = useTranslation("interviews");
  const phone = useMediaQuery("(max-width: 48em)");
  const [design, setDesign] = useLocalStorage<Design>({
    key: "jat.interviews.design",
    defaultValue: import.meta.env.MODE === "test" ? "current" : "dotMonths",
    getInitialValueInEffect: false,
  });
  useEffect(() => {
    const n = Number(new URLSearchParams(window.location.search).get("design"));
    const chosen = DESIGNS[n - 1];
    if (chosen) setDesign(chosen.value);
  }, [setDesign]);
  if (!import.meta.env.DEV) return { design: "current", designSwitch: null };
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
}

const DAY = "YYYY-MM-DD";
const MONTH = "month" as const;

/** A day's colour: what most needs you first (awaiting an outcome), then coming up, held, cancelled. */
const TONES = ["orange", "blue", "teal", "red", "gray"];
function tone(rounds: Interview[]): string {
  const colors = rounds.map((r) => roundStatus(r).color);
  return TONES.find((c) => colors.includes(c)) ?? "gray";
}

const dotColor = (color: string) => ({ "--dot": `var(--mantine-color-${color}-filled)` }) as CSSProperties;

/** One round's details, or a day's rounds as a list (each with its own details). */
function DayDetails({
  day,
  rounds,
  names,
}: {
  day: string;
  rounds: Interview[];
  names: (r: Interview) => string[];
}) {
  const { i18n } = useTranslation("interviews");
  if (rounds.length === 1) return <RoundDetails round={rounds[0]!} people={names(rounds[0]!)} />;
  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} c="dimmed">
        {formatDay(day, "weekdayDayMonth", i18n.language)}
      </Text>
      {rounds.map((r) => (
        <RoundChip key={r.id} round={r} people={names(r)} full />
      ))}
    </Stack>
  );
}

/** A day with rounds, as a button: its rounds on hover, focus or click. */
function DayButton({
  day,
  rounds,
  names,
  className,
  style,
  children,
  data,
}: {
  day: string;
  rounds: Interview[];
  names: (r: Interview) => string[];
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  data?: Record<string, string | boolean | undefined>;
}) {
  const { t, i18n } = useTranslation("interviews");
  return (
    <HoverDetails
      width={rounds.length === 1 ? 340 : 280}
      position="bottom"
      details={() => <DayDetails day={day} rounds={rounds} names={names} />}
      target={(props) => (
        <UnstyledButton
          className={className}
          style={style}
          data-day={day}
          aria-label={t("calendar.concepts.dayLabel", {
            count: rounds.length,
            day: formatDay(day, "weekdayDayMonth", i18n.language),
          })}
          {...data}
          {...props}
        >
          {children}
        </UnstyledButton>
      )}
    />
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
function Stats({ s, rounds = false }: { s: Summary; rounds?: boolean }) {
  const { t } = useTranslation("interviews");
  return (
    <Group gap={12} wrap="nowrap">
      {rounds && (
        <IconStat
          icon={<IconCalendarEvent size={15} stroke={1.8} />}
          n={s.total - s.cancelled}
          label={t("calendar.concepts.rounds", { count: s.total - s.cancelled })}
        />
      )}
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

/** 1. Dot months: each month a grid of dots, newest first; a bigger, coloured dot on a day with rounds. */
export function DotMonths({ rounds, days, today, now, names }: ConceptProps) {
  const { i18n } = useTranslation("interviews");
  const lang = i18n.language;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing={48} verticalSpacing={40}>
      {monthsToShow(days, today).map((month) => {
        const { first, last } = periodRange(month, MONTH);
        const cells = gridDays(month, MONTH);
        return (
          <section key={month} className={classes.month} aria-label={formatDay(month, "monthNameYear", lang)}>
            <Group justify="space-between" mb="md" wrap="nowrap">
              <Text fw={650} size="lg">
                {formatDay(month, "monthNameYear", lang)}
              </Text>
              <Stats s={summarise(rounds, first, last, now)} />
            </Group>
            <div className={classes.dotGrid}>
              {cells.slice(0, 7).map((d) => (
                <span key={`h${d}`} className={classes.dotHead} aria-hidden>
                  {formatDay(d, "minWeekday", lang)}
                </span>
              ))}
              {cells.map((d) => {
                if (d.slice(0, 7) !== month.slice(0, 7)) return <span key={d} className={classes.dotCell} />;
                const here = days.get(d) ?? [];
                return (
                  <span key={d} className={classes.dotCell} data-today={d === today || undefined}>
                    {here.length ? (
                      <DayButton
                        day={d}
                        rounds={here}
                        names={names}
                        className={classes.bigDot}
                        style={dotColor(tone(here))}
                        data={{ "data-size": String(Math.min(here.length, 3)), "data-tone": tone(here) }}
                      >
                        {here.length > 1 ? here.length : null}
                      </DayButton>
                    ) : (
                      <span className={classes.smallDot} />
                    )}
                  </span>
                );
              })}
            </div>
          </section>
        );
      })}
    </SimpleGrid>
  );
}

/** 2. Dot year: the whole search as a grid of days, a column per week, darker for busier days. */
export function DotYear({ rounds, days, today, now, names }: ConceptProps) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const viewport = useRef<HTMLDivElement>(null);
  const keys = [...days.keys()].sort();
  const monday = (d: dayjs.Dayjs) => d.subtract((d.day() + 6) % 7, "day");
  const floor = monday(dayjs(today).subtract(51, "week"));
  const earliest = monday(dayjs(keys[0] ?? today).subtract(1, "week"));
  const start = earliest.isBefore(floor) ? floor : earliest;
  const lastKey = keys.at(-1);
  const end = monday(dayjs(lastKey && lastKey > today ? lastKey : today)).add(6, "day");
  const weeks: string[][] = [];
  for (let w = start; !w.isAfter(end); w = w.add(1, "week"))
    weeks.push(Array.from({ length: 7 }, (_, i) => w.add(i, "day").format(DAY)));
  const first = weeks[0]![0]!;
  const last = weeks.at(-1)![6]!;
  const s = summarise(rounds, first, last, now);
  // Open on the latest weeks, where a phone can't show them all.
  useEffect(() => {
    const el = viewport.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [weeks.length]);
  const grid = { gridTemplateColumns: `auto repeat(${weeks.length}, var(--cell))` } as CSSProperties;
  return (
    <Stack gap="lg">
      <Group justify="space-between" align="flex-end">
        <Title order={3}>
          {t("calendar.weekRange", {
            from: formatDay(weeks[0]![6]!, "monthYear", lang),
            to: formatDay(last, "monthYear", lang),
          })}
        </Title>
        <Stats s={s} rounds />
      </Group>
      {s.total === 0 && (
        <Text size="sm" c="dimmed">
          {t("calendar.concepts.noRounds")}
        </Text>
      )}
      <ScrollArea type="auto" viewportRef={viewport} offsetScrollbars>
        <div className={classes.year} style={grid}>
          {weeks.map((w, i) => {
            const firstOfMonth = w.find((d) => d.endsWith("-01"));
            const label = firstOfMonth ?? (i === 0 ? w[0] : undefined);
            return label ? (
              <span key={`m${w[0]}`} className={classes.yearMonth} style={{ gridColumn: i + 2, gridRow: 1 }}>
                {formatDay(label, "shortMonth", lang)}
              </span>
            ) : null;
          })}
          {weeks[0]!.map((d, row) =>
            row % 2 === 0 ? (
              <span key={`r${d}`} className={classes.yearWeekday} style={{ gridColumn: 1, gridRow: row + 2 }}>
                {formatDay(d, "shortWeekday", lang)}
              </span>
            ) : null,
          )}
          {weeks.flatMap((w, col) =>
            w.map((d, row) => {
              const here = days.get(d) ?? [];
              const active = here.filter((r) => r.status !== "cancelled").length;
              const place = { gridColumn: col + 2, gridRow: row + 2 };
              const data = {
                "data-level": String(Math.min(active, 3)),
                "data-future": d > today || undefined,
                "data-today": d === today || undefined,
              };
              if (d > last) return null;
              return (
                <span key={d} className={classes.yearCell} style={place}>
                  {here.length ? (
                    <DayButton day={d} rounds={here} names={names} className={classes.yearDot} data={data} />
                  ) : (
                    <span className={classes.yearDot} {...data} />
                  )}
                </span>
              );
            }),
          )}
        </div>
      </ScrollArea>
      <Group gap={6} justify="flex-end" aria-hidden>
        <Text size="xs" c="dimmed">
          {t("calendar.concepts.fewer")}
        </Text>
        {[0, 1, 2, 3].map((level) => (
          <span key={level} className={classes.yearDot} data-level={level} />
        ))}
        <Text size="xs" c="dimmed">
          {t("calendar.concepts.busier")}
        </Text>
      </Group>
    </Stack>
  );
}

/** 3. Clusters: a compact month, a small dot per round; the day you pick is listed beside it. */
export function DayClusters({ days, today, names, anchor }: ConceptProps) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const [picked, setPicked] = useState<string | null>(null);
  const month = anchor.slice(0, 7);
  const cells = gridDays(anchor, "month");
  // The day you picked; else today or the next day with rounds this month; else its first busy day.
  const busy = cells.filter((d) => d.startsWith(month) && days.has(d));
  const day = picked?.startsWith(month) ? picked : (busy.find((d) => d >= today) ?? busy[0] ?? `${month}-01`);
  const here = days.get(day) ?? [];
  return (
    <div className={classes.clusters}>
      <div className={classes.clusterGrid}>
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
              aria-pressed={d === day}
              aria-label={t("calendar.concepts.dayLabel", {
                count: rs.length,
                day: formatDay(d, "weekdayDayMonth", lang),
              })}
              onClick={() => setPicked(d)}
            >
              <span className={classes.clusterNumber}>{formatDay(d, "dayOfMonth", lang)}</span>
              <span className={classes.clusterDots}>
                {rs.map((r) => (
                  <span
                    key={r.id}
                    className={classes.miniDot}
                    data-status={r.status}
                    style={dotColor(roundStatus(r).color)}
                  />
                ))}
              </span>
            </UnstyledButton>
          );
        })}
      </div>
      <div className={classes.panel} aria-live="polite">
        <Text fw={650} mb="sm">
          {formatDay(day, "weekdayDayMonth", lang)}
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
    </div>
  );
}

/** Where in a day's strip a time sits, from 07:00 to 21:00. */
function dayFraction(iso: string): number {
  const d = dayjs(iso);
  const minutes = d.hour() * 60 + d.minute();
  return Math.min(1, Math.max(0, (minutes - 7 * 60) / (14 * 60)));
}

/** A round's dot on its day's strip: at its time, lifted a little when it shares the day. */
function timeDotStyle(r: Interview, n: number): CSSProperties {
  return {
    ...dotColor(roundStatus(r).color),
    // Inset from the ends, so a dot at 07:00 or 21:00 stays inside its own day.
    left: `calc(7px + (100% - 14px) * ${dayFraction(whenOf(r))})`,
    "--lift": `${(n % 3) * -7}px`,
  } as CSSProperties;
}

/** 4. Week strip: a row per week, each round a dot at its time of day, the week's figures at the end. */
export function WeekStrip({ rounds, days, today, now, names, anchor }: ConceptProps) {
  const { t, i18n } = useTranslation("interviews");
  const lang = i18n.language;
  const month = anchor.slice(0, 7);
  const cells = gridDays(anchor, "month");
  const weeks = Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <div className={classes.strips}>
      {weeks.map((w) => (
        <div key={w[0]} className={classes.weekRow}>
          <Text size="sm" fw={600} className={classes.weekLabel}>
            {t("calendar.weekRange", {
              from: formatDay(w[0]!, "dayMonth", lang),
              to: formatDay(w[6]!, "dayMonth", lang),
            })}
          </Text>
          <div className={classes.track}>
            {w.map((d, i) => (
              <div
                key={d}
                className={classes.trackDay}
                data-today={d === today || undefined}
                data-outside={!d.startsWith(month) || undefined}
                data-weekend={i >= 5 || undefined}
              >
                <div className={classes.trackLine}>
                  {(days.get(d) ?? []).map((r, n) => {
                    const time = formatDay(whenOf(r), "time", lang);
                    const style = timeDotStyle(r, n);
                    return (
                      <HoverDetails
                        key={r.id}
                        position="bottom"
                        details={() => <RoundDetails round={r} people={names(r)} />}
                        target={(props) => (
                          <UnstyledButton
                            className={classes.timeDot}
                            data-status={r.status}
                            style={style}
                            aria-label={t("calendar.roundLabel", {
                              label: roundLabel(r),
                              company: r.company_name,
                              when: time,
                            })}
                            {...props}
                          />
                        )}
                      />
                    );
                  })}
                </div>
                <span className={classes.trackLabel}>
                  <span>{formatDay(d, "minWeekday", lang)}</span>
                  <span>{formatDay(d, "dayOfMonth", lang)}</span>
                </span>
              </div>
            ))}
          </div>
          <div className={classes.weekSum}>
            <Stats s={summarise(rounds, w[0]!, w[6]!, now)} rounds />
          </div>
        </div>
      ))}
    </div>
  );
}
