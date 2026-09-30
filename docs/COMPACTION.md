# Compacting the build session

The long-running Claude Code session that builds this repo compacts its context now and then.
This file says what the summary must keep, and how to pick up afterwards, so the build carries
on unattended exactly as before.

**How to use it:** run `/compact` followed by everything under [The prompt](#the-prompt).
After compaction, the session follows [Resuming](#resuming-after-compaction).

The [current state](#3-current-state-snapshot-2026-09-30) section is a snapshot; refresh it before
each compaction. This repo is public: nothing here may contain Kai's job-search data.

---

## The prompt

Summarise this session so work continues with no questions to Kai. Keep, verbatim where
quoted, everything in sections 1–7 below: standing instructions, project facts, current state,
work in flight, the delivery loop, decisions already made and the gotchas. Keep ids, paths,
ports, branch names, PR numbers, commit hashes and commands exact. Drop what section 8 says.
End the summary with section 9's "resume" steps and one line: the exact next action.

### 1. Standing instructions from Kai

`CLAUDE.md` in the repo is the source of truth and wins on any conflict. Carry these:

- **Keep going.** "keep going. im going afk. you have enough to work on for ages, you'll hit a
  rate limit before you finish. just wait it out." Never stop because one task is done; take the
  next roadmap task. On a rate limit, wait about 30 minutes and retry.
- **Commits.** "commit small and frequently and often". Conventional Commits, one logical unit
  each, push after committing. End every commit message with
  `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>` and every PR body with
  `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **PRs.** One worktree and PR per roadmap task, on branch `worktree-<task id>` (the PM dashboard
  links them). Claude merges its own PRs (`.claude/settings.json` allows `gh pr merge`) with
  `gh pr merge N --merge --delete-branch`, after a reviewer pass and after fixing every
  `must_fix` and the reasonable `should_fix` findings. Docs-only PRs may skip the reviewer.
- **No agent-team skill in this repo.** Use plain `general-purpose` reviewer subagents.
- **`.gitignore` follows the stack.** When a technology enters the repo, append its
  github/gitignore template under `# --- <Name> (github/gitignore) ---`. Python and Node are in.
- **README.** Catchy, search- and LLM-friendly, aimed at GitHub stars, and honest: a feature is
  "✅ Available" only once merged. Update the README row and `llms.txt` as features land;
  `readme-refresh-N` tasks refresh screenshots after each feature group.
- **Privacy.** Kai's data never enters this public repo. Tests, fixtures, seed data and
  screenshots use fictional names (Contoso, Fabrikam, Northwind Talent, Alex Morgan…) and
  example.com only.
- **Scope cuts.** No job searching or scraping, no quick-add from URLs, no MCP server.
- **Visibility.** Kai wants to see progress. After each merge: fast-forward main, rebuild the
  frontend on main, restart the tracker if the backend changed, and give a short status line.
- **Documents.** Project documents go in the repo, not in artifacts. Kai confirms deletes; if
  Kai declines one, leave it.
- **Product decisions Kai made mid-build** (see section 6): interview rounds with descriptions;
  stage moves any-to-any by default with Jira-style transitions as an opt-in.

### 2. Project facts

- **Repos.** Code: `/home/kai/Documents/Projects/job-application-tracker`
  (`waddington/job-application-tracker`, public). Data:
  `/home/kai/Documents/Projects/job-application-tracker-data`
  (`waddington/job-application-tracker-data`, private). Worktrees: `.claude/worktrees/<name>`.
- **Plan.** `docs/prd/tracker.md` (PRD, FR1–FR23), `docs/rfc/stack.md` (accepted stack RFC),
  `docs/ROADMAP.yaml` (phases P0–P6 with task status), `docs/planning/README.md`, `docs/IDEAS.md`.
- **Stack.** Python 3.12, uv, FastAPI, SQLAlchemy 2.1, Alembic (migrations 0001–0003) and SQLite
  in `src/jat`. Frontend in `frontend/`: Vite 8, React 19, TypeScript 5.9 (pinned), Mantine 9,
  TanStack Router and Query, dnd-kit, react-markdown + remark-gfm, openapi-fetch typed client.
- **Backend layout.** `api/` (routers, schemas, deps, crud, interviews, notes, links, attachments,
  documents, next_actions, insights, backup), `domain/` (workflow, applications, duplicates,
  interviews, insights), `storage/` (notes, files, eml), `snapshot/`, `security.py` (LocalOnly
  middleware), `cli.py`, `app.py`.
- **Data format.** `tracker.sqlite3` is git-ignored. `export/*.jsonl` + `_meta.json`, `notes/`
  (Markdown files with YAML frontmatter, the source of truth), `files/` (attachments) and
  `config.toml` are committed to the data repo. Snapshots auto-commit after 60 s idle; push only
  on demand (`jat push`), never forced. `.tmp/` (upload staging) is git-ignored.
- **Running apps** (background processes of the session, started from the main checkout, with
  `timeout: 7200000` because background jobs are killed at their time limit):
  - Tracker: `uv sync -q && uv run jat --data-dir /home/kai/Documents/Projects/job-application-tracker-data serve`
    → http://127.0.0.1:8770 (API docs `/api/docs`). `serve` migrates the DB on start.
  - PM dashboard: `python3 -m tools.pm` → http://127.0.0.1:8767.
- **Commands.**
  - Backend: `uv run pytest -q`, `uv run ruff check src tests`, `uv run ruff format -q src tests`.
  - Frontend (in `frontend/`): `pnpm typecheck | lint | test | build | format`.
  - After API changes: `uv run python -m jat.openapi` then `pnpm --dir frontend gen:api`
    (`tests/test_openapi.py` fails on drift).
  - Demo data: `uv run python scripts/seed_demo.py <new empty dir>`, then
    `uv run jat --data-dir <dir> serve --port 88xx` (use a fresh port per check; 8770/8767 are Kai's).
  - Screenshots: `google-chrome --headless=new --no-sandbox --user-data-dir=<tmp> --window-size=1400,900 --virtual-time-budget=6000 --screenshot=<png> <url>`,
    then Read the PNG to check it.
- **Node.** Needs Node ≥ 22.12. Prefix every pnpm command with
  `PATH=/home/kai/.nvm/versions/node/v22.23.3/bin:/usr/local/bin:/usr/bin:/bin`.
- **Scratch files** go in `$CLAUDE_JOB_DIR/tmp` (`/home/kai/.claude/jobs/cf5328f4/tmp`), not `/tmp`.

### 3. Current state (snapshot 2026-09-30)

- **Merged to main** (main at `7f12581`), P0–P4 complete:
  - #1–#16: setup, planning, PM dashboard, README, stack RFC, data dir, schema, app shell,
    workflow, API, snapshots, list, board, detail pages.
  - #17 recruiters · #18/#19 docs · #20 duplicate warning · #21 interview rounds · #22 README
    refresh 1 · #23 workflow modes (any-to-any) · #24 notes · #25 links · #26 attachments +
    LocalOnly security middleware · #27 `.eml` import · #28 CV/cover-letter documents ·
    #29 Next actions · #30 one-click follow-up/snooze/Ghosted · #31 README refresh 2.
- **No open PRs.** Tests on main: 215+ backend, 40 frontend.
- **Roadmap left** (in order): `sankey` (in flight), `stats`, `scorecard`, `readme-refresh-3`,
  then P6 `offers`, `ics-export`, `backup-export`, `search`, `readme-refresh-4`.
- **Waiting on Kai** (don't block on these):
  - Create `.env` in the main checkout:
    `echo "JAT_DATA_DIR=$HOME/Documents/Projects/job-application-tracker-data" > .env`
    (the harness blocks Claude writing it).
  - Push the data repo (`jat push`); it has local snapshot commits only.
  - Optionally set the GitHub repo description and topics.

### 4. Work in flight

- **`sankey`**, worktree `.claude/worktrees/sankey`, branch `worktree-sankey`, backend committed
  and pushed (`d617ff3`, no PR yet):
  - `src/jat/domain/insights.py`: stage paths from events (undone moves excluded), folded
    forwards in workflow order (active → success → closed) so the Sankey has no loops;
    `flow(session, workflow, since, until, route)`.
  - `src/jat/api/insights.py`: `GET /api/v1/insights/flow?since&until&route` → `{applications,
    nodes[{id,name,kind,color,reached,current}], links[{source,target,value}]}`.
  - `tests/test_insights.py` passes; OpenAPI regenerated.
  - **Next:** frontend. Add `d3-sankey` and `@types/d3-sankey` (compute the layout, render SVG in
    React). New `frontend/src/pages/InsightsPage.tsx` at `/insights` (replace the placeholder in
    `router.tsx` `PAGES`), with filters: date range (all time / last 30 / 90 days) and route
    (any / direct / agency / referral); stage colours from the workflow; hover shows counts.
    `frontend/src/App.test.tsx` "renders a placeholder for each page" currently uses `/insights`;
    once every nav page is built, test the Placeholder component directly instead. Then live
    check on demo data, screenshot, README row ("Sankey diagram" → ✅), roadmap `sankey: done`,
    PR, reviewer, fixes, merge.
- **`compaction-doc`**: this file (branch `worktree-compaction-doc`).

### 5. The delivery loop, per roadmap task

1. Branch from `origin/main` (`git worktree add .claude/worktrees/<name> -b worktree-<name> origin/main`),
   or stack on an unmerged branch when the task needs it; enter it with EnterWorktree `path`.
2. Backend first: domain logic, API, tests; regenerate OpenAPI. Commit and push.
3. Frontend: hooks, components, page wiring, tests. Commit and push.
4. Live check on demo data (seed → serve on a spare port → curl/screenshot → Read the PNG).
   Never on Kai's real data.
5. Update the README row(s) and `llms.txt` if a feature became available; set the roadmap task
   to `done`. Commit.
6. PR with `--body-file` (write the body to the job tmp dir first).
7. Start a background `general-purpose` reviewer subagent: tell it to run `gh pr diff N` once from
   the main checkout, and to Read files in the worktree if Bash is blocked; ask for
   must_fix / should_fix / nit with file:line, under ~250 words. Meanwhile start the next task
   on a new worktree (stacked if it depends on this one).
8. Fix `must_fix` and reasonable `should_fix`, re-run all checks, commit, push, wait for
   `mergeable` to leave UNKNOWN, merge, confirm `MERGED`.
9. `ExitWorktree keep`, then in the main checkout: `git pull --ff-only`,
   `git worktree remove --force .claude/worktrees/<name>`, `git branch -D worktree-<name>`,
   rebuild the frontend, restart the tracker if the backend changed, check both apps respond.

### 6. Decisions already made (don't re-litigate)

- **Workflow:** `[workflow] transitions = "any"` is the default (move between any stages; the
  configured rules become `suggested_next` hints, highlighted on the board and listed first in
  "Move to…"). `"configured"` enforces them, Jira-style. A `config.toml` with its own
  `[[workflow.stages]]` and no `transitions` stays `"configured"`.
- **Interview rounds:** numbered rounds with a free-text description ("Round 2 · Engineering
  manager chat"); the current round shows on board, list and header while the stage is active.
- **Staleness:** not stale if snoozed, if a follow-up is planned for a later date, or if any round
  is booked in the future. Next actions takes the client's local `today` and `since`.
- **Notes** are `.md` files (source of truth) indexed in `note_index`; edits outside the app are
  picked up; PATCH takes `base_updated_at` and returns 409 on conflicting edits.
- **Links/attachments** point at entities by `entity_type` + `entity_id` (`ENTITY_MODELS` in
  `db/models.py`, including `document`). Deleting an entity deletes its links and *detaches*
  its files (kept as unattached). A document version's file can't be deleted via `/attachments`.
- **Security:** `LocalOnly` middleware refuses non-loopback `Host` (unless bound to a specific
  host) and cross-site writes (foreign `Origin` or `Sec-Fetch-Site: cross-site`), and oversize
  uploads by `Content-Length`. Tests use `TestClient(base_url="http://127.0.0.1", app=...)`.
  Only PDFs, images and plain text are served inline; everything else downloads.

### 7. Gotchas already learned

- **Harness refusals.** The sandbox refuses Bash it can't verify stays in the worktree:
  - long `&&` chains mixing git with other tools, heredocs or `python3 - <<EOF` that mention
    "git" (even inside strings, e.g. "git repo", "github.com"), `sed` programs it can't parse,
    commands with `$(...)` feeding another program, `cd` into a different worktree.
  - Fixes: split into plain commands; use Edit/Write instead of sed for multi-line changes; put
    Python scripts in the job tmp dir and run `python3 <file>`; put commit messages in a file and
    `git commit -F <file>`; avoid `<->` in messages.
  - Edit/Write only work inside the worktree the session is in: EnterWorktree first.
- **False greens.** `cmd | grep passed && git commit` commits even when tests failed (grep
  matches "1 failed, 200 passed"). Look at the pytest line before committing; the usual failure
  is OpenAPI drift → regenerate.
- **gh.** `gh pr merge` prints "'main' is already used by worktree" — ignore, confirm with
  `gh pr view N --json state`. Mergeability shows UNKNOWN for a few seconds after a push: poll.
- **Toolchain.** TypeScript stays 5.9. `src/lib/` is git-ignored by the Python template (use
  `src/utils/`). Mantine 9 `Grid` uses `gap`. Typed router params resolve to AnyRouter, so build
  links as strings (`/companies/${id}`). `pnpm format` rewrites files (then "file changed on
  disk" notices are expected).
- **Tests (frontend).** jsdom stubs `matchMedia`, `ResizeObserver`, `document.fonts`. Mantine
  menus/selects render options hidden mid-transition: use `findByText` or `{ hidden: true }`.
  Mantine Select isn't `role="textbox"` (use `getByLabelText`). Detail mocks need every
  `ApplicationDetail` field (`suggested_next`, `duplicates`, `documents`…). Use relative dates
  for anything compared with "now". `mockApi` routes by `"METHOD /path"` or path.
- **Tests (backend).** Shared fixtures in `tests/conftest.py` (`app`, `client`, `seeded`), `post`
  helper in `tests/factories.py`. SQLite: when a handler writes in a separate session, commit the
  request session before its own writes (stale snapshot → "database is locked").
- **Data safety.** Restore builds in a temp file and swaps on success. Events order by `seq`.
  Session dependency commits before responding. Files: save → DB commit in the handler → delete
  the file if the commit fails; deletes commit first, then remove the file.

### 8. Drop

- Tool output, diffs and file contents already on disk; per-command narration; exploration that
  led nowhere.
- Reviewer reports once handled (their fixes are in git history).
- Superseded plans: Obsidian, shadcn/ui and other UI kits, Next.js, server-rendered UI,
  restricted-by-default workflow.

### 9. End the summary with

The resume steps below, then: "Next action: build the Sankey frontend in
`.claude/worktrees/sankey` (section 4)."

---

## Resuming after compaction

1. **Re-read, don't trust memory:** `CLAUDE.md`, `docs/ROADMAP.yaml` (anything not `done`),
   `docs/COMPACTION.md` (this file), `gh pr list`, `git worktree list`, and `git log --oneline -5`
   on main and on any worktree branch.
2. **Check the apps.** `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`
   and `http://127.0.0.1:8767/`. If either is down, start it from the main checkout as a
   background job with `timeout: 7200000` (commands in section 2). After pulling backend changes,
   stop and restart the tracker.
3. **Open PRs first.** For each open PR: if a review came back, apply the fixes; if not, start a
   reviewer (section 5, step 7). Merge when clean.
4. **Worktrees with unpushed or uncommitted work:** commit and push it (small units), then carry
   on with that task.
5. **Then the roadmap, in order:** the first task not `done` whose dependencies are done. One
   worktree, one PR, the full loop in section 5.
6. **Tell Kai** in a line or two what's merged and what's next, then keep going. Don't ask
   questions a sensible default answers; note the assumption and proceed.
7. **Before the next compaction,** refresh section 3 and 4 of this file in a small docs PR.
