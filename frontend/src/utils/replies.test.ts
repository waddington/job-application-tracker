import { describe, expect, it } from "vitest";

import { overdueBy, replyHabit, workingDays } from "./replies";

describe("workingDays", () => {
  it("leaves weekends out, as the server does", () => {
    expect(workingDays("2026-10-09", "2026-10-09")).toBe(0); // the same day
    expect(workingDays("2026-10-09", "2026-10-12")).toBe(1); // Friday to Monday
    expect(workingDays("2026-10-10", "2026-10-11")).toBe(0); // a weekend
    expect(workingDays("2026-10-12", "2026-10-19")).toBe(5); // a week
    expect(workingDays("2026-10-12", "2026-10-09")).toBe(0);
  });
});

describe("replyHabit", () => {
  it("says how long they usually take, once there's something to go on", () => {
    expect(replyHabit({ replies: 0, usual_reply_days: null })).toBeNull();
    expect(replyHabit({ replies: 1, usual_reply_days: 3 })).toBe("Replied once, in 3 working days");
    expect(replyHabit({ replies: 4, usual_reply_days: 1 })).toBe("Usually replies within 1 working day");
    expect(replyHabit({ replies: 3, usual_reply_days: 2 })).toBe("Usually replies within 2 working days");
    expect(replyHabit({ replies: 3, usual_reply_days: 11 })).toBe("Usually replies within 11 working days");
    expect(replyHabit({ replies: 1, usual_reply_days: 1 })).toBe("Replied once, in 1 working day");
    expect(replyHabit({ replies: 2, usual_reply_days: 0 })).toBe("Usually replies the same day");
    expect(replyHabit({ replies: 1, usual_reply_days: 0 })).toBe("Replied once, the same day");
  });

  it("counts how far past their usual you've been waiting", () => {
    const usual = { replies: 3, usual_reply_days: 2 };
    expect(overdueBy({ ...usual, awaiting_reply_since: "2026-10-12" }, "2026-10-14")).toBe(0);
    expect(overdueBy({ ...usual, awaiting_reply_since: "2026-10-12" }, "2026-10-19")).toBe(3);
    expect(overdueBy({ ...usual, awaiting_reply_since: null }, "2026-10-19")).toBe(0);
  });
});
