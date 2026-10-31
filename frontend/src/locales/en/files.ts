// Files and links: the Files and Links cards on applications, roles, people, companies and
// agencies (docs/rfc/i18n.md §15). File names, email subjects and link titles are your data.
export default {
  // File sizes, wherever one shows.
  size: {
    bytes: "{{size}} B",
    kb: "{{size}} KB",
    mb: "{{size}} MB",
  },
  attachments: {
    title: "Files",
    upload: "Upload",
    empty:
      "Drop files here: the CV you sent, a brief, an exported email. Up to 50 MB each, kept in your data folder.",
    noSubject: "(no subject)",
    sizeDate: "{{size}} · {{date}}",
    delete: "Delete file",
    deleteNamed: "Delete {{name}}",
    deleteConfirm: "Delete {{name}}? (It stays in your data repo's git history.)",
  },
  links: {
    title: "Links",
    empty: "Job ads, Google Docs, repos: anything with a URL.",
    urlError: "Paste a link starting with https://",
    url: "Link URL",
    urlPlaceholder: "https://docs.google.com/…",
    titleOptional: "Link title (optional)",
    titlePlaceholder: "Title (optional)",
    add: "Add",
    linkTitle: "Link title",
    defaultPlaceholder: "Leave empty for a default",
    saveTitle: "Save title",
    cancel: "Cancel",
    rename: "Rename",
    renameNamed: "Rename {{label}}",
    remove: "Remove",
    removeNamed: "Remove {{label}}",
  },
} as const;
