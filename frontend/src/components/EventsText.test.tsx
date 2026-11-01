import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { i18n } from "../i18n";
import { PSEUDO } from "../i18n/language";
import en from "../locales/en";
import type { SearchHit } from "../api/searchHooks";
import { hitTitle } from "../pages/SearchPage";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import cases from "./eventMessages.cases.json";
import { EVENT_TEXT, type EventMsg, eventText, movedRoundText, moveLine, type RoundMove } from "./eventText";

// An event's saved English (i18n-events-setup). tests/test_event_messages.py makes the real API write
// each of these same cases, so the frontend's English and the saved summary can't drift apart.

const msgOf = (c: (typeof cases)[number]) => ({ key: c.key, params: c.params }) as EventMsg;

afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await i18n.changeLanguage("en");
});

const event = (id: string, summary: string, msg: EventMsg | null, kind = "manual") => ({
  id,
  application_id: "a1",
  kind,
  occurred_at: "2026-09-01T10:00:00Z",
  from_stage: null,
  to_stage: null,
  summary,
  data: {},
  created_at: "2026-09-01T10:00:00Z",
  msg,
});

function showTimeline(extra: object[] = []) {
  mockApi({
    "/api/v1/workflow": WORKFLOW,
    "GET /api/v1/applications/a1": {
      ...row(),
      events: [
        event("e1", "Link added: Contoso careers", {
          key: "event.linkAdded",
          params: { title: "Contoso careers" },
        }),
        event("e2", "Spoke to Alex", null, "call"),
        ...extra,
      ],
      contacts: [],
      allowed_next: [],
      suggested_next: [],
      can_undo: false,
      documents: [],
      duplicates: [],
    },
    "/api/v1/contacts": [],
    "/api/v1/roles": [],
    "/api/v1/documents": [],
    "/api/v1/health": {},
  });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/applications/a1"] }))} />);
}

describe("the application timeline", () => {
  it("shows a message as the saved English, and your own words as typed", async () => {
    showTimeline();
    expect(await screen.findByText("Link added: Contoso careers")).toBeInTheDocument();
    expect(screen.getByText("Spoke to Alex")).toBeInTheDocument();
  });

  it("translates a message, not the summary, and leaves your own words alone", async () => {
    await i18n.changeLanguage(PSEUDO);
    showTimeline();
    const translated = i18n.t("events:linkAdded", { title: "Contoso careers" });
    expect(translated).not.toBe("Link added: Contoso careers");
    expect(await screen.findByText(translated)).toBeInTheDocument();
    expect(screen.queryByText("Link added: Contoso careers")).not.toBeInTheDocument();
    expect(screen.getByText("Spoke to Alex")).toBeInTheDocument();
  });
});

describe("a reschedule on the application timeline", () => {
  const round = { round: 1, title: "Pairing", kind: "pairing" };
  const times = { from_at: "2026-11-03T10:00:00", to_at: "2026-11-05T14:00:00" };
  const TIMES = "Moved from Tue 3 Nov, 10:00 to Thu 5 Nov, 14:00";
  const SAVED = "Round 1 · Pairing rescheduled (you both needed the change): {{not}} a value";
  const saved = (reschedule?: RoundMove) => ({
    ...event(
      "e3",
      SAVED,
      {
        key: "event.roundRescheduledByMutualReason",
        params: { ...round, reason: "{{not}} a value" },
      } as EventMsg,
      "interview",
    ),
    ...(reschedule ? { reschedule } : {}),
  });

  it("says the round, then its times, who and why, and your words as written", async () => {
    showTimeline([saved({ ...times, by: "mutual", reason: "{{not}} a value" })]);
    expect(await screen.findByText("Round 1 · Pairing rescheduled")).toBeInTheDocument();
    expect(screen.getByText(`${TIMES} · You both needed the change · {{not}} a value`)).toBeInTheDocument();
  });

  it.each([
    ["me", "You needed the change"],
    ["them", "They needed the change"],
    ["mutual", "You both needed the change"],
    ["neither", "Not down to either of you"],
  ] as const)("words %s as: %s", (by, words) => {
    expect(moveLine({ ...times, by })).toBe(`${TIMES} · ${words}`);
  });

  it("leaves out what wasn't said", () => {
    expect(moveLine(times)).toBe(TIMES);
    expect(moveLine({ ...times, by: null, reason: null })).toBe(TIMES);
    expect(moveLine({ ...times, reason: "A clash" })).toBe(`${TIMES} · A clash`);
    expect(moveLine({ ...times, by: "from a newer server" as "me" })).toBe(TIMES);
  });

  it("keeps today's text exactly with no move: older events, an older server", async () => {
    showTimeline([saved()]);
    expect(await screen.findByText(SAVED)).toBeInTheDocument();
    expect(screen.queryByText(/^Moved from/)).not.toBeInTheDocument();
  });

  it("keeps the whole text beside a move when its message isn't a move's", async () => {
    const summaryOnly = { ...saved({ ...times, reason: "A clash" }), msg: null };
    showTimeline([summaryOnly]);
    expect(await screen.findByText(SAVED)).toBeInTheDocument();
    expect(screen.getByText(`${TIMES} · A clash`)).toBeInTheDocument();
    expect(movedRoundText(summaryOnly)).toBeNull();
  });
});

