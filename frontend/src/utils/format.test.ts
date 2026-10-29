import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
  formatDateLocal,
  formatDateTimeLocal,
  formatDay,
  formatMoney,
  formatNumber,
  formatShortWeekday,
  type DatePattern,
} from "./format";
import { money } from "../api/offerHooks";
import { formatDate, formatDateTime } from "./time";

// Each helper must give exactly what the app shows today in English, so cutting a page over
// changes nothing (docs/rfc/i18n.md §7).
const AT = "2026-03-05T09:07:00";
const TODAY_SHOWS: Record<DatePattern, [string, string]> = {
  // pattern: [the format call it replaces, its output]
  weekdayDayMonth: ["dddd D MMMM", "Thursday 5 March"],
  shortWeekdayDayMonth: ["ddd D MMM", "Thu 5 Mar"],
  shortWeekdayDayMonthYear: ["ddd D MMM YYYY", "Thu 5 Mar 2026"],
  dayMonth: ["D MMM", "5 Mar"],
  dayMonthYear: ["D MMM YYYY", "5 Mar 2026"],
  monthYear: ["MMM YYYY", "Mar 2026"],
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
    expect(formatDay(AT, "dayMonth", "en-XA")).toBe("5 Mar");
    expect(formatDay(AT, "dayMonth", "fr")).toBe("5 Mar");
    expect(formatDay(AT, "dayMonth", "constructor")).toBe("5 Mar"); // not a prototype key
  });

  it("never changes dayjs's global locale", () => {
    const before = dayjs.locale();
    formatDay(AT, "dayMonth", "zh-TW");
    formatDay(AT, "dayMonth", "en-GB");
    expect(dayjs.locale()).toBe(before);
  });
});

describe("English dates are day, month, year, whatever the browser's locale", () => {
  // jsdom's own locale is American English, so these would read "Mar 5, 2026" without en-GB.
  it("a date and time", () => {
    expect(formatDateTimeLocal(AT, "en")).toBe("5 Mar 2026, 09:07");
    expect(formatDateTime(AT)).toBe("5 Mar 2026, 09:07");
  });

  it("a day, and the dash for no date", () => {
    expect(formatDateLocal("2026-10-31", "en")).toBe("31 Oct 2026");
    expect(formatDate("2026-10-31")).toBe("31 Oct 2026");
    expect(formatDateLocal(null, "en")).toBe("—");
    expect(formatDateLocal(undefined, "en")).toBe("—");
  });

  it("the Interviews list's short date", () => {
    expect(formatShortWeekday(AT, "en")).toBe("Thu 5 Mar");
  });

  it("an evening time on a 24-hour clock", () => {
    expect(formatDateTimeLocal("2026-10-30T19:25:00", "en")).toBe("30 Oct 2026, 19:25");
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

describe("formatMoney", () => {
  const cases: [number | null | undefined, string | null | undefined][] = [
    [85000, "GBP"],
    [650, "gbp"],
    [120000, "USD"],
    [90000, "EUR"],
    [150000, "CHF"],
    [85000, null],
    [85000, ""],
    [null, "GBP"],
    [undefined, "GBP"],
  ];

  it.each(cases)("%s %s matches api/offerHooks money()", (n, currency) => {
    expect(formatMoney(n, currency, "en")).toBe(money(n, currency));
  });

  it("keeps the symbol in front, or the code after", () => {
    expect(formatMoney(85000, "GBP", "en")).toBe("£85,000");
    expect(formatMoney(150000, "CHF", "en")).toBe("150,000 CHF");
    expect(formatMoney(null, "GBP", "en")).toBe("—");
  });
});
