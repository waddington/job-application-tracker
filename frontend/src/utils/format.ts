// Dates, times and numbers in the reader's language (docs/rfc/i18n.md §7). English is British
// English: day, month, year ("31 Oct 2026"), a 24-hour clock, and "85,000", whatever the
// browser's own locale (an American browser used to turn dates into "Oct 31, 2026").
// - Every date goes through one of the dayjs PATTERNS, so one month is written one way
//   everywhere (Intl's en-GB would write "Sept", dayjs "Sep").
// - Money keeps its symbol or code ("£85,000", "85,000 CHF").
// A new language adds its row to PATTERNS and NUMBER_LOCALE (and its dayjs locale import).
//
// utils/time.ts formatDate / formatDateTime use these, and so does every converted page.
// Dates sent to the API stay `YYYY-MM-DD` and don't go through here.

import dayjs, { type ConfigType } from "dayjs";

import { FALLBACK } from "../i18n/language";

interface Patterns {
  /** Thursday 5 March */
  weekdayDayMonth: string;
  /** Thu 5 Mar */
  shortWeekdayDayMonth: string;
  /** Thu 5 Mar, 09:07 */
  shortWeekdayDayMonthTime: string;
  /** Thu 5 Mar 2026 */
  shortWeekdayDayMonthYear: string;
  /** 5 Mar */
  dayMonth: string;
  /** 5 Mar 2026 */
  dayMonthYear: string;
  /** 5 Mar 2026, 09:07 */
  dayMonthYearTime: string;
  /** Mar 2026 */
  monthYear: string;
  /** 5 Mar, 09:07 */
  dayMonthTime: string;
  /** 09:07 */
  time: string;
}

const PATTERNS = new Map<string, Patterns>([
  [
    "en",
    {
      weekdayDayMonth: "dddd D MMMM",
      shortWeekdayDayMonth: "ddd D MMM",
      shortWeekdayDayMonthTime: "ddd D MMM, HH:mm",
      shortWeekdayDayMonthYear: "ddd D MMM YYYY",
      dayMonth: "D MMM",
      dayMonthYear: "D MMM YYYY",
      dayMonthYearTime: "D MMM YYYY, HH:mm",
      monthYear: "MMM YYYY",
      dayMonthTime: "D MMM, HH:mm",
      time: "HH:mm",
    },
  ],
]);

/** Locale for numbers. */
const NUMBER_LOCALE = new Map<string, string>([["en", "en-GB"]]);

/** "en-GB" → its row, else "en"'s, else English's. */
function lookup<T>(table: Map<string, T>, lang: string): T {
  const lower = lang.toLowerCase();
  const key = [lower, lower.split("-")[0]!].find((k) => table.has(k)) ?? FALLBACK;
  return table.get(key) as T;
}

/** The dayjs locale for a language: its own if imported, else English. Calendars use it too. */
export function dayjsLocale(lang: string): string {
  const lower = lang.toLowerCase();
  return [lower, lower.split("-")[0]!].find((n) => Object.hasOwn(dayjs.Ls, n)) ?? FALLBACK;
}

/**
 * dayjs in the language's locale, if that locale has been imported, else English. The name
 * is resolved here: passing dayjs an unloaded "xx-yy" makes it retry "xx" and change its
 * global locale as a side effect.
 */
const dayjsIn = (value: ConfigType, lang: string) => dayjs(value).locale(dayjsLocale(lang));

export type DatePattern = keyof Patterns;

/** A date (or date-time) in one of the app's fixed shapes, e.g. formatDay(at, "dayMonth", lang). */
export function formatDay(value: ConfigType, pattern: DatePattern, lang: string): string {
  return dayjsIn(value, lang).format(lookup(PATTERNS, lang)[pattern]);
}

/** "5 Mar 2026, 09:07", in your time zone (utils/time.ts formatDateTime). */
export const formatDateTimeLocal = (iso: string, lang: string): string =>
  formatDay(iso, "dayMonthYearTime", lang);

/** "5 Mar 2026" for a YYYY-MM-DD day, or "—" (utils/time.ts formatDate). */
export const formatDateLocal = (iso: string | null | undefined, lang: string): string =>
  iso ? formatDay(iso, "dayMonthYear", lang) : "—";

/** "Thu 5 Mar" (the Interviews list). */
export const formatShortWeekday = (iso: string, lang: string): string =>
  formatDay(iso, "shortWeekdayDayMonth", lang);

/** "85,000" (money amounts and counts). */
export function formatNumber(n: number, lang: string): string {
  return n.toLocaleString(lookup(NUMBER_LOCALE, lang));
}

const SYMBOLS = new Map([
  ["GBP", "£"],
  ["USD", "$"],
  ["EUR", "€"],
]);

/** "£85,000", "85,000 CHF", or "—" with no amount (api/offerHooks.ts money()). The currency is
 *  the offer's own; only the digits follow the language. */
export function formatMoney(n: number | null | undefined, currency: string | null | undefined, lang: string) {
  if (n == null) return "—";
  const symbol = SYMBOLS.get((currency ?? "").toUpperCase());
  const digits = formatNumber(n, lang);
  return symbol ? `${symbol}${digits}` : `${digits}${currency ? ` ${currency}` : ""}`;
}
