# Compacting the build session

The long-running Claude Code session that builds this repo compacts its context now and then.
This file says what the summary must keep and how to carry on afterwards, so the work continues
as before.

**How to use it:** run `/compact` followed by everything under [The prompt](#the-prompt). After
compaction, the session follows [Resuming](#resuming-after-compaction).

Section 3 is a snapshot (2026-10-02); refresh it before each compaction. This repo is public:
nothing here may contain Kai's job-search data.

---

## The prompt

Summarise this session so work continues without asking Kai anything a sensible default
answers. Keep everything in sections 1–7 below, quoting Kai verbatim where quoted: standing
instructions, project facts, current state, the delivery loop, decisions, gotchas and how Kai
works. Keep ids, paths, ports, branch names, PR numbers, commit hashes and commands exact. Drop
what section 8 says. End with section 9's resume steps and one line: the next action.

### 1. Standing instructions from Kai

`CLAUDE.md` in the repo is the source of truth and wins on any conflict. Carry these:

- **Keep going.** "keep going. im going afk. you have enough to work on for ages, you'll hit a
  rate limit before you finish. just wait it out." On a rate limit, wait about 30 minutes and
  retry. The roadmap is finished (see section 3); new work now comes from Kai's feedback.
- **Commits.** "commit small and frequently and often". Conventional Commits, one logical unit
  each, push after committing. End every commit message with
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and every PR body with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **PRs.** One worktree and PR per task, branch `worktree-<name>`. Claude merges its own PRs with
  `gh pr merge N --merge --delete-branch` after a reviewer pass, fixing every `must_fix` and the
  reasonable `should_fix`. Docs-only PRs may skip review, but a large docs change gets a
  fact-check reviewer.
- **PM dashboard.** "keep the PM dashboard up to date, or even backfill items if they were not
  added". Every task from Kai's feedback gets a `docs/ROADMAP.yaml` entry (phase P7, id = branch
  name minus `worktree-`) in the PR that builds it; set it to `done` just before merging.
- **No agent-team skill in this repo.** Plain `general-purpose` reviewer subagents.
- **Visibility.** After each merge: fast-forward main, rebuild the frontend on main, restart the
  tracker if the backend changed (Kai is using it live), check both apps answer, and give a
  short status line saying what's now live.
- **README, `llms.txt` and the user guide.** Honest: a feature is "✅ Available" only once
  merged. Every PR that adds or changes a feature, command, setting or data-folder behaviour
  updates `docs/guide/` (and the README row and `llms.txt`) in the same PR, checked against the
  code. `readme-refresh-*` tasks cover both the README and `llms.txt`.
- **Version and status.** "we'll leave it as 0.1.0 for now, i havent tested it at all". Don't
  bump the version or tag a release. The README, `llms.txt` and `CHANGELOG.md` say "early
  development (0.1.0), built but not yet tested in real use".
- **Privacy.** Kai's data never enters this repo. Tests, fixtures, seed data and screenshots use
  fictional names (Contoso, Fabrikam, Northwind Talent, Alex Morgan, Riley Chen…) and
  example.com. Never act on Kai's real data folder beyond reading status (`/api/v1/backup`,
  `git log`/`status`) or restarting the tracker on it.
- **Scope cuts.** No job searching or scraping, no quick-add from URLs, no MCP server, no `.ics`
  export.
- **Documents** go in the repo, not artifacts. Deleting anything needs Kai's confirmation; if
  Kai declines, leave it.

### 2. Project facts

- **Repos.** Code: `/home/kai/Documents/Projects/job-application-tracker`
  (`waddington/job-application-tracker`, public). Data:
  `/home/kai/Documents/Projects/job-application-tracker-data` (private repo with a remote; Kai
  pushes it). Worktrees: `.claude/worktrees/<name>`.
- **Docs.** `docs/guide/` (user guide: install, your-data, using-the-app, customising, commands,
  troubleshooting), `docs/prd/tracker.md`, `docs/rfc/stack.md`, `docs/ROADMAP.yaml`,
  `CHANGELOG.md`, `docs/IDEAS.md`.
- **Stack.** Python 3.12, uv, FastAPI, SQLAlchemy 2.1, Alembic (migrations 0001–0005) and SQLite
  in `src/jat`. Frontend `frontend/`: Vite 8, React 19, TypeScript 5.9, Mantine 9, TanStack
  Router/Query, dnd-kit, d3-sankey, react-markdown, openapi-fetch.
