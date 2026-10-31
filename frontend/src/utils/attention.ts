import dayjs from "dayjs";

import type { ApplicationDetail } from "../api/client";
import type { WorkflowStage } from "../api/hooks";
import type { Interview } from "../api/interviewHooks";
import type { Offer } from "../api/offerHooks";
import type { Todo } from "../api/todoHooks";
import { i18n } from "../i18n";
import { formatDay as format } from "./format";
import { roundLabel } from "./rounds";

/**
 * What an application needs, and how long ago things happened, for its "At a glance" card.
 * The rules follow Today (the next-actions API, src/jat/api/next_actions.py), so the two agree.
 */

export type Tone = "red" | "orange" | "blue" | "gray";

export interface GlanceItem {
  key: string;
  label: string;
  when: string; // "for 12 days", "overdue by 2 days", "in 3 days"
  tone: Tone;
}

export interface KeyDate {
  label: string;
  day: string; // YYYY-MM-DD
  value: string; // "12 Sep 2026"
  ago: string; // "3 weeks ago"
}

export interface Glance {
  open: boolean; // active and not archived: only then does anything need doing
  attention: GlanceItem[];
  comingUp: GlanceItem[];
  dates: KeyDate[];
}

export interface GlanceInput {
  app: ApplicationDetail;
  stage: WorkflowStage | undefined;
  interviews: Interview[];
  offers: Offer[];
  todos: Todo[];
  today: string; // YYYY-MM-DD, your local day
  now: number; // ms since the epoch
}

/** The local calendar day of a timestamp or date. */
const dayOf = (value: string) => dayjs(value).format("YYYY-MM-DD");

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return dayjs(to).diff(dayjs(from), "day");
}

const t = i18n.t;

/** "today", "yesterday", "5 days ago", "3 weeks ago", "2 months ago". */
export function since(days: number): string {
  if (days <= 0) return t("common:time.today");
  if (days === 1) return t("common:time.yesterday");
  if (days < 14) return t("common:time.daysAgo", { count: days });
  if (days < 60) return t("common:time.weeksAgo", { count: Math.floor(days / 7) });
  return t("common:time.monthsAgo", { count: Math.floor(days / 30) });
}

/** "today", "tomorrow", "in 5 days", "in 3 weeks". */
export function until(days: number): string {
  if (days <= 0) return t("common:time.today");
  if (days === 1) return t("common:time.tomorrow");
  if (days < 14) return t("common:time.inDays", { count: days });
  if (days < 60) return t("common:time.inWeeks", { count: Math.floor(days / 7) });
  return t("common:time.inMonths", { count: Math.floor(days / 30) });
}

/** A due date against today: "due today", "overdue by 3 days", "in 2 days". */
function due(on: string, today: string): { when: string; overdue: boolean } {
  const days = daysBetween(today, on);
  if (days < 0) return { when: t("common:time.overdueBy", { count: -days }), overdue: true };
  if (days === 0) return { when: t("common:time.dueToday"), overdue: false };
  return { when: until(days), overdue: false };
}

/** "for 12 days" (or "since today"). */
function lasting(fromDay: string, today: string): string {
  const days = daysBetween(fromDay, today);
  return days <= 0 ? t("common:time.sinceToday") : t("common:time.forDays", { count: days });
}

const formatDay = (day: string) => format(day, "dayMonthYear", i18n.language);

const LAST_CONTACT = {
  call: "today:glance.lastCall",
  email: "today:glance.lastEmail",
  message: "today:glance.lastMessage",
} as const;

