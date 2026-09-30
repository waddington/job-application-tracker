# Compaction prompt for the build session

Use this when compacting the long-running Claude Code session that builds this repo, for example
`/compact <everything under "The prompt">`. It lists what the summary must keep so the next
context carries on building unattended, exactly as before. The state section is a snapshot
(2026-09-30); refresh it before each compaction.

This repo is public: nothing here, or in any summary committed later, may contain Kai's job-search
data.

## The prompt

Summarise this session so work continues with no questions to Kai. Preserve, verbatim where
quoted, everything in the sections below: standing instructions, project facts, current state,
the delivery loop and the gotchas. Keep ids, paths, ports, branch names, PR numbers and commands
exact. Drop what "Drop" says. End with one line: the exact next action.

### 1. Standing instructions from Kai

`CLAUDE.md` in the repo is the source of truth and wins on any conflict. Key points to carry:

- **Keep going.** "keep going. im going afk. you have enough to work on for ages, you'll hit a rate
  limit before you finish. just wait it out." Never stop because one task is done. On a rate limit,
  wait about 30 minutes and retry.
- **Commits.** "commit small and frequently and often". Conventional Commits, one logical unit
  each, push after committing.
- **PRs.** One worktree and PR per roadmap task, on branch `worktree-<task id>` so the PM dashboard
  links it. Claude merges its own PRs (`.claude/settings.json` allows `gh pr merge`) with
  `gh pr merge N --merge --delete-branch`, after a review pass and after fixing `must_fix` findings.
- **No agent-team skill in this repo.** Use plain reviewer subagents.
- **`.gitignore` follows the stack.** When a technology enters the repo, append its
  github/gitignore template under `# --- <Name> (github/gitignore) ---`. Python and Node are in.
- **README.** Catchy, search- and LLM-friendly, aimed at GitHub stars, and honest: a feature is
  "✅ Available" only once merged. `readme-refresh-1..4` tasks sit after each feature group.
  `llms.txt` mirrors the README.
- **Privacy.** Kai's data never enters this public repo. Tests, fixtures and screenshots use
  fictional names and example.com only.
- **Scope cuts.** No job searching or scraping, no quick-add from URLs, no MCP server. Data comes
  from Kai, or from Claude looking things up when asked.
- **Visibility.** Kai wants to see progress. After merges, rebuild the frontend on main (and restart
  the tracker if the backend changed). Give short status lines.
- **Artifacts.** Kai asked for this document as a repo file, not an artifact. Prefer repo files for
  project documents.

### 2. Project facts

- **Repos.** Code: `/home/kai/Documents/Projects/job-application-tracker`
  (`waddington/job-application-tracker`, public). Data:
  `/home/kai/Documents/Projects/job-application-tracker-data`
  (`waddington/job-application-tracker-data`, private). Worktrees live under
  `.claude/worktrees/<name>`.
- **Plan.** `docs/prd/tracker.md` (PRD), `docs/rfc/stack.md` (accepted stack RFC),
  `docs/ROADMAP.yaml` (phases P0–P6), `docs/planning/README.md`, `docs/IDEAS.md`.
- **Stack.** Python 3.12, uv, FastAPI, SQLAlchemy 2.1, Alembic and SQLite in `src/jat`. The
  frontend in `frontend/` is Vite 8, React 19, TypeScript 5.9 (pinned), Mantine 9, TanStack
  Router and Query, dnd-kit, and an openapi-fetch typed client.
- **Data format.** `tracker.sqlite3` is git-ignored. `export/*.jsonl` and `_meta.json` (with row
  counts and schema revision) are committed. Notes go in `notes/`, files in `files/`, settings in
  `config.toml` (workflow, `[snapshot] debounce_seconds`). Snapshots auto-commit to the data repo
  after 60 s idle. Push is on demand only and never forced.
- **Running apps.** Tracker: `uv run jat --data-dir /home/kai/Documents/Projects/job-application-tracker-data serve`
  on http://127.0.0.1:8770 (API docs at `/api/docs`). PM dashboard: `python3 -m tools.pm` on
  http://127.0.0.1:8767. Both run as background processes of the session, from the main checkout.
- **Commands.**
  - Backend: `uv run pytest`, `uv run ruff check .`, `uv run ruff format`.
  - Frontend, from `frontend/`: `pnpm typecheck | lint | test | build | format`.
  - After API changes: `uv run python -m jat.openapi` and `pnpm --dir frontend gen:api`
    (`tests/test_openapi.py` fails on drift).
  - Demo data: `uv run python scripts/seed_demo.py <new empty dir>`.
  - Screenshots: `google-chrome --headless=new --no-sandbox --user-data-dir=<tmp> --window-size=1400,900 --virtual-time-budget=5000 --screenshot=<png> <url>`.
- **Node.** Needs Node >= 22.12. Node 22.23.3 is installed in nvm next to Kai's 22.5.1. Prefix
  pnpm commands with `PATH=/home/kai/.nvm/versions/node/v22.23.3/bin:/usr/local/bin:/usr/bin:/bin`.

### 3. Current state (snapshot 2026-09-30)

