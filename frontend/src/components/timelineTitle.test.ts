import { afterEach, describe, expect, it } from "vitest";

import type { TimelineItem } from "../api/timelineHooks";
import { i18n } from "../i18n";
import { PSEUDO } from "../i18n/language";
import eventCases from "./eventMessages.cases.json";
import events from "./timelineEvents.cases.json";
import cases from "./timelineTitles.cases.json";
import { timelineDetail, timelineTitle } from "./timelineTitle";

// tests/test_timeline_titles.py makes the real API send each of these same cases, with this `title`, so
// the frontend's English and the API's can't drift apart.

const API_TITLE = "the API's title";

type Raw = Pick<TimelineItem, "stage_move" | "round" | "offer" | "call" | "note_title" | "closed_as">;

type Case = Partial<Raw> & {
  kind?: string;
  title?: string;
  person?: string | null;
  role?: string | null;
  company?: string | null;
  agency?: string | null;
};

const CASES = cases as unknown as (Case & { title: string })[];

const itemOf = (c: Case, title = API_TITLE) =>
  ({
    kind: c.kind,
    title,
    people: c.person == null ? [] : [{ id: "p", name: c.person }],
    role_title: c.role ?? null,
    company_name: c.company ?? null,
    agency_name: c.agency ?? null,
    stage_move: c.stage_move,
    round: c.round,
    offer: c.offer,
    call: c.call,
    note_title: c.note_title,
    closed_as: c.closed_as,
  }) as unknown as TimelineItem;

/** A part of a raw field gone, as an older or odder server might send. */
const broken = (value: object) => value as never;

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("a title built here", () => {
  it.each(CASES)("reads as the API wrote it: $title", (c) => {
    expect(timelineTitle(itemOf(c))).toBe(c.title);
  });

  it("goes through the translation files", async () => {
    await i18n.changeLanguage(PSEUDO);
    for (const c of CASES) expect(timelineTitle(itemOf(c))).not.toBe(c.title);
  });

  it("names who a call is with, whoever comes first on the entry", () => {
    const call = { kind: "call", title: null, status: "booked", contact_name: "Sam Second" };
    const item = itemOf({ kind: "meeting", person: "Riley First", call });
    expect(timelineTitle(item)).toBe("Call with Sam Second (booked)");
  });
});

describe("an other event's words", () => {
  const eventItem = (msg: unknown, detail: string | null = null, kind = "other-event") =>
    ({ ...itemOf({ kind }), msg, detail }) as unknown as TimelineItem;
  const link = (title: string) => ({ key: "event.linkAdded", params: { title } });

  it.each(eventCases.map((c) => [c.summary, c] as const))("reads as the API wrote it: %s", (summary, c) => {
    const item = eventItem({ key: c.key, params: c.params });
    expect(timelineTitle(item)).toBe(summary);
    expect(timelineDetail(item)).toBeNull();
  });

  // tests/test_event_messages.py sends these through Python's split.
  it.each(events.split.map((c) => [c.summary, c] as const))("splits as the API does: %j", (_, c) => {
    const item = eventItem(link(c.params.title));
    expect(timelineTitle(item)).toBe(c.title);
    expect(timelineDetail(item)).toBe(c.detail);
  });

  it.each(events.bare)("with no words, says its kind: $kind", ({ kind, title }) => {
    expect(timelineTitle({ ...eventItem(null), bare_kind: kind })).toBe(title);
  });

  it("shows a stage move's whole note as its detail, only when the API sends one", () => {
    const undo = { key: "event.undoMove", params: { stage: "applied" } };
    expect(timelineDetail(eventItem(undo, "Undo: back to applied", "stage-event"))).toBe(
      "Undo: back to applied",
    );
    expect(timelineDetail(eventItem(undo, null, "stage-event"))).toBeNull();
  });

  it("goes through the translation files", async () => {
    await i18n.changeLanguage(PSEUDO);
    const translated = i18n.t("events:linkAdded", { title: "Contoso\nmore" });
    const item = eventItem(link("Contoso\nmore"), "more");
    expect(timelineTitle(item)).not.toBe("Link added: Contoso");
    expect(timelineTitle(item)).toBe(translated.split("\n")[0]);
    expect(timelineDetail(item)).toBe(translated.split("\n")[1]);
    expect(timelineTitle({ ...eventItem(null), bare_kind: "call" })).not.toBe("Call");
  });

  it("falls back on what the API sent, for old events and typed text", () => {
    expect(timelineTitle(eventItem(null))).toBe(API_TITLE);
    expect(timelineDetail(eventItem(null, "Saved detail"))).toBe("Saved detail");
    expect(timelineDetail(eventItem(undefined))).toBeNull();
    const future = eventItem({ key: "event.fromTheFuture", params: {} }, "Saved detail");
    expect(timelineTitle(future)).toBe(API_TITLE);
    expect(timelineDetail(future)).toBe("Saved detail");
    expect(timelineTitle({ ...eventItem(null), bare_kind: "stage_change" })).toBe(API_TITLE);
  });
});

