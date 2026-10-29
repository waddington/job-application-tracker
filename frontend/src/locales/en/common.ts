// Text used across the app (header, menu, footer, shared buttons). Filled in as each area is
// converted (docs/rfc/i18n.md §15). Keys say what the text is for, not what it says.
export default {
  nav: {
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
  theme: {
    toDark: "Switch to dark mode",
    toLight: "Switch to light mode",
  },
  footer: {
    backup: "Download a backup",
  },
} as const;
