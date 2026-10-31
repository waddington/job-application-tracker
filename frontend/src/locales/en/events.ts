// A saved event's text, one sentence per message. English must match what the API saves in `summary`
// character for character (tests/test_event_messages.py and EventsText.test.tsx share the cases).
export default {
  linkAdded: "Link added: {{title}}",
  noteAdded: "Note added: {{title}}",
  fileAdded: "File added: {{name}}",
  email: "{{subject}} (from {{sender}})",
  emailNoSubject: "(no subject) (from {{sender}})",
  emailUnknownSender: "{{subject}} (from unknown sender)",
  emailNoSubjectUnknownSender: "(no subject) (from unknown sender)",
  cvSent: "CV sent: {{name}} {{label}}",
  coverLetterSent: "Cover letter sent: {{name}} {{label}}",
  documentSent: "Document sent: {{name}} {{label}}",
} as const;
