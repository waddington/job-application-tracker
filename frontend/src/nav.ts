import {
  IconBriefcase,
  IconBuilding,
  IconCalendarEvent,
  IconCash,
  IconChartSankey,
  IconChecklist,
  IconFileText,
  IconNotes,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";

export interface NavItem {
  path: string;
  label: string;
  icon: Icon;
  /** Roadmap task that builds the page (shown on its placeholder). */
  task: string;
  description: string;
}

// Navigation from docs/prd/tracker.md §7. Next actions is the home page.
export const NAV: NavItem[] = [
  {
    path: "/",
    label: "Next actions",
    icon: IconChecklist,
    task: "next-actions",
    description: "Stale applications, follow-ups, upcoming interviews and deadlines.",
  },
  {
    path: "/applications",
    label: "Applications",
    icon: IconBriefcase,
    task: "app-list",
    description: "Every application as a filterable list or a board.",
  },
  {
    path: "/recruiters",
    label: "Recruiters",
    icon: IconUsers,
    task: "recruiters",
    description: "Agencies and recruiters, their contact details and the roles they've sent.",
  },
  {
    path: "/companies",
    label: "Companies",
    icon: IconBuilding,
    task: "detail-pages",
    description: "Companies, their roles and who you've spoken to.",
  },
  {
    path: "/interviews",
    label: "Interviews",
    icon: IconCalendarEvent,
    task: "interviews",
    description: "Interviews and coding tasks: schedule, prep and debriefs.",
  },
  {
    path: "/offers",
    label: "Offers",
    icon: IconCash,
    task: "offers",
    description: "Offers side by side: salary, bonus, equity, pension, day rate and IR35.",
  },
  {
    path: "/documents",
    label: "Documents",
    icon: IconFileText,
    task: "documents",
    description: "CV and cover-letter versions, and where each was sent.",
  },
  {
    path: "/notes",
    label: "Notes",
    icon: IconNotes,
    task: "notes",
    description: "Markdown notes on anything, plus general notes.",
  },
  {
    path: "/insights",
    label: "Insights",
    icon: IconChartSankey,
    task: "sankey",
    description: "Sankey diagram of your funnel, conversion rates and recruiter scorecards.",
  },
];
