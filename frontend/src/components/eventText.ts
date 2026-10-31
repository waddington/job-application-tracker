import type { ApiEvent } from "../api/client";
import { i18n } from "../i18n";
import type { TextKey } from "../locales/en";

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
} as const satisfies Record<EventMsg["key"], TextKey>;

/**
 * What an event says: its message in your language, or the saved English `summary` for what has no
 * message (older events, your own words, an older server).
 */
export function eventText(event: Pick<ApiEvent, "summary" | "msg">): string | null {
  const msg = event.msg;
  if (!msg || !Object.hasOwn(EVENT_TEXT, msg.key)) return event.summary;
  // The key and its params come as a pair from the API's union; t() can't follow that across a lookup.
  return (i18n.t as unknown as (key: string, params: object) => string)(EVENT_TEXT[msg.key], msg.params);
}
