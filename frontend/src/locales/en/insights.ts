// Insights: the page and its tabs, stage and route tables, the scorecard, weekly activity and
// The whole picture (docs/rfc/i18n.md §15). Stage, company and people's names are your data.
export default {
  title: "Insights",
  percent: "{{percent}}%",
  range: {
    label: "Date range",
    all: "All time",
    days90: "Last 90 days",
    days30: "Last 30 days",
  },
  routes: {
    label: "Route",
    any: "Any route",
    direct: "Direct",
    agency: "Via an agency",
    referral: "Referral",
  },
  tabs: {
    whole: "The whole picture",
    applications: "Applications",
    conversations: "Recruiter conversations",
    documents: "CVs and cover letters",
  },
  flow: {
    title: "Where applications go",
    intro_one:
      "{{count}} application by the date they were added. Moves back to an earlier stage count as staying at the furthest one reached.",
    intro_other:
      "{{count}} applications by the date they were added. Moves back to an earlier stage count as staying at the furthest one reached.",
    introLoading:
      "… by the date they were added. Moves back to an earlier stage count as staying at the furthest one reached.",
    loadFailed: "Couldn't load the flow.",
    notMoved: "No application has moved on from its first stage yet. Come back once things get going.",
    noMatch: "No applications match these filters.",
    statsFailed: "Couldn't load the stats.",
  },
  whole: {
    title: "The whole picture",
    intro_one:
      "{{count}} role by the date they were added: where each came from, then passing on it, deciding, or applying and how far it got. Just after each stage, what's still waiting there (one moved back counts at the furthest stage it reached); on the right, how things ended. A role you applied to twice counts twice.",
    intro_other:
      "{{count}} roles by the date they were added: where each came from, then passing on it, deciding, or applying and how far it got. Just after each stage, what's still waiting there (one moved back counts at the furthest stage it reached); on the right, how things ended. A role you applied to twice counts twice.",
    introLoading:
      "… by the date they were added: where each came from, then passing on it, deciding, or applying and how far it got. Just after each stage, what's still waiting there (one moved back counts at the furthest stage it reached); on the right, how things ended. A role you applied to twice counts twice.",
    loadFailed: "Couldn't load the whole picture.",
    empty: "Nothing here yet: add a role or an application and it shows up.",
    chart_one: "Sankey diagram of {{count}} role, from where they came from to where they are now",
    chart_other: "Sankey diagram of {{count}} roles, from where they came from to where they are now",
  },
  stages: {
    title: "Stage by stage",
    intro:
      '"Moved on" means reaching a later stage that isn\'t a closed one. Time in stage counts every finished stay, including ones before a move back.',
    stage: "Stage",
    reached: "Reached",
    movedOn: "Moved on",
    conversion: "Conversion",
    median: "Median time in stage",
    underADay: "under a day",
    // {{value}} is the number as shown: "2.5".
    days_one: "{{value}} day",
    days_other: "{{value}} days",
    from_one: "from {{count}} stay",
    from_other: "from {{count}} stays",
  },
  routeTable: {
    title: "Direct vs recruiter",
    intro: "The share of each route's applications that got at least as far as each stage.",
    same: "Every application so far came the same way. Nothing to compare yet.",
    route: "Route",
    applications: "Applications",
  },
  weekly: {
    title: "Weekly activity",
    added: "Added",
    applied: "Applied",
    moves: "Stage moves",
    interviews: "Interviews",
    calls: "Calls",
    pitched: "Roles pitched",
    week: "Week of {{date}}: {{counts}}",
    // Plural keys, each with {{count}}. English's one form of added and applied is the same word.
    countAdded_one: "{{count}} added",
    countAdded_other: "{{count}} added",
    countApplied_one: "{{count}} applied",
    countApplied_other: "{{count}} applied",
    countMoves_one: "{{count}} stage move",
    countMoves_other: "{{count}} stage moves",
    countInterviews_one: "{{count}} interview",
    countInterviews_other: "{{count}} interviews",
    countCalls_one: "{{count}} call",
    countCalls_other: "{{count}} calls",
    countPitched_one: "{{count}} role pitched",
    countPitched_other: "{{count}} roles pitched",
  },
  scorecard: {
    title: "Recruiter scorecard",
    intro:
      "For the roles each one put you forward for. First update is the median time from adding an application to the first call, email, message or stage move.",
    by: "Scorecard by",
    recruiters: "Recruiters",
    agencies: "Agencies",
    loadFailed: "Couldn't load the scorecard.",
    noneRecruiters:
      "No roles from recruiters in this period. Add a recruiter or agency to an application to see it here.",
    noneAgencies:
      "No roles from agencies in this period. Add a recruiter or agency to an application to see it here.",
    recruiter: "Recruiter",
    agency: "Agency",
    roles: "Roles",
    interviewed: "Interviewed",
    now: "Where they are now",
    firstUpdate: "First update",
    lastContact: "Last contact",
    sameDay: "same day",
    days_one: "{{value}} day",
    days_other: "{{value}} days",
    active: "{{count}} active",
    accepted: "{{count}} accepted",
    ghosted: "{{count}} ghosted",
    closed: "{{count}} closed",
  },
} as const;
