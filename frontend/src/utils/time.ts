import { i18n } from "../i18n";

/** "today", "yesterday", "5 days ago", "3 weeks ago" … */
export function ago(days: number): string {
  if (days <= 0) return i18n.t("common:time.today");
  if (days === 1) return i18n.t("common:time.yesterday");
  if (days < 14) return i18n.t("common:time.daysAgo", { count: days });
  if (days < 60) return i18n.t("common:time.weeksAgo", { count: Math.floor(days / 7) });
  return i18n.t("common:time.monthsAgo", { count: Math.floor(days / 30) });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
