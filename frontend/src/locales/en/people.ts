// Recruiters and people: their pages, cards and reply habits (docs/rfc/i18n.md §15, i18n-people).
export default {
  replies: {
    // Working days: weekdays after the day you started waiting (domain/replies.py).
    sameDay: "Usually replies the same day",
    within_one: "Usually replies within {{count}} working day",
    within_other: "Usually replies within {{count}} working days",
    // Shown after the habit, when you've been waiting past it.
    longerThanUsual_one: "waiting {{count}} working day longer than usual",
    longerThanUsual_other: "waiting {{count}} working days longer than usual",
  },
} as const;
