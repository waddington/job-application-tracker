import dayjs from "dayjs";

import type { ApiEvent } from "../api/client";
import { i18n } from "../i18n";
import type { TextKey } from "../locales/en";
import { formatDay, formatMoney } from "../utils/format";
import { roundLabel } from "../utils/rounds";

export type EventMsg = NonNullable<ApiEvent["msg"]>;

// A key the API adds without text here is a type error.
export const EVENT_TEXT = {
  "event.linkAdded": "events:linkAdded",
  "event.noteAdded": "events:noteAdded",
  "event.fileAdded": "events:fileAdded",
  "event.email": "events:email",
  "event.emailNoSubject": "events:emailNoSubject",
  "event.emailUnknownSender": "events:emailUnknownSender",
  "event.emailNoSubjectUnknownSender": "events:emailNoSubjectUnknownSender",
  "event.cvSent": "events:cvSent",
  "event.coverLetterSent": "events:coverLetterSent",
  "event.documentSent": "events:documentSent",
  "event.roundScheduled": "events:roundScheduled",
  "event.roundAdded": "events:roundAdded",
  "event.roundCancelled": "events:roundCancelled",
  "event.roundBackOn": "events:roundBackOn",
  "event.roundDone": "events:roundDone",
  "event.roundRemoved": "events:roundRemoved",
  "event.roundRescheduled": "events:roundRescheduled",
  "event.roundRescheduledReason": "events:roundRescheduledReason",
  "event.roundRescheduledByMe": "events:roundRescheduledByMe",
  "event.roundRescheduledByThem": "events:roundRescheduledByThem",
  "event.roundRescheduledByMutual": "events:roundRescheduledByMutual",
  "event.roundRescheduledByNeither": "events:roundRescheduledByNeither",
  "event.roundRescheduledByMeReason": "events:roundRescheduledByMeReason",
  "event.roundRescheduledByThemReason": "events:roundRescheduledByThemReason",
  "event.roundRescheduledByMutualReason": "events:roundRescheduledByMutualReason",
  "event.roundRescheduledByNeitherReason": "events:roundRescheduledByNeitherReason",
  "event.offerReceivedYear": "events:offerReceivedYear",
  "event.offerReceivedDay": "events:offerReceivedDay",
  "event.offerReceivedNoFigures": "events:offerReceivedNoFigures",
  "event.offerBackYear": "events:offerBackYear",
  "event.offerBackDay": "events:offerBackDay",
  "event.offerBackNoFigures": "events:offerBackNoFigures",
  "event.offerAcceptedYear": "events:offerAcceptedYear",
  "event.offerAcceptedDay": "events:offerAcceptedDay",
  "event.offerAcceptedNoFigures": "events:offerAcceptedNoFigures",
  "event.offerDeclinedYear": "events:offerDeclinedYear",
  "event.offerDeclinedDay": "events:offerDeclinedDay",
  "event.offerDeclinedNoFigures": "events:offerDeclinedNoFigures",
  "event.offerWithdrawnYear": "events:offerWithdrawnYear",
  "event.offerWithdrawnDay": "events:offerWithdrawnDay",
  "event.offerWithdrawnNoFigures": "events:offerWithdrawnNoFigures",
  "event.offerRemovedYear": "events:offerRemovedYear",
  "event.offerRemovedDay": "events:offerRemovedDay",
  "event.offerRemovedNoFigures": "events:offerRemovedNoFigures",
  "event.followedUp": "events:followedUp",
  "event.noReply": "events:noReply",
  "event.replyToRead": "events:replyToRead",
  "event.replyRead": "events:replyRead",
  "event.repliedWaiting": "events:repliedWaiting",
  "event.heardBack": "events:heardBack",
  "event.undoMove": "events:undoMove",
  "event.recruiterChanged": "events:recruiterChanged",
  "event.recruiterSet": "events:recruiterSet",
  "event.recruiterRemoved": "events:recruiterRemoved",
  "event.recruiterChangedAgency": "events:recruiterChangedAgency",
  "event.recruiterSetAgency": "events:recruiterSetAgency",
  "event.recruiterRemovedAgency": "events:recruiterRemovedAgency",
  "event.recruiterChangedOnRole": "events:recruiterChangedOnRole",
  "event.recruiterSetOnRole": "events:recruiterSetOnRole",
  "event.rolePersonKeptAgency": "events:rolePersonKeptAgency",
  "event.rolePersonKeptUnnamedAgency": "events:rolePersonKeptUnnamedAgency",
  "event.rolePersonKeptDirect": "events:rolePersonKeptDirect",
} as const satisfies Record<EventMsg["key"], TextKey>;

