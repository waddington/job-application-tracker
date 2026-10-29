// Proves keys and placeholders stay type-checked (docs/rfc/i18n.md §3a). It's never run,
// only type-checked by `pnpm typecheck`: each @ts-expect-error line must be a type error, so
// if checking ever stops working (a version bump, a broken i18next.d.ts), the expectation
// itself becomes the error.

import { useTranslation } from "react-i18next";

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
