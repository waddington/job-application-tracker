import {
  IconBriefcase,
  IconBuilding,
  IconCalendarEvent,
  IconCash,
  IconChartSankey,
  IconFileText,
  IconHome,
  IconListDetails,
  IconNotes,
  IconTimeline,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

import type en from "./locales/en";

type Nav = (typeof en)["common"]["nav"];
/** A menu text key, as t() takes it in the common namespace: "nav.items.today". */
type GroupKey = `nav.groups.${keyof Nav["groups"]}`;
type ItemKey = `nav.items.${keyof Nav["items"]}`;

export type NavGroup = "Today" | "Your applications" | "People and companies" | "Files and notes" | "Review";

/** Menu headings, in order. */
export const NAV_GROUPS: NavGroup[] = [
  "Today",
  "Your applications",
  "People and companies",
  "Files and notes",
  "Review",
];

/** Each menu heading's text key. */
export const NAV_GROUP_KEYS: Record<NavGroup, GroupKey> = {
  Today: "nav.groups.today",
  "Your applications": "nav.groups.applications",
  "People and companies": "nav.groups.people",
  "Files and notes": "nav.groups.files",
  Review: "nav.groups.review",
};

export interface NavItem {
  path: string;
  /** The heading it sits under in the menu. */
  group: NavGroup;
  label: string;
  /** The label's text key, bare as t() takes it in the common namespace (docs/rfc/i18n.md). */
  labelKey: ItemKey;
  icon: Icon;
  /** Roadmap task that builds the page (shown on its placeholder). */
  task: string;
  description: string;
}

// Navigation from docs/prd/tracker.md §7, grouped so the menu reads as a map of the app.
export const NAV: NavItem[] = [
  {
    path: "/",
    group: "Today",
    label: "Today",
    labelKey: "nav.items.today",
    icon: IconHome,
    task: "today-page",
    description: "Your move, what's coming up, and who you're waiting on.",
  },
  {
    path: "/roles",
    group: "Your applications",
    label: "Roles",
    labelKey: "nav.items.roles",
    icon: IconListDetails,
    task: "role-decisions",
    description: "Roles you might go for: pitched by a recruiter or spotted, then applied for or passed on.",
  },
  {
    path: "/applications",
    group: "Your applications",
    label: "Applications",
    labelKey: "nav.items.applications",
    icon: IconBriefcase,
    task: "app-list",
    description: "Every application as a filterable list or a board.",
  },
  {
    path: "/recruiters",
    group: "People and companies",
    label: "Recruiters",
    labelKey: "nav.items.recruiters",
    icon: IconUsers,
    task: "recruiters",
    description: "Agencies and recruiters, their contact details and the roles they've sent.",
  },
  {
    path: "/companies",
    group: "People and companies",
    label: "Companies",
    labelKey: "nav.items.companies",
    icon: IconBuilding,
    task: "detail-pages",
    description: "Companies, their roles and who you've spoken to.",
  },
  {
    path: "/interviews",
    group: "Your applications",
    label: "Interviews",
    labelKey: "nav.items.interviews",
    icon: IconCalendarEvent,
    task: "interviews",
    description: "Interviews and coding tasks: schedule, prep and debriefs.",
  },
  {
    path: "/offers",
    group: "Your applications",
    label: "Offers",
    labelKey: "nav.items.offers",
    icon: IconCash,
    task: "offers",
    description: "Offers side by side: salary, bonus, equity, pension, day rate and IR35.",
  },
  {
    path: "/documents",
    group: "Files and notes",
    label: "Documents",
    labelKey: "nav.items.documents",
    icon: IconFileText,
    task: "documents",
    description: "CV and cover-letter versions, and where each was sent.",
  },
  {
    path: "/notes",
    group: "Files and notes",
    label: "Notes",
    labelKey: "nav.items.notes",
    icon: IconNotes,
    task: "notes",
    description: "Markdown notes on anything, plus general notes.",
  },
  {
    path: "/insights",
    group: "Review",
    label: "Insights",
    labelKey: "nav.items.insights",
    icon: IconChartSankey,
    task: "sankey",
    description: "Sankey diagram of your funnel, conversion rates and recruiter scorecards.",
  },
  {
    path: "/timeline",
    group: "Review",
    label: "Timeline",
    labelKey: "nav.items.timeline",
    icon: IconTimeline,
    task: "timeline",
    description:
      "Everything that happened, by day or one row per role: calls, pitches, applications and outcomes.",
  },
];
