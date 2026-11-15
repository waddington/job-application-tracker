# Contributing

Thanks for thinking about it. Job Application Tracker is ready and in daily use (version 1.0
and up, following [semantic versioning](https://semver.org/)). Bug reports, ideas and pull
requests all help.

## Ways to help

- **Report a bug.** [Open an issue](https://github.com/waddington/job-application-tracker/issues/new?template=bug_report.yml)
  with what you did, what you expected and what happened. Screenshots help.
- **Suggest a feature.** [Describe the problem](https://github.com/waddington/job-application-tracker/issues/new?template=feature_request.yml)
  it would solve in your own job search, not just the button you'd add.
- **Improve the docs.** The [user guide](docs/guide/README.md) is plain Markdown in
  `docs/guide/`.
- **Add a language.** [Adding a language](docs/guide/adding-a-language.md) takes you through it,
  and you don't need to be a developer.
- **Send a pull request.** For anything bigger than a small fix, open an issue first so we can
  agree on the approach.
- **Star the repo.** It helps other job seekers find it.

## Privacy first

It's a job-search tool, so real people and companies turn up quickly. In issues, tests,
fixtures, screenshots and docs, use made-up data only: fictional companies (Contoso,
Fabrikam, Northwind Talent…), fictional people (Alex Morgan, Riley Chen…) and `example.com`
addresses. Never paste your own data folder into an issue.

Some things the project deliberately doesn't do: scrape job boards or LinkedIn, fetch data
from the web, contact anyone, or send telemetry. Pull requests that add these won't be merged.

## Set up for development

You need Python 3.12 to 3.14 with [uv](https://docs.astral.sh/uv/), Node.js 22.12+ with
[pnpm](https://pnpm.io/), and git. Linux or macOS.

```bash
git clone https://github.com/waddington/job-application-tracker.git
cd job-application-tracker
uv sync
pnpm --dir frontend install
uv run python scripts/seed_demo.py /tmp/jat-demo     # made-up demo data (--lang zh-CN: in Chinese)
```

Run the API with reloading, and the web UI with hot reloading, in two terminals:

```bash
uv run jat --data-dir /tmp/jat-demo serve --dev     # API on http://127.0.0.1:8770
pnpm --dir frontend dev                             # UI on http://127.0.0.1:5173 (proxies /api)
```

## Where things are

| Path | What's there |
|---|---|
| `src/jat/` | The backend: FastAPI app, SQLAlchemy models, Alembic migrations, the `jat` CLI |
| `tests/` | Backend tests (pytest) |
| `frontend/` | The web UI: React, TypeScript, Mantine, TanStack Router and Query |
| `docs/guide/` | The user guide |
| `website/` | The project website: one Astro landing page |
| `scripts/` | Demo data (`seed_demo.py`), the README's demo GIF and the social preview card |
| `docs/prd/`, `docs/rfc/`, `docs/ROADMAP.yaml` | The product plan, design decisions and roadmap |

**Cards and lists that load their own data** go through `QueryState`
(`frontend/src/components/QueryState.tsx`): skeleton lines while the query loads, "Couldn't load
this." with Retry when it fails, and the empty text only for a list that loaded empty. Never default
query data to `[]` (`data ?? []`) before deciding it's empty: a list still loading, or one that
failed, would say there's nothing there. Whole-page loads keep their `Loader`.

**Project dashboard.** `python3 -m tools.pm` (→ http://127.0.0.1:8767) shows the roadmap,
progress and live PR status of the build itself. It needs nothing but Python; the
[`gh` CLI](https://cli.github.com/) adds PR status.

## Checks

Run these before opening a pull request. They must all pass.

```bash
uv run pytest -q
uv run ruff check src tests
uv run ruff format --check src tests
pnpm --dir frontend typecheck
pnpm --dir frontend lint
pnpm --dir frontend test
pnpm --dir frontend format:check
pnpm --dir frontend e2e
```

`tools/dev/checks.sh` runs them all and prints PASS or FAIL for each; `tools/dev/README.md` lists the
other maintainer scripts (merging main, the version bump, merging and releasing).

**When you can skip the browser tests.** `pnpm e2e` tests a production build on the demo data. If
every file you changed is in this list, skip it, run the rest, and say so in the pull request: a
draft language's text (`frontend/src/locales/<code>/` for a language in `DRAFT_LANGUAGES`, which only
a dev server loads, and its glossary `docs/i18n/<code>.md`), `scripts/i18n/`, `scripts/demo_gif/`,
`scripts/social_preview/`, `.claude/workflows/`, `.claude/settings.json`, the maintainer scripts
(`tools/dev/`), Python tests (`tests/`) and docs. Anything else
needs it, including `scripts/seed_demo.py` (the browser tests' demo data), `frontend/e2e/`, any
config or lockfile, `frontend/src/i18n/` (adding a draft or switching one on), and `DRAFT_LANGUAGES`.

**Test runs stay out of your way.** `pnpm test` and `pnpm e2e` use half your CPU threads
(6 where there are 12; each browser-test worker also runs its own app server and Chrome), at the
lowest CPU priority. On Linux they also ask for idle disk priority, which only the BFQ disk
scheduler honours. Only one runs at a time: a second, from any checkout or worktree, waits for
the first and says so (a quick `pnpm test` waits behind a long `pnpm e2e` too). Set
`TEST_WORKERS=3` for fewer workers (or more), or `TEST_LOCK=off` to skip the wait. The wrapper is
`frontend/scripts/test-run.mjs`; running `vitest` or `playwright` yourself keeps the worker limit
but skips the wait and the low priority.

**Browser tests** (`frontend/e2e/`, [Playwright](https://playwright.dev/)) open the real app in
the Chrome on your machine and use it, so they need Chrome installed and nothing downloaded.
`pnpm --dir frontend e2e` builds the frontend, then runs them.
To watch them, build first (`pnpm --dir frontend build`), then run
`pnpm --dir frontend exec playwright test --ui`; add a file's name to run just that one.

- Each test file gets its own server on fresh demo data (`scripts/seed_demo.py`) in a temp
  folder, and checks that's the server answering before any test runs. Tests in a file share its
  data, so don't rely on an exact count or on what another test left behind.
- Use relative addresses (`page.goto("/roles")`), so a test can only reach that server.
- Each test gets a fresh browser context, with nothing kept in localStorage.
- A console error, an uncaught exception or a failed request fails the test. A test that
  provokes one on purpose says so with `problems.allow(/…/)`.
- Import `test` and `expect` from `./fixtures`, not from Playwright. Find things the way a person
  does: `getByRole`, `getByLabel`, `getByText`.
- Run them before changing a dependency's version, and add to them when you add to the app.

If you change an API route or schema, regenerate the OpenAPI spec and the frontend's types,
and commit both (`tests/test_openapi.py` fails if they drift):

```bash
uv run python -m jat.openapi
pnpm --dir frontend gen:api
```

## Text in the UI (translations)

The app comes in English and Simplified Chinese; the plan is in [`docs/rfc/i18n.md`](docs/rfc/i18n.md)
and [`docs/rfc/zh-cn.md`](docs/rfc/zh-cn.md). The UI's own text goes through the translation layer. Events
saved before their message existed, and your own words, stay as saved. A server error shows the text
for its code, and a 422's problems are worded from Pydantic's `type` and `ctx`
(`api/validationText.ts`). A problem whose `type` has no text there shows Pydantic's English.

A stage's name always goes through `stageName({ id, name })` (`utils/stageName.ts`) when it's shown: a
default stage shows translated, a renamed or added one as written. It's for showing only: logic,
sorting, saves and the API use the id, or the name as the API sent it. A new default stage in
`domain/workflow.py` also goes in `locales/defaultStages.json`, `locales/en/stages.ts` and `STAGE_TEXT`:
a test and the type check fail until it does.

- **English lives in `frontend/src/locales/en/<namespace>.ts`**, one file per area, as a
  nested object with `as const`. Name keys for what the text is for (`waiting.title`), not
  what it says. Put a comment beside any wording that was chosen on purpose.
- **In a component:**
  ```tsx
  const { t } = useTranslation("today");
  t("waiting.title");
  t("waiting.usuallyReplies", { count: days }); // with usuallyReplies_one / _other keys
  ```
  **Outside a component:** `i18n.t("today:waiting.title")` from `src/i18n`.
  **Text from another namespace too:** `useTranslation(["todos", "common"])`, then
  `t("common:actions.cancel")`. A `t()` from `useTranslation("todos")` refuses another
  namespace's keys, and its own namespace's keys with a prefix.
- **Text the app saves** (an event's summary, a stage move's note) stays English: it's what's
  exported and searched. Everything the app words itself also saves a message, with `svc.log_message`, or
  `svc.message` where the event isn't logged activity. A new message needs its key in `EventMsg`
  (`api/schemas.py`), its text in `locales/en/events.ts` and `eventText.ts`, and a case in
  `eventMessages.cases.json`. The frontend never sends a key: for English it wants saved, it names an allowed
  `app_text` or `app_note` in the query, and the server holds the words and the key.
- **Every language the app ships gets the change too,** in the same pull request: a new or changed English
  line needs its Chinese line in `locales/zh-CN/<namespace>.json`, translated for where it shows and following
  the glossary (`docs/i18n/zh-CN.md`). Can't write Chinese? Leave it and say so in the pull request: the
  catalog test lists the missing keys, and the maintainer adds them before merging. The Chinese is
  AI-translated, so corrections by issue or pull request are welcome.
- **Values** go in `{{placeholders}}`, never glued on with `+` or a template string, so a
  translation can put them anywhere in the sentence.
- **Plurals** are `_one` / `_other` keys used with `count`, never `n === 1 ? … : …`. So no
  other key may end in `_one`, `_other`, `_few` and the like. A second count in the same sentence
  gets its own plural key, nested with its count:
  `"Of {{count}} booked rounds, $t(insights:rescheduling.movedRounds, {\"count\": {{moved}} })."`
  (always `ns:key`, so the unused-key check sees it).
- **One whole sentence per state,** not pieces joined with a translated separator: a move's line has a
  key for each mix of who and reason, so a translation can put the reason first.
- **Markup inside a sentence** uses `<Trans>` with named tags: `"Read <guide>the guide</guide>"`
  plus `components={{ guide: <a href="…" /> }}`. Don't name a tag after an HTML element that
  can't hold text (`link`, `img`, `br`, `input`, `meta`): it renders empty.
- **Dates, numbers and money** go through `src/utils/format.ts`
  (`formatDay(at, "dayMonth", lang)`, `formatNumber`, `formatMoney`), not a fixed
  `dayjs().format()` or `toLocale*String()`. Dates sent to the API stay `YYYY-MM-DD`.
  - English dates are British, whatever the browser's locale: "31 Oct 2026",
    "30 Oct 2026, 19:25" (24-hour). Every date uses one of the dayjs patterns there, so a month
    is spelled one way everywhere ("Sep", never Intl's "Sept").
  - `utils/time.ts` `formatDate` and `formatDateTime` go through it too.
  - Date inputs and pickers get their `valueFormat` ("D MMM YYYY", "D MMM YYYY HH:mm") from
    `theme.ts`, so don't pass one.
- **Lists the app builds** (a round's interviewers, a role's files) go through `joinList` in
  `src/utils/list.ts`, which uses the language's separator (`common:listSeparator`: ", " in English,
  "、" in Chinese), never `.join(", ")`, which the `no-restricted-syntax` lint rule refuses. Whole
  sentences shown one after another go through `joinSentences` there (`common:twoSentences`: a space
  in English, none after 。 in Chinese), not a `{" "}` or a leading space in a template literal.
- **Ids instead of keys built at run time.** Map an id to a key with a typed object rather
  than `` t(`stages.${id}`) ``, which the type check can't follow. Write the map's keys the
  way that file's `t()` takes them, bare for its own namespace (`"nav.items.today"`, typed
  like `` `nav.items.${keyof …}` ``): `t()` refuses `"common:nav.items.today"` when `common`
  is its own namespace. The unused-key test counts any dotted string in a file as a key of
  that file's namespaces. Don't use `keyPrefix`.
- **Hard-coded text is a lint error** in every source file except tests. The rule
  (`i18next/no-literal-string` in `frontend/eslint.config.js`) checks text and template strings in
  JSX, and the props people read or hear (`label`, `*Label`, `placeholder`, `aria-label`, `title`,
  `description`, `error`, `hint`, `empty`, `confirm`…). A second rule (`no-restricted-syntax`) catches
  a plain string in an object's `message`, `title`, `label`, `description`, `placeholder` or `error`,
  such as a toast's or a dropdown option's. It skips translation keys, the locale files and `nav.ts`.
  Neither catches a JSX prop not listed (`tooltip=`, `message=`), a string held in a variable or
  constant (`{ label }`, `message: SOME_TEXT`), a property with another name, or a word in capitals.
  Those are yours to catch: the pseudo-language shows them.
  Strings in plain code, like a form's error messages, still need care. A prop that carries
  prose and isn't on the list goes on it.
- **Adding an error code,** for an error people can see (the backend never translates):
  1. add the code to `ErrorCode` in `src/jat/api/errors.py`, with underscores and no ending like a
     plural form (`_one`, `_other`);
  2. add its line to `codes` in `frontend/src/locales/en/errors.ts`, with values as `{{placeholders}}`;
     a code with a `count` also goes in `PluralCode` there, with `_one` and `_other` lines;
  3. raise it, with `detail` the same English as before and the values as params:
     `raise CodedError(409, f"{name} is taken", "company_name_taken", {"name": name})`. Write params
     as a dict there, and don't name one after an i18next option (`lng`, `ns`, `context`…): a test
     checks both;
  4. run `uv run python -m jat.openapi` and `pnpm --dir frontend gen:api`, and add its row to `TEXT`
     in `components/ErrorsText.test.tsx`.

  The type check fails if a code has no text or no row, or text has no code. Every route under
  `/api/v1` already declares `ErrorOut`, so a route needs nothing. A new plain `HTTPException` in
  `src/jat/api` fails `tests/test_validation_text.py`: give it a code, or if nobody can meet it, add it
  to `PLAIN_ALLOWED` there and say why. A check in a schema raises `check_failed` with its own name, with
  its `check_<name>` line in `validation` in `errors.ts` and a case in
  `api/validationIssues.cases.json`; a new request field gets a line in `fields`. A domain exception that carries a code (`WorkflowError`, `SnapshotError`…)
  takes it at the raise, and goes in `CODED_EXCEPTIONS` in `tests/test_error_codes.py`. Something
  not found gets its code from `NOT_FOUND` or `REQUIRED_NOT_FOUND` in `api/deps.py`.
- **Adding a language:** the steps are in [the guide](docs/guide/adding-a-language.md), and the
  language switch links to it. If you change one of the files or checks it names, change it too.
- **Your data is never translated:** stage names, companies, notes and the like show as they
  were typed.

`pnpm --dir frontend typecheck` checks every key, its namespace and its placeholder names.
`pnpm --dir frontend test` also:
- fails on English keys nothing uses;
- fails on a placeholder with no value, or a key with no text, in any call the tests run;
- fails if another language is missing a key, a namespace or a plural form it needs (Polish
  needs one, few, many and other), has keys English doesn't, or drops a placeholder.

`src/i18n/types.check.tsx` proves the type checking still works. In `pnpm dev`, `?lang=pseudo`
shows every string accented and longer, so any text that skipped the layer stands out.

**Proving a cutover changed nothing.** `scripts/i18n/text_snapshot.py` records every page's
visible text and its `aria-label`, `title`, `placeholder` and `alt`. It also records a few
dialogs and menus it opens and closes again; it never saves anything. Take one on main and one
on the branch, against the same demo data, then compare them with `scripts/i18n/text_diff.py`.
It must print `0 view parts differ`. The script's docstring has the steps. Pin anything it can't
reach (a dialog the demo data doesn't have) in a test.

## The website

The site at <https://waddington.github.io/job-application-tracker/> lives in `website/`: one
landing page that links to the guide here on GitHub. Its pictures of the app are light-mode captures of
the demo data in `website/src/assets/` (`hero/`, `demo/` and `story/`); retake them when the app's look
changes. Only ever capture the made-up demo data, never a real tracker:

```bash
uv run python scripts/seed_demo.py /tmp/jat-shots      # a new or empty folder
uv run jat --data-dir /tmp/jat-shots serve --port 8894 # any free port but 8770
uv run --with playwright python tools/dev/shot.py http://127.0.0.1:8894 /tmp/shots/ \
  /@light "/applications?view=board@light" /insights@light /recruiters@light /interviews@light \
  /offers@light /notes@light
```

`shot.py` captures at 1440 × 900 (add `@full` for a whole page, as Today and a role's page need for the
hero's scrolling demo). Copy each capture over the file of the same page in `website/src/assets/`, keeping
its name; the 简体中文 Today in `hero/` is the same with the browser set to Chinese.

```bash
pnpm --dir website install
pnpm --dir website dev       # http://localhost:4321/job-application-tracker/, hot reloading
pnpm --dir website build     # the static site in website/dist
pnpm --dir website preview   # serve that build locally
```

Colours, type and the glass come from the tokens in `website/src/styles/site.css`; the page's design
is in [docs/rfc/website-redesign.md](docs/rfc/website-redesign.md).

## Pull requests

- One logical change per pull request, with tests for new behaviour.
- [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
  (`feat: …`, `fix: …`, `docs: …`).
- Update the docs in the same pull request: the [user guide](docs/guide/README.md) for
  anything a user can see or configure, the README's feature table and `llms.txt` for new
  features, and `CHANGELOG.md`.
- If the change is visible in a README screenshot, retake it with the demo data.
- `README.zh-CN.md` mirrors `README.md`: change both the same way, with the same sections and images (the
  Chinese screenshots are in `docs/screenshots/zh-CN/`; `uv run pytest tests/test_readme_parity.py` checks).
  If you can't write Chinese, change the English only and say so; the maintainer updates the Chinese before
  merging. The [user guide](docs/guide/README.md) is English only.

By contributing, you agree that your contributions are licensed under the
[Apache-2.0 licence](LICENSE).
