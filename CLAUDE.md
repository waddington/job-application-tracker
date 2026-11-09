# job-application-tracker: instructions for Claude

## What this is
A local-first **web app** for tracking Kai's software-engineering job search (not Obsidian-based).
Kai's brief (2026-09-30):
applications come in directly and through recruiters, and one recruiter can have several
roles. Each application moves through stages and statuses governed by a workflow or state
machine. Kai needs an overview, a clear view of what to chase, and somewhere to keep details:
notes on the role, interview and call notes (probably Markdown files or Google Doc links),
PDFs and email exports. It runs locally. The product plan is `docs/prd/tracker.md`; the
roadmap is `docs/ROADMAP.yaml`, shown by the PM dashboard (see "Project management").

## Ownership
- Kai is hands-off on this repo. **Claude manages all PRs, merges and local state**, and Kai
  interacts only through Claude. Claude may merge its own PRs here after the review-fix cycle (see
  "Git"). This overrides the generic "never merge" default for this repo only.
- Remote: `git@github.com:waddington/job-application-tracker.git` (**public**). The default
  branch is `main`.
- License: Apache-2.0 (`LICENSE`) with a `NOTICE` crediting Kai. Keep both intact, and keep
  any third-party code's license notices when borrowing (e.g. from MIT-licensed JobSync).

## Public repo: personal data never gets committed
- This repo is public, but the data is Kai's job search: companies, recruiters, contacts,
  salaries, notes, CVs, PDFs and email exports. **None of it goes into git.**
- **Kai's data lives outside this repo** in
  `/home/kai/Documents/Projects/job-application-tracker-data`, in a format that is easy to back
  up (Kai, 2026-09-30). The app takes that path from config or an env var, never from a
  hard-coded value in the repo. Never delete or rewrite it without asking.
- Claude's own runtime state (`var/RESUME.md` etc.) lives in git-ignored `var/`, resolved to the
  main checkout path so it survives worktrees. `data/` stays ignored as a safety net.
- Tests, fixtures, screenshots, docs and examples use made-up data only (fake companies,
  `example.com` addresses). Real names, emails and phone numbers never appear in code,
  commits, PR descriptions or issues.
- Before every commit, check the diff for personal data. If any has been pushed, stop and tell
  Kai; don't rewrite history on your own.

## Working style
- **After a start or a compaction, read `docs/agents/`** (the state and live plan, Kai's standing instructions, gotchas,
  decisions, and what to read for which task). A hook tells the session to read them after a compaction; `docs/COMPACTION.md` says how.
- **Don't use the `agent-team` skill in this repo** (Kai, 2026-09-30). This overrides the global
  "default to agent-team" instruction. Work directly; use a plain subagent only when parallel
  work or a review pass calls for one.

## Git
- Follow `~/.claude/git-workflow.md`: a worktree per change set under `.claude/worktrees/`,
  a PR per change set, merge commits (`gh pr merge N --merge --delete-branch`), and
  Conventional Commits.
- **Commit and push small, frequent, logical units.**
- **Open a draft PR early.** As soon as work is going to become a PR, push a first commit, however
  minimal (the roadmap task set to `building` will do), and open it with
  `gh pr create --draft --title … --body-file …`. The PM dashboard then shows the task as Building,
  even one so far only on the branch's roadmap (marked "on its branch"), and as Review once the PR is ready. Keep pushing to it as work continues. Run `gh pr ready` when it's time for review, then follow the
  review-fix cycle below.
- **A UI change shows before and after in its PR** (Kai, 2026-11-09). A PR that changes what the app looks
  like (a page, card, dialog, pill, layout or wording on screen) carries an `| Item | Before | After |` table of
  screenshots in its body: run `tools/dev/pr_shots.sh` from the worktree with a view for each thing changed, added
  or removed. A few views that show the change are enough, not every data scenario; add `--setup` when the demo
  data doesn't show it. Demo data only. The images live on the long-lived `pr-shots` branch: never delete it. PRs
  that don't change the UI, and a draft language's translation PRs (shown only on a dev server), leave it out.
