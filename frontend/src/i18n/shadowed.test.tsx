import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { HowItWorks, START_FROM_TODAY } from "../components/HowItWorks";
import { overdueBy, replyHabit } from "../utils/replies";
import { report, resetShadow, shadow } from "./shadow";

// Every real string still shadowed, checked against the English text files with the inputs the
// app gives them (areas already cut over to t() are tested in their own files). Under test a
// mismatch throws (shadow.ts), so each call is an assertion. Tests that render these pages
// check them again with real data.

beforeEach(() => resetShadow());

describe("Today", () => {
  it.each(["Your move", "Coming up", "Waiting on them"])("the badge for %s", (group) => {
    for (const count of [1, 2, 12]) shadow("today:groupBadge", `${count} in ${group}`, { count, group });
  });
});

describe("reply habits", () => {
  it("usually replies the same day, or within 1 or more working days", () => {
    expect(replyHabit({ replies: 2, usual_reply_days: 0 })).toBe("Usually replies the same day");
    expect(replyHabit({ replies: 4, usual_reply_days: 1 })).toBe("Usually replies within 1 working day");
    expect(replyHabit({ replies: 3, usual_reply_days: 2 })).toBe("Usually replies within 2 working days");
    expect(replyHabit({ replies: 3, usual_reply_days: 11 })).toBe("Usually replies within 11 working days");
    expect(report().map((r) => [r.key, r.status])).toEqual([
      ["people:replies.sameDay", "match"],
      ["people:replies.within", "match"],
    ]);
  });

  it("waiting longer than usual, by 1 or more days", () => {
    const usual = { replies: 3, usual_reply_days: 2, awaiting_reply_since: "2026-10-12" };
    for (const [today, late] of [
      ["2026-10-15", 1],
      ["2026-10-19", 3],
    ] as const) {
      expect(overdueBy(usual, today)).toBe(late);
      shadow(
        "people:replies.longerThanUsual",
        `waiting ${late} working day${late === 1 ? "" : "s"} longer than usual`,
        { count: late },
      );
    }
  });
});

describe("How it works", () => {
  it("renders exactly the sentence it shadows", () => {
    render(
      <MantineProvider>
        <HowItWorks />
      </MantineProvider>,
    );
    const title = screen.getByText("Start from Today");
    expect(title.nextElementSibling?.textContent).toBe(START_FROM_TODAY);
    expect(report().find((r) => r.key === "today:howItWorks.startFromToday")?.status).toBe("match");
  });
});
