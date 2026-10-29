import js from "@eslint/js";
import i18next from "eslint-plugin-i18next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Files whose text has moved to the translation files (docs/rfc/i18n.md §15). Each area's PR
// adds its files here, so hard-coded English can't creep back in; i18n-finish turns it on
// everywhere.
const TRANSLATED = [
  "src/components/Layout.tsx",
  "src/components/HeaderSearch.tsx",
  "src/components/ApiStatus.tsx",
  "src/components/DeleteButton.tsx",
  "src/components/EditNameModal.tsx",
  "src/components/CreatableSelect.tsx",
  "src/components/DuplicateWarning.tsx",
  "src/pages/NotFound.tsx",
];

export default tseslint.config(
  { ignores: ["dist", "node_modules", "src/api/schema.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    files: TRANSLATED,
    plugins: { i18next },
    rules: {
      // Text in JSX, and in the props people read or hear, must come from t().
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-only",
          "jsx-attributes": {
            include: ["label", "placeholder", "aria-label", "title", "description", "alt", "error"],
          },
          // Strings these take are names, not text (form fields, namespaces).
          callees: { exclude: ["i18n(ext)?", "t", "require", "getInputProps", "useTranslation"] },
        },
      ],
    },
  },
);
