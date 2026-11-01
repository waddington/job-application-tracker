# Compacting the build session

The long-running Claude Code session that builds this repo compacts its context now and then.
This file says what the summary must keep, what it can drop, where to find what it dropped,
and how to carry on afterwards, so the work continues as if nothing happened.

**How to use it:** run `/compact` followed by everything under [The prompt](#the-prompt).
After compaction, the session follows [Resuming](#resuming-after-compaction), and
[Re-expanding](#re-expanding-what-the-summary-dropped) when it needs a detail back.

Sections 3, 4 and 5 are a snapshot (2026-10-30, after PR #115; section 5's i18n list is current), and 4a is the live plan, updated during #164 (P8 items 8 to 10);
refresh them before each
compaction in a small docs PR. This repo is public: nothing here may contain Kai's job-search
data (no real companies, people, salaries or notes).

---

## The prompt

Summarise this session so work continues without asking Kai anything a sensible default
answers. Keep everything in sections 1–8 below, quoting Kai verbatim where quoted. Keep ids,
paths, ports, branch names, PR numbers, commit hashes and commands exact. Keep the last few
user messages word for word, with what was done about each, and anything promised but not yet
done. Drop what section 9 says. End with section 10: the resume steps and one line saying the
next action.

### 1. Standing instructions from Kai

`CLAUDE.md` in the repo is the source of truth and wins on any conflict. Carry these:

- **Keep going.** "keep going. im going afk. you have enough to work on for ages, you'll hit a
  rate limit before you finish. just wait it out." On a rate limit, wait about 30 minutes and
  retry. New work comes from Kai's feedback and section 4a.
- **Commits.** "commit small and frequently and often". Conventional Commits, one logical unit
  each, push after committing. End every commit message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the harness's current trailer;
  older commits say "(1M context)") and every PR body with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **PRs.** One worktree and PR per task, branch `worktree-<name>`. Claude merges its own PRs
  with `gh pr merge N --merge --delete-branch` after the review-fix cycle (CLAUDE.md *Git*), fixing
  every `must_fix`, the reasonable `should_fix` and the cheap nits, and reviewing again until no
  `must_fix` is left. Every PR goes through it, docs-only ones too; a large docs change gets a
  fact-check reviewer. Kai: "merge once ready and update local main".
- **Approval to merge and release (since 2026-10-31).** Kai: "if you have followed and completed the
  iterative review-fix cycle then it can auto merge and make a release as appropriate, but it needs
  my explicit permission each time to make a major release". So don't ask per PR, except for a major,
  or when Kai has said to hold that PR. The auto-mode permission check may still block `gh pr merge`
  and tag/`gh release create`: never work around a refusal; ask, and give the `!` command as a fallback.
- **What to start.** Kai scopes the work: "stop after merge and release, dont start the next one";
  "then stop once thats done, dont start the next". So: one i18n area per go-ahead; after merge and
  release, report and wait. A dev preview (section 6) before merging only when Kai asks for one on
  that work: "i want to check the dev version before merging".
- **Plan before building when asked.** "lets plan it firtst and dont start building until i say
  so" (Docker); "dont build yet, just commit the plan"; "noooo noo no no, dont buikld antyhing
  eyt … undo all of that. i want to know what each PR would be". When Kai asks for a plan,
  write it (an RFC in `docs/rfc/`, roadmap tasks) and stop; build only on "lets get
  building" / "do the first item".
- **Branches.** "also delete branches on remote that are no longer needed". After each merge
  only `main` should remain, locally and on GitHub.
- **PM dashboard.** "keep the PM dashboard up to date, or even backfill items if they were not
  added". Every task gets a `docs/ROADMAP.yaml` entry in phase P7 (P8 for i18n; id = branch name minus
  `worktree-`, `prd: docs/prd/tracker.md`, `depends` on real task ids) in the PR that builds
  it, `status: building`, set to `done` just before merging. `uv run pytest -q tests/pm`
  checks the file still parses.
- **Docs and images.** "ensure docs are up to date, readme, images, etc". Every PR that adds or
  changes a feature, command, setting or data-folder behaviour updates `docs/guide/`, the
  README row (and its text and alt text), `llms.txt` and `CHANGELOG.md` in the same PR,
  checked against the code. When a change is visible in a README screenshot (or a `demo.gif`
  frame), retake it. The website (`website/`) copies the screenshots, so it follows.
- **Show before applying.** "i want to see the new gif(s) before you apply them"; "i want to be
  able to have it running asap so i can follow the progretss/chagnes in a browser with
  hotreloading". GIFs stay a standing ask: show them before applying. For other visual things
  (the website, colour schemes), preview when Kai asks: a local server, or files to look at.
- **Visibility.** After each merge: fast-forward main, rebuild the frontend on main, and say in
  a line what's now live. If the backend changed (a migration, a new or changed API), Kai must
  Ctrl+C and rerun `uv run jat serve` in their terminal; a frontend-only change needs a page
  refresh.
- **Version and status.** "it is ready, im using it. i just havent bumped a version number to
  the first major release". Kai then asked for 1.0.0 (released 2026-10-25) and for semver on
  every PR: "most are patch unless its new feature then it would be minor. it should be very
  explicit asking me for permission to merge a major bump". The rules are in `CLAUDE.md`
  (*Versions and releases*): bump in each PR, release each version, ask before any major.
  Released: v1.0.0, v1.1.0, v1.1.1–v1.1.4, v1.2.0–v1.2.8. Kai: "yes add release for each change"
  (each i18n PR is its own patch release; the switcher was minor). Only internal planning
  files (`CLAUDE.md`, `docs/ROADMAP.yaml`, `docs/COMPACTION.md`, `docs/IDEAS.md`, `docs/rfc/` plans) and the PM dashboard skip
  the bump.
- **Privacy.** Kai's data never enters this repo. Tests, fixtures, seed data and screenshots use
  fictional names (Contoso, Fabrikam, Litware, Northwind Talent, Northwind Pay, Blue Yonder
  Recruitment, Alex Morgan, Riley Chen, Sam Patel, Jordan Lee…) and example.com. Never act on
  Kai's real data folder beyond reading status (`/api/v1/backup`, `git log`/`status`, a GET to
  check a migration or endpoint is live, e.g. `/api/openapi.json`); never POST, PATCH or
  DELETE against Kai's tracker. Kai's screenshots show real names: never copy them
  into the repo, commits or PRs.
- **Scope cuts.** No job searching or scraping, no quick-add from URLs, no `.ics` export.
  The MCP cut is reversed: Kai asked for "mcp or smt so local agents can query the status and
  perhaps make changes" (roadmap `mcp-server`, #101). Dropped on request: Search Console and
  Google Analytics ("lets forget search console and GA"), a test CI workflow ("skip the CI
  tests workflow"), a coined phrase ("forget it"), and a Chinese README for now ("leave it for
  now", it comes with `multi-language`).
- **Outward-facing changes** (repo settings, Pages, description, topics, publishing) need Kai's
  yes first. Given so far: the description and topics ("Yes make the chnages"); Pages, the
  repo's Website field and the README link ("merge it, setup github pages, update the repo url
  to point to the pages"). **Not given yet:** the description and topics proposed in #96 (see
  section 5). Kai uploads the social preview by hand (Settings → General → Social preview).
- **English dates are day, month, year.** Kai: "english dates should be 31st October 2026 (day
  month year), american is month day year". Every date goes through the dayjs patterns in
  `utils/format.ts` ("31 Oct 2026", "30 Oct 2026, 19:25"), never the browser's locale.
- **Documents** go in the repo, not artifacts. Deleting anything of Kai's needs confirmation.
- **No agent-team skill in this repo.** Plain `general-purpose` subagents for reviews and
  fact-checks.

### 2. Project facts

- **Repos.** Code: `/home/kai/Documents/Projects/job-application-tracker`
  (`waddington/job-application-tracker`, public, created 2026-09-30). Data:
  `/home/kai/Documents/Projects/job-application-tracker-data` (private; Kai pushes it).
  Worktrees: `.claude/worktrees/<name>`.
- **GitHub listing.** Description "Open-source, self-hosted job application tracker for
  software engineers. Kanban board, recruiter CRM, interview rounds, follow-up reminders,
  offers compared side by side, Sankey funnel and insights. Local-first: your data stays in
  plain files on your machine. A free Huntr / Teal alternative with no scraping." 20 topics
  (job-application-tracker, job-tracker, job-search, job-hunting, job-hunt, jobhunt,
  job-search-tracker, job-search-tool, application-tracker, job-applications, job-tracking,
  job-seekers, job-seeker, interview-tracker, offer-comparison, job-offers, recruiter-crm,
  recruiters, self-hosted, local-first). Website field:
  https://waddington.github.io/job-application-tracker/. Social preview:
  `docs/social-preview.png`, indigo, layout B since #96: "No account. No cloud. / No AI. No
  tracking." beside the whole-picture Sankey (Kai: the board is what every competitor shows).
  Rebuilt by `python3 scripts/social_preview/make_card.py [--layout a|b]` from `card.html`
  (layout A is a checklist). 4 stars as of 2026-10-25. Releases: v1.0.0, v1.1.0.
