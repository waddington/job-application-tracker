// The English text, one namespace per area of the app. English is the source of truth and
// the fallback; other languages are JSON files with the same keys (docs/rfc/i18n.md §3).
import common from "./common";
import selftest from "./selftest";

const en = { common, selftest } as const;

export default en;
export type Namespace = keyof typeof en;
