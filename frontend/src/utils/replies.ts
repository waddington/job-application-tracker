import dayjs from "dayjs";

import { i18n } from "../i18n";

/** Weekdays after `start`, up to and including `end` (as the server counts them). */
export function workingDays(start: string, end: string): number {
  let day = dayjs(start);
  const last = dayjs(end);
  let count = 0;
  while (day.isBefore(last, "day")) {
    day = day.add(1, "day");
    if (day.day() !== 0 && day.day() !== 6) count++;
  }
  return count;
}

export interface ReplyHabit {
  replies?: number;
  usual_reply_days?: number | null;
  awaiting_reply_since?: string | null;
}

/** "Usually replies within 2 working days", or null when they've never replied yet. */
export function replyHabit(c: ReplyHabit): string | null {
  if (!c.replies || c.usual_reply_days == null) return null;
  const count = c.usual_reply_days;
  if (c.replies === 1)
    return count === 0 ? i18n.t("people:replies.onceSameDay") : i18n.t("people:replies.onceIn", { count });
  return count === 0 ? i18n.t("people:replies.sameDay") : i18n.t("people:replies.within", { count });
}

/** Working days you've been waiting beyond their usual, or 0 (not waiting, or not late yet). */
export function overdueBy(c: ReplyHabit, today: string): number {
  if (!c.awaiting_reply_since || c.usual_reply_days == null || !c.replies) return 0;
  return Math.max(0, workingDays(c.awaiting_reply_since, today) - c.usual_reply_days);
}