- **Website** (`website/`, Astro 7, one landing page, PR #64): published by
  `.github/workflows/website.yml` to GitHub Pages (Source: GitHub Actions) on pushes to main
  touching `website/**`, `docs/screenshots/**`, `docs/social-preview.png`,
  `frontend/public/**` or `llms.txt`. `scripts/sync.mjs` copies the screenshots, social card,
  favicon and `llms.txt` in (git-ignored). Palette **paper** (warm off-white, ink, burnt
  orange); `forest`, `ember`, `indigo` exist, and a switcher plus `?palette=` work in
  `pnpm --dir website dev` only. Docs links go to the guide on GitHub (no docs section). Since
  #96 the copy speaks to job seekers who aren't developers (no `git clone` in the hero, a "What
  you'll need" setup, FAQ on being technical, Huntr/Teal, AI, Windows, phone, import), with SEO
  title "Free Job Application Tracker: private, no sign-up, open source". The footer says
  "Hosted on GitHub Pages; this site adds no cookies, analytics or trackers".
  `waddington.github.io/robots.txt` 404s, so the site's own robots.txt has no effect. `pnpm --dir website dev` (localhost:4321, Astro 7
  runs it as a background daemon: `npx astro dev stop` / `status`), `build`, `preview`,
  `format`; `build` runs `astro check`.
- **Docs.** `docs/guide/` (README, install, your-data, using-the-app, customising, commands,
  troubleshooting), `CONTRIBUTING.md`, `.github/ISSUE_TEMPLATE/` (bug, feature, links),
  `.github/pull_request_template.md`, `docs/prd/tracker.md`, `docs/rfc/stack.md`,
  `docs/ROADMAP.yaml`, `CHANGELOG.md`, `docs/IDEAS.md`, `docs/screenshots/` (17 PNGs incl.
  `conversations.png` and `cv-insights.png`, plus `demo.gif`), `docs/social-preview.png`, this file.
- **Demo GIF.** `python3 scripts/demo_gif/make_demo_gif.py [--out x.gif] [--hold 150]` renders
  `scripts/demo_gif/scene.html` frames with headless Chrome and builds the GIF with
  ImageMagick (1.5 s per scene, 45 frames, ~2.7 MB). Show Kai a preview before replacing it.
