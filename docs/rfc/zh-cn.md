# Simplified Chinese (zh-CN): the plan

Status: in progress. The pilot (`i18n-zh-cn-applications`, the applications strings) merged in #239; every other
task waits for Kai's go (Kai, 2026-11-05: "after that file is translated and gets merged, dont continue after that
until isay").

Simplified Chinese is the first language after English: the language research (`docs/rfc/i18n.md` §13a) ranked it first.
The roadmap tasks are `i18n-zh-cn-*` in phase P8 of `docs/ROADMAP.yaml`.

## Decisions (Kai, 2026-11-05)

- **Code `zh-CN`**, named "简体中文" in the language switch. Browsers set to Traditional Chinese stay on English.
- **AI translation.** No native-speaker review; people can correct it by issue or PR ("i will have AI do the translations,
  people can open an issue/pr if the think something should change").
- **A draft until every file is in** (#237): `zh-CN` sits in `DRAFT_LANGUAGES`, so only a dev server offers it
  (`?lang=zh-CN`), and files not translated yet show in English.
- **No release while it's a draft** ("yes no release while it is draft"): the translation and layout PRs bump no version.
  Switching it on is a minor release.
- **One PR per string file**, translated in context and reviewed per area of the screen by several models (below).
- **Reviewers:** Sonnet and Opus, each separately ("perhaps we can drop haiku"); Opus translates and settles
  disagreements.
- **No screenshots in the translation PRs** ("no screenshots in the PR"). They're taken to translate and review, and stay
  outside the repo. Since 2026-11-09 every PR that changes the UI shows before and after (CLAUDE.md, *Git*); a draft
  language's translation PRs are the exception, as only a dev server shows them. Switching a language on is a UI change
  and gets the table.
- **Layout: English stays as it is, with as little language-specific CSS as possible** (Kai, 2026-11-09: "im not
  expecting any changes to english language version. if there are some needed then wait for my approval firtst";
  "ideally we want to reduce the language-specific css as much as possible … balacne between langauge-specific css and
  making english chagnes too"). Fixes that work for every language without changing English come first (fonts last in
  the list, `word-break: keep-all` on short labels, date patterns per language); a fix that changes English waits for
  Kai's yes. Kai chose: no forced capitals in Chinese (`:lang(zh)` in `text.module.css`, the one language-specific rule),
  and the date boxes one per line on phones in every language.
- **This replaces `docs/rfc/i18n.md` §14 for Chinese** where they differ: there are Chinese screenshots (not English
  only), and the website only says the app comes in several languages (no translated site for now).
- **Which browsers get it:** only those asking for `zh-CN`. Plain `zh` or `zh-Hans` doesn't match yet; whether it should is
  decided in `i18n-zh-cn-switch-on`.
- **No saved context pack.** A saved list of where each key is used would go stale as the code changes, so each run looks
  up the context fresh from the code it's translating.
- "Coming soon!" in the language menu becomes "More coming soon". Search is left as it is (`i18n-search` comes later).
- **Promotion:** the main README shows Chinese near the top (a language line under the title), the GitHub description
  carries Chinese so it shows in search results, and the README makes it clear the app itself is translated, not just the
  README, without putting it in the hero.

## How each translation PR runs

One Workflow per string file, `locales/en/<file>.ts` → `locales/zh-CN/<file>.json`. The scripts and workflows that do
it are in the repo, for any language: `scripts/i18n/translate/README.md` has the commands (Kai, 2026-11-05: "feel free
to put the helper scripts in the repo and to ipdate docs about them").

1. **Areas.** Split the file's keys into areas a reader would recognise on screen ("board columns", "the application card
   on the board", "New application"), usually by the file's top-level groups.
2. **Context, fresh.** For each area: the English with its comments, every place in the code that uses each key (with
   the code around it), and English screenshots of where it shows, taken on demo data from the branch.
3. **Translate**, one Opus agent per area, following the glossary (`docs/i18n/zh-CN.md`) and the files already merged.
   New key terms go into the glossary.
4. **Consistency pass:** one agent reads the whole file for terms and tone that differ between areas.
5. **Checks:** the catalog test (every key and placeholder intact, the plural forms, no `[TRANSLATE]` left; it doesn't
   check tags like `<b>`, so the translation workflow and the reviewers do); then the same pages are
   screenshotted in `?lang=zh-CN`, at desktop width and 375 px.
6. **Text review, per area:** Sonnet and Opus each review the area separately, with the same context and screenshots, and
   report `must_fix`, `should_fix` or `nit` per string with a suggestion.
7. **Review in place, per screenshot:** Sonnet and Opus each look for clipped or badly wrapped text, and words that read
   wrong where they sit.
8. **Judge, per area (Opus):** findings both models agree on stand; where they differ, the judge decides and says why. The
   PR body lists every disagreement and how it was settled.
9. Apply the fixes, then re-review only the strings that changed, until no `must_fix` is left.
10. A code reviewer checks the non-text changes; the full checks run; then merge (no release while a draft).

The PR body also reports the agents used and the tokens spent, so the cost of each file is visible.

## The PRs, in order

| # | Task | What |
|---|------|------|
| 1 | `i18n-zh-cn-applications` | Pilot: `applications` (190 strings). Registers the draft (loaded on a dev server only), starts the glossary, and adds Chinese dates and numbers (`dayjs/locale/zh-cn`, a `PATTERNS` row like `YYYY[年]M[月]D[日]`, `NUMBER_LOCALE`). Kai checks the process and token use before anything else starts. |
| 2–17 | `i18n-zh-cn-<file>` | One per remaining file, smallest first (Kai, 2026-11-05: "order them by string count asc"): stages (11), files (27), todos (31), calls (54), documents (75), notes (78), events (81), offers (91), common (94), timeline (103), interviews (136), roles (139), today (152), people (213), errors (269), insights (327). |
| 18 | `i18n-zh-cn-layout` | System CJK fonts (PingFang SC, Microsoft YaHei, Noto Sans CJK SC) and clipped labels, checked on every page at desktop width and 375 px. |
| 19 | `i18n-zh-cn-switch-on` | Minor release. `LANGUAGES` and `LANGUAGE_NAMES`; load it in production builds too (drop the dev-only gate in `i18n/index.ts`); "More coming soon", a browser test that finds no English left. README: a "Use it in your language" feature row and a Languages section with the open language menu; guide, `llms.txt`, changelog. |
| 20 | `i18n-zh-cn-demo-data` | `seed_demo.py --lang zh-CN`: made-up Chinese companies, people and notes, so Chinese screenshots look like real use (to confirm with Kai). |
| 21 | `i18n-zh-cn-screenshots` | The README screenshots and `demo.gif` in Chinese under `docs/screenshots/zh-CN/`; shown to Kai before they go in. |
| 22 | `i18n-zh-cn-readme` | `README.zh-CN.md` with the Chinese images, reviewed the same way; the main README gets `English · 简体中文` under its title. |
| 23 | `i18n-zh-cn-website` | The website says the app comes in several languages (Features, FAQ) (to confirm with Kai). |
| 24 | `i18n-zh-cn-listing` | Not a PR: the GitHub description with Chinese in it (e.g. "… in English and 简体中文 · 开源求职申请追踪器"), and perhaps the topics `chinese` and `multilingual` in place of two others. Kai approves the exact text first. |
