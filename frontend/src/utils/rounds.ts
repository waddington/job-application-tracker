import { i18n } from "../i18n";

type Named = { round: number | null; title: string | null; kind: string };

// Whole keys, so the unused-key scanner sees them and a missing one fails the type check.
const KIND_NAMES = {
  screen: "interviews:kindNames.screen",
  hiring_manager: "interviews:kindNames.hiring_manager",
  technical: "interviews:kindNames.technical",
  coding_task: "interviews:kindNames.coding_task",
  system_design: "interviews:kindNames.system_design",
  pairing: "interviews:kindNames.pairing",
  behavioural: "interviews:kindNames.behavioural",
  onsite: "interviews:kindNames.onsite",
  final: "interviews:kindNames.final",
  other: "interviews:kindNames.other",
} as const;

function isKnownKind(kind: string): kind is keyof typeof KIND_NAMES {
  return Object.hasOwn(KIND_NAMES, kind);
}

/**
 * A round's name, "Round 2 · System design test"; its kind stands in for a missing description.
 * Built here because the API's `label` is English: it matches `label()` in domain/interviews.py,
 * which stays for the CLI and the API's other readers. Your description is shown as written.
 */
export function roundLabel({ round, title, kind }: Named): string {
  const what = title || (isKnownKind(kind) ? i18n.t(KIND_NAMES[kind]) : kind);
  return round ? i18n.t("interviews:label", { round, what }) : what;
}
