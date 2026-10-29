// Only for the i18n self-tests (src/i18n/*.test.ts and types.check.ts), which prove keys,
// placeholders and plurals are type-checked and work. Never shown in the app, never translated.
export default {
  plain: "Hello",
  nested: { deeper: "Nested text" },
  greeting: "Hello {{name}}",
  days_one: "{{count}} day",
  days_other: "{{count}} days",
  linked: "Read <link>the guide</link> first",
} as const;
