// Text used across the app (header, menu, footer, shared buttons). Filled in as each area is
// converted (docs/rfc/i18n.md §15). Keys say what the text is for, not what it says.
export default {
  app: {
    name: "Job Application Tracker",
    // The wordmark links home; screen readers hear where it goes.
    homeLabel: "Job Application Tracker: today",
  },
  header: {
    toggleNav: "Toggle navigation",
    search: "Search everything",
    help: "How it works",
    newApplication: "New application",
  },
  nav: {
    label: "Main navigation",
    // A page in the menu that isn't built yet (pages/Placeholder.tsx). There are none today.
    placeholder: {
      comingSoon: "Coming soon",
      roadmapTask: "Roadmap task <task/>",
    },
    // Menu headings, in menu order (nav.ts NAV_GROUPS).
    groups: {
      today: "Today",
      applications: "Your applications",
      people: "People and companies",
      files: "Files and notes",
      review: "Review",
    },
    // One per page in the menu (nav.ts NAV).
    items: {
      today: "Today",
      roles: "Roles",
      applications: "Applications",
      recruiters: "Recruiters",
      companies: "Companies",
      interviews: "Interviews",
      offers: "Offers",
      documents: "Documents",
      notes: "Notes",
      insights: "Insights",
      timeline: "Timeline",
    },
  },
  // The language switch in the header. Languages are listed by their own names, not here.
  language: {
    label: "Language",
    comingSoon: "Coming soon!",
    pseudo: "Pseudo-language (dev)",
    // A link to the guide for adding a language; the second is what a screen reader hears.
    addYours: "Don't see your language?",
    addYoursLabel: "Don't see your language? Opens a guide on GitHub in a new tab.",
  },
  // One key per state: "dark" and "light" need translating too.
  theme: {
    toDark: "Switch to dark mode",
    toLight: "Switch to light mode",
  },
  footer: {
    localFirst: "Local-first · your data stays on this machine",
    backup: "Download a backup",
    backupHint:
      "Everything in one zip: your data, notes and files. Unzip it and run `jat init` on the folder (it rebuilds everything).",
  },
  // The connection dot in the footer (ApiStatus). Commands stay in English.
  api: {
    connecting: "Connecting…",
    connectingHint: "Checking the local API",
    offline: "API offline",
    offlineHint: "Start it with `uv run jat serve`",
    connected: "Connected",
    detailsBackups: "v{{version}} · schema {{schema}} · backups on",
    detailsNoGit: "v{{version}} · schema {{schema}} · data dir isn't a git repo",
  },
  // How long ago, or how long until, in days (utils/time.ts ago, utils/attention.ts).
  time: {
    today: "today",
    yesterday: "yesterday",
    tomorrow: "tomorrow",
    daysAgo_one: "{{count}} day ago",
    daysAgo_other: "{{count}} days ago",
    weeksAgo_one: "{{count}} week ago",
    weeksAgo_other: "{{count}} weeks ago",
    monthsAgo_one: "{{count}} month ago",
    monthsAgo_other: "{{count}} months ago",
    inDays_one: "in {{count}} day",
    inDays_other: "in {{count}} days",
    inWeeks_one: "in {{count}} week",
    inWeeks_other: "in {{count}} weeks",
    inMonths_one: "in {{count}} month",
    inMonths_other: "in {{count}} months",
    dueToday: "due today",
    overdueBy_one: "overdue by {{count}} day",
    overdueBy_other: "overdue by {{count}} days",
    sinceToday: "since today",
    forDays_one: "for {{count}} day",
    forDays_other: "for {{count}} days",
  },
  notFound: {
    title: "Page not found",
    body: "There's nothing at this address.",
    back: "Back to Today",
  },
  actions: {
    cancel: "Cancel",
    save: "Save",
    delete: "Delete",
    deleteNamed: "Delete {{name}}",
    undo: "Undo",
  },
  // Rename a company or agency (EditNameModal).
  editName: {
    name: "Name",
    website: "Website",
    websitePlaceholder: "https://…",
    needsName: "It needs a name",
    websiteExample: "Like https://contoso.example.com",
  },
  // A dropdown that can add what you typed (CreatableSelect).
  select: {
    add: '+ Add "{{name}}"',
  },
  // Applications that look like the same job (DuplicateWarning).
  duplicates: {
    roleAt: "{{role}} at {{company}}",
    via: "via {{name}}",
    viaRecruiter: "via a recruiter",
    byReferral: "by referral",
    directly: "directly",
    // {{how}} is one of the via / byReferral / directly texts above.
    howOn: "{{how}} on {{date}}",
    now: "now {{stage}}",
    archived: "archived",
    similarTitle: "similar title",
    // Between the parts of a line: "via Northwind Talent · now Applied · archived".
    separator: " · ",
  },
} as const;
