// Roles: the Roles page, a role's page, adding and editing a role, Apply / Interested / Pass,
// and the role lines shown on Today and on people's, companies' and calls' pages
// (docs/rfc/i18n.md §15). Titles, companies, people and reasons are values: they're your data.
export default {
  title: "Roles",
  intro: "Roles you might go for, before you apply: apply, mark as interested, or pass on each.",
  add: "Add role",
  // Which roles the page shows.
  views: {
    label: "Show",
    to_decide: "To decide",
    interested: "Interested",
    applied: "Applied",
    closed: "Closed",
    passed: "Passed",
    all: "All",
  },
  empty: {
    to_decide:
      "Nothing to decide. After a call with a recruiter, add the roles they mentioned here (or from the call on their page), then apply or pass on each.",
    interested:
      "No roles you're interested in but haven't applied for yet. Press Interested on a role to track it.",
    applied: "No roles applied for from here yet.",
    closed: "No roles closed before you applied (withdrawn while only interested, say).",
    passed: "You haven't passed on any roles.",
    all: "No roles yet.",
  },
  // A role's badge. A role closed before you applied shows the stage it ended at instead.
  status: {
    to_decide: "To decide",
    interested: "Interested",
    closed: "Closed",
    applied: "Applied",
    passed: "Passed",
  },
  // What it pays: "£600 a day, outside IR35", "£80k–£95k". The amounts come ready-made.
  pay: {
    dayRate: "{{rate}} a day",
    dayRateIr35: "{{rate}} a day, {{ir35}} IR35",
    ir35: {
      outside: "outside",
      inside: "inside",
    },
    range: "{{from}}–{{to}}",
  },
  // A favourite person's name gets a star, a ghosted one this, wherever a role names them.
  ghosted: " (ghosted)",
  // The buttons on a role still to decide, and on one you passed.
  actions: {
    openApplication: "Open application",
    apply: "Apply",
    applyLabel: "Apply: {{role}}",
    interested: "Interested",
    interestedLabel: "Interested: {{role}}",
    pass: "Pass",
    passLabel: "Pass: {{role}}",
    reconsider: "Reconsider",
    reconsiderLabel: "Reconsider: {{role}}",
  },
  // One role in a list.
  line: {
    // Between the parts under a role: "£80k–£95k · hybrid · London · from Alex Morgan".
    separator: " · ",
    // How the role is worked, in the middle of that line.
    workModes: {
      remote: "remote",
      hybrid: "hybrid",
      office: "office",
    },
    from: "from {{person}}",
    fromAgency: "from {{person}} ({{agency}})",
    passed: "passed: {{reason}}",
    files_one: "{{count}} file on {{role}}",
    files_other: "{{count}} files on {{role}}",
    edit: "Edit {{role}}",
    addTodo: "Add a to-do",
    addTodoLabel: "Add a to-do about {{role}}",
    deleteConfirm: "Delete the role {{role}} at {{company}}? Passing on it keeps a record instead.",
  },
  // Adding or editing a role.
  form: {
    addTitle: "Add a role to decide on",
    editTitle: "Edit {{role}}",
    intro: "A role you might go for. It waits under <b>Roles</b> until you apply or pass.",
    company: "Company",
    companyPlaceholder: "Pick or type a new one",
    role: "Role",
    rolePlaceholder: "Platform Engineer",
    who: "Who told you about it",
    whoPlaceholder: "No one: you found it",
    call: "On which call",
    notFromCall: "Not from a call",
    pickWhoFirst: "Pick who first",
    // A call in the list: "Intro call with Sam Patel · 14 Oct".
    callOption: "{{call}} · {{date}}",
    newPersonHint:
      "Saving also gives this role's open applications the new person where they fit how you applied (through their agency, or someone at the company for a direct one), noted on their timelines; others keep theirs.",
    jobAd: "Job ad link",
    jobAdPlaceholder: "https://…",
    location: "Location",
    locationPlaceholder: "London",
    workMode: "Work mode",
    workModes: {
      remote: "Remote",
      hybrid: "Hybrid",
      office: "Office",
    },
    type: "Type",
    types: {
      permanent: "Permanent",
      contract: "Contract",
      fixed_term: "Fixed term",
    },
    dayRate: "Day rate (£)",
    ir35: "IR35",
    ir35Options: {
      outside: "Outside",
      inside: "Inside",
      unknown: "Not sure",
    },
    salaryFrom: "Salary from (£)",
    salaryTo: "Salary to (£)",
    notes: "Notes",
    notesHint: "What they said about it: team, stack, why it's open.",
    files: "Job description or other files",
    filesHint: "Optional: PDFs, documents. Kept with the role, and on the application once you apply.",
    chooseFiles: "Choose files",
    add: "Add role",
    addAnother: "Add and add another",
    errors: {
      company: "Which company? Type a new name to add it.",
      role: "What's the role?",
      link: "Links start with http:// or https://",
    },
  },
  // Apply (or Interested) on a role: makes the application.
  apply: {
    applyTitle: "Apply: {{role}} at {{company}}",
    interestedTitle: "Interested: {{role}} at {{company}}",
    // How you'd be applying; {{person}} carries any star or "(ghosted)".
    throughAgencyPerson: "Through {{agency}} ({{person}}).",
    throughAgency: "Through {{agency}}.",
    directWith: "Directly, with {{person}} as your contact.",
    direct: "Directly.",
    stage: "Stage",
    appliedOn: "Applied on",
    notYet: "Not yet",
    create: "Create application",
  },
  pass: {
    title: "Pass on {{role}} at {{company}}",
    why: "Why? (optional)",
    whyPlaceholder: "Office five days a week, too junior, rate too low…",
    pass: "Pass",
  },
  // A role's own page.
  page: {
    back: "All roles",
    loadFailed: "Couldn't load this role. It may have been deleted.",
    edit: "Edit",
    about: "About the role",
    facts: {
      pay: "Pay",
      terms: "Terms",
      location: "Location",
      jobAd: "Job ad",
      from: "From",
      added: "Added",
      passed: "Passed",
    },
    // How the role is worked, under Terms.
    workModes: {
      remote: "Remote",
      hybrid: "Hybrid",
      office: "In the office",
    },
    types: {
      permanent: "Permanent",
      contract: "Contract",
      fixed_term: "Fixed term",
    },
    termsSeparator: " · ",
    // Who it came from, linked: "Alex Morgan at Northwind Talent · on Intro call".
    fromPerson: "<person/>",
    fromPersonAgency: "<person/> at <agency/>",
    fromPersonCall: "<person/> · on {{call}}",
    fromPersonAgencyCall: "<person/> at <agency/> · on {{call}}",
    passedYes: "Yes",
    passedWhy: "{{when}}: {{reason}}",
    whatTheySaid: "What they said",
    noDescription: "Edit adds what they said about it: team, stack, why it's open.",
    yourApplication: "Your application",
    applications: "Applications",
    // An application of this role: "Contoso · Backend Engineer".
    applicationName: "{{company}} · {{role}}",
    via: "via <person/>",
    viaApplied: "via <person/> · applied {{date}}",
    direct: "Direct",
    directApplied: "Direct · applied {{date}}",
    filesEmpty:
      "Drop the job description here, or a brief. Files here show on the application too, once you apply.",
  },
} as const;
