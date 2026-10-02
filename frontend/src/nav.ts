import {
  IconBriefcase,
  IconBuilding,
  IconCalendarEvent,
  IconCash,
  IconChartSankey,
  IconChecklist,
  IconFileText,
  IconHome,
  IconListDetails,
  IconNotes,
  IconTimeline,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

export type NavGroup = "Today" | "Your applications" | "People and companies" | "Files and notes" | "Review";

/** Menu headings, in order. */
export const NAV_GROUPS: NavGroup[] = [
  "Today",
  "Your applications",
  "People and companies",
  "Files and notes",
  "Review",
];

export interface NavItem {
  path: string;
  /** The heading it sits under in the menu. */
  group: NavGroup;
  label: string;
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
    label: "Overview",
    icon: IconHome,
    task: "home",
    description: "Where things stand: what needs doing, what's coming up and what happened lately.",
  },
  {
    path: "/next-actions",
    group: "Today",
    label: "Next actions",
    icon: IconChecklist,
    task: "next-actions",
    description: "Stale applications, follow-ups, upcoming interviews and deadlines.",
  },
  {
    path: "/timeline",
    group: "Today",
    label: "Timeline",
    icon: IconTimeline,
    task: "timeline",
    description: "Everything that happened, across every application, company, agency and person.",
  },
  {
    path: "/roles",
    group: "Your applications",
    label: "Roles",
    icon: IconListDetails,
    task: "role-decisions",
    description: "Roles you might go for: pitched by a recruiter or spotted, then applied for or passed on.",
  },
  {
    path: "/applications",
    group: "Your applications",
    label: "Applications",
    icon: IconBriefcase,
    task: "app-list",
    description: "Every application as a filterable list or a board.",
  },
  {
    path: "/recruiters",
    group: "People and companies",
    label: "Recruiters",
    icon: IconUsers,
    task: "recruiters",
    description: "Agencies and recruiters, their contact details and the roles they've sent.",
  },
  {
    path: "/companies",
    group: "People and companies",
    label: "Companies",
    icon: IconBuilding,
    task: "detail-pages",
    description: "Companies, their roles and who you've spoken to.",
  },
  {
    path: "/interviews",
    group: "Your applications",
    label: "Interviews",
    icon: IconCalendarEvent,
    task: "interviews",
    description: "Interviews and coding tasks: schedule, prep and debriefs.",
  },
  {
    path: "/offers",
    group: "Your applications",
    label: "Offers",
    icon: IconCash,
    task: "offers",
    description: "Offers side by side: salary, bonus, equity, pension, day rate and IR35.",
  },
  {
    path: "/documents",
    group: "Files and notes",
    label: "Documents",
    icon: IconFileText,
    task: "documents",
    description: "CV and cover-letter versions, and where each was sent.",
  },
  {
    path: "/notes",
    group: "Files and notes",
    label: "Notes",
    icon: IconNotes,
    task: "notes",
    description: "Markdown notes on anything, plus general notes.",
  },
  {
    path: "/insights",
    group: "Review",
    label: "Insights",
    icon: IconChartSankey,
    task: "sankey",
    description: "Sankey diagram of your funnel, conversion rates and recruiter scorecards.",
  },
];
