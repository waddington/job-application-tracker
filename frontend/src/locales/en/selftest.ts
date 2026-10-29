// Only for the i18n self-tests (src/i18n/*.test.tsx and types.check.tsx), which prove keys,
// placeholders and plurals are type-checked and work. Never shown in the app, never translated.
export default {
  plain: "Hello",
  nested: { deeper: "Nested text" },
  greeting: "Hello {{name}}",
  days_one: "{{count}} day",
  days_other: "{{count}} days",
  linked: "Read <guide>the guide</guide> first",
} as const;
