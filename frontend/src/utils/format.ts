// Dates, times and numbers in the reader's language (docs/rfc/i18n.md §7). For English each
// helper gives exactly what the app shows today, so cutting a page over changes nothing:
// - the fixed dayjs patterns ("D MMM", "dddd D MMMM"…) stay as they are;
// - dates already formatted with Intl in the browser's own locale stay that way;
// - numbers stay en-GB ("85,000"), and money keeps its symbol or code ("£85,000", "85,000 CHF").
// A new language adds its row to PATTERNS and NUMBER_LOCALE (and its dayjs locale import).
//
// Not used by the app yet (i18n-setup); pages switch to these as they're converted.
// Dates sent to the API stay `YYYY-MM-DD` and don't go through here.

import dayjs, { type ConfigType } from "dayjs";

import { FALLBACK } from "../i18n/language";

interface Patterns {
  /** Thursday 5 March */
  weekdayDayMonth: string;
  /** Thu 5 Mar */
  shortWeekdayDayMonth: string;
  /** Thu 5 Mar 2026 */
  shortWeekdayDayMonthYear: string;
  /** 5 Mar */
  dayMonth: string;
  /** 5 Mar 2026 */
  dayMonthYear: string;
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
      shortWeekdayDayMonthYear: "ddd D MMM YYYY",
      dayMonth: "D MMM",
      dayMonthYear: "D MMM YYYY",
      monthYear: "MMM YYYY",
      dayMonthTime: "D MMM, HH:mm",
      time: "HH:mm",
    },
  ],
]);

/** Locale for Intl dates. English uses the browser's own (undefined), as the app does today. */
const DATE_LOCALE = new Map<string, string | undefined>([["en", undefined]]);
/** Locale for numbers. English is en-GB, as the app does today. */
const NUMBER_LOCALE = new Map<string, string>([["en", "en-GB"]]);

/** "en-GB" → its row, else "en"'s, else English's. */
function lookup<T>(table: Map<string, T>, lang: string): T {
  const lower = lang.toLowerCase();
  const key = [lower, lower.split("-")[0]!].find((k) => table.has(k)) ?? FALLBACK;
  return table.get(key) as T;
}

/**
 * dayjs in the language's locale, if that locale has been imported, else English. The name
 * is resolved here: passing dayjs an unloaded "xx-yy" makes it retry "xx" and change its
 * global locale as a side effect.
 */
const dayjsIn = (value: ConfigType, lang: string) => {
  const lower = lang.toLowerCase();
  const name = [lower, lower.split("-")[0]!].find((n) => Object.hasOwn(dayjs.Ls, n)) ?? FALLBACK;
  return dayjs(value).locale(name);
};

export type DatePattern = keyof Patterns;

/** A date (or date-time) in one of the app's fixed shapes, e.g. formatDay(at, "dayMonth", lang). */
export function formatDay(value: ConfigType, pattern: DatePattern, lang: string): string {
  return dayjsIn(value, lang).format(lookup(PATTERNS, lang)[pattern]);
}

/** "5 Mar 2026, 09:07" in the reader's locale (utils/time.ts formatDateTime). */
export function formatDateTimeLocal(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(lookup(DATE_LOCALE, lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "5 Mar 2026" for a YYYY-MM-DD day, or "—" (utils/time.ts formatDate). */
export function formatDateLocal(iso: string | null | undefined, lang: string): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(lookup(DATE_LOCALE, lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Thu 5 Mar" (the Interviews list). */
export function formatShortWeekday(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lookup(DATE_LOCALE, lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

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
