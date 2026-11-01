// Checks on the text files themselves (docs/rfc/i18n.md §3a, §11), used by catalog.test.ts:
// keys another language is missing or has extra, translations that drop or invent a
// {{placeholder}}, and English keys no code uses.

type Tree = { readonly [key: string]: string | Tree };

// Plural forms, including ordinals ("place_ordinal_one"). So a key's own name must never end
// in one of these ("status_other"), and the app doesn't use i18next's context suffixes.
const PLURAL = /(_ordinal)?_(zero|one|two|few|many|other)$/;

/**
 * In front of every line scripts/i18n/new_language.mjs writes: "[TRANSLATE] Show all rows". A
 * line still holding it hasn't been translated, and a test fails until none is left.
 */
export const TO_TRANSLATE = "[TRANSLATE]";

/** The lines of a language's file ("a.b") still marked TO_TRANSLATE. */
export const untranslated = (tree: Tree): string[] =>
  Object.entries(flatten(tree))
    .filter(([, text]) => text.includes(TO_TRANSLATE))
    .map(([key]) => key);

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
  /** English keys the other language doesn't have. A test failure: they'd show in English. */
  missing: string[];
  /** Keys English doesn't have: left over from a rename, or a typo. */
  extra: string[];
  /** Translations that drop a value English shows, or use one it doesn't pass. */
  placeholders: { key: string; dropped: string[]; unknown: string[] }[];
  /** Plural keys missing a form the language needs (Polish needs one, few, many and other). */
  pluralForms: { key: string; missing: string[] }[];
}

const PLURAL_FORM = /_(zero|one|two|few|many|other)$/;

/** The plural forms a language uses: ["one", "few", "many", "other"] for Polish. */
export const pluralCategories = (lang: string): string[] =>
  new Intl.PluralRules(lang).resolvedOptions().pluralCategories as string[];

/** One namespace of another language (`lang`) against English. Plural forms may differ, but
 *  each plural key needs every form `lang` uses (Polish one/few/many/other, Chinese only
 *  other). A dropped {{count}} is fine where the language says it in words. */
export function compare(en: Tree, other: Tree, lang: string): Comparison {
  const ours = byBase(flatten(en));
  const theirs = byBase(flatten(other));
  const result: Comparison = { missing: [], extra: [], placeholders: [], pluralForms: [] };
  const theirKeys = new Set(Object.keys(flatten(other)));
  const plurals = new Set(
    Object.keys(flatten(en))
      .filter((k) => PLURAL_FORM.test(k))
      .map(baseKey),
  );
  const forms = pluralCategories(lang);
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
    if (plurals.has(key)) {
      const missing = forms.filter((f) => !theirKeys.has(`${key}_${f}`));
      if (missing.length) result.pluralForms.push({ key, missing });
    }
  }
  return result;
}

/**
 * Keys a source file uses, as "namespace:key". What it understands (and so what code must do
 * for the unused-key test to see a key):
 * - t("key") / t(`key`) and i18nKey="key" are credited to every namespace the file names in
 *   useTranslation("ns") or useTranslation(["a", "b"]), or the default namespace if none;
 * - <Trans ns="x" i18nKey="key"> is credited to x;
 * - any "ns:key" string with a known namespace counts wherever it is (calls outside
 *   components: i18n.t("today:waiting.title"));
 * - any other dotted string ("nav.items.today") is credited to the file's namespaces, as for
 *   t(). That's how typed maps of ids to keys are written: bare, the way t() takes them.
 * Not understood: keyPrefix, and keys built at run time (`stage.${id}`), which the app avoids.
 */
export function usedKeys(code: string, namespaces: readonly string[], defaultNs: string): Set<string> {
  // A key named only in a comment isn't used. (Rough: a "//" inside a string, as in a URL,
  // drops the rest of that line, which can only make a key look unused, never hide one.)
  const source = code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  const used = new Set<string>();
  const declared = new Set<string>();
  for (const m of source.matchAll(/useTranslation\(\s*(\[[^\]]*\]|["'][\w-]+["'])/g)) {
    for (const n of m[1]!.matchAll(/["']([\w-]+)["']/g)) declared.add(n[1]!);
  }
  const fileNamespaces = declared.size ? [...declared] : [defaultNs];
  const add = (key: string, inNamespaces: readonly string[]) => {
    const [first, rest] = key.split(/:(.*)/s, 2);
    if (rest !== undefined && namespaces.includes(first!)) used.add(`${first}:${baseKey(rest)}`);
    else for (const ns of inNamespaces) used.add(`${ns}:${baseKey(key)}`);
  };
  for (const m of source.matchAll(/\bt\(\s*(["'`])([^"'`$]+)\1/g)) add(m[2]!, fileNamespaces);
  for (const m of source.matchAll(/\bi18nKey=\{?\s*(["'`])([^"'`$]+)\1/g)) {
    // A ns="…" on the same <Trans> element wins over the file's namespaces. The element runs
    // from its "<Trans" to the next one (its props can hold JSX, so ">" can't end it).
    const start = source.lastIndexOf("<Trans", m.index);
    const next = source.indexOf("<Trans", m.index);
    const element = start < 0 ? "" : source.slice(start, next < 0 ? undefined : next);
    const ns = element.match(/\bns=\{?\s*["']([\w-]+)["']/)?.[1];
    add(m[2]!, ns ? [ns] : fileNamespaces);
  }
  const qualified = new RegExp(`["'\`](${namespaces.join("|")}):([\\w.-]+)["'\`]`, "g");
  for (const m of source.matchAll(qualified)) used.add(`${m[1]}:${baseKey(m[2]!)}`);
  for (const m of source.matchAll(/["'`]([\w-]+(?:\.[\w-]+)+)["'`]/g)) add(m[1]!, fileNamespaces);
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
