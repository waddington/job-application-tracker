// Which language to show (docs/rfc/i18n.md §6): a choice saved in this browser, else the
// browser's own languages, else English. In dev, ?lang= overrides both, including the
// pseudo-language. There's no switch in the UI until a second language ships.

/** Languages the app ships. Add one here when its translation is reviewed. */
export const LANGUAGES = ["en"] as const;
export type Language = (typeof LANGUAGES)[number];
export const FALLBACK: Language = "en";
/**
 * Dev-only: accented, longer text that shows any string the translation layer missed.
 * Registered as en-XA, the standard pseudo-locale, so plurals follow English rules: an
 * unknown tag like "pseudo" makes Intl.PluralRules use the machine's own locale, and a
 * Polish browser would then look for "few" forms pseudo doesn't have.
 */
export const PSEUDO = "en-XA";
/** What you type in the URL for it: ?lang=pseudo. */
export const PSEUDO_ALIAS = "pseudo";
export const STORAGE_KEY = "jat.language";

const shipped = (code: string | null | undefined): Language | undefined => {
  if (!code) return undefined;
  const lower = code.toLowerCase();
  // "en-GB" → "en"; an exact match ("zh-cn") wins over its prefix ("zh").
  return (
    LANGUAGES.find((lang) => lang.toLowerCase() === lower) ??
    LANGUAGES.find((lang) => lang.toLowerCase() === lower.split("-")[0])
  );
};

export interface LanguageSources {
  /** location.search, e.g. "?lang=pseudo". Only read when `dev`. */
  search?: string;
  /** The saved choice (localStorage `jat.language`). */
  stored?: string | null;
  /** navigator.languages, most preferred first. */
  browser?: readonly string[];
  dev?: boolean;
}

export function pickLanguage({ search = "", stored, browser = [], dev = false }: LanguageSources): string {
  if (dev) {
    const asked = new URLSearchParams(search).get("lang");
    if (asked === PSEUDO_ALIAS || asked === PSEUDO) return PSEUDO;
    const fromUrl = shipped(asked);
    if (fromUrl) return fromUrl;
  }
  return shipped(stored) ?? browser.map(shipped).find(Boolean) ?? FALLBACK;
}

/** The saved choice, or null where storage isn't available (private windows, some previews). */
export function storedLanguage(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
