// Recruiters and people: their pages, cards, reply habits, and the buttons that track a
// conversation (docs/rfc/i18n.md §15). Names are values: {{name}}, {{who}}.
export default {
  replies: {
    // Working days: weekdays after the day you started waiting (domain/replies.py).
    sameDay: "Usually replies the same day",
    within_one: "Usually replies within {{count}} working day",
    within_other: "Usually replies within {{count}} working days",
    onceSameDay: "Replied once, the same day",
    onceIn_one: "Replied once, in {{count}} working day",
    onceIn_other: "Replied once, in {{count}} working days",
    // Shown after the habit, when you've been waiting past it.
    longerThanUsual_one: "waiting {{count}} working day longer than usual",
    longerThanUsual_other: "waiting {{count}} working days longer than usual",
  },
  // Where a conversation stands, and the buttons that move it on (Waiting.tsx), for an
  // application or a person.
  conversation: {
    waitingSinceToday: "Waiting since today",
    waitingDays_one: "Waiting {{count}} day",
    waitingDays_other: "Waiting {{count}} days",
    repliedToday: "Replied today",
    repliedYesterday: "Replied yesterday",
    repliedDaysAgo_one: "Replied {{count}} day ago",
    repliedDaysAgo_other: "Replied {{count}} days ago",
    toReadToday: "Reply to read · today",
    toReadYesterday: "Reply to read · yesterday",
    toReadDaysAgo_one: "Reply to read · {{count}} day ago",
    toReadDaysAgo_other: "Reply to read · {{count}} days ago",
    theyReplied: "They've replied",
    theyRepliedWho: "They've replied: {{who}}",
    theyRepliedHint: "Their reply needs reading: it goes to the top of Today",
    readIt: "Read it",
    readItWho: "Read it: {{who}}",
    iveReplied: "I've replied, waiting",
    heardBack: "Heard back",
    heardBackWho: "Heard back from {{who}}",
  },
  // Chasing someone, or no longer expecting anything from them (PersonChase.tsx).
  chase: {
    ghosted: "Ghosted",
    notInterested: "Not interested",
    chased: "Chased",
    chasedWho: "Chased: {{name}}",
    chasedHint: "You nudged them: waiting again from today",
    chasedDone: "Chased {{name}}",
    chasedToday: "Chased today",
    chasedYesterday: "Chased yesterday",
    chasedDaysAgo_one: "Chased {{count}} day ago",
    chasedDaysAgo_other: "Chased {{count}} days ago",
    ghostedWho: "Ghosted: {{name}}",
    ghostedHint: "No reply: stop waiting on them",
    ghostedDone: "{{name}}: ghosted, off Today",
    notInterestedWho: "Not interested: {{name}}",
    notInterestedHint: "You're not interested: stop waiting on them",
    notInterestedDone: "{{name}}: not interested, off Today",
    // {{what}} is Ghosted or Not interested, above.
    closedOn: "{{what}} · {{date}}",
    // Taking it off again is a plain action, not an "undo" (docs/COMPACTION.md, ghosts).
    notAGhost: "Not a ghost",
    notAGhostHint: "They were just slow, or got back in touch: take Ghosted off, whenever it was set",
    notAGhostShort: "Not a ghost: take Ghosted off",
    notAGhostDone: "{{name}}: not a ghost any more",
    removeNotInterested: "Remove Not interested",
    removeNotInterestedHint: "Take Not interested off",
    removeNotInterestedDone: "{{name}}: not marked Not interested any more",
    takeOff: "Take {{what}} off {{name}}",
  },
  // The marks before a name (GhostMark.tsx).
  marks: {
    ghosted: "Ghosted",
    ghostedHint: "Ghosted: no reply",
    favourite: "Favourite",
    favouriteWho: "Favourite: {{name}}",
    star: "Mark as a favourite",
    unstar: "A favourite: click to unstar",
  },
} as const;
