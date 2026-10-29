import "i18next";

import type en from "./locales/en";

// Checks every t("…") key, its namespace, and the names of its {{placeholders}} against the
// English text (docs/rfc/i18n.md §3a). src/i18n/types.check.ts proves it keeps working.
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "common";
    resources: typeof en;
  }
}