export function glance({ app, stage, interviews, offers, todos, today, now }: GlanceInput): Glance {
  const open = app.stage_kind === "active" && !app.archived;
  const attention: GlanceItem[] = [];
  const comingUp: GlanceItem[] = [];

  if (open && app.reply_to_read_since) {
    attention.push({
      key: "to-read",
      label: t("today:glance.toRead"),
      when: lasting(app.reply_to_read_since, today),
      tone: "red",
    });
  }

  // Your own to-dos, whatever the stage (Today lists every open one): due by today,
  // then undated; later ones are coming up.
  const openTodos = todos.filter((t) => !t.done_at);
  for (const todo of openTodos.filter((t) => t.due_on)) {
    const dueOn = todo.due_on as string;
    const d = due(dueOn, today);
    const item = { key: `todo-${todo.id}`, label: t("today:glance.todo", { text: todo.text }), when: d.when };
    if (dueOn <= today) attention.push({ ...item, tone: d.overdue ? "red" : "orange" });
    else comingUp.push({ ...item, tone: "gray" });
  }
  for (const todo of openTodos.filter((t) => !t.due_on)) {
    attention.push({
      key: `todo-${todo.id}`,
      label: t("today:glance.todo", { text: todo.text }),
      when: t("today:glance.noDate"),
      tone: "blue",
    });
  }

  if (open) {
    // The newest offer counts; a pending one with a reply date needs an answer.
    const offer = [...offers].sort(
      (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id),
    )[0];
    if (offer?.status === "pending" && offer.respond_by) {
      const d = due(offer.respond_by, today);
      const item = {
        key: "offer",
        label: t("today:glance.replyToOffer", { date: formatDay(offer.respond_by) }),
        when: d.when,
      };
      if (daysBetween(today, offer.respond_by) <= 14)
        attention.push({ ...item, tone: d.overdue ? "red" : "orange" });
      else comingUp.push({ ...item, tone: "gray" });
    }

    for (const round of interviews) {
      if (round.status !== "scheduled") continue;
      const at = round.starts_at ?? round.deadline_at;
      if (!at) {
        comingUp.push({
          key: `round-${round.id}`,
          label: t("today:glance.notBooked", { label: roundLabel(round) }),
          when: t("today:glance.noDate"),
          tone: "gray",
        });
      } else if (Date.parse(at) < now) {
        attention.push({
          key: `round-${round.id}`,
          label: t("today:glance.howDidItGo", { label: roundLabel(round) }),
          when: since(daysBetween(dayOf(at), today)),
          tone: "orange",
        });
      } else {
        comingUp.push({
          key: `round-${round.id}`,
          label: roundLabel(round),
          when: t("today:glance.roundWhen", {
            until: until(daysBetween(today, dayOf(at))),
            at: format(at, "dayMonthTime", i18n.language),
          }),
          tone: "blue",
        });
      }
    }

    const snoozed = app.snoozed_until !== null && app.snoozed_until > today;
    const followUpDue =
      app.follow_up_on !== null && app.follow_up_on <= today && !app.reply_to_read_since && !snoozed;
    if (followUpDue && app.follow_up_on) {
      const d = due(app.follow_up_on, today);
      attention.push({
        key: "follow-up",
        label: t("today:glance.followUp"),
        when: d.when,
        tone: d.overdue ? "red" : "orange",
      });
    } else if (app.follow_up_on && app.follow_up_on > today) {
      comingUp.push({
        key: "follow-up",
        label: t("today:glance.followUpOn", { date: formatDay(app.follow_up_on) }),
        when: until(daysBetween(today, app.follow_up_on)),
        tone: "gray",
      });
    }

    if (app.stale && !followUpDue) {
      const limit = stage?.stale_after_days;
      attention.push({
        key: "stale",
        label: limit
          ? t("today:glance.goneQuietAfter", { stage: stage?.name ?? app.stage_name, count: limit })
          : t("today:glance.goneQuiet"),
        when: t("today:glance.noActivity", { count: app.days_since_activity }),
        tone: "red",
      });
    }

    if (app.awaiting_reply_since && !followUpDue) {
      attention.push({
        key: "waiting",
        label: t("today:glance.waiting"),
        when: lasting(app.awaiting_reply_since, today),
        tone: "gray",
      });
    }

    if (snoozed && app.snoozed_until) {
      comingUp.push({
        key: "snoozed",
        label: t("today:glance.snoozedUntil", { date: formatDay(app.snoozed_until) }),
        when: until(daysBetween(today, app.snoozed_until)),
        tone: "gray",
      });
    }
  }

  // Key dates, oldest first.
  const dates: KeyDate[] = [];
  const at = (label: string, day: string) =>
    dates.push({ label, day, value: formatDay(day), ago: since(daysBetween(day, today)) });
  const added = app.events.find((e) => e.kind === "stage_change" && e.from_stage === null);
  at(t("today:glance.added"), dayOf(added?.occurred_at ?? app.created_at));
  if (app.applied_on) at(t("today:glance.applied"), app.applied_on);
  // Only what has happened: a call logged ahead of time doesn't count until then.
  const past = app.events
    .filter((e) => Date.parse(e.occurred_at) <= now)
    .sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
  const enteredStage = past.find((e) => e.kind === "stage_change" && e.to_stage === app.stage);
  if (enteredStage) at(t("today:glance.movedTo", { stage: app.stage_name }), dayOf(enteredStage.occurred_at));
  const contact = past.find((e) => Object.hasOwn(LAST_CONTACT, e.kind));
  if (contact) at(t(LAST_CONTACT[contact.kind as keyof typeof LAST_CONTACT]), dayOf(contact.occurred_at));
  const lastRound = interviews
    .filter((r) => r.status === "done" && (r.starts_at ?? r.deadline_at))
    .map((r) => (r.starts_at ?? r.deadline_at) as string)
    .sort()
    .pop();
  if (lastRound) at(t("today:glance.lastInterview"), dayOf(lastRound));
  // last_activity_at takes the latest of everything, so something logged for later moves it
  // ahead; then the latest event that has happened stands in.
  const lastActivity = Date.parse(app.last_activity_at) <= now ? app.last_activity_at : past[0]?.occurred_at;
  if (lastActivity) at(t("today:glance.lastActivity"), dayOf(lastActivity));
  dates.sort((a, b) => a.day.localeCompare(b.day)); // stable: same-day dates keep this order

  return { open, attention, comingUp, dates };
}
