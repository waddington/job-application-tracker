// The default workflow's stage names, shown by utils/stageName.ts only while a stage still has its
// default id and English name. English repeats those names exactly, so it never changes. A stage
// you renamed or added is yours, and never comes here (docs/rfc/i18n.md §5).
export default {
  interested: "Interested",
  applied: "Applied",
  screen: "Screen",
  interviewing: "Interviewing",
  final: "Final",
  offer: "Offer",
  accepted: "Accepted",
  declined: "Declined",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
  ghosted: "Ghosted",
} as const;
