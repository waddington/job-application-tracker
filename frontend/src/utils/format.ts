// Dates, times and numbers in the reader's language (docs/rfc/i18n.md §7). For English each
// helper gives exactly what the app shows today, so cutting a page over changes nothing:
// - the fixed dayjs patterns ("D MMM", "dddd D MMMM"…) stay as they are;
// - dates already formatted with Intl in the browser's own locale stay that way;
// - numbers stay en-GB ("85,000").
// A new language adds its row to PATTERNS and NUMBER_LOCALE (and its dayjs locale import).
//
// Not used by the app yet (i18n-setup); pages switch to these as they're converted.
// Dates sent to the API stay `YYYY-MM-DD` and don't go through here.

import dayjs, { type ConfigType } from "dayjs";

import { FALLBACK } from "../i18n/language";

interface Patterns {
  /** Thursday 5 March */
  weekdayDayMonth: string;
  /** 5 Mar */
  dayMonth: string;
  /** 5 Mar 2026 */
  dayMonthYear: string;
  /** 5 Mar, 09:07 */
  dayMonthTime: string;
  /** 09:07 */
  time: string;
}

const PATTERNS: Record<string, Patterns> = {
  en: {
    weekdayDayMonth: "dddd D MMMM",
    dayMonth: "D MMM",
    dayMonthYear: "D MMM YYYY",
    dayMonthTime: "D MMM, HH:mm",
    time: "HH:mm",
  },
};

/** Locale for Intl dates. English uses the browser's own (undefined), as the app does today. */
const DATE_LOCALE: Record<string, string | undefined> = { en: undefined };
/** Locale for numbers. English is en-GB, as the app does today. */
const NUMBER_LOCALE: Record<string, string> = { en: "en-GB" };

const base = (lang: string) => lang.toLowerCase().split("-")[0] ?? FALLBACK;
const patterns = (lang: string) => PATTERNS[lang] ?? PATTERNS[base(lang)] ?? PATTERNS[FALLBACK]!;
const dateLocale = (lang: string) => (lang in DATE_LOCALE ? DATE_LOCALE[lang] : DATE_LOCALE[base(lang)]);
const numberLocale = (lang: string) =>
  NUMBER_LOCALE[lang] ?? NUMBER_LOCALE[base(lang)] ?? NUMBER_LOCALE[FALLBACK]!;
/** dayjs only knows English until a language imports its locale; others fall back to it. */
const dayjsIn = (value: ConfigType, lang: string) => {
  const d = dayjs(value);
  return lang === FALLBACK ? d : d.locale(lang.toLowerCase());
};

export type DatePattern = keyof Patterns;

/** A date (or date-time) in one of the app's fixed shapes, e.g. formatDay(at, "dayMonth", lang). */
export function formatDay(value: ConfigType, pattern: DatePattern, lang: string): string {
  return dayjsIn(value, lang).format(patterns(lang)[pattern]);
}

/** "5 Mar 2026, 09:07" in the reader's locale (utils/time.ts formatDateTime). */
export function formatDateTimeLocal(iso: string, lang: string): string {
  return new Date(iso).toLocaleString(dateLocale(lang), {
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
  return new Date(`${iso}T00:00:00`).toLocaleDateString(dateLocale(lang), {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** "Thu 5 Mar" (the Interviews list). */
export function formatShortWeekday(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(dateLocale(lang), {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

/** "85,000" (money amounts and counts). */
export function formatNumber(n: number, lang: string): string {
  return n.toLocaleString(numberLocale(lang));
}