describe("a search result for a timeline entry", () => {
  const hit = (msg: EventMsg | null) =>
    ({ kind: "timeline", id: "e", title: "Heard back", msg }) as unknown as SearchHit;
  const heardBack: EventMsg = { key: "event.heardBack", params: {} };

  it("reads the same in English, and in your language from its message", async () => {
    expect(hitTitle(hit(heardBack))).toBe("Heard back");
    await i18n.changeLanguage(PSEUDO);
    expect(hitTitle(hit(heardBack))).toBe(i18n.t("events:heardBack"));
    expect(hitTitle(hit(heardBack))).not.toBe("Heard back");
  });

  it("stays as saved with no message", async () => {
    await i18n.changeLanguage(PSEUDO);
    expect(hitTitle(hit(null))).toBe("Heard back");
  });
});

describe("a stage move's note on the application timeline", () => {
  it("shows its message", async () => {
    await i18n.changeLanguage(PSEUDO);
    const undo = {
      ...event("e3", "Undo: back to applied", { key: "event.undoMove", params: { stage: "applied" } }),
      kind: "stage_change",
      from_stage: "screen",
      to_stage: "applied",
    };
    showTimeline([undo]);
    expect(await screen.findByText(i18n.t("events:undoMove", { stage: "applied" }))).toBeInTheDocument();
    expect(screen.queryByText("Undo: back to applied")).not.toBeInTheDocument();
  });
});

describe("a round's or offer's message in another language", () => {
  it("builds the round's name in that language, keeping your description", async () => {
    await i18n.changeLanguage(PSEUDO);
    const params = { round: 2, title: null, kind: "final" };
    const label = i18n.t("interviews:label", { round: 2, what: i18n.t("interviews:kindNames.final") });
    expect(eventText({ summary: "x", msg: { key: "event.roundDone", params } })).toBe(
      i18n.t("events:roundDone", { label }),
    );
    expect(label).not.toContain("Final");
    const named = eventText({
      summary: "x",
      msg: { key: "event.roundDone", params: { ...params, title: "Coffee chat" } },
    });
    expect(named).toContain("Coffee chat");
    expect(named).not.toContain("Round 2");
  });

  it("builds the money with the offer's own currency", async () => {
    await i18n.changeLanguage(PSEUDO);
    const shown = eventText({
      summary: "x",
      msg: { key: "event.offerDeclinedDay", params: { amount: 1200, currency: "CHF" } },
    });
    expect(shown).toBe(i18n.t("events:offerDeclinedDay", { money: "1,200 CHF" }));
    expect(shown).not.toBe("Offer declined: 1,200 CHF a day");
  });
});

describe("event messages", () => {
  it.each(cases.map((c) => [c.summary, c] as const))("shows %s", (summary, c) => {
    expect(eventText({ summary: "something else", msg: msgOf(c) })).toBe(summary);
  });

  it("has a case for every message, and text for every case", () => {
    expect(new Set(cases.map((c) => c.key))).toEqual(new Set(Object.keys(EVENT_TEXT)));
    expect(Object.values(EVENT_TEXT).map((key) => key.replace("events:", ""))).toEqual(
      Object.keys(en.events),
    );
  });

  it("shows the saved summary when there's no message", () => {
    expect(eventText({ summary: "Spoke to Alex", msg: null })).toBe("Spoke to Alex");
    expect(eventText({ summary: "From an older server" })).toBe("From an older server");
    expect(eventText({ summary: null, msg: null })).toBeNull();
  });

  it("shows the saved summary for a key this version doesn't know", () => {
    const msg = { key: "event.fromTheFuture", params: {} } as unknown as EventMsg;
    expect(eventText({ summary: "Saved English", msg })).toBe("Saved English");
  });
});