- **Merged.**
  - #1–#6: setup, NOTICE, CLAUDE.md, PRD, roadmap, PM dashboard, README, stack RFC.
  - #7–#10: `data-dir`, `schema`, `app-shell`, Node fix.
  - #11–#13: `workflow`, `api`, `snapshots`.
  - #14–#16: `app-list`, `board`, `detail-pages`.
- **Open: PR #17 `recruiters`** (branch `worktree-recruiters`). Reviewed, with no `must_fix`.
  Before merging, fix these `should_fix` items:
  1. Make agency website links http(s)-only.
  2. Contacts saved with a company but no agency vanish from the Recruiters page; add a section
     for them.
  3. Searching an agency's name should show all of its people.
  4. Make sure contact edits refresh `["application", id]`.
  5. Nits: key the contact form modal by contact id; give detail rows stable keys; strip "ext"
     from phone links; add a "No matches" message.
- **In flight.** A fresh `worktree-dup-warning` worktree with no commits yet. Plan: a backend
  duplicate check (same company, and the same role or a similar title), a live warning in the
  New application form, and an "also applied via…" note on application pages. This PR,
  `worktree-compaction-doc`, adds this file.
- **Next in order.**
  - `readme-refresh-1` (screenshots from demo data).
  - P3: `notes`, `links`, `attachments`, `eml-import`, `documents`, `interviews`.
  - P4: `next-actions`, `followups`.
  - Then `readme-refresh-2`, P5 (`sankey`, `stats`, `scorecard`), `readme-refresh-3`, P6
    (`offers`, `ics-export`, `backup-export`, `search`) and `readme-refresh-4`.
- **Waiting on Kai.**
  - Create `.env` in the main checkout:
    `echo "JAT_DATA_DIR=$HOME/Documents/Projects/job-application-tracker-data" > .env`.
    The harness blocks Claude writing it.
  - Push the data repo, which has local commits only (`jat push`).
  - Optionally set the GitHub repo description and topics.

### 4. The delivery loop, per roadmap task

1. Merge `origin/main` or branch from it. Stack on an unmerged branch only when the task depends
   on it; create that worktree with `git worktree add .claude/worktrees/<name> -b worktree-<name> <base>`
   and enter it with EnterWorktree `path`.
2. Build it with tests. Commit and push in small logical units.
3. Check it live on demo data (seed it, `serve --port 879x`, screenshot), never on Kai's real
   data.
4. Open the PR with `--body-file` for any body containing backticks.
5. Start a background reviewer subagent. Tell it to run `gh pr diff N` once and review from that
   output, because the sandbox blocks its other commands. Meanwhile, start the next task on a
   stacked branch.
6. Fix `must_fix` and reasonable `should_fix` findings, then merge, fast-forward main and remove
   the worktree (`git worktree remove --force`, `git branch -D`).
7. Rebuild the frontend on main; restart the tracker if the backend changed. Update the README
   row and roadmap statuses as features land.

### 5. Gotchas already learned

- **Harness.** It refuses "complex" Bash, heredocs mentioning git, `git -C` into other repos from a
  worktree, `$VAR` in PATH prefixes, and `source`. Split commands, use Write/Edit instead of
  heredocs, and pass PR bodies by file. `pkill -f` patterns can match their own shell, so write
  them as `[p]ort 8793`. `gh pr merge` prints "'main' is already used by worktree"; ignore it and
  confirm with `gh pr view N --json state`. Mergeability can show UNKNOWN briefly after a push.
- **Toolchain.** TypeScript stays 5.9 (typescript-eslint doesn't support TS 7). `src/lib/` is
  ignored by the Python template, so use `src/utils/`. Mantine 9 `Grid` uses `gap`, not `gutter`.
  Typed router params resolve to AnyRouter (circular import), so build detail links as plain
  strings (`/companies/${id}`). Generated migrations are exempt from E501.
- **Tests.**
  - The jsdom setup stubs `matchMedia`, `ResizeObserver` and `document.fonts`.
  - The API client resolves `fetch` per call and uses an absolute `baseUrl` so `mockApi` works.
  - Mantine's TagsInput Enter doesn't register in jsdom; test via another control.
  - Clear localStorage in `beforeEach`.
  - Backend: `tests/factories.py` holds fake data; `git_env`/`git_repo` fixtures make temp repos.
- **Data safety.** Restore builds in a temp file and swaps it in only on success. Events are
  ordered by `seq`, not rowid. The session dependency uses `scope="function"`, so it commits
  before responding. Quick-create (`POST /applications/quick`) is one transaction. Snapshots
  commit only the staged snapshot files, never prompt, lock across processes, and refuse a
  detached HEAD.

### 6. Drop

- Tool output, diffs and file contents already on disk.
- Exploration that led nowhere and per-command narration.
- Reviewer reports once handled; keep only the open items listed above.
- Superseded plans: the Obsidian option, shadcn/ui and other UI kits, Next.js, the server-rendered
  UI.

### 7. Re-expand after compaction

Read these instead of relying on memory: `CLAUDE.md`, `docs/ROADMAP.yaml`, `gh pr list`,
`git worktree list`, and the open PR's diff. Check that the tracker (:8770) and PM dashboard
(:8767) respond; restart them from the main checkout if not.