- **Data folder.** Found by `--data-dir` or `JAT_DATA_DIR` (env var or `.env` in the repo root,
  read from the current directory); no default. `tracker.sqlite3` is git-ignored and rebuilt
  from `export/*.jsonl` by `jat restore` (or `jat init` on a fresh clone). Snapshots commit
  60 s after the last write; pushing is `jat push` only.
- **Running apps** (background jobs of this session, started from the main checkout with
  `timeout: 7200000`; they're killed after 2 hours, and when that happens say so rather than
  restarting in a loop; restart when Kai asks):
  - Tracker: `uv sync -q && uv run jat --data-dir /home/kai/Documents/Projects/job-application-tracker-data serve`
    → http://127.0.0.1:8770 (`/api/docs`). `serve` migrates the database on start.
  - PM dashboard: `python3 -m tools.pm` → http://127.0.0.1:8767.
- **Commands.**
  - Backend: `uv run pytest -q`, `uv run ruff check src tests`, `uv run ruff format -q src tests`.
  - Frontend: prefix pnpm with `PATH=/home/kai/.nvm/versions/node/v22.23.3/bin:/usr/local/bin:/usr/bin:/bin`;
    `pnpm --dir frontend typecheck | lint | test | build | format | gen:api`.
  - After API changes: `uv run python -m jat.openapi` then `pnpm --dir frontend gen:api`.
  - Demo: `uv run python scripts/seed_demo.py <new empty dir>` then
    `uv run jat --data-dir <dir> serve --port 88xx` (spare port; 8851 was the last used).
  - Screenshot: `google-chrome --headless=new --no-sandbox --user-data-dir=<tmp> --window-size=1400,900 --hide-scrollbars --virtual-time-budget=6000 --screenshot=<png> <url>`, then Read the PNG.
  - Link check for docs: a small script that resolves relative links and GitHub-style anchors.
- **Scratch files** in `/home/kai/.claude/jobs/cf5328f4/tmp`, never `/tmp`.

### 3. Current state (snapshot 2026-10-02)

