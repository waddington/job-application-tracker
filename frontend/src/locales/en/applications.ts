// Applications: the list and board, the quick view and the application page, New application
// and documents sent (docs/rfc/i18n.md §15). Stage names, companies, roles, people and tags
// are values: they're your data.
export default {
  title: "Applications",
  // List or board, above the filters.
  view: {
    label: "View",
    list: "List",
    board: "Board",
  },
  filters: {
    search: "Search",
    searchPlaceholder: "Search company, role, recruiter…",
    stages: "Stages",
    allStages: "All stages",
    route: "Route",
    anyRoute: "Any route",
    agency: "Agency",
    anyAgency: "Any agency",
    needsChasing: "Needs chasing",
    archived: "Archived",
  },
  empty: {
    noMatch: "No applications match these filters",
    clearFilter: "Try clearing a filter.",
    none: "No applications yet",
    addFirst: "Add the first one: company, role and how you applied.",
  },
  // The list's columns.
  columns: {
    companyRole: "Company / role",
    route: "Route",
    stage: "Stage",
    lastActivity: "Last activity",
    tags: "Tags",
  },
  // A row in the list, read out by screen readers.
  openRow: "Open {{role}} at {{company}}",
  // Small red and orange lines under the last activity.
  needsChasing: "needs chasing",
  replyToRead: "reply to read",
  // How an application came about, in the list and on the board's cards. The filter's
  // "Recruiter" is the agency route.
  routes: {
    direct: "Direct",
    agency: "Agency",
    recruiter: "Recruiter",
    referral: "Referral",
    // Between the recruiter and their agency: "Alex Morgan · Northwind Talent".
    separator: " · ",
  },
  board: {
    showClosed: "Show closed stages",
    byRound: "A column per interview round",
    // A stage split into a column per round: "Interviewing · Round 2".
    noRoundYet: "{{stage}} · No round yet",
    round: "{{stage}} · Round {{round}}",
    column: "{{title}} column",
    card: "{{company}}: {{role}}",
    replyToRead: "Reply to read",
    roundsInOrder: "Rounds go in order",
    roundFromInterviews:
      "A card's round comes from its interviews: add or finish a round on the application to move it along.",
    dropOnNoRound: "Drop it on {{stage}} · No round yet; it moves along as you add its interview rounds.",
    notAllowed: "That move isn't allowed",
    cantGo: "{{from}} can't go to {{to}}.",
    moved: "{{company}} moved to {{stage}}",
    // Read out by screen readers while dragging a card with the keyboard.
    drag: {
      application: "Application",
      pickedUp: "Picked up {{card}}. Use arrow keys to move, Space to drop.",
      over: "{{card}} is over {{column}}.",
      notOver: "{{card}} isn't over a stage.",
      droppedOn: "{{card}} dropped on {{column}}.",
      dropped: "{{card}} dropped.",
      cancelled: "Cancelled. {{card}} stays where it was.",
    },
  },
  // The quick view (a drawer) and the top of the application page.
  summary: {
    drawerTitle: "Application",
    needsChasing: "Needs chasing",
    archived: "Archived",
    alsoApplied: "Also applied for this job",
    moveTo: "Move to…",
    usualNext: "Usual next",
    otherStages: "Other stages",
    undoMove: "Undo last move",
    // <b> holds the label: "<b>Applied on:</b> 20 Sep 2026".
    route: "<b>Route:</b> <route/>",
    appliedOn: "<b>Applied on:</b> {{date}}",
    lastActivity: "<b>Last activity:</b> {{ago}}",
    followUpOn: "<b>Follow up on:</b> {{date}}",
    openFullPage: "Open full page",
    loadFailed: "Couldn't load this application",
    somethingWrong: "Something went wrong.",
  },
  // The route line, with the recruiter, agency and company linked to their pages.
  routeLine: {
    throughAgency: "Through an agency",
    throughBoth: "Through <person/> at <agency/>",
    throughOne: "Through <who/>",
    referral: "Referral",
    directly: "Applied directly",
    directlyVia: "Directly, via <person/> at <company/>",
  },
  log: {
    title: "Log activity",
    kinds: {
      call: "Call",
      email: "Email",
      message: "Message",
      note: "Note",
    },
    placeholder: "What happened?",
    // The button, one per kind.
    submit: {
      call: "Log call",
      email: "Log email",
      message: "Log message",
      note: "Log note",
    },
  },
  timeline: {
    title: "Timeline",
    added: "Added as {{stage}}",
    undone: "Undone: back to {{stage}}",
    moved: "{{from}} → {{to}}",
    // One per kind of event; anything else shows its kind.
    kinds: {
      call: "Call",
      email: "Email",
      message: "Message",
      note: "Note",
      file: "File",
      interview: "Interview",
      manual: "Manual",
    },
  },
  page: {
    back: "All applications",
    deleteConfirm:
      "Delete your application to {{company}} ({{role}})? Its interviews, offer, timeline and record of documents sent go with it; notes and files stay. To keep it but hide it, archive it instead.",
    // The name in "Delete …": "Litware · Senior Software Engineer".
    deleteName: "{{company}} · {{role}}",
    fromRole: "From the role",
  },
  details: {
    title: "Details",
    appliedOn: "Applied on",
    followUpOn: "Follow up on",
    followUpHint: "Shows on Today, under Your move, on this date",
    snoozeUntil: "Snooze until",
    snoozeHint: "Won't be flagged as stale before then",
    tags: "Tags",
    archived: "Archived",
    save: "Save details",
  },
  role: {
    title: "Role",
    jobAd: "Job ad",
    // How the role is worked (the role's page says "In the office"; this card always said "Office").
    workModes: {
      remote: "Remote",
      hybrid: "Hybrid",
      office: "Office",
    },
  },
  people: {
    title: "People",
    none: "No one linked yet. Add recruiters, hiring managers and interviewers.",
    unknown: "Unknown contact",
    remove: "Remove {{name}}",
    removeUnknown: "Remove contact",
    // Under a person's name: "Interviewer · riley@example.com".
    relationEmail: "{{relation}} · {{email}}",
    add: "Add a person",
    choose: "Choose a contact",
    as: "As",
    link: "Link person",
    newPerson: "New person",
    newHint:
      "Someone new? <b>New person</b> adds them (at {{company}} unless you change it) and links them as the role chosen above.",
  },
  sent: {
    title: "Documents sent",
    open: "open",
    // Under the document: "CV · sent 6 Oct 2026".
    kindSent: "{{kind}} · sent {{date}}",
    notSent: "Not sent with this one",
    remove: "Remove {{document}} {{version}}",
    none: "Record which CV and cover letter you sent, so you know what they've seen.",
    addFirst: "<docs>Add your CV on the Documents page</docs> first.",
    // The groups in the picker: "Main CV (CV)", and its versions "Main CV · v3".
    group: "{{document}} ({{kind}})",
    option: "{{document}} · {{version}}",
    version: "Version",
    pick: "Pick a CV or cover letter",
    sentOn: "Sent on",
    add: "Add",
  },
  // New application, from the header or the empty list.
  new: {
    title: "New application",
    intro: "Type names as you go: a company, agency or person you haven't added yet is created for you.",
    company: "Company",
    companyPlaceholder: "Contoso",
    newCompany: "New company: it's added for you",
    pickOrType: "Pick one or type a new name",
    role: "Role",
    rolePlaceholder: "Senior Backend Engineer",
    maybeApplied: "You may have applied for this already",
    jobAd: "Job ad link",
    jobAdPlaceholder: "https://…",
    how: "How did you apply?",
    routes: {
      direct: "Directly",
      agency: "Through a recruiter",
      referral: "Referral",
    },
    whoReachedOut: "Who reached out? (optional)",
    newPersonAtCompany: "New person at the company",
    inHouseHint: "An in-house recruiter or head of talent, if they contacted you",
    personPlaceholder: "Riley Chen",
    agency: "Agency",
    agencyPlaceholder: "Northwind Talent",
    newAgency: "New agency: it's added for you",
    recruiter: "Recruiter",
    recruiterPlaceholder: "Alex Recruiter",
    newRecruiter: "New person: they're added for you",
    optional: "Optional",
    stage: "Stage",
    appliedOn: "Applied on",
    notYet: "Not yet",
    tags: "Tags",
    tagsPlaceholder: "python, fintech, remote…",
    add: "Add application",
    added: "Application added",
    addedBody: "{{role}} at {{company}}",
    errors: {
      company: "Which company?",
      role: "What's the role?",
      link: "Links start with http:// or https://",
      agency: "Add the agency or recruiter",
    },
  },
} as const;
