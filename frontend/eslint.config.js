import js from "@eslint/js";
import i18next from "eslint-plugin-i18next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

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
    // Playwright fixtures call their callback `use`, which isn't React's.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // Every source file: all UI text comes from the translation files (docs/rfc/i18n.md §15).
    // Tests look for that text, in English, so they're the exception.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/**/*.test.{ts,tsx}", "src/test/**"],
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