- **Don't quote Kai in PR descriptions or comments** (Kai, 2026-11-06). When Kai asks for work, the PR
  body says what was asked in your own words ("Adds a Done button to …", "Fixes the bug `fix-…`
  recorded in #N"), not Kai's message word for word; the same goes for PR and issue comments. The roadmap task
  and the maintainer's notes (`docs/COMPACTION.md`, `docs/agents/`) may still record Kai's words.
- **Keep PRs small.** Aim for about 500 changed lines, and treat 1,000 as a strong target to stay
  below. Go over only when a change can't sensibly be split, and say why in the PR. `uv.lock`,
  `pnpm-lock.yaml`, `frontend/openapi.json` and `frontend/src/api/schema.d.ts` don't count. When a
  roadmap task won't fit, split it into tasks with their own ids, branches and versions before
  starting. Land each part only when it works by itself: nothing half-converted or half-wired.
- **Edit files directly in the worktree** with the editor tools (Kai, 2026-10-31). No patch scripts
  for changes you could make by hand; a script is only for a truly mechanical bulk change, such as
  the version bump.
- **Checks run locally; only the website has a CI build.** On the exact commit being merged, in the
  worktree, these must pass: `uv run pytest -q`, `uv run ruff check src tests scripts`, and in
  `frontend/` `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm e2e`
  (`tools/dev/checks.sh` runs them all; `tools/dev/README.md` lists the other maintainer scripts). Never
  merge on a failure. Merging main into the branch makes a new commit, so run them again. A PR that
  only touches docs and planning files can skip these, and the PR says so; if it touches
  `docs/ROADMAP.yaml`, run `uv run pytest -q tests/pm`.
- **Browser tests only when the production build can change** (Kai, 2026-11-05). `pnpm e2e` tests a
  production build on demo data, so a PR whose every changed file is in this list skips it and runs
  every other check: a draft language's text (`frontend/src/locales/<code>/` for a code in
  `DRAFT_LANGUAGES`, which only a dev server loads, and its glossary `docs/i18n/<code>.md`),
  `scripts/i18n/`, `scripts/demo_gif/`, `scripts/social_preview/`, `.claude/workflows/`, `.claude/settings.json`, `tools/dev/`,
  Python tests (`tests/`), and docs. Anything else runs it, including `scripts/seed_demo.py` (the browser tests'
  demo data), `frontend/e2e/`, any config or lockfile, `frontend/src/i18n/` and `DRAFT_LANGUAGES`
  itself, and switching a draft on. The PR says it skipped and why.
- **Don't max out Kai's PC** (Kai, 2026-11-02). `pnpm test` and `pnpm e2e` limit their workers,
  run at low priority and wait for each other across worktrees (CONTRIBUTING, *Checks*): run them
  through `pnpm` (a single spec: `pnpm e2e e2e/<file>`), not `vitest` or `playwright` directly,
  and don't raise `TEST_WORKERS` or turn `TEST_LOCK` off unless Kai asks. They use half the CPU
  threads by default (Kai, 2026-11-05: up from a quarter, so the browser tests take about half as long).
- **Merging and releasing:** once a PR has been through the iterative review-fix cycle, Claude merges
  it and makes the release if it has a version bump, without asking (Kai, 2026-10-31). The cycle: a
  reviewer pass (a plain reviewer subagent or `/code-review`), fix the findings, and review again until
  no `must_fix` is left, then the checks above. Every PR goes through it, docs-only ones too. **A major
  release needs Kai's explicit permission each time** (see "Versions and releases"). If Kai says to hold
  a PR, or asks to preview it, wait for that. If a permission check blocks a merge or release, ask Kai;
  never work around it. This doesn't widen what to start. Never leave a finished PR sitting open.
- The main checkout (`/home/kai/Documents/Projects/job-application-tracker`) is where Kai's
  IntelliJ is open. After merging, fast-forward it:
  `git -C ~/Documents/Projects/job-application-tracker pull --ff-only`.

