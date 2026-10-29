// The translation layer (docs/rfc/i18n.md). English is bundled and is the fallback for any
// key another language lacks; the frontend does all translating, and the backend only sends
// codes and ids next to its English (§4).
//
// Loaded at start-up (main.tsx, and the test setup). Converted areas call
// `useTranslation("<namespace>")` and `t("key", values)`; code outside components uses
// `i18n.t("<namespace>:key")`. The rest still show their own English until they're cut over
// (CONTRIBUTING.md "Text in the UI").

import { createInstance, type i18n as I18n, type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../locales/en";
import { FALLBACK, PSEUDO, pickLanguage, storedLanguage } from "./language";
import { pseudoTree } from "./pseudo";

export const DEFAULT_NS = "common";

/** Thrown in strict mode when text has a {{placeholder}} the call gave no value for. */
export class MissingValueError extends Error {
  constructor(placeholder: string) {
    // Only the placeholder's name: the text may already hold other values (your data).
    super(`No value for {{${placeholder}}}`);
    this.name = "MissingValueError";
  }
}

/** Thrown in strict mode for a key no language has (a cast, or a plural called without count). */
export class MissingKeyError extends Error {
  constructor(key: string) {
    super(`No text for key "${key}"`);
    this.name = "MissingKeyError";
  }
}

export interface Options {
  lng: string;
  /** Every language's text; English is added when missing. Tests pass their own. */
  resources?: Resource;
  /**
   * Throw on a placeholder with no value or a key with no text (tests and dev), instead of
   * showing the raw "{{name}}" or key. The types catch a misspelt value name but not a call
   * with no values at all (docs/rfc/i18n.md §3a), so this covers the rest.
   */
  strict?: boolean;
  /** Also build the pseudo-language, so changeLanguage(PSEUDO) works later. Always when lng is it. */
  pseudo?: boolean;
  /**
   * Make this react-i18next's default instance, for useTranslation() without a provider. Only
   * the app's own instance does: a test's fixture instance must never replace it.
   */
  react?: boolean;
}

export function createI18n({ lng, resources, strict = false, pseudo = false, react = false }: Options): I18n {
  const all: Resource = { en, ...resources };
  if (pseudo || lng === PSEUDO) all[PSEUDO] = pseudoTree(all.en as Parameters<typeof pseudoTree>[0]);
  const instance = createInstance();
  if (react) instance.use(initReactI18next);
  instance.init({
    lng,
    fallbackLng: FALLBACK,
    resources: all,
    ns: Object.keys(all.en ?? {}),
    defaultNS: DEFAULT_NS,
    initAsync: false, // resources are in memory, so t() works as soon as this returns
    returnEmptyString: false,
    interpolation: { escapeValue: false }, // React escapes text it renders
    ...(strict && {
      missingInterpolationHandler: (_text: string, match: RegExpExecArray | string[]) => {
        // match[1] is what's inside the braces, format included: " amount, number".
        throw new MissingValueError(
          String(match[1] ?? "")
            .split(",")[0]!
            .trim(),
        );
      },
      parseMissingKeyHandler: (key: string) => {
        throw new MissingKeyError(key);
      },
    }),
  });
  return instance;
}

/** Dev servers and tests are strict; a production build never throws over text. */
export const isStrict = (env: { DEV?: boolean; MODE?: string }) => Boolean(env.DEV) || env.MODE === "test";

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
  strict: isStrict(env),
  pseudo: env.DEV,
  react: true,
});
