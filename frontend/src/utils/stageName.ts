import { i18n } from "../i18n";
import defaults from "../locales/defaultStages.json";

// The default workflow, as `domain/workflow.py` has it: tests/test_default_stages.py fails if they part.
type DefaultStageId = keyof typeof defaults;

// A default stage added to the JSON without text here is a type error.
const STAGE_TEXT = {
  interested: "stages:interested",
  applied: "stages:applied",
  screen: "stages:screen",
  interviewing: "stages:interviewing",
  final: "stages:final",
  offer: "stages:offer",
  accepted: "stages:accepted",
  declined: "stages:declined",
  rejected: "stages:rejected",
  withdrawn: "stages:withdrawn",
  ghosted: "stages:ghosted",
} as const satisfies Record<DefaultStageId, string>;

const isDefaultId = (id: string): id is DefaultStageId => Object.hasOwn(defaults, id);

/**
 * A stage's name to show: in your language while it still has its default id and default English
 * name, otherwise as written in config.toml. An id can be missing (an older server).
 *
 * For showing only. Saves, the API, logic and sorting use the id, or the name as the API sent it.
 */
export function stageName(stage: { id?: string | null; name: string }, lng?: string): string {
  const { id, name } = stage;
  if (id == null || !isDefaultId(id) || defaults[id] !== name) return name;
  return lng ? i18n.t(STAGE_TEXT[id], { lng }) : i18n.t(STAGE_TEXT[id]);
}
