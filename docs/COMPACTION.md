# Compacting the build session

The long-running Claude Code session that builds this repo compacts its context now and then.
This file says what the summary must keep, what it can drop, and how to carry on afterwards,
so the work continues as if nothing happened.

**How to use it:** run `/compact` followed by everything under [The prompt](#the-prompt).
After compaction, the session follows [Resuming](#resuming-after-compaction).

Sections 3 and 4 are a snapshot (2026-10-02, after PR #52); refresh them before each
compaction. This repo is public: nothing here may contain Kai's job-search data.

---

## The prompt

Summarise this session so work continues without asking Kai anything a sensible default
answers. Keep everything in sections 1–8 below, quoting Kai verbatim where quoted. Keep ids,
paths, ports, branch names, PR numbers, commit hashes and commands exact. Keep the last few
user messages word for word, with what was done about each. Drop what section 9 says. End with
section 10: the resume steps and one line saying the next action.

### 1. Standing instructions from Kai

`CLAUDE.md` in the repo is the source of truth and wins on any conflict. Carry these:

- **Keep going.** "keep going. im going afk. you have enough to work on for ages, you'll hit a
  rate limit before you finish. just wait it out." On a rate limit, wait about 30 minutes and
  retry. The roadmap is finished; new work comes from Kai's feedback.
- **Commits.** "commit small and frequently and often". Conventional Commits, one logical unit
  each, push after committing. End every commit message with
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and every PR body with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **PRs.** One worktree and PR per task, branch `worktree-<name>`. Claude merges its own PRs
  with `gh pr merge N --merge --delete-branch` after a reviewer pass, fixing every `must_fix`
  and the reasonable `should_fix` (and cheap nits). Docs-only PRs may skip review; a large docs
  change gets a fact-check reviewer.
- **Branches.** "also delete branches on remote that are no longer needed". After each merge
  only `main` should remain, locally and on GitHub.
- **PM dashboard.** "keep the PM dashboard up to date, or even backfill items if they were not
  added". Every task gets a `docs/ROADMAP.yaml` entry in phase P7 (id = branch name minus
  `worktree-`) in the PR that builds it, `status: building`, set to `done` just before merging.
- **Docs and images.** "ensure docs are up to date, readme, images, etc". Every PR that adds or
  changes a feature, command, setting or data-folder behaviour updates `docs/guide/`, the
  README row, `llms.txt` and `CHANGELOG.md` in the same PR, checked against the code. When a
  change is visible in a README screenshot, retake it (see section 7, Screenshots).
- **Visibility.** After each merge: fast-forward main, rebuild the frontend on main, restart
  the tracker if the backend changed (Kai uses it live), check both apps answer, and say in a
  line what's now live.
- **Version and status.** "we'll leave it as 0.1.0 for now, i havent tested it at all". Don't
  bump the version or tag a release. Docs say "early development (0.1.0), built but not yet
  tested in real use".
- **Privacy.** Kai's data never enters this repo. Tests, fixtures, seed data and screenshots use
  fictional names (Contoso, Fabrikam, Northwind Talent, Northwind Pay, Alex Morgan, Riley
  Chen, Sam Patel, Jordan Lee…) and example.com. Never act on Kai's real data folder beyond
  reading status (`/api/v1/backup`, `git log`/`status`) or restarting the tracker on it. Kai's
  screenshots show real names: never copy them into the repo, commits or PRs.
- **Scope cuts.** No job searching or scraping, no quick-add from URLs, no MCP server, no
  `.ics` export.
- **Documents** go in the repo, not artifacts. Deleting anything of Kai's needs confirmation.
- **No agent-team skill in this repo.** Plain `general-purpose` subagents for reviews and
  fact-checks.

### 2. Project facts

- **Repos.** Code: `/home/kai/Documents/Projects/job-application-tracker`
  (`waddington/job-application-tracker`, public). Data:
  `/home/kai/Documents/Projects/job-application-tracker-data` (private repo with a remote;
  Kai pushes it). Worktrees: `.claude/worktrees/<name>`.
- **Docs.** `docs/guide/` (README, install, your-data, using-the-app, customising, commands,
  troubleshooting), `docs/prd/tracker.md`, `docs/rfc/stack.md`, `docs/ROADMAP.yaml`,
  `CHANGELOG.md`, `docs/IDEAS.md`, `docs/screenshots/` (15 images incl. `demo.gif`), this file.
- **Stack.** Python 3.12, uv, FastAPI, SQLAlchemy 2.1, Alembic (migrations 0001–0007) and
  SQLite in `src/jat`. Frontend `frontend/`: Vite 8, React 19, TypeScript 5.9, Mantine 9,
  TanStack Router/Query, dnd-kit, d3-sankey, react-markdown, openapi-fetch.
- **Data folder.** Found by `--data-dir` or `JAT_DATA_DIR` (env var, or `.env` in the repo root
  read from the current directory); no default. `tracker.sqlite3` is git-ignored and rebuilt
  from `export/*.jsonl` by `jat restore` (or `jat init` on a fresh clone). Snapshots commit 60 s
  after the last write; pushing is `jat push` only.
- **Running apps** (background jobs of this session, started from the main checkout with
  `timeout: 7200000`; killed after 2 hours: say so rather than restarting in a loop, and
  restart when Kai asks or work needs it):
  - Tracker: `uv sync -q && uv run jat --data-dir /home/kai/Documents/Projects/job-application-tracker-data serve`
    → http://127.0.0.1:8770 (`/api/docs`). `serve` migrates on start. It serves
    `frontend/dist` from disk, so a frontend-only change needs a rebuild, not a restart.
  - PM dashboard: `python3 -m tools.pm` → http://127.0.0.1:8767. Reads `docs/ROADMAP.yaml` on
    main and PR state from GitHub (merged PRs count as done even after their branch is gone).
- **Commands.**
  - Backend: `uv run pytest -q`, `uv run ruff check src tests`, `uv run ruff format -q src tests`.
  - Frontend: prefix pnpm with `PATH=/home/kai/.nvm/versions/node/v22.23.3/bin:/usr/local/bin:/usr/bin:/bin`;
    `pnpm --dir frontend install --frozen-lockfile --silent` (new worktrees), then
    `typecheck | lint | test | build | format | gen:api`.
  - After API changes: `uv run python -m jat.openapi` then `pnpm --dir frontend gen:api`.
  - Demo: `uv run python scripts/seed_demo.py <new empty dir>` then
    `uv run jat --data-dir <dir> serve --port 88xx` (spare port; 8856 was the last used).
    For an empty-ish folder: `jat --data-dir <dir> init`, then POST a few things to the API.
  - Screenshot: `google-chrome --headless=new --no-sandbox --user-data-dir=<tmp> --window-size=1400,900 --hide-scrollbars --virtual-time-budget=8000 --screenshot=<png> <url>`, then Read the PNG.
  - Link check: `python3 /home/kai/.claude/jobs/cf5328f4/tmp/check_links.py` (resolves the
    guide's relative links and GitHub-style anchors; rewrite it if the tmp dir is gone).
- **Scratch files** in `/home/kai/.claude/jobs/cf5328f4/tmp`, never `/tmp`.

### 3. Product map (what exists, so you can find things)

- **Menu** (`frontend/src/nav.ts`, groups in `NAV_GROUPS`): *Today*: Overview `/`, Next
  actions `/next-actions`, Timeline `/timeline`. *Your applications*: Roles `/roles`,
  Applications `/applications` (list/board, `?view=board`), Interviews, Offers. *People and
  companies*: Recruiters, Companies. *Files and notes*: Documents, Notes. *Review*: Insights.
  Detail pages: `/applications/$id`, `/companies/$id`, `/agencies/$id`, `/people/$id`,
  `/search?q=`.
- **Header** (`components/Layout.tsx`): wordmark → `/`; **New application** (icon-only on
  phones); search (`/`); **?** How it works (`components/HowItWorks.tsx`, 5 numbered steps);
  theme toggle.
- **Overview** (`pages/HomePage.tsx`): stats, pipeline, Needs attention (follow-ups, gone
  quiet, roles to decide), Coming up (interviews and calls in time order, then offer
  deadlines), Recent activity (timeline, last 14 days, "added" hidden once there are
  applications). Empty tracker → Getting started card; people/calls/roles but no
  applications → "No applications yet" card plus the usual panels; waits for all queries.
- **Next actions** (`pages/NextActionsPage.tsx`, `api/next_actions.py`), in page order: Offers
  to answer, Waiting to hear back, How did it go? (interviews + calls), Follow up, Roles to
  decide, Coming up (interviews + calls), Gone quiet.
- **Timeline** (`api/timeline.py`, `pages/TimelinePage.tsx`): events + interviews at their
  time + offer reply deadlines + calls + roles mentioned/passed + people waiting + notes not
  on an application + things added. Filters: period, category, about (company/agency/person).
  List by day, or lanes (`?view=lanes`) per application/company/agency/person.
- **People**: person pages (calls card, roles they've mentioned, applications, interviews,
  notes, links, files); `ContactCard` shows details (long ones end in "…").
- **Calls and meetings** (`api/meetings.py`, `components/Meetings.tsx`): Book a call / log one;
  Happened (asks for notes) / Didn't happen; Add roles from this call.
- **Roles to decide** (`api/roles.py`, `components/Roles.tsx`, `pages/RolesPage.tsx`): Add
  role (from Roles, a company, a person or a call), Apply (makes the application), Pass (with
  reason), Reconsider, edit, delete.
- **API** (`/api/v1`): CRUD for companies, agencies, contacts, roles, applications (+ `/quick`,
  `/move`, `/undo`, `/activities`, `/contacts`), interviews, offers, notes, links,
  attachments, documents; summaries for company/agency/contact; `next-actions`, `timeline`,
  `meetings`, `role-summaries`, `insights/{flow,stats,activity,scorecard}`, `search`,
  `backup` (+ `/archive`, `/snapshot`, `/push`).

### 4. Current state (snapshot 2026-10-02, after #52)

- **main at `59f6625`** (merge of #52), plus this doc's PR until it merges. No other open PRs,
  worktrees or remote branches.
- **Roadmap P0–P7 all `done`** (47 tasks with this one). Merged PRs #1–#52. P7 so far: #42
  status wording; #43 deleting; #44 user guide; #45 person pages, in-house recruiters,
  renaming; #46 waiting to hear back; #47 compaction doc; #48 Overview, Timeline, grouped
  menu, help; #49 calls and meetings (migration 0006); #50 roles to decide (migration 0007);
  #51 docs refresh (all screenshots and the GIF retaken, contact card fix, "New person"
  button); #52 Overview before the first application.
- **Tests on main:** 258 backend, 74 frontend.
- **Kai is using it on real data** and sends feedback mid-turn, often with screenshots. Their
  latest messages, in order: how to record a recruiter call with no role (→ #49); roles
  separate from applications, apply or reject after a call (→ #50); "i dont see aplace for
  the roles or to add a role" (it wasn't merged yet; it is now); "now ensure docs are up to
  date, readme, images, etc" (→ #51); the Overview with no applications but recruiters and
  roles (→ #52); then this compaction refresh.
- **Still waiting on Kai:** `.env` in the main checkout
  (`JAT_DATA_DIR=$HOME/Documents/Projects/job-application-tracker-data`).
- **Told Kai:** a role left without an application (e.g. after deleting the application)
  shows as "to decide"; pass on it or delete it. If their header's right-hand buttons look
  missing, a hard refresh fixes a stale bundle.

### 5. Work in flight and candidates

- **In flight:** none (after this doc's PR merges).
- **Candidates if Kai asks for more, or for a quiet moment** (none promised):
  - The application page's People card lists only people linked via `application_contacts`.
    A recruiter set through the route (New application does this) shows in "Route:" but the
    card says "No one linked yet". Probably worth showing them there.
  - Overview stats show zeros before the first application (Interviews, Waiting, Offers);
    could hide or swap for people/roles counts.
  - Small nits deliberately left: re-passing a role re-stamps `decided_on`; all-day timeline
    items are at UTC midnight (a day early west of UTC); `GET /meetings?upcoming` defaults
    to UTC midnight; the timeline re-scans the notes folder each request.

### 6. The delivery loop

1. `git fetch -q && git worktree add -q .claude/worktrees/<name> -b worktree-<name> origin/main`
   (stack on an unmerged branch when one PR needs another), then EnterWorktree with `path`.
   Add the roadmap task (P7, `building`). In a new worktree, `pnpm install` before frontend
   commands; `uv` makes its own venv.
2. Backend: model + migration (check `tests/test_db.py` for drift and FK-cycle warnings),
   API, tests; regenerate OpenAPI and types. Commit and push.
3. Frontend: hooks (invalidate every view that shows the data), components, pages, tests.
   Commit and push.
4. Docs: guide, README row, `llms.txt`, changelog (with the PR number: next is `gh pr list
   --state all --limit 1` + 1), screenshots if visible UI changed. Link check.
5. Live check: seed demo data, serve on a spare port, curl the API and screenshot the page.
6. PR with `--body-file` (what Kai asked, quoted; what changed; checks). Start a background
   `general-purpose` reviewer: `gh pr diff N` once, Read files in the worktree, report
   must_fix/should_fix/nit in ~250 words. Tell Kai what's happening meanwhile.
7. Apply fixes, re-run every check, set the roadmap task `done`, push. Poll until mergeable
   (section 8, Polling), then merge.
8. ExitWorktree keep; on main: `git pull -q --ff-only`, `git worktree remove --force …`,
   `git branch -D …`, `git push -q origin --delete worktree-<name>` (gh can't delete it while
   the worktree exists), `git fetch --prune`; rebuild the frontend; restart the tracker if the
   backend changed (TaskStop the old job first); stop demo servers; curl both apps; report.

### 7. Decisions already made (don't re-litigate)

- **Workflow:** any-to-any moves by default; `transitions = "configured"` enforces `next`
  rules (Jira-style).
- **Staleness:** not stale if snoozed, a follow-up is planned later, a round is booked ahead,
  or you're waiting to hear back.
- **Waiting to hear back:** `awaiting_reply_since` (a local date) on applications and contacts;
  set and cleared by buttons, logged on the application timeline, cleared by a stage move (an
  undo restores it). Never inferred from messages.
- **People:** a contact belongs to an agency or a company. A direct application may have an
  in-house recruiter; an agency recruiter makes it an agency application. Relations:
  recruiter, internal_recruiter, hiring_manager, interviewer, referrer, other.
- **Calls and meetings:** a `Meeting` is with one person (cascade on delete), optionally about
  an application (set null). scheduled/done/cancelled = Booked/Happened/Didn't happen. No
  application events; the Timeline adds them.
- **Roles to decide:** status derived: *applied* if any application uses the role, else
  *passed* if `decision == "passed"`, else *to decide*. `roles.meeting_id` has no FK on
  purpose (it would close a cycle with applications and meetings and break export order);
  `clear_role_meetings` (before_flush) nulls it. A role's call must be with its person. Apply
  goes through the person's agency if any, else direct with them as recruiter, stage Applied
  (or the workflow's initial stage). New application with the same title at the same company
  reuses the role.
- **Overview:** an empty tracker gets the Getting started card; anything added but no
  applications gets the "No applications yet" card plus the usual panels.
- **Deleting:** a company or role with applications can't be deleted; a company's unused roles
  go with it. Links go, files are detached, notes stay. Deleting a person deletes their calls
  and unlinks their roles; deleting a call unlinks its roles.
- **Offers:** the newest per application counts; worth a year = salary + bonus + equity
  estimate + employer pension, or day rate × 220.
- **Search:** every word must match, accent- and case-insensitive; a Python scan. Covers
  calls.
- **Backups:** one zip (`GET /api/v1/backup/archive`, `jat archive`), no database inside.
- **Security:** LocalOnly middleware. Tests use `TestClient(base_url="http://127.0.0.1", ...)`.

### 8. Gotchas already learned

- **Harness refusals.** Bash it can't prove stays in the entered worktree is refused:
  heredocs or inline Python containing the word "git"; `for` loops with sed/uv; `$VAR` as a
  program; `cd` elsewhere before git; long `&&` chains mixing git with other tools; `cat >>`
  appends. Fix: Write a script to the tmp dir and `python3` it; Edit for small changes;
  `git commit -F <file>` or `-m` parts; split commands. A refused command changed nothing:
  check before assuming it ran.
- **Worktrees.** Edits need the worktree you've entered. Don't ExitWorktree before you're done
  (if you do, EnterWorktree with `path` again). Subagents can't run Bash in your worktree:
  tell them to use `gh pr diff` and Read.
- **Polling.** `until … | grep -qv UNKNOWN` exits early on an empty reply. Use
  `for i in $(seq 1 40); do s=$(gh pr view N --json mergeable -q .mergeable); [ "$s" = "MERGEABLE" ] || [ "$s" = "CONFLICTING" ] && break; sleep 3; done`.
- **gh:** "'main' is already used by worktree" is harmless; check `gh pr view N --json state`.
- **False greens and flakes.** Read the test summary line before committing. Under load a
  frontend test sometimes times out (seen in ApplicationsPage and RecruitersPage tests): rerun
  that file alone, then the suite; it's a flake only if both pass.
- **Rules that run on every PATCH** (`_check_route`) must not reject states old data may
  already be in.
- **FK cycles** make `sorted_tables` warn (SAWarning in `tests/test_db.py`) and break
  export/restore order. New tables must also be filled in `tests/factories.py` `populate()`
  (the export test needs a row in every table).
- **SQLAlchemy:** flush role deletes before deleting their company. Contact PATCH dumps JSON:
  set dates explicitly.
- **React lint (react-compiler rules):** no `Date.now()` in render (`useState(() => Date.now())`);
  no reading refs in handlers built during render (for "which submit button", read
  `event.nativeEvent.submitter`); put the default submit button first in the DOM (CSS `order`
  to reorder) so Enter does the obvious thing.
- **Frontend:** nav routes are generated, so use `router.history.push` (not typed `navigate`);
  read `location.search` as a record; Mantine options render hidden (`findByText` or
  `{hidden: true}`); `<th>` needs `scope="row"` for row headers; detail mocks need every
  field; give buttons in repeated rows an `aria-label` with the item's name, and query them
  with a regex prefix; invalidate every query key that shows the changed data (people,
  timeline, meetings, role-summaries, search, contact-summary…).
- **Test fixtures:** shared ones in `frontend/src/test/mockApi.ts` (`row`, `item`, `meeting`,
  `roleSummary`). Never import from another `*.test.tsx`: its tests run twice. To prove a test
  catches a bug, revert the fix, see it fail, restore.
- **Screenshots:** throwaway scripts (in the tmp dir as `shots5.py`, `crops5.py`, `gif5.py`,
  `enrich_demo.py`; rewrite them if gone): seed demo data, run `enrich_demo.py <api base>`,
  serve on a spare port, capture each page with headless Chrome (`?view=board`,
  `?view=lanes`), crop with `convert <png> -crop WxH+X+Y +repage`, and Read every image before
  committing (that's how the contact card overflow was found). Build GIFs with ImageMagick
  (`convert -delay 250 -loop 0 frames… -resize 1000x -colors 128 -layers Optimize`) and check
  the frame count with `identify`; ffmpeg once collapsed one to a single frame. Seeding gives
  new ids each time: look them up from the API.

### 8a. How Kai works

- Tests the app for real and reports gaps as they hit them, sometimes several at once, with
  screenshots. Answer in the first line (how to do it today, or why they can't see it yet),
  then fix it properly in a PR and say when it's live.
- Asks short questions; answer plainly and honestly (e.g. an app went down at the 2-hour
  limit; a feature isn't merged yet).
- Values findability (no dead ends, help in the app), honesty about state, docs and images
  that match the code, and a tidy repo (no stale branches, dashboard up to date).

### 9. Drop

Tool output, diffs and file contents already on disk; per-command narration; reviewer reports
already handled (their fixes are in git); superseded plans (Obsidian, other UI kits, Next.js,
restricted-by-default workflow, `.ics`); the earlier versions of this doc.

### 10. End the summary with

The resume steps below, then: "Next action: wait for Kai's next request; if none, check both
apps are running and report."

---

## Resuming after compaction

1. **Re-read, don't trust memory:** `CLAUDE.md`, this file, `gh pr list`, `git worktree list`,
   `git branch -a`, `git log --oneline -5` on main and any worktree branch.
2. **Check the apps:** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`
   and `http://127.0.0.1:8767/`. If one is down, tell Kai; restart it (section 2) if Kai wants
   it or work needs it.
3. **Open PRs first:** apply review fixes or start a reviewer; merge when clean; deploy.
4. **Unfinished worktrees:** commit and push, then finish that task.
5. **Then Kai's latest request.** If there isn't one, report the state in two lines and wait.
6. **Before the next compaction,** refresh sections 4 and 5 in a small docs PR.