/** A message saves raw parts where a language builds its own: a round's name, an offer's money. */
function textParams(msg: EventMsg): object {
  if (isRound(msg)) return { ...msg.params, label: roundLabel(msg.params) };
  if (isMoney(msg)) return { money: formatMoney(msg.params.amount, msg.params.currency, i18n.language) };
  return msg.params;
}

function isRound(msg: EventMsg): msg is Extract<EventMsg, { params: { kind: string } }> {
  return "kind" in msg.params;
}

function isMoney(msg: EventMsg): msg is Extract<EventMsg, { params: { amount: number } }> {
  return "amount" in msg.params;
}

/**
 * What an event says: its message in your language, or the saved English `summary` for what has no
 * message (older events, your own words, an older server).
 */
export function eventText(event: Pick<ApiEvent, "summary" | "msg">): string | null {
  const msg = event.msg;
  if (!msg || !Object.hasOwn(EVENT_TEXT, msg.key)) return event.summary;
  // The key and its params come as a pair from the API's union; t() can't follow that across a lookup.
  return (i18n.t as unknown as (key: string, params: object) => string)(EVENT_TEXT[msg.key], textParams(msg));
}

export type RoundMove = NonNullable<ApiEvent["reschedule"]>;

// Whole keys, so the unused-key scanner sees them. A newer server's who is left unsaid.
const MOVE_BY = {
  me: "interviews:reschedule.move.byMe",
  them: "interviews:reschedule.move.byThem",
  mutual: "interviews:reschedule.move.byMutual",
  neither: "interviews:reschedule.move.byNeither",
} as const;

/** A move, in sentences: "Moved from Tue 3 Nov, 10:00 to Thu 5 Nov, 14:00 · They needed the change · Why". */
export function moveLine(move: RoundMove): string {
  // The year only when the move crosses one, in your time zone like the times themselves.
  const crossesYear = dayjs(move.from_at).year() !== dayjs(move.to_at).year();
  const pattern = crossesYear ? "shortWeekdayDayMonthYearTime" : "shortWeekdayDayMonthTime";
  const when = (iso: string) => formatDay(iso, pattern, i18n.language);
  const parts: string[] = [
    i18n.t("interviews:reschedule.move.times", { from: when(move.from_at), to: when(move.to_at) }),
  ];
  if (move.by && Object.hasOwn(MOVE_BY, move.by)) parts.push(i18n.t(MOVE_BY[move.by]));
  if (move.reason) parts.push(move.reason); // your own words, as written
  return parts.join(i18n.t("interviews:reschedule.move.separator"));
}

/**
 * The short words above a move's line, "Round 2 · Technical rescheduled", so its who and why aren't said
 * twice. Null for anything else, which keeps its whole message: no move, or a message that isn't a move's.
 */
export function movedRoundText(event: Pick<ApiEvent, "msg" | "reschedule">): string | null {
  const msg = event.msg;
  if (!event.reschedule || !msg?.key.startsWith("event.roundRescheduled") || !isRound(msg)) return null;
  return i18n.t("events:roundRescheduled", { label: roundLabel(msg.params) });
}
