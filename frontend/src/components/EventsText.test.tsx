import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { i18n } from "../i18n";
import { PSEUDO } from "../i18n/language";
import en from "../locales/en";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import cases from "./eventMessages.cases.json";
import { EVENT_TEXT, type EventMsg, eventText } from "./eventText";

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

function showTimeline() {
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
