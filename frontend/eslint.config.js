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
  "src/components/HeaderButtons.tsx",
  "src/components/CreatableSelect.tsx",
  "src/components/DuplicateWarning.tsx",
  "src/pages/NotFound.tsx",
  // i18n-today
  "src/pages/TodayPage.tsx",
  "src/components/Todos.tsx",
  "src/components/Waiting.tsx",
  "src/components/ChaseActions.tsx",
  "src/components/PersonChase.tsx",
  "src/components/ReplyHabit.tsx",
  "src/components/GhostMark.tsx",
  "src/components/OutcomeNotes.tsx",
  "src/components/HowItWorks.tsx",
  "src/components/AtAGlance.tsx",
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
            include: [
              "label",
              ".*Label",
              "placeholder",
              "aria-label",
              "aria-description",
              "aria-valuetext",
              "title",
              "subtitle",
              "description",
              "alt",
              "error",
              "hint",
              "empty",
              "confirm",
              "nothingFoundMessage",
            ],
          },
          // Text with no letters in it (● · — and numbers) isn't language, nor are ids in
          // capitals (the plugin anchors each to the whole string). This replaces the plugin's
          // own list.
          words: { exclude: ["[^A-Za-z]*", "[A-Z_-]+"] },
          // Template strings in JSX too: `Delete ${name}` is text.
          "should-validate-template": true,
          // Strings these take are names, not text: the plugin's defaults, form fields and
          // namespaces.
          callees: {
            exclude: [
              "i18n(ext)?",
              "t",
              "require",
              "addEventListener",
              "removeEventListener",
              "postMessage",
              "getElementById",
              "dispatch",
              "commit",
              "includes",
              "indexOf",
              "endsWith",
              "startsWith",
              "getInputProps",
              "useTranslation",
              // utils/format.ts: their strings are pattern names ("dayMonth").
              "formatDay",
            ],
          },
        },
      ],
    },
  },
);