- **API docs page** `/api/docs` serves Swagger UI from the app (`_api_docs` in `app.py`; the
  build copies `swagger-ui-dist` into `dist/api-docs/`, and Vite serves them in dev), not a CDN
  (#96), so nothing is fetched from the web.
- **Stack.** Python 3.12, uv, FastAPI, SQLAlchemy 2.1, Alembic (migrations 0001–0014) and
  SQLite in `src/jat`. Frontend `frontend/`: Vite 8, React 19, TypeScript 5.9, Mantine 9,
  TanStack Router/Query, dnd-kit, d3-sankey, react-markdown, openapi-fetch.
- **Data folder.** `--data-dir` or `JAT_DATA_DIR` (env var or `.env` in the current
  directory; `~` expanded). Kai has a `.env` in the main checkout. `tracker.sqlite3` is
  git-ignored and rebuilt from `export/*.jsonl` by `jat restore`. Snapshots commit 60 s after
  the last write; pushing is `jat push` only. Notes are Markdown files under `notes/` with
  their links in the front matter; `note_index` is rebuilt from the files (`_sync`).
- **Running apps.**
  - **The tracker:** `uv run jat serve` in the main checkout → http://127.0.0.1:8770
    (`/api/docs`), on Kai's data folder via `.env`. It migrates on start and serves
    `frontend/dist`. **Kai runs it in their own terminal** (as of 2026-10-25: `pgrep -af "jat
    serve"` shows it). On 2026-10-14 Kai said "start it up" and this session ran it as a
    background job, but that stopped when the session restarted, and Kai started their own.
    Never stop Kai's. After a merge that changes the backend, tell Kai to Ctrl+C and rerun it;
    a frontend-only change needs only `pnpm build` on main and a page refresh. Check it with
    `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`; if it's down,
    say so and offer to start it as a background job from the main checkout.
  - PM dashboard: `python3 -m tools.pm` → http://127.0.0.1:8767 (pages in section 4a). Kai asked for it on 2026-10-25 and it runs as a
    background job of this session from the main checkout; restart it if it's gone.
- **Commands.**
  - Backend: `uv run pytest -q`, `uv run ruff check src tests scripts`, `uv run ruff format -q src tests`.
  - Frontend: prefix pnpm with `PATH=/home/kai/.nvm/versions/node/v22.23.3/bin:/usr/local/bin:/usr/bin:/bin`;
    `pnpm --dir frontend install --frozen-lockfile --silent` (new worktrees), then
    `typecheck | lint | test | build | format | gen:api`. Run `format` before committing.
  - After API changes: `uv run python -m jat.openapi` then `pnpm --dir frontend gen:api`
    (`tests/test_openapi.py` fails on drift, including docstring changes).
  - Demo: `uv run python scripts/seed_demo.py <new empty dir>` then
    `uv run jat --data-dir <dir> serve --port 88xx` as a background job (8886 was the last
    port). Since #99 the seed fills every section of Today (waiting, overdue in red, a
    recruiter slower than usual, a favourite, a follow-up due, a call to mark, an unbooked
    round). Rebuild `frontend/dist` in the worktree first so it serves the branch. TaskStop it
    after merging, and tell Kai the URL if they want to look.
  - Screenshots: Playwright with the system Chrome, from a throwaway env:
    `uv run --with playwright python <script>` with `p.chromium.launch(channel="chrome")`.
    Use it to click (tabs), scroll and crop to element boxes. Plain
    `google-chrome --headless=new --screenshot` works for a page top, not after anchors.
  - Link check: `python3 /home/kai/.claude/jobs/cf5328f4/tmp/check_links.py` (rewrite it if the
    tmp dir is gone: it resolves the guide's relative links and GitHub-style anchors).
  - Waiting on a PR's checks: a background Bash `until` loop on
    `gh pr view N --json mergeStateStatus` (not CLEAN-only: UNSTABLE while the website build
    runs), never a foreground `sleep`.
- **Scratch files** in `/home/kai/.claude/jobs/cf5328f4/tmp` (and `tmp/site/` for the website),
  never `/tmp`.

### 3. Product map (what exists, so you can find things)

- **Menu** (`frontend/src/nav.ts`, `NAV_GROUPS`): *Today* `/` (one item, so its group heading
  is hidden; `/next-actions` redirects to `/` in `router.tsx`). *Your applications*: Roles `/roles`, Applications `/applications`
  (list/board, `?view=board`), Interviews, Offers. *People and companies*: Recruiters,
  Companies. *Files and notes*: Documents, Notes. *Review*: Insights, Timeline. Detail pages:
  `/applications/$id`, `/roles/$id`, `/companies/$id`, `/agencies/$id`, `/people/$id`,
  `/search?q=`.
- **Header** (`components/Layout.tsx`; buttons in `components/HeaderButtons.tsx`): wordmark →
  `/`; **New application**; search (`/`); **?** How it works; the **language switch**
  (`LanguageSwitch`, #114: English ticked, *Coming soon!* greyed out, *Pseudo-language (dev)*
  in dev only; saved in localStorage `jat.language`; `<html lang>` follows); theme toggle.
  Every date picker rings today (#82) and shows "D MMM YYYY" (`theme.ts` `valueFormat`);
  calendars follow the language (`DatesProvider` in `App.tsx`, weeks from Monday).
- **Translations (i18n, in progress; plan `docs/rfc/i18n.md`).** i18next + react-i18next.
  - `frontend/src/i18n/`: `index.ts` (`createI18n`, the app's `i18n`, strict mode throws
    `MissingValueError`/`MissingKeyError` in dev and tests), `language.ts` (`LANGUAGES`,
    `LANGUAGE_NAMES`, `pickLanguage`, `saveLanguage`, `isLanguage`, `PSEUDO` = `en-XA`,
    `?lang=pseudo` in dev), `pseudo.ts`, `catalog.ts` (key and placeholder checks, unused-key
    scanner), `shadow.ts` (shadow mode, unused now), `types.check.tsx` (type tests).
  - English text: `frontend/src/locales/en/{common,today,people,todos,selftest}.ts` (`as const`,
    typed via `i18next.d.ts`; `TextKey` = "ns:key"). Other languages will be JSON in
    `locales/<code>/`; a missing key, namespace or plural form fails `catalog.test.ts`.
  - Converted so far: the frame (header, menu, footer, Not found, shared dialogs), Today and
    everything on it (to-dos, reply/chase buttons, marks, reply habits, How did it go?, At a
    glance, How it works), and the switch. The lint rule, in
    `frontend/eslint.config.js` (`i18next/no-literal-string`), now covers every source file but tests.
  - `utils/format.ts`: `formatDay(value, pattern, lang)` and helpers; every date through the
    dayjs `PATTERNS`. `utils/time.ts` `formatDate`/`formatDateTime`/`ago` go through it.
  - `scripts/i18n/text_snapshot.py` + `text_diff.py`: before/after text check (section 6).
- **Today** (`pages/TodayPage.tsx`, `TodayPage.module.css`, `api/next_actions.py`; #99
  replaced `HomePage.tsx` and `NextActionsPage.tsx`): one line of numbers (active, interviews
  in two weeks, offers to answer) over a thin pipeline; then three groups (`Bucket`, h3, a
  count badge labelled "N in <group>"), two columns from `lg` (Your move left):
  - **Your move**: replies to read, offers to answer, how did it go?, to-dos due today or
    undated (`TodosSection`, with Add and Done recently), follow up, roles to decide.
  - **Coming up**: calls, interviews and to-dos dated later, by time, then rounds not booked.
  - **Waiting on them**: waiting to hear back (people rows: Chased / Ghosted / Not interested;
    *Usually replies within N working days*, *longer than usual*), gone quiet.
  Sections are small grey labels (`SectionLabel`, h4, `role="group"` with the title; the hint
  shows on hover/focus and is read by screen readers). Rows share `Row` (who on the left,
  stage and status on one line on the right, buttons underneath); each row is a soft tile that
  darkens under the pointer, with `.actions` at opacity 0.55 until hover/focus-within (always
  full on `hover: none`). To-dos and roles keep full-strength buttons. Recent activity and How
  it works fold away at the bottom. Getting started / *No applications yet* as before; it waits
  for applications only when nothing else shows. *How did it go?* (#87/#88,
  `components/OutcomeNotes.tsx`): a round's **Done** asks for the debrief and questions asked,
  **Didn't happen** (round or call) for what happened; nothing saves until you confirm.
- **Application page and quick view** (`pages/ApplicationPage.tsx`,
  `components/ApplicationDrawer.tsx`): summary, then **At a glance**
  (`components/AtAGlance.tsx`, rules in `utils/attention.ts`, #65). Then details, interviews,
  documents sent, offer, notes, links, files (+ *From the role*), log activity, timeline;
  to-dos, role and people on the right. *Route* (`RouteLine`, #89) links the recruiter, agency
  and company. Every application starts at the workflow's first stage (#83): one created later
  gets an *implied* creation event a second before plus an implied move (`data.implied`,
  `is_implied`, `in_time_order`); not undoable, not a stay, update, reply or weekly move;
  migration 0013 backfilled it (first stage read from the data folder's `config.toml`).
- **Roles** (`api/roles.py`, `components/Roles.tsx`, `pages/RolesPage.tsx`,
  `pages/RolePage.tsx`): pitched or spotted roles, **Apply** / **Interested** / **Pass** /
  Reconsider; a page per role with its files (shown on the application). Status (#77):
  `to_decide` (no application, not passed), `interested`, `closed` (#79, with `closed_as` =
  the latest application's stage name, e.g. *Withdrawn*), `applied`, `passed`; a view on the
  Roles page for each. All from `role_progress` in `domain/insights.py` (also `applied_rank`,
  `before_applied`, `stage_paths`): *applied* if any application's stage path got to Applied
  or later (or it was recorded straight at a closed stage with an applied date); else
  *closed* if every one is closed; else *interested*. Stage history is only loaded for roles
  that might not be applied. Role lines link to the latest application, and wrap their
  buttons under the role in narrow cards.
  *Interested* opens `ApplyModal` with `interested` (starting stage, no applied date; hidden
  when the workflow starts at Applied); the dialog's date follows before/after Applied until
  edited (`utils/applied.ts`). `move()` fills in `applied_on` when it reaches Applied or later.
  Changing a role's person (#92, `_role_recruiter_changed` in `api/routers.py` via the CRUD
  `after_update` hook) gives its open, unarchived, non-referral applications that had the old
  person (or nobody) the new one only where they fit (same agency; someone at the role's
  company for direct); others keep theirs with a note; route and agency never change. Notes
  use `note_change` (`manual` event, `data.bookkeeping`, not activity; `_activity_time` skips
  them). Recruiter changes on an application are noted too. The role form shows a hint.
- **People** (`pages/RecruitersPage.tsx` tiles with All / Agencies / Companies / Independent /
  *Favourites · n* / *Ghosted · n*, favourites first; `pages/PersonPage.tsx`): calls, roles mentioned, applications, interviews,
  to-dos, notes, links, files; **Timeline**, **Edit**, **Merge…**, **Delete**.
  - Merge and one person per email / LinkedIn (`components/MergePerson.tsx`,
    `domain/people.py`, #68).
  - **Ghosts** (#72): `components/GhostMark.tsx` (`GhostMark`, `useGhosted`, `PersonName`) puts
    a ghost before a ghosted person's name across the app (tiles, page icon, application
    list/board/quick view/People card, company/agency/role pages, calls, Today,
    Timeline entries and person lanes, search, Insights). Role lines say "(ghosted)". **Not a
    ghost** / **Remove Not interested** on the page, or the × on the tile chip, with Undo
    (`components/PersonChase.tsx`, `useAct`).
  - **Favourites** (#80): `contacts.favourite` (migration 0012, not null, default false);
    `FavouriteToggle` (☆, `aria-pressed`, label "Favourite: <name>") on tiles and the person
    page; a gold star (`FavouriteMark`) via `PersonName` / `PersonMarks` (both marks, used
    wherever the ghost shows); role lines add " ★". The edit form never sends `favourite`
    (only create does); merge keeps it if either had it.
  - **Reply times** (#73): `replies` table (migration 0011, backfilled from application
    events), `domain/replies.py` (`working_days` = weekdays after the wait day up to the reply,
    `is_reply_move`, `record`, `take_back_move`, `stats`); `ContactOut.replies` +
    `usual_reply_days` (median, rounded up); `components/ReplyHabit.tsx`, `utils/replies.ts`.
- **Documents** (`pages/DocumentsPage.tsx`, `api/documents.py`): CVs and cover letters with
  versions. **CV files you've attached** card (`components/CvFiles.tsx`, #74/#75):
  `GET /cv-files` finds PDF/Word files on applications, roles and people named like a CV or in
  two or more places (a role and its own application count as one), grouped by `sha256`, each
  with `sources` and the `applications` it counts for (role/person files only claim
  applications with no CV yet); `POST /cv-files/adopt` copies it into a version (or reuses the
  matching one) and records it on the ticked `application_ids` (sent on `applied_on`, else the
  earliest attachment linked to that application). *Not a CV* (localStorage `jat.notACv`,
  "Show … you said aren't CVs").
- **Board** (`components/Board.tsx`, `utils/board.ts`): *Show closed stages*, and **A column
  per interview round** (#91, localStorage `jat.board.byRound`): an active stage whose id/name
  says "interview" splits into *No round yet*, then Round 1… up to the furthest (empty gaps
  only up to Round 6); a card's round is `current_round` (next booked, else last done). Only
  *No round yet* takes drops (`isRoundColumn`, keys `<stage>#round-<n>`, `stageOfColumn`).
- **Interviews page** (`pages/InterviewsPage.tsx`, #90): a pencil per row (the round's form)
  and **Reschedule** for booked rounds (`components/Reschedule.tsx`: new time, optional reason;
  end moves with it). `interviews.rescheduled_count` / `rescheduled_from` (migration 0014,
  backfilled count); `PATCH` with a moved booked time counts it and keeps the old time
  (`reschedule_reason`, max 500, goes on the timeline); a *Rescheduled* badge.
- **Insights** (`pages/InsightsPage.tsx`): tabs *The whole picture* (default, #84:
  `GET /insights/whole-flow`, `whole_flow`/`source_of` in `domain/insights.py`: sources
  *Through a recruiter* / *Referred* / *You found it*, roles with no application to
  *Decided not to apply* or *Deciding whether to apply*), *Applications* (Sankey, stage table,
  routes, scorecard), *Recruiter conversations* (`components/Conversations.tsx`,
  `domain/conversations.py`, #66) and *CVs and cover letters* (#71:
  `domain/document_performance.py`, `GET /insights/documents`,
  `components/DocumentPerformance.tsx`, Fisher's exact test in `utils/abtest.ts`; a note
  linking to Documents when CV files aren't versions yet). *Weekly activity* under all.
  All Sankeys (`components/SankeyChart.tsx`, #84–#86): a spur from each active stage to where
  things wait (`holding` nodes: *Waiting to hear back*, *Still interviewing*…, built in
  `_flow_out`/`_with_holding` in `api/insights.py`), placed just after their stage; outcomes on
  the right; *Decided not to apply* (`PASSED_NAME`) beside Applied; `untangle` searches column
  orders for the fewest weighted crossings (`tangle`), once per flow at a nominal size, capped
  at 300 layouts; labels wrap (`wrap`) and get a halo; height grows with busy columns; narrow
  screens scroll sideways.
- **Timeline** (`pages/TimelinePage.tsx`, `api/timeline.py`, #67/#70): list by day or lanes
  (per role by default, or person, company, agency). View, period and *About* live in the URL
  (`useTimelineSearch`; the router JSON-parses `?period=30` into a number); person, company and
  agency pages have a **Timeline** button (`components/TimelineButton.tsx`) opening
  `/timeline?about=contact:<id>&period=all`. Notes on a role count for its company, pitcher and
  agency; roles you added yourself are `added` bookkeeping.
- **API** (`/api/v1`): CRUD for companies, agencies, contacts (+ `/merge`), roles,
  applications (+ `/quick`, `/move`, `/undo`, `/activities`, `/contacts`), interviews, offers,
  notes, links, attachments, documents (+ `cv-files`, `cv-files/adopt`), todos; summaries;
  `role-summaries`, `next-actions`, `timeline`, `meetings`,
  `insights/{whole-flow,flow,stats,activity,scorecard,conversations,documents}`, `search`, `backup`
  (+ `/archive`, `/snapshot`, `/push`).

### 4. Current state (snapshot 2026-10-30, after #115)

- **main at `7e9fe8b`** (merge of #114; #115 merged just before), plus this doc's PR until it
  merges. No other open PRs, worktrees or remote branches. Version **1.2.0**, released as
  v1.2.0 (tag on `7e9fe8b`).
- **Merged since the last snapshot (#102):**
  - #103 roadmap: Docker built locally (`docker-image`) and a published image later
    (`docker-image-publish`); #104 `docs/rfc/docker.md`, the Docker plan, shelved ("lets
    shelve this for now, add the extra detail somewhere for when we do dockerize it");
  - #105–#109 the i18n plan: `docs/rfc/i18n.md` (questions answered, backend never translates,
    type checking across the API, data impact §4a, no backfill, a release per patch), 14 tasks
    plus `multi-language` in their own phase **P8**, listed before P7 so they head the backlog;
  - #110 `i18n-setup` (1.1.1): the layer, helpers, tests, used nowhere;
  - #111 `i18n-shadow` (1.1.2): shadow mode on real strings, console only;
  - #112 `i18n-shell` (1.1.3): the frame cut over, lint rule on;
  - #113 `i18n-today` (1.1.4): Today cut over, dates day-month-year everywhere, the text
    snapshot scripts, a strict check that every language has every key and plural form;
  - #114 `i18n-switcher` (1.2.0): the language switch;
  - #115 roadmap: `tests-reorganise` (P7).
- **Tests on main:** 351 backend, 285 frontend.
- **Kai's tracker** runs in Kai's terminal (answered `200` on 2026-10-30). Only frontend changes
  since #99, so a page refresh is enough.
- **Kai's messages since #102, in order** (word for word where quoted):
  - "okay lets dockerize this. but lets plan it firtst and dont start building until i say so"
    (7 questions answered) → #103; "okay lets shelve this for now, add the extra detail
    somewhere for when we do dockerize it" → #104.
  - "lets plan i18n support, we could do the transormatio to support it but still only have en
    for now. think through the questions wed need to asnwer, and then answer them" → #105;
    "how will we go from code compoinent location that needs text, to getting the actual text
    from the strings file? will there be type checking on strings file keys" → #106.
  - "Great, lets get building but first tell me what each PR would be?" then "noooo noo no no,
    dont buikld antyhing eyt" and "undo all of that. i want to know what each PR would be"
    (the early start was deleted unpushed).
  - "how will the backend handle this? are we reimplenting i18n twice basically?"; "so hopw does
    tyer checking work when backend sends an ID/code and the frontend looks it up".
  - "okay I would want to split out the setup PR to a few more PRs 1. add dependencies and
    scafollding/utils code with their tests … 2. add some shadow calls that are not surfaced to
    user, only in logs/console so i can check them 3. then continue with other order, page by
    page extracting strings and cutting over usage to it".
  - "commit the plan, each PR as a work item on the board/backlog. Make the i18n tasks top of
    backlog/roadmap are any of these patches?" (#107); "how will adding i18n impact data we have
    in databasE?"; "what did you mean by backfill events"; "1. yes add release for each change
    2. what do you mean i18n events? … 3. yes skip the backfill dont build yet, just commit the
    plan" (#108); "whats the pm dahboar link".
  - "split out the i18n tasks to P8 just for it, then do the first item" (#109, #110); "merge 110
    and release v1.1.1 then do the next item (shadow calls), you can also merge that and release
    once ready, i approve" (#111); "okay whats the next part?"; "yeah lets do that, i want to
    check the dev version before merhing. will there be a way to see the dev version with the
    accented text and with the real text?"; "looks good, merge and release, then start the next
    one" (#112 → #113).
  - During #113: "dropdown calendar not yet updated, will that come in a later one or should it
    be part of this one?"; "english dates should be 31st October 2026 (day month year), american
    is month day year"; "to decide, apply, interested, are not done yet"; "dont merge yet"; "if
    there are things planned for later that is fine"; "looks good, merge then release"; "when we
    have multipee locales, will trhere be a check to ensure that every strings key is present in
    all locales? it would be a bad bad error if one is missing" (made strict); "stop after merge
    and release, dont start the next one".
  - "does this feature also includea alnaguage picker/switcher for manual changes? if not, add it
    to the roadmap, do it as the next item in this feature, and the languages should be English
    and a 'Coming soon!'" (#114); "dev version can have the psuedo language as an option in the
    picker"; "where do the strings for the pseudo language come from/"; "also add a feature to
    the roadmap to reorganise the tests and also add react testing library to test individual
    components" (#115); "you can merge and release once ready"; "then stop once thats done, dont
    start the next".
  - Then: "update … COMPACTION.md again for claude code compact command. i want to continue with
    the i18n work".

### 4a. Current work, 2026-10-31 (read this first; it overrides 4 and 5 where they differ)

Keep this whole section word for word in the summary: it is the live plan.

**Versions and main.** Released up to v1.2.28 (#163), and #164 `i18n-sankey` (v1.2.29) is the last of Kai's batch: if it's
still open, finish its review-fix cycle, merge and release it first. All 17 `e2e-*` tasks in P9 are done (v1.2.3 to
v1.2.19), P8 through `i18n-people` (v1.2.20), and all six tasks in P10 (#148 to #153, no releases). This batch: #155
`i18n-interviews`, #156 `i18n-calls`, #157 `i18n-offers`, #158 the roadmap split, #159 `i18n-documents`, #160
`i18n-attachments-links`, #161 `i18n-notes-search`, #162 `i18n-insights-tabs`, #163 `i18n-insights-reviews`, #164
`i18n-sankey` (v1.2.21 to v1.2.29). The whole browser suite is 645 tests and passes; pytest is 510; unit tests 439. Before
trusting anything here, re-read `docs/ROADMAP.yaml` and run `gh pr list`.

**Once #164 is out, nothing is running: wait for Kai.** The "keep going" loop does not apply right now. Kai scopes each step:
- P9: "continue with the P9 E2e test tasks but do not make the security fixes or bug fixes" (finished).
- P8: "now back to p8, pick up items 8 then 9 then 10 then stop and wait for further instruction", then "first, detail them
  out to me", then "each item can be multiple PRs", which I took as the go. Items 8, 9, 10 are the roadmap's "i18n 8/14",
  "9/14", "10/14". Stopped after #164. Then "coninue with these 3 items" (11, 12, 13), "i want you to fan out and work in
  parallel", "sounds good, get started". **Live plan: nine PRs (#166 split the tasks), three at a time, one from each item.**
  Wave 1: `i18n-timeline-page`, `i18n-errors-setup`, `i18n-events-setup`. Wave 2: `i18n-timeline-titles`,
  `i18n-errors-applications`, `i18n-events-rounds-offers`. Wave 3: `i18n-timeline-records`, `i18n-errors-files`, then
  `i18n-events-activity` once `i18n-timeline-records` has merged. Merges go one at a time; the version bump and changelog
  happen only at merge time, from main's version. Stop after these nine; `i18n-finish` waits for Kai.
- P10: "start p10, the pm dashboard upgrades. do 3 items from it for now", "feel free to start PM activityt and also pm
  agents", "keep going, finish p10 then stop" (finished).
- Bugs: asked which to fix and when, Kai said "none yet". Recording them is still required.
- Not started, waiting on Kai: `deps-*` and `security-alerts` (the Dependabot fixes, below), `pm-draft-building` (P7).

**Kai's latest word on how to work:**
- PM dashboard work gets no version bump or release. Asked "should these be releases?" with "i think yes because were
  making changes, but also no because theyre not part of the actual tracker", I said no and Kai said "sounds good to me".
- On the dashboard: "you dont have to match the styling, but hype pie dashboard has many features this dashboard doesnt
  hav". Features matter, not matching the look. And "on roadmap i want to be able to collapse sections".
- "if you have followed and completed the iterative review-fix cycle then it can auto merge and make a release as
  appropriate, but it needs my explicit permission each time to make a major release" (section 1, CLAUDE.md *Git*). It
  doesn't change what to start: Kai still scopes that.
- "I want smaller PRs, PRs created as drafts as early as possible, work directly on the files in the worktree dont use
  patch scripts": the rules are in CLAUDE.md *Git*.
- "all deletes should have a confirmation dialog/modal". Recorded as `fix-deletes-no-confirm` and
  `fix-call-delete-no-confirm`; not fixed.
- "why are you making changes via tmp files and not working in the worktree directly": edit worktree files directly
  with the Edit tool. A script only for a truly mechanical bulk change. Patch scripts kept breaking on Prettier's wrapping.
- "have you started yet? the pm dashboard doesnt show anything in progress?": the dashboard reads `worktree-<id>`
  branches and PRs, so push the branch as soon as work starts, not after it's done.
- "the pm dashboard isnt showing the currently in progress item as being in progress": it reads main's roadmap, so a task
  split only on its branch doesn't show. Land a roadmap split in its own small PR before the code starts (#158 did). An open
  draft still shows as In review until `pm-draft-building`; Kai hasn't asked for that yet, and I told Kai so.
- "how tf is pr 131 still open??????" and "was antyhing done in the last 90 minutes…": never leave a ready PR unmerged
  once the cycle is complete, and never report and stop while approved work remains. A subagent's report isn't the end of
  the job: check for open PRs before going quiet.
- Mid-turn "sitrep" questions get a short honest answer straight away, then carry on.

**Open bugs (phase B; 56, all recorded, owner Kai; none to fix without a go-ahead).** Each has a `test.fail` or a detail
in the roadmap; remove a bug's `test.fail` in the PR that fixes it. Branch `worktree-<bug id>`, and the board follows it.
- High: `fix-applied-date-wipe` (may have hit Kai's real data; I recommended it first, with the two 422s below).
- Medium, can't edit: `fix-person-move-blocks-application`, `fix-agency-delete-blocks-application-save` (every edit gets 422).
- Medium, lost or overwritten data: `fix-person-saved-before-new-company`, `fix-note-reopen-stale`, `fix-stale-edit-after-save`,
  `fix-typed-agency-lost`, `fix-emptied-agency-kept`, `fix-call-delete-no-confirm`, `fix-deletes-no-confirm`.
- Medium, silent or wrong: `fix-hidden-link-blocks-save`, `fix-timeline-load-error-silent`, `fix-link-rename-cancel-saves`.
- Medium, 500 on overlapping writes (`database is locked`): `fix-double-save-locked`, `fix-link-rename-tick-error`.
- Medium, duplicates: `fix-duplicate-agency-name`, `fix-duplicate-company-name`, `fix-duplicate-role`. Also
  `fix-add-another-role-carries-over`.
- Low: 37 more, in the roadmap.
Told to Kai but unconfirmed, not recorded: the backup hint says `jat init` where the restore docs say `jat restore`.

**Settled:** two people can share a name. Kai: "yes there can be 2 people with the same name". Keep that test pinned; it
isn't a bug.

**The running tracker** on 8770 needs a restart by Kai (Ctrl+C, `uv run jat serve`) to pick up this batch's API fields; I've
told Kai. Until then: a role's page loses "on Call with…" (#156, the only thing that goes missing), and search and Sankey
names stay in their English (#161, #164), which looks the same. Leave it alone.

**The loop for the next i18n area** (the nine parts above, then `i18n-finish`; as Kai scopes them):
- Read the area and the last entry in `docs/rfc/i18n.md`. If it won't fit in about 500 changed lines (1,000 at most,
  CLAUDE.md *Git*), split its roadmap task first, in its own PR (#158). Worktree `worktree-<id>`; set the task `building`,
  push, and open a draft PR straight away.
- **English stays exactly the same.** If a move would fix a recorded bug, keep the bug and leave the fix to its task: Kai
  said "none yet". `fix-offer-plurals` keeps "1 months", with `_one` forms repeating the plural; its `test.fail` would have
  gone green otherwise (#157).
- **Check what the API sends as English.** Round names, call names, search titles and Sankey names all were. Build the words
  in the frontend from raw parts, adding those to the response if it lacks them (rounds had them), and keep the English
  field. Fall back to it for an older server (`hitTitle`, `nodeName` do; #156's role page drops its text instead, so don't
  copy that). Say in the report if Kai must restart.
- **Whole sentences, one per state:** no word dropped into a placeholder, no count glued on. A count always gets `_one` and
  `_other` keys, even when English repeats itself, or the catalog test can't protect it. Keys in a map
  outside a component are whole (`"ns:key"`), or
  the unused-key scanner misses them.
- Move strings to `frontend/src/locales/en/<namespace>.ts`; the lint rule covers every source file but tests.
  Your words go into `<Trans>` as components, never `values`. A regex with `//` gets its own line, for the unused-key
  scanner. Pass `TFunction<"namespace">`, not `ReturnType<typeof useTranslation>["t"]` (too deep for TypeScript).
- Add the area's views to `scripts/i18n/text_snapshot.py`. `bash <tmp>/deps/i18n_snapshot.sh` from the worktree compares
  main's build with the branch's: it must say 0 view parts differ, and no view "couldn't open".
- A `*Text.test.tsx` pins what the snapshot can't reach, by exact text: plurals, hover titles, errors, confirmations, and
  states the demo lacks (it has no attachments, links, closed offers or waiting CV files). Reviewers check each claim of
  coverage, so say "most of" unless it's all. Run the review before the slow checks, and the checks on the final commit.
- Don't pipe `pnpm format` into `tail -0` (it stops Prettier part way); send it to `/dev/null`. A snapshot run across the top
  of an hour differs on the call form's default time: run it again.
- `pr-<task>.md` in `<tmp>/deps/` is the PR body; `python3 <tmp>/deps/finish_i18n.py <task> "<what>" "<title>"` bumps, writes
  the changelog, marks the roadmap done, sets the draft PR's title and body, and marks it ready.
- Review, fix, review again until no `must_fix` is left, run everything (the list is in CLAUDE.md *Git*), `merge.sh <pr>`, then `ship.sh <version> <pr> <task>` from the main checkout. Add the
  RFC's Built entry in the PR. Don't stop after the merge without checking the release exists.

**The loop's scripts,** in `<tmp>` = `/home/kai/.claude/jobs/cf5328f4/tmp`: `deps/e2e.sh <spec>` (format, typecheck, lint,
one spec), `deps/merge_main.sh` (merge main; a roadmap conflict keeps both sides, then `deps/roadmap_dedupe.py` leaves one
line per id, the longer), `deps/merge.sh`, `deps/ship.sh`, `deps/finish.py` (tests-only PRs), `deps/pm_checks.sh` (every
check in CLAUDE.md *Git* on the current commit, printing PASS or FAIL for each and the commit it ran on; about 6 minutes,
so run it in the background and restart it after any new commit), `<tmp>/pm_shot.py <base url> <prefix> <path>[@light][@375][@full]`
(screenshots, run with `uv run --with playwright python`; not the older `deps/pm_shot.py`). If they're gone, rewrite them from this description. `e2e.sh`'s
output is cut short, so read the whole of it before trusting a pass.

**Dependabot, already reviewed (31 alerts: 27 open, 4 auto-dismissed; no PRs made). Three PRs, one per lockfile:**
- `deps-python`, `uv.lock`: certifi to 2026.10.18 (critical advisory; only pulled in by httpx, a dev dependency, despite
  GitHub saying runtime), opentelemetry-api to 1.45.1 (via FastAPI, runtime). `uv lock --upgrade-package`.
- `deps-frontend`: vite to 8.3.3 (direct dev dependency; 6 alerts), seroval to 1.6.11 (via TanStack Router, in the
  bundle), undici to 8.12.2 (via jsdom, tests only), zod to 4.6.6 (via the eslint plugin, lint only).
- `deps-website`: fast-uri to 3.1.9, undici to 8.12.2. Check what pulls them in after installing (`pnpm why`).
- Test each with pytest, vitest, `pnpm e2e`, and for the website a build and a screenshot. These are patches: start
  them when Kai says, then merge and release after the review-fix cycle.

**PM dashboard.** http://127.0.0.1:8767 runs from the main checkout as a background job of this session (`python3 -m
tools.pm`). It reads the main checkout's roadmap, so **pull main after every merge, roadmap-only ones too**, or Kai's
dashboard is stale (Kai noticed once). It doesn't reload code, so restart it after a change to `tools/pm`:
`pkill -f '^python3 -m tools[.]pm$'`, then start it again as a background job. The "failed, exit 143" notice that follows
is that stopped process, not a fault. To preview a branch, serve it on a spare port from the worktree:
`python3 -m tools.pm --port 8768 --root <main checkout>`.
- **Pages:** Overview `/`, Board `/board`, Roadmap `/roadmap`, Activity `/activity`, Agents `/agents`, a task
  `/task/<id>`. `Collector` serves the last snapshot and refreshes in the background; a failed source keeps its last data
  with a red light, and one that never answered shows "unknown", never a false 0. Folds are kept in localStorage.
- **Modules:** `live.py` (git and `gh`), `derive.py` (Overview and Roadmap numbers), `charts.py`, `activity.py`,
  `agents.py`, `task_page.py`, `render.py`, `style.py`, `roadmap.py` (status from evidence), `server.py`. Standard library only, and nothing loads from the web.
- **Decided, and told to Kai:** no plan line on the burn-up, because the roadmap has no planned dates (a labelled forecast
  instead); a swimlane bar is a PR, not an agent, because this project keeps no workflow journals.
- **Known gaps, left:** drafts show as In review and a task only on its branch doesn't appear until it merges
  (`pm-draft-building`); with GitHub down since startup, a task page reads as if it has no PR; "Tests added" counts a test
  moved between files; chart text is small on tablet widths; empty Board columns still show on phones (from the #129 review).

**Other things said lately:**
- Kai asked for links twice while I was working, and text sent mid-turn didn't always reach them: when asked for
  links or status, give them in a clean final message.
- `uv.lock`, `openapi.json` and five version files change in every bump; finish.py handles them.
- Reviewers kept finding real bugs in code that passed its tests, usually false statements when a source fails, so ask
  them to check what a page claims, not just the code. Look at real pages too: a screenshot, not a test, found the broken
  logo in #150.
- Formatting rewraps lines, so an Edit written from memory can miss: read the lines first, and check an edit applied
  before committing (a missed one pushed a failing test). Don't push before the tests pass.
- `pkill -f` matches its own command line if the pattern appears literally there, and kills that shell: anchor it as above.

**Browser test facts:**
- `pnpm --dir frontend e2e` builds and runs everything; `pnpm exec playwright test e2e/<file>` runs one (a bare word
  matches the path, and "today" matched the worktree's name).
- `fixtures.ts`: a server per test file on seeded demo data in a temp folder, checked by health's `data_dir` and
  `git_repo`, with `JAT_*` and `GIT_*` removed from its environment. Any console error, uncaught exception or failed
  request fails the test unless `problems.allow(/…/)`.
- Tests in a file share data: use unique names, make what you need through the API, and don't rely on counts. A failed
  test restarts the worker and reseeds.
- A `test.fail` must not rest on timing: freeze staleness with `page.clock.setFixedTime`, hold overlapping requests in `page.route` and release them together, wait for retries with the loader gone. And it must go green for any shape of fix: check the outcome, not the wording.
- Check `toBeHidden` only after something else has loaded, or it passes during loading. After "nothing happened",
  watch for non-GET requests. A mocked request can't prove the server's state, so check the UI there.
- Mantine: `getByLabel` needs `exact: true` or `.first()` (a hidden twin); SegmentedControl: click its label text;
  switches: `check({force:true})`, or `click({force:true})` when the state only flips after a save; dropdown options via
  `getByRole("option")`; choosing a Select's current value clears it; Escape closes a dialog unless a dropdown is open
  (then it takes two); the role dialog opens with Company's list covering the form, so click away first.
- Board: `test.use` a 3800 px viewport (autoscroll moves targets); wait for dnd-kit's live region ("X is over Y") before
  releasing. `window.confirm` needs `page.once("dialog", …)`, or it's dismissed by default.
- Demo data names: Alex Morgan, Sam Patel, Jordan Lee (no Riley Chen); stages Interested, Applied, Screen, Interviewing,
  Final, Offer, Accepted, then closed Rejected, Withdrawn, Ghosted; Backend CV (v2, v3 (impact first)), Short cover letter.
- A TypeScript error stops the build, so every test then fails for one reason. Prettier reformats specs, which is one more
  reason to edit them directly. Run `git` with no `-C`, and don't `cd ..` before it: the harness refuses both.
- `gh pr merge` can fail right after a push (still rechecking) or with a 504: merge.sh retries. The "'main' is already
  used" line is harmless. Never run finish.py during a merge conflict: it once committed markers (it refuses now).

### 5. Work in flight and candidates

- **In flight:** none (after this doc's PR merges).
- **Next: what's left of the i18n work, P8, in this order** (when Kai says; the areas before these are done, see 4a):
  1. `i18n-timeline-*`: titles built in the frontend from a new `kind` and raw fields, including a round's and a call's
     title (`api/timeline.py`), which Today's recent list also shows.
  2. `i18n-errors-*`: error codes (Literal) + `errors` namespace, and the "That didn't work" toasts in `api/*Hooks`.
  3. `i18n-events-*`: `data.msg` on new events, a typed `msg` in the API; "Followed up", "No reply" and the rounds' saved
     summaries (saved English today) move here. No backfill.
  4. `i18n-finish`: the lint rule everywhere, `shadow.ts` removed, a pseudo screenshot pass, RFC done. Then
     `i18n-contribute-language`, `i18n-default-stages` and `multi-language` (Chinese, a native-speaker review; also percent
     and number formats, brackets and separators, and search matching the API's English titles).
- **Planned elsewhere, not started** (build only when Kai asks): `tests-reorganise` (P7: a test
  file per component next to it with React Testing Library, shared render helpers in
  `src/test/`, `@testing-library/user-event`, backend tests by module, a Testing section in
  CONTRIBUTING); `docker-image` (plan in `docs/rfc/docker.md`), `docker-image-publish`,
  `windows-support`, `packaged-install`, `desktop-app`, `hosted-version`, `demo-site`,
  `mcp-server`.
- **Offered, waiting on Kai:**
  - The GitHub description and topics proposed in #96 (description "Self-hosted job
    application tracker for software engineers. No account, no cloud, no AI, no tracking.
    Kanban board, recruiter CRM, interview rounds, follow-ups, offer comparison and Sankey
    insights; your data in readable files on your machine, with optional git backups. A free,
    open-source Huntr / Teal alternative."; topics: drop `jobhunt`, `job-seekers`, `recruiters`,
    add `huntr-alternative`, `kanban`, `privacy`).
  - A short brand name (ideas: Pursuit, Offerboard, Shortlist, Followup, Dossier, Waypoint,
    Jobfolio). Keep the repo name either way.
  - Tile rows on other pages; dropping *Screen* from the default workflow; post drafts (Kai
    posts); rebuilding `demo.gif` (preview first).
  - `docs/IDEAS.md` still lists "An MCP server" as rejected (reversed in #101); a one-line fix
    was offered.
- **Noticed, not promised:**
  - i18n: labels computed outside components (`utils/attention.ts`, `waitingLabel`…) don't
    re-render on a language change by themselves; fine while English-only, revisit for
    `multi-language`. Calendar names can't be pseudo-accented (they're dayjs locale data).
    `firstDayOfWeek` is fixed at Monday (TODO in `App.tsx`).
  - Ghost and star still missing in the Timeline *About* select and to-do "about" text.
  - Reply times: weekdays only, no bank holidays.
  - On phones: the header search overlaps the page title.
  - The application page's People card ignores a recruiter set through the route.
  - Today: a to-do on a role shows on its role line and in Coming up; to-dos months ahead still
    count in Coming up.
  - Recruiter conversations' tiles and table still say *Passed*.
  - Board round columns only split stages named "interview" (fix with `i18n-applications`).
  - `insights-stats.png`, `demo.gif`, `recruiters.png`, `person.png`, `roles.png` show older UI.

### 6. The delivery loop

1. `git fetch -q && git worktree add -q .claude/worktrees/<name> -b worktree-<name> origin/main`,
   then EnterWorktree with `path`. Add the roadmap task (P7, `building`), commit, push with
   `-u`, and open it with `gh pr create --draft`. In a new worktree, `pnpm --dir frontend install`
   before frontend commands. Stay near 500 changed lines (CLAUDE.md *Git*); split the task if not.
2. Backend: model + migration (check `tests/test_db.py`), API, tests; new tables/columns in
   `tests/factories.py` `populate()`; regenerate OpenAPI and types. Commit and push.
3. Frontend: hooks (invalidate every query key that shows the data), components, pages,
   tests. Commit and push.
4. Docs: guide, README row and text, `llms.txt`, changelog with the PR number (the draft's,
   `gh pr view --json number`) under a new `## X.Y.Z (date)` section, screenshots if visible UI
   changed. Bump the version (CLAUDE.md *Versions and releases*: five files, `uv lock`,
   `jat.openapi`, `gen:api`). Link check.
5. Live check: seed demo data, build the branch's frontend, serve on a spare port, drive it
   with Playwright, Read the screenshots (also at 375 px when rows gain buttons).
6. Fill in the draft PR's body (what Kai asked, quoted; what changed; checks) and run
   `gh pr ready`. Start a background `general-purpose` reviewer: `gh pr diff N` once, Read files in the worktree, report
   must_fix/should_fix/nit with file:line. For anything touching Kai's real data, tell it to
   focus on data safety. Tell Kai what's happening meanwhile.
7. Apply fixes (more tests where it found gaps) and review again until no `must_fix` is left. Set the
   roadmap task `done`, re-run every check on that commit, push. Poll `mergeStateStatus` for CLEAN, then merge,
   unless it's a major: stop and ask Kai first (CLAUDE.md *Versions and releases*).
8. ExitWorktree keep; on main: `git pull -q --ff-only`, `git worktree remove --force …`,
   `git branch -D …`, `git fetch -q --prune`; rebuild the frontend; TaskStop demo servers;
   check the tracker answers; report what's live and whether Kai must restart.
9. Release: `git tag -a vX.Y.Z <merge sha> -m vX.Y.Z`, `git push origin vX.Y.Z`,
   `gh release create vX.Y.Z --title vX.Y.Z --notes-file <that changelog section>
   --verify-tag` (notes extracted with a script into the tmp dir; make relative links
   absolute). Follows the review-fix cycle without asking; a major needs Kai's explicit yes each time.

**An i18n area's cutover** (since #113; CONTRIBUTING "Text in the UI"):
1. Worktree `worktree-i18n-<area>`; set its P8 task `building`, push, open a draft PR.
2. Baseline: build main's frontend in the worktree (it starts identical), seed demo data
   (`scripts/seed_demo.py <tmp>/demo-x`), `uv run jat --data-dir … serve --port 88xx`, then
   `uv run --with playwright python scripts/i18n/text_snapshot.py http://127.0.0.1:88xx before.json`.
   Take it twice and diff for stability.
3. Write the English in `locales/en/<ns>.ts` (new namespace → `locales/en/index.ts`), cut the
   components over (`useTranslation("<ns>")`, `t()`, `<Trans>` for markup, `i18n.t("ns:key")`
   outside components; another namespace too → `useTranslation(["ns", "common"])`); text the
   app *saves* stays English with a comment (`i18n-events`). The lint rule covers every source file but tests.
4. Typecheck, lint, tests; rebuild, restart the server, snapshot again, `text_diff.py` must say
   `0 view parts differ` (or only intended changes). Pin what the snapshot can't reach in a
   test (`components/TodayText.test.tsx` is the model). Prove a test catches a slip by breaking
   one English string.
5. Dev preview, when Kai asks for one: `JAT_API_URL=http://127.0.0.1:88xx pnpm exec vite --port 5174
   --strictPort` from `frontend/` (background); http://127.0.0.1:5174 and `?lang=pseudo`.
   Screenshot pseudo to check nothing in the area is still plain English.
6. Docs: CONTRIBUTING (what's moved), RFC Status + Learned, CHANGELOG `## 1.x.y`; bump. `gh pr ready`,
   reviewer (tell it to check exact text equivalence for every string), fixes, review again, merge.

Several features can be in flight at once (one worktree each): ExitWorktree keep, then
EnterWorktree the other. Merge main into a branch before its PR when main moved; the usual
conflict is the last lines of `docs/ROADMAP.yaml` (keep both, in merge order).

### 7. Decisions already made (don't re-litigate)

- **Workflow:** any-to-any moves by default; `transitions = "configured"` enforces `next`.
- **Staleness:** not stale if snoozed, a follow-up is planned later, a round is booked ahead,
  you're waiting to hear back, or there's a reply to read.
- **Reply states:** `awaiting_reply_since` and `reply_to_read_since` never coexist; a stage
  move clears both. People also have `chased_on`, `closed_as` (`ghosted` |
  `not_interested`) + `closed_on`.
- **At a glance** follows Today's rules for one application; to-dos show even on closed
  or archived applications; key dates count only what has happened (`last_activity_at` in the
  future falls back to the latest past event).
- **Recruiter conversations:** a pitched role is a role with a person; calls held = marked
  Happened (whatever the time); booked = scheduled and ahead; a scheduled call already past
  isn't counted. Best outcome per role: offer > in progress > closed > ghosted. Time to decide
  counts from an application's first stage event. Weekly calls = held.
- **Timeline:** lanes by role by default; `role` kind for pitches and passes; `added`
  bookkeeping off by default; Application lanes dropped.
- **People:** one agency or company each. One person per email and LinkedIn profile (only
  details new to a person are checked, so old duplicates stay editable). Merge: the kept
  person's fields win; title from the other if none; agency or company if neither; waiting /
  to-read / closed if none; later chased date. Notes are relinked in the file, keeping their
  edit time; the index catches up on the next sync.
- **Roles:** status derived (*applied* > *passed* > *to decide*); role files show on the
  application; same title at the same company reuses the role.
- **Deleting:** a company or role with applications can't be deleted; deleting a person
  deletes their calls and unlinks the rest (so for duplicates, merge).
- **Offers:** the newest per application counts; worth a year = salary + bonus + equity +
  employer pension, or day rate × 220.
- **Interested roles:** a role is *Interested* while every application is in an open stage
  before Applied; Insights' recruiter conversations count those as *still deciding*, and
  Today's *roles to decide* only lists roles with no application.
- **Closed roles:** closed before any application got to Applied → *Closed* (badge = how it
  ended), counted as *passed* in Insights (not in time to decide); applied and then
  withdrawn stays *Applied*; logged straight at a closed stage with an applied date counts as
  applied.
- **Favourites:** one star (not a rating); separate from ghosted (both can show); favourites
  first on the Recruiters page.
- **Every application starts at the first stage:** implied events (`data.implied`) fill it in;
  they aren't undoable and don't count as a stay, update, reply or move; the Timeline shows the
  pair as one *Added at …* entry; the application timeline shows both.
- **Sankeys:** holding spurs for every active stage (DECIDING only when the first stage is
  before Applied); holding nodes just after their stage; outcomes (closed/success) on the right
  edge because they can follow any stage; *Decided not to apply* beside Applied; column order
  searched for fewest crossings. "Passed" is never used as a Sankey label.
- **The whole picture:** sources by precedence referral > recruiter (person on the role, or an
  application with a recruiter/agency) > found; a role applied to twice counts twice.
- **Board rounds:** only stages named "interview"; rounds are sequential and come from
  interviews, so only *No round yet* takes drops.
- **Reschedules:** counted only when a booked round's time moves (not adding/clearing a time,
  not with a status change in the same save); the end moves with the start; the reason lives on
  the timeline only.
- **A role's person changing:** never changes an application's route or agency; only open,
  unarchived, non-referral applications that had the old person or nobody, and only where the
  new person fits; removing the person changes nothing; notes are bookkeeping.
- **Notes dialogs:** nothing saves until confirmed; can't close while saving.
- **Workflow:** *Screen* stays in the default unless Kai says otherwise; Kai's own stages live
  in their data folder's `config.toml` (we give snippets, never edit it).
- **Ghosts:** only `closed_as == "ghosted"` gets a ghost (not *Not interested*); taking it off
  is a plain action any time (not "undo" wording), with an Undo toast.
- **Reply times:** recorded when waiting ends with *They've replied* / *Heard back*, or a move
  on while waiting that isn't yours (Withdrawn, Declined, success stages, `reopen_from`);
  undoing that move takes it back; chasing and Ghosted aren't replies; no guessing at PATCH
  "undos" (it deleted real replies). Local days. Merging people keeps replies; deleting an
  application keeps them (`SET NULL`).
- **CV A/B:** CVs are told apart by the version recorded per application, not by reading
  files. *Sent* = got to Applied (or the first active stage after the start without an
  `applied` stage), closed after it, or a document recorded; reply time from the day it got
  to Applied. Screen or interview is the headline measure; Wilson 95% ranges; Fisher's exact
  test with "too few" under 5 each; a CV can't be compared with its own versions.
- **CV files:** grouped by content (`sha256`); the version gets its own copy; originals never
  touched; role/person files only claim applications without a CV; you tick the applications.
- **Website:** one landing page, paper palette, docs on GitHub, no analytics; it speaks to
  non-developers, the README to developers.
- **Positioning:** "No account. No cloud. No AI. No tracking." (no "no external dependencies",
  which isn't true; "plain files" only with the SQLite caveat; git backups are *optional*).
  The app never calls out to the web (a linked image in a note loads from where it's linked).
  No new coined phrase. Keep the repo name `job-application-tracker`.
- **Today:** one home page in place of the Overview and Next actions; three groups (Your move /
  Coming up / Waiting on them), gone quiet under Waiting on them; the look is "Tiles + faint
  buttons" (Kai: "Lines is least fav"; "I like the new one, ship that"); no per-row ⋯ menu and
  no folding long lists (not picked).
- **Docker vs non-technical users:** Docker is for self-hosters; the lay-person path is the
  one-command install, Windows support, then a double-click desktop app.
- **Promotion:** Claude drafts posts; Kai posts them. Posts say it's built with Claude Code.
- **Search:** every word must match, accent- and case-insensitive.

- **i18n:** the frontend does all translating; the backend sends codes and ids next to its
  English (§4 of the RFC). One namespace per area; keys say what text is for; English as
  `.ts` `as const` (typed keys and placeholder names), other languages JSON. Every converted
  file is linted (every source file but tests). Your data (stage names, companies, notes) is never translated.
  Saved text stays English until `i18n-events`; no backfill of old events. Each i18n PR is a
  patch with its own release (the switch was minor). Cut over directly with the before/after
  text snapshot (shadow mode was for the first steps). Typed id-to-key maps hold bare keys.
  A language is added in four steps (CONTRIBUTING "Adding a language"), `LANGUAGES` last.
- **Language switch:** English plus a greyed *Coming soon!*; pseudo in dev only, never saved;
  languages by their own names (`LANGUAGE_NAMES`), not translated.
- **Docker:** shelved; the plan is `docs/rfc/docker.md` (minor bump, bind-mounted data folder,
  user id and git identity passed in, Podman-compatible, Compose, published image later).

### 8. Gotchas already learned

- **Harness refusals.** Bash it can't prove stays in the entered worktree is refused:
  heredocs and inline Python (especially when the text contains "git"), `for` loops with
  variables as programs, `cd` before git, `&&` chains mixing git with other tools. Fix: split the
  commands, and edit files with Edit. A script in the tmp dir is only for mechanical bulk changes.
  A refused command changed nothing.
- **Never `open(p, "w").write(f(open(p).read()))`**: the write mode truncates the file before
  the read. Read into a variable first. If it happens, `git checkout -- <file>` (tracked files
  only; a new untracked file must be fixed by hand).
- **The main checkout is read-only for edits** in this session (git pull, worktree remove and
  `pnpm build` there are fine). Ask Kai to run anything else with `!`.
- **Subagents can't run Bash in your worktree:** tell them to use `gh pr diff` and Read.
- **`gh pr edit` fails silently** (classic Projects deprecation): set a title or body with
  `gh api -X PATCH repos/waddington/job-application-tracker/pulls/N -f title=… -F body=@file`.
- **`gh pr merge` from the main checkout** prints "'main' is already used by worktree"; the
  merge still happened (check `gh pr view N --json state`).
- **Polling.** Right after a push, poll `mergeStateStatus` for CLEAN before merging.
- **SQLite and notes:** call `_sync(request)` (notes index) before the request's session reads
  anything; otherwise a write later in the request can fail with "database is locked".
- **zsh:** `grep --include=*.tsx` fails ("no matches found"); grep paths directly.
- **React lint:** no `Date.now()` or `dayjs()` in render (`useToday()`, `useNow()` in
  `utils/useToday.ts`). Mantine options render hidden; SegmentedControl items are radios;
  Chips are checkboxes.
- **Test fixtures:** `frontend/src/test/mockApi.ts` (`row`, `item` with `role_id`, `meeting`,
  `roleSummary`, `todo`). Prove a test catches a bug by breaking the code and watching it fail.
- **Headless screenshots** of a page with reveal animations need reduced motion
  (`--force-prefers-reduced-motion` or Playwright `reduced_motion="reduce"`); `scroll-behavior:
  smooth` swallows scripted scrolling (inject `html{scroll-behavior:auto}`).
- **Astro 7 `dev`** detaches into a daemon: `npx astro dev stop` before restarting; a content
  change it misses needs a restart.
- **The truncation trap again (#74):** a script's last line `open(C, "w").write(open(C).read())`
  emptied a file. Never reopen a file for writing on the same line it's read; restore with
  `git checkout -- <file>` and re-apply only that file's edits.
- **`git checkout -- <file>` after a test-the-test break** also drops your uncommitted edits to
  that file: copy the file aside (`cp f tmp/f.bak`) and copy it back instead.
- **`export PATH=…node…`** in a Bash call hides `uv` for the rest of that call: run
  `uv run python -m jat.openapi` in its own call before `pnpm gen:api`.
- **TanStack Router:** routes built from `NAV` aren't typed for `navigate({ to: "/timeline" })`;
  navigate to `"."`. Mantine Select inputs have two elements per label (use
  `getAllByLabelText(...)[0]` or `findByDisplayValue`); jsdom lacks `scrollIntoView` (stubbed
  in `src/test/setup.ts`); notifications persist across tests (scope `Undo` clicks to the
  toast).
- **CI:** a website build check runs when docs/screenshots change; `mergeStateStatus` is
  UNSTABLE until it passes.

- **React synthetic events:** never read `e.currentTarget.value` inside a state updater
  (`setX((v) => …e.currentTarget…)`): React clears it before the updater runs, which crashed
  the notes dialog on Enter (#88). jsdom tests don't catch it; read the value first.
- **EnterWorktree** refuses when the worktree is already the cwd (e.g. after `cd` into it in
  the same Bash call); you're still isolated, carry on.
- **Demo servers** don't reload backend code: after a backend change, TaskStop and restart
  `jat serve` before screenshotting (a stale server showed the old node order in #84).
- **d3-sankey:** a custom `nodeSort` is applied once and kept through relaxation; `undefined`
  lets d3 reorder by position. `nodeAlign` decides columns. Search for orderings outside the
  render path (memo on the flow), not on every resize.
- **CSS modules: no `light-dark()`.** The build rewrites it to variables the app never sets, so
  the colour silently vanishes. Use a custom property, overridden under
  `:where([data-mantine-color-scheme="dark"])` (`theme.module.css`, `TodayPage.module.css`).
- **Mantine 9 `Grid`** takes `gap`, not `gutter`.
- **Astro drops the space** between text and an element on the next line; add `{" "}`.
- **React Query retries a failed request 3 times (~7 s).** A page that waits on a query nobody
  mocked waits that long in tests (they time out); mock it, or don't block on it.
- **pnpm 10** ignores `pnpm.ignoredBuiltDependencies` in `package.json`, and already blocks build
  scripts (e.g. `@scarf/scarf` from `swagger-ui-dist`) by default.
- **`ruff check src tests` misses `scripts/`**: include `scripts` (a long line in
  `make_card.py` sat on main from #96 to #99).
- **The auto-mode permission check** can block merges and releases, as it did on #147's first try
  (no review, no approval). A blocked command ran nothing: ask Kai, never work around it.
- **Migrations that read config:** `migrate()` passes `cfg.attributes["data_dir"]`; a
  `config.toml` that doesn't load must stop the migration, never fall back silently (#83).
- **Data-touching features** (rewriting applications from another edit) get a reviewer told
  to focus on data safety; #92's first version flipped routes and was reworked before merge.

- **i18n gotchas** (more in the RFC's "Learned so far"):
  - `t()` from `useTranslation("x")` refuses keys prefixed with any namespace, its own
    included; use bare keys, or `useTranslation(["x", "common"])` for another namespace.
  - `<Trans>` tags named after HTML void elements (`<link>`, `<br>`) render empty.
  - The pseudo-language is `en-XA` (an unknown tag takes the machine's plural rules).
  - A component rendered alone in a test needs `src/i18n` loaded (the test setup does it).
  - The lint plugin compiles word filters without the `u` flag: no `\p{L}`; it anchors them.
    Prove the rule still bites by putting a hard-coded label back.
  - Intl's en-GB writes "Sept"; dayjs writes "Sep": all dates go through dayjs patterns.
  - A Mantine `Tooltip` inside `Menu.Target` steals the menu's ARIA: put the Tooltip outside.
  - jsdom can't type into a Mantine searchable Select (`fireEvent.change` doesn't stick):
    check those in a real browser (Playwright) until `user-event` arrives.
  - Mantine menu items and options render hidden: query with `hidden: true`.
  - `mouseenter` doesn't bubble: hover a Tooltip's own target element in tests.
- **Bash refusals in a worktree** also hit `cd ..` before git and `python3 - <<EOF` scripts that
  mention git: split the commands, and put long text in a file.

### 8a. How Kai works

- Uses the tracker for a real job search and reports gaps as they hit them, often several in
  one message or mid-turn: split them into PRs, fold small ones into the one in progress.
- Sometimes wants to see things running before they land (a local URL): do that when asked.
- Asks short questions ("how do i run thius?"): answer plainly with the exact command.
- Values findability, honesty about state, docs and images that match the code, a tidy repo,
  and the project being discoverable on GitHub.
- Thinks out loud in questions first ("how will…", "what did you mean…"): answer plainly, and
  record the answers in the RFC when Kai says "commit the plan".
- When previewing, spots gaps (calendar, date order, role lines):
  fold the fix into the open PR if it's small and in scope, else say which planned PR owns it.
- Refines visual things in quick rounds (the Sankeys took #84–#86) when asked to look at them:
  show a demo URL with each round, and fold follow-ups into the open PR.

### 9. Drop

Tool output, diffs and file contents already on disk; per-command narration; reviewer reports
already handled; screenshots already looked at; topic-research tables; superseded plans and
palettes; the earlier versions of this doc.

### 10. End the summary with

The resume steps below, then one line with the next action: Kai's latest instruction if it's unfinished; otherwise
"Next action: nothing is approved to start; wait for Kai (section 4a)."

---

## Resuming after compaction

1. **Re-read, don't trust memory:** `CLAUDE.md`, this file, `gh pr list`, `git worktree list`,
   `git branch -a`, `git log --oneline -5` on main and any worktree branch.
2. **Check the PM dashboard:** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8767/board`; if it's down, start
   `python3 -m tools.pm` from the main checkout as a background job.
   **Check the tracker:** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`.
   Kai runs it in their terminal (section 2): if it answers, leave it alone. If it's down, say
   so and offer to start it (`uv run jat serve` in the main checkout, as a background job), or
   Kai reruns it themselves.
3. **Open PRs first:** finish a draft's work, run the review-fix cycle, then merge and release
   (a major needs Kai's yes first).
4. **Unfinished worktrees:** commit and push, then finish that task.
5. **Then Kai's latest request,** which section 4a spells out. If there isn't one, report the state in two lines and
   wait.
6. **Before the next compaction,** refresh sections 3, 4 and 5 in a small docs PR.

## Re-expanding what the summary dropped

The summary keeps decisions and pointers, not detail. When a detail is needed, get it back
from the record rather than guessing:

- **The full conversation:** the transcript path the summary gives
  (`/home/kai/.claude/projects/-home-kai/<session>.jsonl`). Search it with `grep` for a quote,
  a PR number or a file name; don't read it whole.
- **What a PR did and why:** `gh pr view N` (the body quotes Kai and lists what changed and
  the checks), `gh pr diff N`, and the merge commit's messages (`git log --oneline main`).
- **What a feature does:** `docs/guide/using-the-app.md` and the module docstrings
  (`src/jat/domain/*.py`, `src/jat/api/*.py`); `CHANGELOG.md` maps features to PRs.
- **What's planned or done:** `docs/ROADMAP.yaml` and `docs/IDEAS.md`.
- **How a screenshot was made:** the scripts in the tmp dir (`shots9.py`, `copy9.py`,
  `tmp/site/cap.py`, `insights_shots.py`, `tl_readme.py`, `merge_live.py`); rewrite them from
  the Commands above if the tmp dir is gone.

## Keeping things that must survive

Context is temporary; the repo isn't. Anything that should outlive a compaction goes on disk
in the same PR that makes it true:

- Kai's standing instructions and decisions: sections 1 and 7 here (and `CLAUDE.md` when they
  are rules for the repo).
- What's built: the guide, the README, `llms.txt`, `CHANGELOG.md`, the roadmap.
- Why: the PR body (quote Kai) and commit messages.
- Gotchas worth not relearning: section 8 here.
