// Calls and meetings: the card on a person's page, the call form, Happened, and a call's line on
// Today (docs/rfc/i18n.md §15). People, companies and what a call is about are your data.
export default {
  // A call's name: "Call with Alex Morgan: market catch-up".
  name: {
    call: "Call with {{name}}",
    video: "Video call with {{name}}",
    in_person: "Meeting with {{name}}",
    // A kind the app doesn't know, as saved.
    other: "{{kind}} with {{name}}",
    withAbout: "{{what}}: {{about}}",
  },
  // How it happens, in the form.
  kinds: {
    call: "Phone call",
    video: "Video call",
    in_person: "In person",
  },
  status: {
    scheduled: "Booked",
    done: "Happened",
    cancelled: "Didn't happen",
  },
  line: {
    // <who> is the person, with their marks; <where> their agency or company.
    whoAt: "<who/> · <where/>",
    application: "{{company}} · {{role}}",
    joinLink: "Join link",
  },
  happened: "Happened",
  happenedWho: "Happened: {{label}}",
  moreFor: "More for {{label}}",
  edit: "Edit",
  card: {
    title: "Calls and meetings",
    book: "Book a call",
    empty: "No calls with {{name}} yet. Book one, or log one you've had.",
    addRoles: "Add roles from this call",
  },
  form: {
    howDidItGoTitle: "How did it go?",
    editTitle: "Edit {{label}}",
    bookTitle: "Book a call",
    whoError: "Who is it with?",
    whenError: "When is it?",
    linkError: "Links start with http:// or https://",
    with: "With",
    withPlaceholder: "Pick a person",
    about: "About",
    aboutPlaceholder: "Market catch-up, roles at Contoso…",
    when: "When",
    how: "How",
    status: "Status",
    where: "Where",
    wherePlaceholder: "Coffee shop, their office…",
    meetingLink: "Meeting link",
    linkOptional: "Link (optional)",
    linkPlaceholder: "https://…",
    application: "About an application (optional)",
    applicationHint:
      "If it's about one role you've applied for: it then shows with that application on the Timeline.",
    applicationPlaceholder: "Not about one application",
    applicationOption: "{{company}} · {{role}}",
    agenda: "Agenda",
    agendaHint: "What to ask, what to tell them. Markdown works.",
    howDidItGo: "How did it go?",
    howDidItGoHint:
      "What you talked about and next steps. Add the roles they mentioned from the call on their page, to apply or pass on each. Markdown works.",
    log: "Log call",
    book: "Book call",
  },
} as const;