describe("the API's title shows", () => {
  it("for other events with no message", () => {
    const item = itemOf({ kind: "other-event", person: "Sam Sample", role: "Engineer", company: "Contoso" });
    expect(timelineTitle(item)).toBe(API_TITLE);
  });

  // No raw field at all is what an older server sends.
  const MISSING: (Case & { why: string })[] = [
    { why: "no move", kind: "stage-event" },
    { why: "a move to nowhere", kind: "stage-event", stage_move: broken({ from_name: "Applied" }) },
    { why: "no round", kind: "interview" },
    {
      why: "a round with no status",
      kind: "interview",
      round: broken({ round: 1, title: "Chat", kind: "technical" }),
    },
    {
      why: "a round with no name",
      kind: "interview",
      round: broken({ round: 1, title: null, kind: null, status: "booked" }),
    },
    {
      why: "a round status it has no text for",
      kind: "interview",
      round: { round: 1, title: "Chat", kind: "technical", status: "on_hold" },
    },
    { why: "no offer", kind: "offer-reply" },
    {
      why: "an offer with no amount",
      kind: "offer-reply",
      offer: { per: "year", amount: null, currency: "GBP" },
    },
    { why: "an offer with no basis", kind: "offer-reply", offer: broken({ amount: 650, currency: "GBP" }) },
    { why: "no call", kind: "meeting" },
    {
      why: "a call with no person",
      kind: "meeting",
      call: broken({ kind: "call", title: null, status: "booked" }),
    },
    {
      why: "a call with no status",
      kind: "meeting",
      call: broken({ kind: "call", title: null, contact_name: "Sam Sample" }),
    },
    {
      why: "a call status it has no text for",
      kind: "meeting",
      call: { kind: "call", title: null, status: "on_hold", contact_name: "Sam Sample" },
    },
    { why: "no note title", kind: "note" },
    { why: "a null note title", kind: "note", note_title: null },
    { why: "not knowing how it closed", kind: "contact-closed", person: "Sam Sample" },
    { why: "a way of closing it has no text for", kind: "contact-closed", person: "Sam", closed_as: "moved" },
    { why: "no person", kind: "contact-closed", closed_as: "ghosted" },
  ];
  it.each(MISSING)("for $kind: $why", (c) => {
    expect(timelineTitle(itemOf(c))).toBe(API_TITLE);
  });

  it("from an older server, which sends no kind", () => {
    const item = itemOf({ person: "Sam Sample", role: "Engineer", company: "Contoso" });
    expect(item.kind).toBeUndefined();
    expect(timelineTitle(item)).toBe(API_TITLE);
  });

  it.each([
    "role",
    "role-added",
    "role-passed",
    "company",
    "agency",
    "contact",
    "contact-waiting",
    "contact-chased",
    "contact-to-read",
  ])("for %s when the name its sentence needs is missing", (kind) => {
    expect(timelineTitle(itemOf({ kind }))).toBe(API_TITLE);
  });

  it("for a pitched role with a person but no role title", () => {
    const item = itemOf({ kind: "role", person: "Sam Sample", company: "Contoso" });
    expect(timelineTitle(item)).toBe(API_TITLE);
  });
});
