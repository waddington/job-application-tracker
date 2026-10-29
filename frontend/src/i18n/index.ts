// The translation layer (docs/rfc/i18n.md). English is bundled and is the fallback for any
// key another language lacks; the frontend does all translating, and the backend only sends
// codes and ids next to its English (§4).
//
// Not used by the app yet: the setup PR (i18n-setup) only builds and tests it. Components will
// call `useTranslation("<namespace>")` and `t("key", values)`; code outside components uses
// `i18n.t("<namespace>:key")`.

import { createInstance, type i18n as I18n, type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en";
import { FALLBACK, PSEUDO, pickLanguage, storedLanguage } from "./language";
import { pseudoTree } from "./pseudo";

export const DEFAULT_NS = "common";

/** Thrown when text has a {{placeholder}} the call gave no value for. */
export class MissingValueError extends Error {
  constructor(placeholder: string, text: string) {
    super(`No value for {{${placeholder}}} in "${text}"`);
    this.name = "MissingValueError";
  }
}

export interface Options {
  lng: string;
  /** Every language's text; English is added when missing. Tests pass their own. */
  resources?: Resource;
  /**
   * Throw on a placeholder with no value (tests and dev), instead of showing the raw
   * "{{name}}". The types catch a misspelt value name but not a call with no values at all
   * (docs/rfc/i18n.md §3a), so this covers the rest.
   */
  strict?: boolean;
}

export function createI18n({ lng, resources, strict = false }: Options): I18n {
  const all: Resource = { en, ...resources };
  if (lng === PSEUDO) all[PSEUDO] = pseudoTree(all.en as Parameters<typeof pseudoTree>[0]);
  const instance = createInstance();
  instance.use(initReactI18next).init({
    lng,
    fallbackLng: FALLBACK,
    resources: all,
    ns: Object.keys(all.en ?? {}),
    defaultNS: DEFAULT_NS,
    initAsync: false, // resources are in memory, so t() works as soon as this returns
    returnNull: false,
    returnEmptyString: false,
    interpolation: { escapeValue: false }, // React escapes text it renders
    missingInterpolationHandler: strict
      ? (text: string, match: RegExpExecArray | string[]) => {
          throw new MissingValueError(String(match[1] ?? "").trim(), text);
        }
      : undefined,
  });
  return instance;
}

const env = import.meta.env;

/** The app's instance: the language from the URL (dev), this browser's choice, or the browser. */
export const i18n = createI18n({
  lng:
    typeof window === "undefined"
      ? FALLBACK
      : pickLanguage({
          search: window.location.search,
          stored: storedLanguage(),
          browser: navigator.languages ?? [navigator.language],
          dev: env.DEV,
        }),
  strict: env.DEV || env.MODE === "test",
});
