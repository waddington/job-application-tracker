// The Today page, and How it works (docs/rfc/i18n.md §15, i18n-today).
export default {
  // Read out for the count beside each group's heading: "3 in Your move".
  groupBadge: "{{count}} in {{group}}",
  howItWorks: {
    // The group names are bold because they're the headings on Today.
    startFromToday:
      "<b>Your move</b> is what to do now (replies to read, follow-ups due, your to-dos), <b>Coming up</b> is what's booked, and <b>Waiting on them</b> is who to chase.",
  },
} as const;
