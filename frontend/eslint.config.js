import js from "@eslint/js";
import i18next from "eslint-plugin-i18next";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

// Files whose text has moved to the translation files (docs/rfc/i18n.md §15). Each area's PR
// adds its files here, so hard-coded English can't creep back in; i18n-finish turns it on
// everywhere.
const TRANSLATED = [
  "src/api/notifyError.ts",
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
  // i18n-applications
  "src/pages/ApplicationsPage.tsx",
  "src/pages/ApplicationPage.tsx",
  "src/components/ApplicationDrawer.tsx",
  "src/components/Board.tsx",
  "src/components/NewApplicationModal.tsx",
  "src/components/SentDocuments.tsx",
  "src/components/StageBadge.tsx",
  // i18n-roles
  "src/components/Roles.tsx",
  "src/pages/RolesPage.tsx",
  "src/pages/RolePage.tsx",
  // i18n-people
  "src/pages/RecruitersPage.tsx",
  "src/pages/PersonPage.tsx",
  "src/pages/CompaniesPage.tsx",
  "src/pages/CompanyPage.tsx",
  "src/pages/AgencyPage.tsx",
  "src/components/ContactFormModal.tsx",
  "src/components/ContactCard.tsx",
  "src/components/MergePerson.tsx",
  "src/components/TimelineButton.tsx",
  // i18n-interviews
  "src/pages/InterviewsPage.tsx",
  "src/components/Interviews.tsx",
  "src/components/InterviewFormModal.tsx",
  "src/components/Reschedule.tsx",
  // i18n-calls
  "src/components/Meetings.tsx",
  // i18n-offers
  "src/pages/OffersPage.tsx",
  "src/components/Offers.tsx",
  // i18n-documents
  "src/pages/DocumentsPage.tsx",
  "src/components/CvFiles.tsx",
  // i18n-attachments-links
  "src/components/Attachments.tsx",
  "src/components/Links.tsx",
  // i18n-notes-search
  "src/pages/NotesPage.tsx",
  "src/pages/SearchPage.tsx",
  "src/components/Notes.tsx",
  "src/components/NoteEditorModal.tsx",
  // i18n-insights-tabs
  "src/pages/InsightsPage.tsx",
  "src/components/InsightStats.tsx",
  "src/components/Scorecard.tsx",
  "src/components/WholePicture.tsx",
  // i18n-insights-reviews
  "src/components/Conversations.tsx",
  "src/components/DocumentPerformance.tsx",
  // i18n-sankey
  "src/components/SankeyChart.tsx",
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
    // Playwright fixtures call their callback `use`, which isn't React's.
    files: ["e2e/**"],
    rules: { "react-hooks/rules-of-hooks": "off" },
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
