// Proves keys and placeholders stay type-checked (docs/rfc/i18n.md §3a). It's never run,
// only type-checked by `pnpm typecheck`: each @ts-expect-error line must be a type error, so
// if checking ever stops working (a version bump, a broken i18next.d.ts), the expectation
// itself becomes the error.

import { Trans, useTranslation } from "react-i18next";

import type { TextKey } from "../locales/en";
import { NAV, NAV_GROUP_KEYS } from "../nav";
import { i18n } from ".";

export function typeChecks() {
  // Right: a key, a nested key, a placeholder, a plural, a namespace prefix.
  i18n.t("selftest:plain");
  i18n.t("selftest:nested.deeper");
  i18n.t("selftest:greeting", { name: "Alex" });
  i18n.t("selftest:days", { count: 3 });

  // @ts-expect-error a key that doesn't exist
  i18n.t("selftest:plian");
  // @ts-expect-error a namespace that doesn't exist
  i18n.t("seltest:plain");
  // @ts-expect-error a key from the wrong namespace (the default is common)
  i18n.t("plain");
  // @ts-expect-error a misspelt placeholder value
  i18n.t("selftest:greeting", { nmae: "Alex" });
}

export function useTypeChecks() {
  const { t } = useTranslation("selftest");
  t("greeting", { name: "Alex" });
  t("days", { count: 1 });
  // @ts-expect-error a key that doesn't exist in this namespace
  t("greting", { name: "Alex" });
  // @ts-expect-error a misspelt placeholder value
  t("greeting", { nam: "Alex" });
}

/** TextKey ("namespace:key", used by shadow mode). */
export function textKeyChecks(): TextKey[] {
  const good: TextKey[] = ["people:replies.within", "common:nav.items.today", "today:groupBadge"];
  // @ts-expect-error a key that doesn't exist
  const unknown: TextKey = "people:replies.nope";
  // @ts-expect-error a plural form instead of its base key
  const form: TextKey = "people:replies.within_one";
  // @ts-expect-error an object, not a string
  const branch: TextKey = "common:nav";
  // @ts-expect-error no namespace
  const bare: TextKey = "replies.within";
  return [...good, unknown, form, branch, bare];
}

/** t() from useTranslation() takes its own namespace's keys bare, never prefixed with it, so
 *  typed maps hold bare keys (nav.ts). */
export function useBareKeyChecks() {
  const { t } = useTranslation();
  const group = NAV_GROUP_KEYS.Review;
  const item = NAV[0]!.labelKey;
  // @ts-expect-error a common key prefixed with its own namespace
  const prefixed = t("common:nav.items.today");
  return [t(group), t(item), t("nav.items.today"), prefixed];
}

export function TransChecks() {
  return (
    <>
      <Trans ns="selftest" i18nKey="linked" components={{ guide: <a href="/guide" /> }} />
      {/* @ts-expect-error a Trans key that doesn't exist */}
      <Trans ns="selftest" i18nKey="linkd" components={{ guide: <a href="/guide" /> }} />
    </>
  );
}
