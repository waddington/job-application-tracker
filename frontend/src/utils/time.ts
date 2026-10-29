import { i18n } from "../i18n";
import { formatDateLocal, formatDateTimeLocal } from "./format";

/** "today", "yesterday", "5 days ago", "3 weeks ago" … */
export function ago(days: number): string {
  if (days <= 0) return i18n.t("common:time.today");
  if (days === 1) return i18n.t("common:time.yesterday");
  if (days < 14) return i18n.t("common:time.daysAgo", { count: days });
  if (days < 60) return i18n.t("common:time.weeksAgo", { count: Math.floor(days / 7) });
  return i18n.t("common:time.monthsAgo", { count: Math.floor(days / 30) });
}

/** "5 Mar 2026, 09:07" in the reader's language. */
export const formatDateTime = (iso: string): string => formatDateTimeLocal(iso, i18n.language);

/** "5 Mar 2026" for a YYYY-MM-DD day, or "—", in the reader's language. */
export const formatDate = (iso: string | null | undefined): string => formatDateLocal(iso, i18n.language);
