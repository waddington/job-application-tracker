// The English text, one namespace per area of the app. English is the source of truth and
// the fallback; other languages are JSON files with the same keys (docs/rfc/i18n.md §3).
import applications from "./applications";
import common from "./common";
import interviews from "./interviews";
import people from "./people";
import roles from "./roles";
import selftest from "./selftest";
import today from "./today";
import todos from "./todos";

const en = { common, today, applications, roles, people, interviews, todos, selftest } as const;

export default en;
export type Namespace = keyof typeof en;

type Paths<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Paths<T[K]>}`;
}[keyof T & string];
type PluralForm = "zero" | "one" | "two" | "few" | "many" | "other";
type Base<K extends string> = K extends `${infer B}_ordinal_${PluralForm}`
  ? B
  : K extends `${infer B}_${PluralForm}`
    ? B
    : K;

/** Every key with its namespace, plural forms as one: "today:groupBadge", "people:replies.within". */
export type TextKey = { [N in Namespace]: `${N}:${Base<Paths<(typeof en)[N]>>}` }[Namespace];
