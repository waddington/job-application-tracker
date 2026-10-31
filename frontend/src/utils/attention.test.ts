import { describe, expect, it } from "vitest";

import type { ApplicationDetail } from "../api/client";
import type { WorkflowStage } from "../api/hooks";
import type { Interview } from "../api/interviewHooks";
import type { Offer } from "../api/offerHooks";
import type { Todo } from "../api/todoHooks";
import { row, todo } from "../test/mockApi";
import { glance, since, until } from "./attention";

const TODAY = "2026-10-13";
const NOW = Date.parse("2026-10-13T12:00:00");

const app = (overrides: Record<string, unknown> = {}) =>
  ({
    ...row({ stale: false, days_since_activity: 2, last_activity_at: "2026-10-11T12:00:00", ...overrides }),
    reply_to_read_since: null,
    awaiting_reply_since: null,
    events: [
      { kind: "stage_change", from_stage: null, to_stage: "interested", occurred_at: "2026-09-01T12:00:00" },
      {
        kind: "stage_change",
        from_stage: "interested",
        to_stage: "applied",
        occurred_at: "2026-09-20T12:00:00",
      },
      { kind: "call", from_stage: null, to_stage: null, occurred_at: "2026-10-06T12:00:00" },
      { kind: "email", from_stage: null, to_stage: null, occurred_at: "2026-10-30T12:00:00" }, // logged ahead
    ],
    contacts: [],
    allowed_next: [],
    suggested_next: [],
    can_undo: false,
    duplicates: [],
    documents: [],
    ...overrides,
  }) as unknown as ApplicationDetail;

const STAGE = { id: "applied", name: "Applied", stale_after_days: 10 } as WorkflowStage;
const round = (overrides: Record<string, unknown>) =>
  ({
    id: "i1",
    round: 2,
    title: "System design",
    kind: "technical",
    label: "Round 2 · System design",
    status: "scheduled",
    starts_at: null,
    deadline_at: null,
    ...overrides,
  }) as Interview;

function run(overrides: Partial<Parameters<typeof glance>[0]> = {}) {
  return glance({
    app: app(),
    stage: STAGE,
    interviews: [],
    offers: [],
    todos: [],
    today: TODAY,
    now: NOW,
    ...overrides,
  });
}