- **main at `5d52a40`.** No open PRs. Only the main worktree (plus this doc's, until merged).
- **Roadmap P0–P6 all `done`** (35 tasks). Merged PRs #1–#46. Since the roadmap:
  - #42 status back to early development (0.1.0); #43 delete companies, roles, agencies, people,
    applications; #44 user guide; #45 person pages, add people from companies and
    applications, in-house recruiters, `internal_recruiter` relation, rename companies and
    agencies, type-to-add agency/company; #46 waiting to hear back (applications and people).
- **Tests on main:** 247 backend, 60 frontend.
- **Kai is testing it now on real data** and sending feedback, often mid-turn with screenshots.
- **Still waiting on Kai:** create `.env` in the main checkout
  (`JAT_DATA_DIR=$HOME/Documents/Projects/job-application-tracker-data`).
- **Open choice to mention if relevant:** in-house recruiters appear in the recruiter scorecard
  alongside agency ones (Claude's default; Kai hasn't objected).

### 4. Work in flight

None. The next work is whatever Kai asks for next.

### 5. The delivery loop

1. `git worktree add .claude/worktrees/<name> -b worktree-<name> origin/main` (stack on an
   unmerged branch when needed), then EnterWorktree with `path`. Add the task to
   `docs/ROADMAP.yaml` (P7, `status: building`) in the first commit.
2. Backend: domain logic, API, tests; regenerate OpenAPI. Commit and push.
3. Frontend: hooks, components, pages, tests. Commit and push.
4. Update `docs/guide/` (and README row, `llms.txt`) if user-facing.
5. Live check on demo data (seed → serve on a spare port → curl/screenshot → Read).
6. PR with `--body-file`; start a background `general-purpose` reviewer (it runs `gh pr diff N`
   once from the main checkout and Reads the worktree; must_fix/should_fix/nit, ~250 words).
   Meanwhile start the next task in its own worktree.
7. Apply fixes, re-run every check, push, poll until `mergeable` isn't UNKNOWN, merge.
8. ExitWorktree keep; on main: `git pull --ff-only`, `git worktree remove --force …`,
   `git branch -D …`, rebuild the frontend, restart the tracker, check both apps, report.

### 6. Decisions already made (don't re-litigate)

- **Workflow:** any-to-any moves by default; `transitions = "configured"` enforces the `next`
  rules (Jira-style). Custom stages without `transitions` stay strict.
- **Staleness:** not stale if snoozed, a follow-up is planned later, a round is booked ahead, or
  you're waiting to hear back.
- **Waiting to hear back:** `awaiting_reply_since` (a local date) on applications and contacts.
  It's set and cleared by buttons, logged on the application timeline, cleared by a stage move
  (an undo restores it). It's not inferred from logged messages, which have no direction.
- **People:** a contact belongs to an agency or a company. A direct application may have an
  in-house recruiter (no agency); an agency recruiter makes it an agency application.
  Relations: recruiter (agency), internal_recruiter, hiring_manager, interviewer, referrer,
  other. In a person summary, `source` means "brought it to you".
- **Deleting:** a company or role with applications (archived included) can't be deleted; a
  company's unused roles go with it. Deleting removes links and detaches files; notes stay.
- **Offers:** the newest per application counts; worth a year = salary + bonus + equity
  estimate + employer pension, or day rate × 220.
- **Search:** every word must match, accent- and case-insensitive; a scan in Python, no index.
- **Backups:** one zip via `GET /api/v1/backup/archive` or `jat archive`; no database inside;
  cross-site requests refused.
- **Security:** LocalOnly middleware (loopback host only, no cross-site writes, upload size by
  Content-Length). Tests use `TestClient(base_url="http://127.0.0.1", app=...)`.

### 7. Gotchas already learned

- **Harness refusals.** The sandbox refuses Bash it can't prove stays in the worktree:
  - heredocs or inline Python mentioning "git"; `for` loops over files with sed or uv; `$VAR`
    used as a program argument; `cd` into another worktree or the main checkout before git;
    `ffmpeg` filter strings.
  - Fix: write the script with Write into the tmp dir and run `python3 <file>`; commit with
    `git commit -F <file>`; split commands.
  - Edit/Write need the worktree you've entered. After a failed `cd`, the working directory may
    still be `frontend/`, so check before running git or uv.
- **False greens.** Read the pytest line before committing (a later fix once had to follow a
  commit with a failing test). Usual causes: OpenAPI drift, or an old test that encodes a rule
  you changed on purpose.
- **Rules that run on every PATCH** (`_check_route` merges current values) must not reject
  states old data may already be in, or unrelated edits start failing.
- **SQLAlchemy:** there's no relationship between companies and roles, so flush role deletes
  before deleting the company. Contact PATCH dumps JSON, so set dates explicitly.
- **Frontend:**
  - Nav routes are generated, so `navigate({to})` isn't typed; use `router.history.push`.
  - TanStack writes numeric-looking search params as JSON; read `location.search.q`, not
    `searchStr`.
  - Mantine menus/selects render options hidden: use `findByText` or `{hidden: true}`.
  - `<th>` without `scope="row"` counts as a column header in tests.
  - Detail mocks need every `ApplicationDetail` field.
  - Invalidate `["contact-summary"]` and the views that show names after renames.
- **gh:** "'main' is already used by worktree" is harmless. Poll mergeability.
- **GIFs:** ffmpeg's slideshow once collapsed to one frame. Use ImageMagick
  `convert -delay 250 -loop 0 frames/*.png -resize 1000x -colors 128 -layers Optimize`, then check
  the frame count with ffprobe.

### 7a. How Kai works

- Kai is testing the app for real and reports gaps as they hit them, sometimes several in one
  message, with screenshots. Answer the question straight away in a line (how to do it today,
  if there's a way), then fix the gap properly in a PR.
- Kai asks short questions ("did you turn the PM dashboard off?"). Answer plainly and honestly
  (it was the 2-hour limit), and offer the durable fix (run it in their own terminal).
- Kai values: findability (no dead ends like "do it from an application" with no way to),
  honesty about state, documentation that matches the code.

### 8. Drop

Tool output, diffs and file contents already on disk; per-command narration; handled reviewer
reports (their fixes are in git); superseded plans (Obsidian, other UI kits, Next.js,
restricted-by-default workflow, `.ics`); the earlier compaction doc's content.

### 9. End the summary with

The resume steps below, then: "Next action: wait for Kai's next request; if none, check both apps
are running and report."

---

## Resuming after compaction

1. **Re-read, don't trust memory:** `CLAUDE.md`, this file, `gh pr list`, `git worktree list`,
   `git log --oneline -5` on main and any worktree branch.
2. **Check the apps:** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`
   and `http://127.0.0.1:8767/`. If one is down, tell Kai; restart it (section 2) if Kai wants it
   or work needs it.
3. **Open PRs first:** apply review fixes or start a reviewer; merge when clean.
4. **Unfinished worktrees:** commit and push, then finish that task.
5. **Then Kai's latest request.** If there isn't one, report the state in two lines and wait.
6. **Before the next compaction,** refresh sections 3 and 4 in a small docs PR.
