# Compacting the build session

The long-running Claude Code session that builds this repo compacts its context now and then.
This file says what the summary must keep, what it can drop, where to find what it dropped,
and how to carry on afterwards, so the work continues as if nothing happened.

**How to use it:** run `/compact` followed by everything under [The prompt](#the-prompt).
After compaction, the session follows [Resuming](#resuming-after-compaction), and
[Re-expanding](#re-expanding-what-the-summary-dropped) when it needs a detail back.

Sections 3, 4 and 5 are a snapshot (2026-10-29, after PR #101); refresh them before each
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
  retry. The roadmap is finished; new work comes from Kai's feedback.
- **Commits.** "commit small and frequently and often". Conventional Commits, one logical unit
  each, push after committing. End every commit message with
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the harness's current trailer;
  older commits say "(1M context)") and every PR body with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **PRs.** One worktree and PR per task, branch `worktree-<name>`. Claude merges its own PRs
  with `gh pr merge N --merge --delete-branch` after a reviewer pass, fixing every `must_fix`,
  the reasonable `should_fix` and the cheap nits. Docs-only PRs may skip review; a large docs
  change gets a fact-check reviewer. Kai: "merge once ready and update local main".
- **Approval to merge and release (since #99).** Kai: "dont merge until ive approved" (for the
  Today page), then "i approve, ship/merge, update local main" and "i approve the release, do
  it". The auto-mode permission check blocks `gh pr merge` and tag/`gh release create` unless
  Kai's latest message clearly approves *that* action ("ship that" about a look wasn't
  enough). For a feature PR Kai is previewing, finish it, then ask for an explicit "merge N";
  ask separately for the release if it isn't covered. Roadmap-only PRs (#100, #101) merged
  without asking. Never work around a refusal; ask, and give the `!` command as a fallback.
- **Branches.** "also delete branches on remote that are no longer needed". After each merge
  only `main` should remain, locally and on GitHub.
- **PM dashboard.** "keep the PM dashboard up to date, or even backfill items if they were not
  added". Every task gets a `docs/ROADMAP.yaml` entry in phase P7 (id = branch name minus
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
  hotreloading". For visual or generated things (GIFs, the website, colour schemes), give Kai
  a preview first: a local server they can open, or files to look at, with options to choose.
- **Visibility.** After each merge: fast-forward main, rebuild the frontend on main, and say in
  a line what's now live. If the backend changed (a migration, a new or changed API), Kai must
  Ctrl+C and rerun `uv run jat serve` in their terminal; a frontend-only change needs a page
  refresh.
- **Version and status.** "it is ready, im using it. i just havent bumped a version number to
  the first major release". Kai then asked for 1.0.0 (released 2026-10-25) and for semver on
  every PR: "most are patch unless its new feature then it would be minor. it should be very
  explicit asking me for permission to merge a major bump". The rules are in `CLAUDE.md`
  (*Versions and releases*): bump in each PR, release each version, ask before any major.
  Released: v1.0.0 (#97) and v1.1.0 (#99, the Today page). Only internal planning files
  (`docs/ROADMAP.yaml`, `docs/COMPACTION.md`, `docs/IDEAS.md`) skip the bump.
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
  - PM dashboard: `python3 -m tools.pm` → http://127.0.0.1:8767 (`/board`, `/roadmap`; the home
    page lists only tasks ready to start). Kai asked for it on 2026-10-25 and it runs as a
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
- **Header** (`components/Layout.tsx`): wordmark → `/`; **New application**; search (`/`);
  **?** How it works (`components/HowItWorks.tsx`); theme toggle. Every date picker rings today
  (#82, theme `classNames` in `theme.ts` + `theme.module.css`).
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

### 4. Current state (snapshot 2026-10-29, after #101)

- **main at `db6bdb8`** (merge of #101), plus this doc's PR until it merges. No other open PRs,
  worktrees or remote branches. Version **1.1.0**, released as v1.1.0 (tag on `071f7e6`).
- **Merged since the last snapshot:**
  - #93 compaction doc; #94 roadmap: Windows support, one-command install, Docker; #95 roadmap:
    a double-click desktop app and a hosted version with accounts;
  - #96 marketing refresh: README first screen ("No account. No cloud. No AI. No tracking."),
    social card B + its script, website copy and SEO for non-developers, `llms.txt`, local
    Swagger UI, `.env.example` path, board.png retaken wider;
  - #97 1.0.0 and semver rules in `CLAUDE.md`, released v1.0.0; #98 roadmap: multi-language,
    Chinese first;
  - #99 the Today page (1.1.0), released v1.1.0; #100 roadmap: a live demo site with no server;
    #101 roadmap: `jat mcp`.
- **Tests on main:** 351 backend, 149 frontend. The machine is sometimes loaded: frontend
  tests that time out in a full run pass when run on their own; rerun those files first.
- **Kai's tracker** runs in Kai's terminal (answered `200` on 2026-10-27). Kai was told to
  restart after #96 (local API docs) and #99 (Today, version 1.1.0); unconfirmed.
- **Kai's messages since #92, in order:** compaction refresh (#93); "use agents, I want to
  review the user-facing marketing side … dont make any changes, just give me an analysis …
  I want to climb to the top of all GH tags search pages … setup google analytics or search
  console" (three reviewers, a report); "no tracking" (another selling point); "why would
  windows not be supported? … update the roadmap, dockerise this … Or does that make it harder
  for the lay-person?" (#94); "add the double click desktop item for lay-people … also an item
  for a cloud version that i host with user accounts" (#95); "item 3 loading swagger docs from
  cdn … work through all the SEO type items … except item 5 … add an item to the roadmap to cut
  a release after bumping to 1.0.0 … forget search console and GA … skip the CI tests workflow
  … Dont work on the roadmap stuff yet … preview it before its merged" (#96);
  '"with automatic git backups." to "with optional automatic git backups."'; "for the new
  social card, change the screenshot part … all of these competitor tools have a kanban"
  (Sankey); "lets go with b, then merge it" (#96); "start the dashboard"; "bump to version
  1.0.0, add claude instructions that each PR should follow semver … very explicit asking me for
  permission to merge a major bump … then create a release" (#97, v1.0.0); "is it worth having
  a different language version? e.g. chinese?" then "yes add multi-lang support to the
  roadmap, near the top" (#98) and "leave it for now" (Chinese README); "should we try and coin
  a new phrase?" then "forget it"; "a slightly better name … than job application tracker?"
  (ideas given, no decision); "The overview and next actions page are a bit confused … perhaps
  rethink these pages" (picked one Today page) then, while building: "dont merge until ive
  approved", "lots of empty space on the right", "what happened to gone quiet and needs
  attention", "add data so that all sections appear", "now it looks very busy" (picked a slimmer
  strip and flat groups), "rows/overflow doesnt look right", "small horizontal lines", "now it
  looks like a spreadsheet … our most difficult task yet" (three looks, then a fourth), "I like
  the new one, ship that", "i approve, ship/merge, update local main" (#99), "i approve the
  release, do it" (v1.1.0); "a demo site deployed somewhere. no backend just the ui … what are
  your ideas" (#100); "mcp or smt so local agents can query the status and perhaps make
  changes" (#101); "whats the roadmap URL"; then this compaction refresh.

### 5. Work in flight and candidates

- **In flight:** none (after this doc's PR merges).
- **Planned on the roadmap (P7), not started** ("Dont work on the roadmap stuff yet"; build one
  only when Kai asks): `windows-support`, `multi-language` (Chinese first, with a Chinese
  README), `packaged-install` (PyPI, `uvx`), `docker-image`, `desktop-app`, `hosted-version`
  (Kai hosts, with accounts), `demo-site` (GitHub Pages, the real backend in the browser via
  Pyodide behind a service worker, per-browser changes that reset daily, a Demo banner),
  `mcp-server` (`jat mcp`, stdio, read-only unless writes are switched on, undoable, no
  deleting).
- **Offered, waiting on Kai:**
  - The GitHub description and topics proposed in #96: description "Self-hosted job
    application tracker for software engineers. No account, no cloud, no AI, no tracking.
    Kanban board, recruiter CRM, interview rounds, follow-ups, offer comparison and Sankey
    insights; your data in readable files on your machine, with optional git backups. A free,
    open-source Huntr / Teal alternative."; topics: drop `jobhunt`, `job-seekers`, `recruiters`,
    add `huntr-alternative`, `kanban`, `privacy`.
  - A short brand name ahead of "a self-hosted job application tracker" (ideas: Pursuit,
    Offerboard, Shortlist, Followup, Dossier, Waypoint, Jobfolio; availability checks
    offered). Keep the repo name either way (search, and the Pages URL has no redirect).
  - The same tile rows on other pages' long lists (Interviews, Offers, Roles, a person's
    calls), as a separate small PR.
  - Drop *Screen* from the default workflow for everyone (Kai can already remove it from their
    own `config.toml` with the block we gave).
  - Drafts for other places to post (r/Python showcase format, a Show HN); Kai has the
    r/selfhosted megathread comment. Kai posts; never post on Kai's behalf. Growth plan from
    the #96 analysis: awesome-selfhosted from ~late Feb 2027 (needs a first release 4 months
    old, and a human-written PR), alternativeto.net, dev.to, Show HN once install is smooth.
  - Rebuild `docs/screenshots/demo.gif` from the new screenshots (Today, the whole picture,
    Insights tabs incl. CVs, Timeline by role, ghosts, board rounds); show a preview first. Its
    `scripts/demo_gif/scene.html` caption "A Sankey diagram from applied to offer" is stale.
- **Noticed, not promised:**
  - Ghost and star still missing in: the Timeline *About* select's people, to-do "about" text
    on Today.
  - Reply times: only weekdays, no bank holidays; waits on people before #73 weren't recorded.
  - CV files: an unticked application stays on offer until it has a CV recorded; files
    attached to applications don't use the "no CV yet" rule.
  - On phones: the header search overlaps the page title (Today's rows wrap properly since
    #99).
  - The application page's People card ignores a recruiter set through the route.
  - Today: a to-do on a role shows both on its role line and in Coming up; to-dos dated months
    ahead still count in Coming up; the numbers line hides when applications fail to load,
    offers count included.
  - Sankeys: the whole picture can still have a flow brushing a holding node's label (e.g.
    Screen → Withdrawn under *Still interviewing*); `untangle` only reorders columns.
  - Recruiter conversations' stat tiles and table still say *Passed* (only the Sankey says
    *Decided not to apply*).
  - Board round columns split only stages named "interview"; a Screen stage with rounds doesn't.
  - Reschedules before #90 have a count but no earlier time; a status change plus a new time
    in one save isn't counted as a reschedule.
  - `insights-stats.png` and `demo.gif` show older UI; `recruiters.png`, `person.png` and
    `roles.png` don't show ghosts, favourites, reply times or *Interested* yet.
  - Small nits left on purpose: re-passing a role re-stamps `decided_on`; all-day timeline
    items at UTC midnight; `GET /meetings?upcoming` defaults to UTC; timeline "pitched"
    wording even for a referrer.

### 6. The delivery loop

1. `git fetch -q && git worktree add -q .claude/worktrees/<name> -b worktree-<name> origin/main`,
   then EnterWorktree with `path`. Add the roadmap task (P7, `building`), commit, push with
   `-u`. In a new worktree, `pnpm --dir frontend install` before frontend commands.
2. Backend: model + migration (check `tests/test_db.py`), API, tests; new tables/columns in
   `tests/factories.py` `populate()`; regenerate OpenAPI and types. Commit and push.
3. Frontend: hooks (invalidate every query key that shows the data), components, pages,
   tests. Commit and push.
4. Docs: guide, README row and text, `llms.txt`, changelog with the PR number (`gh pr list
   --state all --limit 1` + 1) under a new `## X.Y.Z (date)` section, screenshots if visible UI
   changed. Bump the version (CLAUDE.md *Versions and releases*: five files, `uv lock`,
   `jat.openapi`, `gen:api`). Link check.
5. Live check: seed demo data, build the branch's frontend, serve on a spare port, drive it
   with Playwright, Read the screenshots (also at 375 px when rows gain buttons).
6. PR with `--body-file` (what Kai asked, quoted; what changed; checks). Start a background
   `general-purpose` reviewer: `gh pr diff N` once, Read files in the worktree, report
   must_fix/should_fix/nit with file:line. For anything touching Kai's real data, tell it to
   focus on data safety. Tell Kai what's happening meanwhile.
7. Apply fixes (more tests where it found gaps), re-run every check, set the roadmap task
   `done`, push. Poll `mergeStateStatus` for CLEAN, then merge.
8. ExitWorktree keep; on main: `git pull -q --ff-only`, `git worktree remove --force …`,
   `git branch -D …`, `git fetch -q --prune`; rebuild the frontend; TaskStop demo servers;
   check the tracker answers; report what's live and whether Kai must restart.
9. Release: `git tag -a vX.Y.Z <merge sha> -m vX.Y.Z`, `git push origin vX.Y.Z`,
   `gh release create vX.Y.Z --title vX.Y.Z --notes-file <that changelog section>
   --verify-tag` (notes extracted with a script into the tmp dir; make relative links
   absolute). Needs Kai's approval in the current message (section 1).

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

### 8. Gotchas already learned

- **Harness refusals.** Bash it can't prove stays in the entered worktree is refused:
  heredocs and inline Python (especially when the text contains "git"), `for` loops with
  variables as programs, `cd` before git, `&&` chains mixing git with other tools. Fix: Write a
  script to the tmp dir and run it with `python3`; Edit for small changes; split commands.
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
- **The auto-mode permission check** blocks merges and releases without Kai's explicit
  approval in the current message (section 1). A blocked command ran nothing.
- **Migrations that read config:** `migrate()` passes `cfg.attributes["data_dir"]`; a
  `config.toml` that doesn't load must stop the migration, never fall back silently (#83).
- **Data-touching features** (rewriting applications from another edit) get a reviewer told
  to focus on data safety; #92's first version flipped routes and was reworked before merge.

### 8a. How Kai works

- Uses the tracker for a real job search and reports gaps as they hit them, often several in
  one message or mid-turn: split them into PRs, fold small ones into the one in progress.
- Likes to see things running before they land (a local URL), then says "merge".
- Asks short questions ("how do i run thius?"): answer plainly with the exact command.
- Values findability, honesty about state, docs and images that match the code, a tidy repo,
  and the project being discoverable on GitHub.
- Refines visual things in quick rounds (the Sankeys took #84–#86): show a demo URL with each
  round, fold follow-ups into the open PR, and expect "merge it once ready and update local
  main" at the end.

### 9. Drop

Tool output, diffs and file contents already on disk; per-command narration; reviewer reports
already handled; screenshots already looked at; topic-research tables; superseded plans and
palettes; the earlier versions of this doc.

### 10. End the summary with

The resume steps below, then: "Next action: wait for Kai's next request; if none, check the
tracker answers and report."

---

## Resuming after compaction

1. **Re-read, don't trust memory:** `CLAUDE.md`, this file, `gh pr list`, `git worktree list`,
   `git branch -a`, `git log --oneline -5` on main and any worktree branch.
2. **Check the tracker:** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`.
   Kai runs it in their terminal (section 2): if it answers, leave it alone. If it's down, say
   so and offer to start it (`uv run jat serve` in the main checkout, as a background job), or
   Kai reruns it themselves.
3. **Open PRs first:** apply review fixes or start a reviewer; merge when clean; deploy.
4. **Unfinished worktrees:** commit and push, then finish that task.
5. **Then Kai's latest request.** If there isn't one, report the state in two lines and wait.
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
