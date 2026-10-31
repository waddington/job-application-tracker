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

You need Python 3.12+ with [uv](https://docs.astral.sh/uv/), Node.js 22.12+ with
[pnpm](https://pnpm.io/), and git. Linux or macOS.

```bash
git clone https://github.com/waddington/job-application-tracker.git
cd job-application-tracker
uv sync
pnpm --dir frontend install
uv run python scripts/seed_demo.py /tmp/jat-demo     # made-up demo data
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

The app is being made translatable, English only for now; the plan and its order are in
[`docs/rfc/i18n.md`](docs/rfc/i18n.md). Pages move over area by area. So far:
- the app's frame (header, menu, footer, Not found, shared buttons and dialogs);
- Today, with its to-dos, the reply and chase buttons, How did it go?, At a glance and How it
  works;
- Applications: the list and board, the quick view, the application page and New application;
- Roles: the Roles page, a role's page, the role form, Apply / Interested / Pass and role lines;
- People and companies: Recruiters, a person's page and form, Merge, companies and agencies;
- Interviews: the Interviews page, rounds on an application, the round form and Reschedule;
- Calls: the calls card on a person's page, the call form, Happened and a call's line;
- Offers: the Offers page, the Offer card on an application and the offer form;
- Documents: the Documents page and the CV files card;
- Files and links: the Files and Links cards;
- Notes and search: notes, the note editor, the Notes page and the search results page;
- Insights: the page, stage and route tables, the scorecard, weekly activity, The whole picture,
  Recruiter conversations, CVs and cover letters and the Sankey;
- Timeline: the page's own text, filters, kinds of thing and lanes, and entries' titles and details, also
  in Today's recent list (only events saved before their message existed, and your own words, stay as saved).
- Errors: the shared "That didn't work" toast, and the errors that have a code so far (backup,
  to-dos, applications, people, calls, stage moves, documents, attachments and notes).

The files are listed in `TRANSLATED` in `frontend/eslint.config.js`. Until an area has moved,
keep writing its text as before. Once it has:

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
  `app_text` or `app_note`, and the server holds the words and the key.
- **Values** go in `{{placeholders}}`, never glued on with `+` or a template string, so a
  translation can put them anywhere in the sentence.
- **Plurals** are `_one` / `_other` keys used with `count`, never `n === 1 ? … : …`. So no
  other key may end in `_one`, `_other`, `_few` and the like.
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
- **Ids instead of keys built at run time.** Map an id to a key with a typed object rather
  than `` t(`stages.${id}`) ``, which the type check can't follow. Write the map's keys the
  way that file's `t()` takes them, bare for its own namespace (`"nav.items.today"`, typed
  like `` `nav.items.${keyof …}` ``): `t()` refuses `"common:nav.items.today"` when `common`
  is its own namespace. The unused-key test counts any dotted string in a file as a key of
  that file's namespaces. Don't use `keyPrefix`.
- **Hard-coded text is a lint error** in files that have moved over: add each converted file
  to `TRANSLATED` in `frontend/eslint.config.js`. The rule (`i18next/no-literal-string`) checks
  text and template strings in JSX, and the props people read or hear (`label`, `*Label`,
  `placeholder`, `aria-label`, `title`, `description`, `error`, `hint`, `empty`, `confirm`…).
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
  `/api/v1` already declares `ErrorOut`, so a route needs nothing. Errors people never see can stay
  plain `HTTPException`s. A domain exception that carries a code (`WorkflowError`, `SnapshotError`…)
  takes it at the raise, and goes in `CODED_EXCEPTIONS` in `tests/test_error_codes.py`. Something
  not found gets its code from `NOT_FOUND` or `REQUIRED_NOT_FOUND` in `api/deps.py`.
- **Adding a language** (once its translation is reviewed; the `multi-language` task does the
  first):
  1. its text in `frontend/src/locales/<code>/`, one JSON file per namespace (the tests
     fail on any missing key or plural form);
  2. register them in the app instance's `resources` (`frontend/src/i18n/index.ts`);
  3. import its dayjs locale, and add its row to `PATTERNS` and `NUMBER_LOCALE` in
     `utils/format.ts`;
  4. add its code to `LANGUAGES` and its own name to `LANGUAGE_NAMES` in
     `frontend/src/i18n/language.ts`. The switch lists it from then on. Do this step last:
     until the others are done, picking it would show English.
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

**Shadow mode** (`src/i18n/shadow.ts`) checks strings before they're cut over, a call at a time;
nothing uses it now.
`shadow("people:replies.within", english, { count })` still shows the hard-coded English, but
it also looks the key up and compares the two.
- **Where it runs:** always in `pnpm dev` (`?i18n=off` pauses it until the next reload). In a
  built app it runs only after you open it once with `?i18n=shadow`, which is remembered in
  that browser until you open `?i18n=off`.
- **What the console shows:**
  - `✓` for each key that matches. These are `console.debug` lines, so turn on Chrome's
    "Verbose" level to see them.
  - `✗` with both texts for a mismatch.
  - `?` for a key with no text, and `!` for a failed lookup.
- **A table:** `window.jatI18n.report()` lists everything, worst first.
- **Under test,** anything but a match throws `ShadowMismatchError`, so every test that renders
  a shadowed string checks it. Pin each new shadow call in a test too, with the inputs the app
  gives it.
- **Other helpers:** `shadowTrans` (sentences with tags) and `shadowValue` (format helpers)
  work the same way.
- **Keys:** shadow keys are typed `"namespace:key"` (`TextKey`), so a typo is a type error.

## The website

The site at <https://waddington.github.io/job-application-tracker/> lives in `website/`: one
landing page that links to the guide here on GitHub. It copies the screenshots from
`docs/screenshots/`, so retaken screenshots show up there too.

```bash
pnpm --dir website install
pnpm --dir website dev       # http://localhost:4321/job-application-tracker/, hot reloading
pnpm --dir website build     # the static site in website/dist
pnpm --dir website preview   # serve that build locally
```

Colours come from palettes in `website/src/styles/landing.css`; the site uses `paper`. In
`pnpm dev` only, a switcher in the bottom-left corner (or `?palette=forest`, `ember`,
`indigo`) previews the others. The built site leaves both out.

## Pull requests

- One logical change per pull request, with tests for new behaviour.
- [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
  (`feat: …`, `fix: …`, `docs: …`).
- Update the docs in the same pull request: the [user guide](docs/guide/README.md) for
  anything a user can see or configure, the README's feature table and `llms.txt` for new
  features, and `CHANGELOG.md`.
- If the change is visible in a README screenshot, retake it with the demo data.

By contributing, you agree that your contributions are licensed under the
[Apache-2.0 licence](LICENSE).