describe("glance", () => {
  it("has nothing to do for a quiet-but-fine application, and dates it", () => {
    const g = run();
    expect(g.open).toBe(true);
    expect(g.attention).toEqual([]);
    expect(g.dates.map((d) => [d.label, d.ago])).toEqual([
      ["Added", "6 weeks ago"],
      ["Applied", "3 weeks ago"],
      ["Moved to Applied", "3 weeks ago"],
      ["Last call", "7 days ago"], // the email logged for later doesn't count yet
      ["Last activity", "2 days ago"],
    ]);
  });

  it("lists what needs doing in Next actions' order, with how long", () => {
    const g = run({
      app: app({
        reply_to_read_since: "2026-10-10",
        stale: true,
        days_since_activity: 12,
        awaiting_reply_since: "2026-10-01",
      }),
      todos: [todo({ id: "t1", text: "Send portfolio", due_on: "2026-10-11" }) as unknown as Todo],
      interviews: [round({ starts_at: "2026-10-09T10:00:00" })],
    });
    expect(g.attention.map((i) => [i.label, i.when])).toEqual([
      ["They've replied: read it", "for 3 days"],
      ["To-do: Send portfolio", "overdue by 2 days"],
      ["How did Round 2 · System design go?", "4 days ago"],
      ["Gone quiet (Applied goes quiet after 10 days)", "no activity for 12 days"],
      ["Waiting to hear back", "for 12 days"],
    ]);
  });

  it("puts a due follow-up first among chasers, and hides quiet and waiting behind it", () => {
    const g = run({
      app: app({ follow_up_on: "2026-10-12", stale: true, awaiting_reply_since: "2026-10-01" }),
    });
    expect(g.attention.map((i) => [i.label, i.when])).toEqual([["Follow up", "overdue by 1 day"]]);
  });

  it("doesn't chase a snoozed application or one with a reply to read", () => {
    expect(run({ app: app({ follow_up_on: "2026-10-12", snoozed_until: "2026-10-20" }) }).attention).toEqual(
      [],
    );
    const toRead = run({ app: app({ follow_up_on: "2026-10-12", reply_to_read_since: "2026-10-13" }) });
    expect(toRead.attention.map((i) => i.label)).toEqual(["They've replied: read it"]);
  });

  it("shows what's coming up", () => {
    const g = run({
      app: app({ follow_up_on: "2026-10-20" }),
      interviews: [
        round({ starts_at: "2026-10-15T14:00:00" }),
        round({ id: "i2", round: 3, title: "Final", kind: "technical", label: "Round 3 · Final" }),
      ],
      todos: [todo({ id: "t2", text: "Prep questions", due_on: "2026-10-14" }) as unknown as Todo],
    });
    expect(g.comingUp.map((i) => [i.label, i.when])).toEqual([
      ["To-do: Prep questions", "tomorrow"],
      ["Round 2 · System design", "in 2 days · 15 Oct, 14:00"],
      ["Round 3 · Final: not booked yet", "no date"],
      ["Follow up on 20 Oct 2026", "in 7 days"],
    ]);
    expect(g.attention).toEqual([]);
  });

  it("asks for an answer to the newest pending offer", () => {
    const offers = [
      { id: "o1", status: "pending", respond_by: "2026-10-12", created_at: "2026-10-01T00:00:00Z" },
      { id: "o2", status: "pending", respond_by: "2026-10-16", created_at: "2026-10-05T00:00:00Z" },
    ] as Offer[];
    expect(run({ offers }).attention.map((i) => [i.label, i.when])).toEqual([
      ["Reply to the offer by 16 Oct 2026", "in 3 days"],
    ]);
  });

  it("has nothing to chase once closed or archived, but keeps the dates", () => {
    for (const g of [
      run({ app: app({ stage_kind: "closed", reply_to_read_since: "2026-10-10", stale: true }) }),
      run({ app: app({ archived: true, follow_up_on: "2026-10-01" }) }),
    ]) {
      expect(g.open).toBe(false);
      expect(g.attention).toEqual([]);
      expect(g.comingUp).toEqual([]);
      expect(g.dates.length).toBeGreaterThan(0);
    }
  });

  it("still lists your to-dos on a closed application, as Next actions does", () => {
    const g = run({
      app: app({ stage_kind: "closed" }),
      todos: [
        todo({ id: "t1", text: "Ask for feedback", due_on: null }) as unknown as Todo,
        todo({ id: "t2", text: "Thank them", due_on: "2026-10-13" }) as unknown as Todo,
      ],
    });
    expect(g.open).toBe(false);
    // Dated (due by today) before undated.
    expect(g.attention.map((i) => [i.label, i.when])).toEqual([
      ["To-do: Thank them", "due today"],
      ["To-do: Ask for feedback", "no date"],
    ]);
  });

  it("follows the newest offer, and leaves a far-off reply date for later", () => {
    const declinedLater = [
      { id: "o1", status: "pending", respond_by: "2026-10-15", created_at: "2026-10-01T00:00:00Z" },
      { id: "o2", status: "declined", respond_by: "2026-10-15", created_at: "2026-10-05T00:00:00Z" },
    ] as Offer[];
    expect(run({ offers: declinedLater }).attention).toEqual([]);
    const farOff = [
      { id: "o3", status: "pending", respond_by: "2026-11-10", created_at: "2026-10-05T00:00:00Z" },
    ] as Offer[];
    const g = run({ offers: farOff });
    expect(g.attention).toEqual([]);
    expect(g.comingUp.map((i) => [i.label, i.when])).toEqual([
      ["Reply to the offer by 10 Nov 2026", "in 4 weeks"],
    ]);
  });

  it("says a follow-up due today is due today", () => {
    expect(run({ app: app({ follow_up_on: TODAY }) }).attention.map((i) => [i.label, i.when])).toEqual([
      ["Follow up", "due today"],
    ]);
  });

  it("treats a take-home deadline like a booked time", () => {
    const g = run({ interviews: [round({ deadline_at: "2026-10-12T17:00:00" })] });
    expect(g.attention.map((i) => [i.label, i.when])).toEqual([
      ["How did Round 2 · System design go?", "yesterday"],
    ]);
  });

  it("doesn't date last activity by something logged for later", () => {
    // Logging the email ahead moved last_activity_at into the future.
    const g = run({ app: app({ last_activity_at: "2026-10-30T12:00:00" }) });
    expect(g.dates.find((d) => d.label === "Last activity")).toMatchObject({
      value: "6 Oct 2026",
      ago: "7 days ago",
    });
  });
});

describe("since and until", () => {
  it("say it the way people do", () => {
    expect([0, 1, 5, 20, 90].map(since)).toEqual([
      "today",
      "yesterday",
      "5 days ago",
      "2 weeks ago",
      "3 months ago",
    ]);
    expect([0, 1, 5, 20, 30].map(until)).toEqual([
      "today",
      "tomorrow",
      "in 5 days",
      "in 2 weeks",
      "in 4 weeks",
    ]);
  });
});
