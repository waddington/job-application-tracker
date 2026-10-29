// Checks on the text files themselves (docs/rfc/i18n.md §3a, §11), used by catalog.test.ts:
// keys another language is missing or has extra, translations that drop or invent a
// {{placeholder}}, and English keys no code uses.

type Tree = { readonly [key: string]: string | Tree };

const PLURAL = /_(zero|one|two|few|many|other)$/;

/** { a: { b: "x" } } → { "a.b": "x" }. */
export function flatten(tree: Tree, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out[path] = value;
    else Object.assign(out, flatten(value, path));
  }
  return out;
}

/** "days_one" → "days": plural forms differ by language, so keys are compared without them. */
export const baseKey = (key: string) => key.replace(PLURAL, "");

/** The placeholder names in a string: "{{count}} at {{ name, number }}" → {count, name}. */
export function placeholders(text: string): Set<string> {
  return new Set(Array.from(text.matchAll(/\{\{\s*([^},\s]+)[^}]*\}\}/g), (m) => m[1]!));
}

function byBase(flat: Record<string, string>): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, text] of Object.entries(flat)) {
    const base = baseKey(key);
    out.set(base, [...(out.get(base) ?? []), text]);
  }
  return out;
}

const namesIn = (texts: string[]) => new Set(texts.flatMap((t) => [...placeholders(t)]));

export interface Comparison {
  /** English keys the other language doesn't have (they'll show in English). */
  missing: string[];
  /** Keys English doesn't have: left over from a rename, or a typo. */
  extra: string[];
  /** Translations that drop a value English shows, or use one it doesn't pass. */
  placeholders: { key: string; dropped: string[]; unknown: string[] }[];
}

/** One namespace of another language against English. Plural forms may differ (Polish has
 *  few/many, Chinese only other); a dropped {{count}} is fine where the language says it in
 *  words. */
export function compare(en: Tree, other: Tree): Comparison {
  const ours = byBase(flatten(en));
  const theirs = byBase(flatten(other));
  const result: Comparison = { missing: [], extra: [], placeholders: [] };
  for (const key of ours.keys()) if (!theirs.has(key)) result.missing.push(key);
  for (const [key, texts] of theirs) {
    const english = ours.get(key);
    if (!english) {
      result.extra.push(key);
      continue;
    }
    const want = namesIn(english);
    const have = namesIn(texts);
    const dropped = [...want].filter((n) => n !== "count" && !have.has(n));
    const unknown = [...have].filter((n) => !want.has(n));
    if (dropped.length || unknown.length) result.placeholders.push({ key, dropped, unknown });
  }
  return result;
}

/**
 * Keys a source file uses, as "namespace:key":
 * - t("key") / i18nKey="key" in a file whose useTranslation("ns") names the namespace
 *   (the first one, when it lists several), else the default namespace;
 * - any "ns:key" string with a known namespace, which is how typed maps of ids to keys and
 *   calls outside components (i18n.t("today:waiting.title")) are written.
 */
export function usedKeys(source: string, namespaces: readonly string[], defaultNs: string): Set<string> {
  const used = new Set<string>();
  const declared = source.match(/useTranslation\(\s*\[?\s*["']([\w-]+)["']/);
  const ns = declared?.[1] ?? defaultNs;
  const add = (key: string) => {
    const [first, rest] = key.split(/:(.*)/s, 2);
    if (rest !== undefined && namespaces.includes(first!)) used.add(`${first}:${baseKey(rest)}`);
    else used.add(`${ns}:${baseKey(key)}`);
  };
  for (const m of source.matchAll(/\bt\(\s*["'`]([^"'`$]+)["'`]/g)) add(m[1]!);
  for (const m of source.matchAll(/\bi18nKey=\{?\s*["']([^"']+)["']/g)) add(m[1]!);
  const qualified = new RegExp(`["'\`](${namespaces.join("|")}):([\\w.-]+)["'\`]`, "g");
  for (const m of source.matchAll(qualified)) used.add(`${m[1]}:${baseKey(m[2]!)}`);
  return used;
}

/** English keys ("ns:key") that no source uses. Plural forms count as one key. */
export function unusedKeys(
  en: Record<string, Tree>,
  sources: string[],
  defaultNs: string,
  skip: string[] = [],
) {
  const namespaces = Object.keys(en);
  const used = new Set(sources.flatMap((s) => [...usedKeys(s, namespaces, defaultNs)]));
  const all = namespaces
    .filter((ns) => !skip.includes(ns))
    .flatMap((ns) => [...new Set(Object.keys(flatten(en[ns]!)).map(baseKey))].map((key) => `${ns}:${key}`));
  return all.filter((key) => !used.has(key));
}
