// Text used across the app (header, menu, footer, shared buttons). Filled in as each area is
// converted (docs/rfc/i18n.md §15). Keys say what the text is for, not what it says.
export default {
  app: {
    name: "Job Application Tracker",
    // The wordmark links home; screen readers hear where it goes.
    homeLabel: "Job Application Tracker: today",
  },
  header: {
    search: "Search everything",
    help: "How it works",
    newApplication: "New application",
  },
  nav: {
    label: "Main navigation",
    // The phone bar's last button, and the title of the sheet of other pages it opens.
    more: "More",
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
    current: "Language: {{name}}",
    // Greyed out under the languages: more are on their way.
    comingSoon: "More coming soon",
    pseudo: "Pseudo-language (dev)",
    // A language still being translated, shown only on a dev server: its name in itself.
    draft: "{{name}} (draft)",
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
    detailsWindowsNoSnapshots: "v{{version}} · schema {{schema}} · snapshots off on Windows",
  },
  // The version in the footer (AppVersion), and what to do when the server's differs from the
  // page's. Versions are data, written as "1.8.0".
  version: {
    short: "v{{version}}",
    // Starts with the visible text, so speech input can find it (WCAG 2.5.3).
    linkLabel: "v{{version}}: see what's in it on GitHub (opens in a new tab).",
    // The usual case: the frontend was rebuilt, but the running tracker still has older code.
    serverOlder: "The server is v{{server}} but this page is v{{page}}. Restart the tracker to update.",
    // A tab opened before the tracker was restarted or updated.
    pageOlder: "The server is v{{server}} but this page is v{{page}}. Refresh this page to update.",
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
  // A card or list whose data didn't load (components/QueryState.tsx), and its button to try again.
  load: {
    failed: "Couldn't load this.",
    retry: "Retry",
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
  // A card's line about a role or application, then its recruiter's name (components/RecruiterLine.tsx):
  // "Contoso · Backend Engineer · Alex Morgan". Both are filled in by the app.
  recruiterLine: "<line/> · <person/>",
  // Between the items of a list the app builds (utils/list.ts joinList): a round's interviewers, a
  // person's relations to an application, a role's files, a week's counts. Spaces count: Chinese
  // writes "、" with none.
  listSeparator: ", ",
  // Two whole sentences shown one after another (utils/list.ts joinSentences): Chinese puts no space
  // after 。. A pattern, not a bare separator, because an empty translation falls back to English.
  twoSentences: "{{first}} {{second}}",
} as const;
