# Adding a language

You know a language the app doesn't speak yet, and you'd like to add it. This guide is for you,
and you don't need to be a developer: most of the work is translating text files, and the rest is
copying a few lines and running some commands. The examples use Polish (code `pl`).

A language goes in once someone who speaks it well has read all of it. A machine translation can
be your first draft, but read every line: a wrong translation is worse than English.

If the set-up below is more than you want to take on,
[open an issue](https://github.com/waddington/job-application-tracker/issues/new?template=feature_request.yml)
and say which language you'd like to translate.

## What gets translated, and what doesn't

Translated: everything the app itself says, including the default stage names (*Applied*,
*Screen*…) and dates.

Not translated:

- **Your own data.** Companies, notes, and stage names someone has renamed or added show as they
  were typed.
- **What the server already wrote or still sends in English.** History saved before now stays in
  English, and a few rare error messages come from the server in English.
- **The guide, the `jat` commands, and the API.** These stay in English.
- **A few small things not done yet.** Search only knows the English words for some things, and
  commas in lists and the percent sign are written the English way.

## 1. Set up

You need [uv](https://docs.astral.sh/uv/) (it brings Python 3.12), Node.js 22.12 or newer,
[pnpm](https://pnpm.io/), git, and Chrome (for the checks in steps 7 and 8). It runs on Linux or
macOS. [Fork the repo](https://github.com/waddington/job-application-tracker/fork) on GitHub, then,
with your own username in place of `your-username`:

```bash
git clone https://github.com/your-username/job-application-tracker.git
cd job-application-tracker
git switch -c add-polish
uv sync
pnpm --dir frontend install
```

Run every command in this guide from that `job-application-tracker` folder.

## 2. Make the files to translate

Pick the language's code: `pl`, `de`, `ja`. Use a region only if it matters: `pt-BR`, `zh-CN`. (The app picks a language by itself only for a
browser set to that region, so `pl` suits anyone set to Polish, but `pt-BR` won't suit `pt-PT`.) Then:

```bash
node --experimental-strip-types scripts/i18n/new_language.mjs pl
```

That writes all the English to `frontend/src/locales/pl/`: one JSON file per area of the app
(`today.json`, `offers.json`, `stages.json` for the default stage names, and so on), and an
`index.ts` that you leave as it is. It won't overwrite a folder that's already there.

Every line starts with `[TRANSLATE]`, so nothing can pass for finished by accident:

```json
"title": "[TRANSLATE] Waiting on them",
```

## 3. Translate

Change the text on the right of each colon, and delete `[TRANSLATE]` as you go. Never change what's
on the left, or the quotes:

```json
"title": "Czekasz na odpowiedź",
```

To see how much is left, and in which files:

```bash
grep -rc '\[TRANSLATE\]' frontend/src/locales/pl
```

Your editor's search across files finds each line.

A few things have to stay exactly as they are, wherever your sentence puts them:

- **`{{name}}`** is filled in by the app. Keep the word inside, and move it where your grammar wants
  it. `"Hello {{name}}"` can become `"{{name}}, cześć"`. The one you may leave out is `{{count}}`, if
  your language says the number in words.
- **`<guide>…</guide>`** marks text that becomes a link or goes bold. Translate what's between the
  tags and keep the tags. No check looks at these, so take care.

To use a `"` inside your text, write `\"`. You'll get the words' context from the English files:
`frontend/src/locales/en/today.ts` is `today.json` with the comments explaining what each line is
for.

## 4. Plural forms

English has two forms for a count, and your language may have more or fewer. Step 2 already wrote
the ones yours uses, so Polish gets four lines where English has two:

```json
"days_few": "[TRANSLATE] {{count}} days",
"days_many": "[TRANSLATE] {{count}} days",
"days_one": "[TRANSLATE] {{count}} day",
"days_other": "[TRANSLATE] {{count}} days",
```

Each becomes the right wording for those numbers:

```json
"days_few": "{{count}} dni",
"days_many": "{{count}} dni",
"days_one": "{{count}} dzień",
"days_other": "{{count}} dnia",
```

A language's forms are often for ranges of numbers (Polish `few` is 2 to 4, 22 to 24…); the
[Unicode plural tables](https://www.unicode.org/cldr/charts/latest/supplemental/language_plural_rules.html)
list them. A language with one form, like Chinese, gets only `_other`.

**One line looks like a plural but isn't:** `holding_other` in `insights.json` ("Still at
{{stage}}"), which has no count. Polish gets `holding_few`, `holding_many`, `holding_one` and
`holding_other`: give them all the same translation.

## 5. Add it to the app

Three small edits, all under `frontend/src/`. You can make them before you've finished translating.
Until all three are done, your language won't show properly.

**`i18n/index.ts`** loads the text. Add the import beside English's, and the `resources` line in
the `createI18n` call at the bottom (the app's own one, with `react: true`):

```ts
import en from "../locales/en";
import pl from "../locales/pl";
```

```ts
  strict: isStrict(env),
  resources: { pl },
  pseudo: env.DEV,
```

A code with a hyphen needs a name without one: `import ptBR from "../locales/pt-BR"`, then
`resources: { "pt-BR": ptBR }`.

**`utils/format.ts`** holds dates and numbers. Import the calendar's month and day names under the
`dayjs` import. [The list of names is here](https://github.com/iamkun/dayjs/tree/dev/src/locale),
and they're lower case (`pt-br`):

```ts
import dayjs, { type ConfigType } from "dayjs";
import "dayjs/locale/pl";
```

Add a row to `PATTERNS`, with one line for each English one, in the order your language writes a
date. `D` is the day, `MMM` a short month, `MMMM` a long one, `ddd` and `dddd` the weekday, `YYYY`
the year, `HH:mm` the time. Words of your own go in square brackets: `YYYY[年]M[月]D[日]`. Then add a
row to `NUMBER_LOCALE`, which says how numbers are written (`85 000` in Polish). In both, use a
lower-case code (`pt-br`):

```ts
  [
    "pl",
    {
      weekdayDayMonth: "dddd, D MMMM",
      shortWeekdayDayMonth: "ddd, D MMM",
      shortWeekdayDayMonthYear: "ddd, D MMM YYYY",
      dayMonth: "D MMM",
      dayMonthYear: "D MMM YYYY",
      dayMonthYearTime: "D MMM YYYY, HH:mm",
      monthYear: "MMM YYYY",
      dayMonthTime: "D MMM, HH:mm",
      time: "HH:mm",
    },
  ],
```

```ts
const NUMBER_LOCALE = new Map<string, string>([
  ["en", "en-GB"],
  ["pl", "pl-PL"],
]);
```

**`i18n/language.ts`** puts it in the language switch, under its name in its own language. A code
with a hyphen needs quotes (`"pt-BR": "Português (Brasil)"`):

```ts
export const LANGUAGES = ["en", "pl"] as const;
export const LANGUAGE_NAMES: Record<Language, string> = { en: "English", pl: "Polski" };
```

## 6. Try it

Make some made-up data to look at, and run the app in two terminals. These use port 8771, not the
usual 8770: if you already use the app, your own copy may be running on 8770, and this would then
show your real job search and change it as you click around.

```bash
uv run python scripts/seed_demo.py /tmp/jat-demo
uv run jat --data-dir /tmp/jat-demo serve --dev --port 8771
```

```bash
JAT_API_URL=http://127.0.0.1:8771 pnpm --dir frontend dev
```

Open <http://127.0.0.1:5173> and choose your language from the button at the top right, beside
light and dark mode. (Adding `?lang=pl` to the address does the same.) It works however much you've
translated: a line you haven't done shows as it is in the file, like `[TRANSLATE] Today`, so you can
try it as you go and see what's left. Go through every page. Look for sentences that read badly, text that's cut off because it came out longer than the English,
and dates and plurals, with a count of 1 and of more.

`Pseudo-language (dev)` in the same menu shows the English with accents and made longer. Anything
still plain there skipped translation altogether: that's a bug in the app, not your text, so
please mention it in your pull request.

## 7. Run the checks

```bash
pnpm --dir frontend format
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend test
```

Each should finish with no errors. `format` tidies the files, so it may change them.

`test` is the one that looks at your text, and it fails until no `[TRANSLATE]` is left. That's only
this test: the app itself keeps working, as in step 6. It lists every line still to do:

```text
AssertionError: Still to translate: 1. Translate each line below and delete its [TRANSLATE] (search for it in frontend/src/locales/)
+ [
+   "pl/applications.json: title",
+ ]
```

That's the line `"title"` at the top level of `applications.json`. A dot in a name means it's nested:
`view.label` is `"label"` inside `"view"`.

It also fails if a file is missing a line or a plural form, has a line English doesn't, or has lost or
invented a `{{value}}`. That check stops at the first file with a problem, so fix that one and run it
again. Here, three forms of a line in `insights.json` are gone:

```text
    "file": "pl/insights.json",
-   "pluralForms": [],
+   "pluralForms": [
+     {
+       "key": "sankey.nodes.holding",
+       "missing": [
+         "few",
+         "many",
+         "one",
+       ],
+     },
+   ],
```

That says `holding_few`, `holding_many` and `holding_one` are missing from `sankey` → `nodes` in
`insights.json`. Run just this check,
more quickly, with `pnpm --dir frontend exec vitest run src/i18n/catalog.test.ts`.

## 8. The before and after text check

This shows the English didn't change. Stop the two servers from step 6, commit your work, then
record the app's text on `main` and again on your branch:

```bash
git add frontend
git commit -m "feat(i18n): add Polish"
rm -rf /tmp/jat-demo
uv run python scripts/seed_demo.py /tmp/jat-demo

git switch main
pnpm --dir frontend build
uv run jat --data-dir /tmp/jat-demo serve --port 8889
```

In a second terminal:

```bash
uv run --with playwright python scripts/i18n/text_snapshot.py http://127.0.0.1:8889 /tmp/before.json
```

Stop the server with Ctrl+C, and do the same on your branch:

```bash
git switch add-polish
pnpm --dir frontend build
uv run jat --data-dir /tmp/jat-demo serve --port 8889
```

```bash
uv run --with playwright python scripts/i18n/text_snapshot.py http://127.0.0.1:8889 /tmp/after.json
python3 scripts/i18n/text_diff.py /tmp/before.json /tmp/after.json
```

It should end with `0 view parts differ`. (It doesn't open the language menu, so your language's
name there doesn't count.) Anything else means English changed, so look at what it lists. Do it all
on one day, since the demo data is dated to the day it's used.

## 9. Open a pull request

```bash
git push -u origin add-polish
```

GitHub then offers a link to open the pull request. Say which language it is, that you read all of it, how
well you know the language, and what you tried. Screenshots are welcome, of the demo data only:
never your own job search. Don't change version numbers or the changelog; those are done at merge.

Afterwards, when someone adds English text, the same test fails until your language has it too, so
you may be asked for a line now and then.
