import dayjs from "dayjs";

import { shadow } from "../i18n/shadow";

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

const wd = (n: number) => (n === 0 ? "the same day" : `${n} working day${n === 1 ? "" : "s"}`);

export interface ReplyHabit {
  replies?: number;
  usual_reply_days?: number | null;
  awaiting_reply_since?: string | null;
}

/** "Usually replies within 2 working days", or null when they've never replied yet. */
export function replyHabit(c: ReplyHabit): string | null {
  if (!c.replies || c.usual_reply_days == null) return null;
  if (c.replies === 1)
    return c.usual_reply_days === 0
      ? "Replied once, the same day"
      : `Replied once, in ${wd(c.usual_reply_days)}`;
  return c.usual_reply_days === 0
    ? shadow("people:replies.sameDay", "Usually replies the same day")
    : shadow("people:replies.within", `Usually replies within ${wd(c.usual_reply_days)}`, {
        count: c.usual_reply_days,
      });
}

/** Working days you've been waiting beyond their usual, or 0 (not waiting, or not late yet). */
export function overdueBy(c: ReplyHabit, today: string): number {
  if (!c.awaiting_reply_since || c.usual_reply_days == null || !c.replies) return 0;
  return Math.max(0, workingDays(c.awaiting_reply_since, today) - c.usual_reply_days);
}
