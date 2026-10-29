// Shadow mode (docs/rfc/i18n.md §15, i18n-shadow): the page keeps showing its hard-coded
// English, and behind it the same text is looked up through the translation layer and
// compared. Nothing changes on screen. Results go to the browser console only:
//   ✓ match     the translation gives exactly the English on screen
//   ✗ mismatch  it gives something else (both are logged)
//   ? missing   no text for the key
//   ! error     the lookup failed (e.g. a {{placeholder}} with no value)
// Each key is logged once per result. window.jatI18n.report() prints a table of everything.
//
// It's on in `pnpm dev`. In a built app it's off until you switch it on, in this browser only:
// open the app with ?i18n=shadow (stays on), and ?i18n=off to switch it off again.
// Under test, a mismatch throws, so the test suite checks every shadowed string it renders.
//
// The shadow calls are removed as each area is cut over to t() (i18n-finish removes this file).

import type { TextKey } from "../locales/en";
import { i18n, MissingKeyError } from ".";
import { FALLBACK } from "./language";

export const FLAG = "jat.i18n.shadow";
export type Status = "match" | "mismatch" | "missing" | "error";

export interface Row {
  key: string;
  status: Status;
  /** What the page shows. */
  english: string;
  /** What the English text file gives for it. */
  translation: string;
  /** What it gives in the current language, when that isn't English (e.g. pseudo). */
  shown?: string;
  checks: number;
}

/** Thrown under test when shadowed text doesn't match the text file. */
export class ShadowMismatchError extends Error {
  constructor(row: Row) {
    super(
      `i18n shadow ${row.status} for ${row.key}: page says "${row.english}", text file gives "${row.translation}"`,
    );
    this.name = "ShadowMismatchError";
  }
}

const env = import.meta.env;
const underTest = env.MODE === "test";
const rows = new Map<string, Row>();
const logged = new Set<string>();
let on: boolean | undefined;

function readFlag(): boolean {
  try {
    return window.localStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
}

/** Whether shadow checks run: always in dev and tests, else when switched on in this browser. */
export function shadowOn(): boolean {
  on ??= Boolean(env.DEV) || underTest || (typeof window !== "undefined" && readFlag());
  return on;
}

/** Switch shadow mode on or off in this browser (remembered across reloads). */
export function setShadow(value: boolean) {
  on = value;
  try {
    if (value) window.localStorage.setItem(FLAG, "1");
    else window.localStorage.removeItem(FLAG);
  } catch {
    // no storage (private window): it lasts until the page reloads
  }
}

function log(row: Row) {
  const id = `${row.key}|${row.status}`;
  if (logged.has(id)) return;
  logged.add(id);
  const shown = row.shown === undefined ? {} : { shown: row.shown };
  if (row.status === "match") console.debug(`[i18n shadow] ✓ ${row.key}`, shown);
  else if (row.status === "mismatch")
    console.warn(`[i18n shadow] ✗ ${row.key}`, {
      english: row.english,
      translation: row.translation,
      ...shown,
    });
  else if (row.status === "missing") console.warn(`[i18n shadow] ? ${row.key}: no text for this key`);
  else console.warn(`[i18n shadow] ! ${row.key}: ${row.translation}`);
}

/** Record one comparison. `lookup(lng)` gives the text in a language; `exists` says whether
 *  there's text for it at all. */
function check(key: string, english: string, lookup: (lng: string) => string, exists = true) {
  let status: Status;
  let translation = "";
  if (!exists) status = "missing";
  else
    try {
      translation = lookup(FALLBACK);
      status = translation === english ? "match" : "mismatch";
    } catch (err) {
      translation = err instanceof Error ? err.message : String(err);
      status = err instanceof MissingKeyError ? "missing" : "error";
    }
  let shown: string | undefined;
  if (i18n.language !== FALLBACK && status === "match") {
    try {
      shown = lookup(i18n.language);
    } catch {
      shown = undefined;
    }
  }
  const before = rows.get(key);
  // Keep the worst result seen for a key, so one later match can't hide a mismatch.
  const row: Row =
    before && before.status !== "match" && status === "match"
      ? { ...before, checks: before.checks + 1 }
      : { key, status, english, translation, shown, checks: (before?.checks ?? 0) + 1 };
  rows.set(key, row);
  log(row);
  if (throws && status !== "match") throw new ShadowMismatchError(row);
}

let throws = underTest;
/** For the shadow helper's own tests: record mismatches without throwing. */
export function setShadowThrows(value: boolean) {
  throws = value;
}

const stripTags = (text: string) => text.replace(/<\/?[\w-]+\s*\/?>/g, "");

/**
 * Shows `english`, and checks it against `key` in the text files. Values fill the key's
 * {{placeholders}}, e.g. shadow("people:replies.within", `Usually replies within ${n} working
 * days`, { count: n }).
 */
export function shadow(key: TextKey, english: string, values?: Record<string, unknown>): string {
  if (!shadowOn()) return english;
  check(key, english, (lng) => t(key, { ...values, lng }), exists(key, values));
  return english;
}

const t = (key: string, options: Record<string, unknown>) =>
  (i18n.t as unknown as (key: string, options: Record<string, unknown>) => string)(key, options);
const exists = (key: string, values?: Record<string, unknown>) =>
  i18n.exists(key as never, { ...values, lng: FALLBACK } as never);

/** Like shadow(), for a sentence with tags (<b>…</b>): compares the text without the tags. */
export function shadowTrans(key: TextKey, englishText: string, values?: Record<string, unknown>) {
  if (!shadowOn()) return;
  check(key, englishText, (lng) => stripTags(t(key, { ...values, lng })), exists(key, values));
}

/** Shows `english`, and checks it against a value worked out another way (a format helper). */
export function shadowValue(id: string, english: string, translated: (lng: string) => string): string {
  if (!shadowOn()) return english;
  check(id, english, translated);
  return english;
}

/** Every key checked so far, worst result first. */
export function report(): Row[] {
  const order: Record<Status, number> = { error: 0, missing: 1, mismatch: 2, match: 3 };
  return [...rows.values()].sort((a, b) => order[a.status] - order[b.status] || a.key.localeCompare(b.key));
}

/** For tests: forget everything checked so far. */
export function resetShadow() {
  rows.clear();
  logged.clear();
  on = undefined;
  throws = underTest;
}

/**
 * Called once at start-up: reads ?i18n=shadow / ?i18n=off, and puts window.jatI18n in the
 * console (report(), on(), off()) whether or not it's on.
 */
export function installShadow(search: string = window.location.search) {
  const asked = new URLSearchParams(search).get("i18n");
  if (asked === "shadow") setShadow(true);
  if (asked === "off") setShadow(false);
  const api = {
    report: () => {
      const all = report();
      console.table(
        all.map(({ key, status, english, translation, shown, checks }) => ({
          key,
          status,
          english,
          translation,
          shown,
          checks,
        })),
      );
      return all;
    },
    on: () => setShadow(true),
    off: () => setShadow(false),
  };
  (window as unknown as { jatI18n: typeof api }).jatI18n = api;
  if (shadowOn())
    console.info(
      "[i18n shadow] on: checking text against the translation files. window.jatI18n.report() for a table; ?i18n=off to stop.",
    );
}
