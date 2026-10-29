import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
  formatDateLocal,
  formatDateTimeLocal,
  formatDay,
  formatNumber,
  formatShortWeekday,
  type DatePattern,
} from "./format";
import { formatDate, formatDateTime } from "./time";

// Each helper must give exactly what the app shows today in English, so cutting a page over
// changes nothing (docs/rfc/i18n.md §7).
const AT = "2026-03-05T09:07:00";
const TODAY_SHOWS: Record<DatePattern, [string, string]> = {
  // pattern: [the format call it replaces, its output]
  weekdayDayMonth: ["dddd D MMMM", "Thursday 5 March"],
  dayMonth: ["D MMM", "5 Mar"],
  dayMonthYear: ["D MMM YYYY", "5 Mar 2026"],
  dayMonthTime: ["D MMM, HH:mm", "5 Mar, 09:07"],
  time: ["HH:mm", "09:07"],
};

describe("formatDay", () => {
  for (const [pattern, [old, shown]] of Object.entries(TODAY_SHOWS)) {
    it(`${pattern} matches dayjs().format("${old}")`, () => {
      expect(formatDay(AT, pattern as DatePattern, "en")).toBe(dayjs(AT).format(old));
      expect(formatDay(AT, pattern as DatePattern, "en")).toBe(shown);
    });
  }

  it("takes a Date, a dayjs or a YYYY-MM-DD day", () => {
    expect(formatDay(new Date(AT), "dayMonth", "en")).toBe("5 Mar");
    expect(formatDay(dayjs(AT), "dayMonth", "en")).toBe("5 Mar");
    expect(formatDay("2026-12-25", "dayMonthYear", "en")).toBe("25 Dec 2026");
  });

  it("uses English for a regional variant or a language it doesn't know", () => {
    expect(formatDay(AT, "dayMonth", "en-GB")).toBe("5 Mar");
    expect(formatDay(AT, "dayMonth", "pseudo")).toBe("5 Mar");
    expect(formatDay(AT, "dayMonth", "fr")).toBe("5 Mar");
  });
});

describe("Intl dates keep the browser's own locale in English", () => {
  it("formatDateTimeLocal = utils/time formatDateTime", () => {
    expect(formatDateTimeLocal(AT, "en")).toBe(formatDateTime(AT));
  });

  it("formatDateLocal = utils/time formatDate, including the dash for no date", () => {
    expect(formatDateLocal("2026-03-05", "en")).toBe(formatDate("2026-03-05"));
    expect(formatDateLocal(null, "en")).toBe("—");
    expect(formatDateLocal(undefined, "en")).toBe("—");
  });

  it("formatShortWeekday = the Interviews list's date", () => {
    const old = new Date(AT).toLocaleDateString(undefined, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
    expect(formatShortWeekday(AT, "en")).toBe(old);
  });
});

describe("formatNumber", () => {
  it("is en-GB in English, as money is shown today", () => {
    expect(formatNumber(85000, "en")).toBe((85000).toLocaleString("en-GB"));
    expect(formatNumber(85000, "en")).toBe("85,000");
    expect(formatNumber(1234567.5, "en")).toBe("1,234,567.5");
    expect(formatNumber(0, "en")).toBe("0");
  });

  it("falls back to English for a language it doesn't know", () => {
    expect(formatNumber(85000, "xx")).toBe("85,000");
  });
});
