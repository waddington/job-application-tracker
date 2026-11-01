// Your own to-dos, on Today and on the pages of what they're about (Todos.tsx).
export default {
  title: "To-dos",
  overdue: "Overdue · {{date}}",
  today: "Today",
  tomorrow: "Tomorrow",
  by: "By {{date}}",
  whatNeedsDoing: "What needs doing",
  due: "Due",
  noDate: "No date",
  save: "Save to-do",
  edit: "Edit",
  editWho: "Edit to-do: {{text}}",
  delete: "Delete",
  deleteWho: "Delete to-do: {{text}}",
  // What a new to-do can be about, grouped in the picker.
  about: {
    label: "About",
    placeholder: "About (optional)",
    nothingFound: "Nothing by that name",
    applications: "Applications",
    roles: "Roles to decide",
    people: "People",
    companies: "Companies",
    agencies: "Agencies",
    // An application or role: company and role.
    companyRole: "{{company}} · {{role}}",
  },
  new: "New to-do",
  newPlaceholder: "Reply to their message, look into the company…",
  dueOptional: "Due (optional)",
  byOptional: "By (optional)",
  add: "Add",
  // The toast after ticking one off or deleting it.
  toast: {
    tickedOff: "Ticked off: {{text}}",
    deleted: "Deleted: {{text}}",
    undo: "Undo",
  },
  none: "Nothing to do here. Add a reminder in your own words; it shows on Today until you tick it off.",
} as const;