## Versions and releases
The app follows [semantic versioning](https://semver.org/), from 1.0.0. **Every PR that changes
what people get (the app, the website, the README or the guide) bumps the version in that
PR.** PRs that only touch internal files (`CLAUDE.md`, `.claude/settings.json`, `docs/ROADMAP.yaml`,
`docs/COMPACTION.md`, `docs/agents/`,
`docs/IDEAS.md`, `var/`, the PM dashboard: `tools/pm`, `tests/pm`, and the maintainer scripts: `tools/dev`,
`tests/dev`) don't, and so get no release.

- **Patch (1.0.0 → 1.0.1): most PRs.** Fixes, wording, docs, screenshots, refactors, tests,
  tooling, small tweaks to something that already exists.
- **Minor (1.0.1 → 1.1.0): a new feature.** Something you can do that you couldn't before: a new
  page, action, command, setting or API endpoint. Existing data, commands and settings keep
  working unchanged.
- **Major (1.1.0 → 2.0.0): anything that breaks how someone already uses it.** For example: a
  data folder an older version can't read, or one that needs manual steps to upgrade; a
  command, setting, `config.toml` key or API endpoint removed, renamed or changed in meaning;
  dropping a supported platform or Python version.
  - **Never merge a major bump without Kai's explicit permission for that bump.** Before merging,
    stop and ask in plain words, e.g. "PR #N is a MAJOR version bump (1.4.2 → 2.0.0) because
    <what breaks>. May I merge it?". Then wait for a yes to that question. "Merge once ready",
    "keep going" and other standing instructions do **not** cover a major bump. Put
    "⚠️ MAJOR version bump" at the top of the PR body, and list what breaks and how to upgrade.
  - If it's unclear whether a change is major, treat it as major and ask.
- **How to bump.** Set the same version in `pyproject.toml`, `src/jat/__init__.py`,
  `frontend/package.json`, `website/package.json` and `softwareVersion` in
  `website/src/layouts/Landing.astro`. Run `uv lock`, then `uv run python -m jat.openapi` and
  `pnpm --dir frontend gen:api`. In `CHANGELOG.md`, add a `## X.Y.Z (YYYY-MM-DD)` section at
  the top with this PR's entries. Say the bump and why in the PR body ("Patch: a fix to …").
- **Bump against main at merge time.** If main moved since the branch was cut, merge main in
  and bump from main's version, so two PRs never ship the same number.
- **Release every version.** After merging, tag the merge commit `vX.Y.Z`, push the tag, and
  publish a GitHub release with that version's changelog section as its notes:
  `gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <section>`. A major release still
  needs Kai's yes first (above).
- Don't write version numbers into prose (README, guide, website copy) beyond "version 1.0",
  so docs don't go stale with every patch.

## Runtime
- Runs locally only. **Never install services** (systemd units, timers, cron entries).
  Long-lived things run as terminal processes.
- No hosted backends, telemetry or cloud sync. Any integration (Google Docs links, email
  import) is opt-in and read-only unless Kai says otherwise.

## Project management
- PM dashboard: `python3 -m tools.pm` (http://127.0.0.1:8767), run from the main checkout.
  Standard library only. It reads `docs/ROADMAP.yaml`, adds the tasks a `worktree-*` branch has added to
  its own copy (not `worktree-agent-*`, nor a branch whose PR merged or closed), and takes live task status
  from `worktree-<task id>` branches and their PRs (via `gh`): a draft PR is Building, a ready one Review.
- Not started is two statuses: `next` (Up next) is work Kai has asked for, queued to be built; `planned`
  (Backlog) is ideas and things to plan with Kai first.
- Its tests run with the rest: `uv run pytest`.
- After merging a PR that changes `tools/pm`, restart the dashboard so it loads the new code.

## README
- The README is the project's shop window (Kai wants GitHub stars): catchy, easy for search
  engines and LLMs to read, and honest. A feature is only marked as available once it has
  merged. `llms.txt` mirrors the README summary.
- When a feature merges, update its status in the README feature table and in `llms.txt` in
  the same PR. The `readme-refresh-*` roadmap tasks do a fuller pass over both the README and
  `llms.txt`: screenshots and GIFs made with fake data only, and `llms.txt` checked against
  what's actually available.
- The user guide (`docs/guide/`) documents everything a user can do or configure. A change
  that adds or alters a feature, command, setting or data-folder behaviour updates the guide
  in the same PR, checked against the code (no guessed steps).

## Code
- Stack (accepted RFC `docs/rfc/stack.md`): Python 3.12 + uv + FastAPI + SQLite in `src/jat`,
  and Vite + React + TypeScript + Mantine in `frontend/`.
- Commands: `uv run jat init | info | migrate | export | restore | serve` (data directory from
  `JAT_DATA_DIR` in the git-ignored `.env`; see `.env.example`), `uv run pytest`,
  `uv run ruff check .`, `uv run ruff format`.
- Run the app: `pnpm --dir frontend install && pnpm --dir frontend build`, then
  `uv run jat serve` (http://127.0.0.1:8770; API docs at `/api/docs`). Development:
  `uv run jat serve --dev` plus `pnpm --dir frontend dev` (http://127.0.0.1:5173, which proxies `/api`).
- Frontend checks (run in `frontend/`): `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm e2e` (browser tests),
  `pnpm format:check`. TypeScript is pinned to 5.9 (typescript-eslint doesn't support TS 7 yet).
- **Node >= 22.12** (`.nvmrc` says `22`; Node 22.23.3 is installed in nvm, alongside Kai's
  22.5.1). Vite 8's native rolldown binary needs it, and `engine-strict` makes pnpm fail
  loudly on older Node. In a non-interactive shell, put
  `/home/kai/.nvm/versions/node/v22.23.3/bin` first on `PATH` before running pnpm.
- API changes: after changing routes or schemas run `uv run python -m jat.openapi` and
  `pnpm --dir frontend gen:api`, and commit `frontend/openapi.json` and `src/api/schema.d.ts`
  (`tests/test_openapi.py` fails on drift). Use the typed client in `frontend/src/api/client.ts`.
- The MCP server (`jat mcp`, planned in `docs/rfc/mcp.md`) wraps the same API. Once it exists, a new
  route needs an entry in `src/jat/mcp/registry.py`, as a tool or under `NOT_EXPOSED` with a reason, and
  a changed route needs its tool checked; either way, re-run `uv run python -m jat.mcp.surface`. A test
  fails until each route has its entry (RFC §9). Changing what an existing tool takes or returns follows
  the RFC's version table (§9.4). Until then, a PR that adds an API feature says in its body whether an
  agent would want it over MCP, so the plan stays current.
- After merging a PR that changes the app, rebuild the frontend in the main checkout and
  restart `jat serve`.
- Once they exist, start with `docs/OVERVIEW.md` (the map: processes, data flow, state) and
  then `docs/ARCHITECTURE.md` (module contracts).
- Tests and lint must pass before merging (the list and its one exception are under "Git").
- **`.gitignore` follows the stack** (Kai, 2026-09-30): whenever a technology, language, framework
  or tool comes into the repo, append the matching template from
  https://github.com/github/gitignore (e.g. `Python.gitignore`, `Node.gitignore`,
  `Global/macOS.gitignore`) to `.gitignore` in the same PR, under a
  `# --- <Name> (github/gitignore) ---` header. Skip it if that template is already there. Don't
  duplicate lines the file already has, and keep the repo-specific entries (worktrees,
  `data/`, `var/`) intact.
- The data format must stay readable and restorable without the app (the stack RFC picks it).
- **No scraping or external job feeds.** All data comes from Kai, or from Claude looking things
  up and filling them in when Kai asks. The app itself never fetches job data.

## Keep going: the continuous delivery loop
**Never stop because a piece of work is finished.** After every merge, pick the next item and
start it in the same session. Stop only for a hard stop (below), a rate limit (wait 30 minutes
and retry, repeatedly) or when Kai says so. **With nothing up next** (no `next` task left that isn't done
or blocked on Kai), report what's in the backlog and wait for Kai to pick, rather than starting backlog
work (see "When the roadmap runs out"). **When Kai has scoped the work to specific items, Kai's
scope wins:** finish those, report, and wait instead of picking the next one. When Kai asks how it's going, give a short status
update and carry on. Don't pause the loop for a question that has a sensible default: make
the call, note the assumption in the PR, and keep going.

### Picking the next item, in this order
1. Unfinished work: open PRs, worktrees under `.claude/worktrees/` (check for uncommitted
   edits), and the "In flight" and follow-up lists in `var/RESUME.md`.
2. Review follow-ups and `should_fix` items left over from merged PRs.
3. `docs/ROADMAP.yaml`: the first task with status `next` whose `depends` are all `done` (earliest
   phase first). Backlog (`planned`) tasks aren't started without Kai's go-ahead. Run independent
   tasks in parallel (worktree and PR each).
4. `var/RESUME.md` "Next" items that aren't on the roadmap yet: add them to the roadmap first, as
   `next` if Kai asked for them, else `planned`.

### Delivering an item
- Big or unclear items get a PRD and an RFC first (`docs/prd`, `docs/rfc`), linked from the
  roadmap task.
- Worktree and PR per change set. Name the branch `worktree-<roadmap task id>`. Every PR goes
  through the review-fix cycle (see "Git").
- **Every PR updates the docs it affects, in the same PR.** A reviewer treats a missing doc
  update as `must_fix`. Put this requirement in every agent prompt.
- The lead session merges (subagents can't). Then fast-forward main, restart anything running
  so it loads the new code, try the change for real, and fix anything that shows up.
- Keep `docs/ROADMAP.yaml` honest: set a task to `done` when it merges, and add any follow-ups
  as new tasks. Work that comes from Kai's feedback goes on the roadmap as `next`, or `building`
  when its own PR adds it: the PR that builds it adds a task (in the latest feedback phase) whose
  id is the branch name minus `worktree-`, so the PM dashboard shows it while it's being built.
  Anything that slipped through gets backfilled. Update `var/RESUME.md` at every milestone.

### Bugs
Every real bug found, however it's found (tests, a review, trying the app, or in passing while
doing something else), goes on the roadmap straight away, like an issue in Jira:
- **Where:** phase `B` in `docs/ROADMAP.yaml`, with `type: bug`, `severity: high | medium | low`, an
  id named `fix-<what>`, a short `name`, what happens and how it was found in `detail`, `owner` and
  `estimate_h`. It then shows in the PM dashboard's Bugs column, the Bugs phase of the Roadmap and
  Open bugs on the Overview. A fix on `worktree-<id>` moves it along the board like any task,
  keeping its BUG tag. A bug that comes back after a merged fix gets a new id.
- **Record it even if you're not fixing it now,** and even when you're sure it's small. Say so to
  Kai in the same message. Don't record what's only suspected: check it first, then record it.
- **A fix that changes behaviour or text needs Kai's go-ahead,** unless a standing instruction
  covers it. A test that shows the bug can land before the fix, marked `test.fail`.
- **Bugs aren't started on their own:** raise them with Kai, and start one when he says go or a
  standing instruction covers it. A bug Kai has OK'd to fix is set to `next`.

### When the roadmap runs out
The roadmap has run out when no `next` task is left that isn't done or blocked on Kai. Then,
without being asked, run an ideation round against Kai's brief above, deduplicate against
`docs/IDEAS.md`, and add the survivors to `docs/ROADMAP.yaml` as a new phase in the backlog
(`planned`). Then report and wait (Kai, 2026-11-02): tell Kai in a line or two what was added and
why, report what's in the backlog, and wait for Kai to pick. Nothing from the backlog is started
without Kai's go-ahead.

### Hard stops: the loop never crosses these
- Never commit or push personal data (see above), and never rewrite history on `main`.
- Nothing contacts anyone on Kai's behalf: no sending emails or messages, no submitting
  applications, no replying to recruiters.
- No paid services, no API keys or accounts created for Kai, no service installs, and no runtime
  dependencies beyond the stack Kai signs off in the stack RFC without asking first.
- Never delete the data directory or `var/`.
