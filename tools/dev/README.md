# Maintainer scripts

The scripts the Claude Code session that maintains this repo uses to check, merge and release a PR. They follow
`CLAUDE.md` (*Git*, *Versions and releases*); that file wins if they disagree. Internal: changing them needs no version
bump or browser tests. Shell scripts load `env.sh`, which puts Node first on `PATH` (`NODE_BIN` overrides it) and
`uv` on it.

Run them from the root of a checkout: the PR's worktree, or the main checkout where it says so. They're written for
Linux (GNU `sed`); on macOS `checks.sh` runs without `flock` and `ionice`, and the others may need GNU tools.

| Script | What it does |
|---|---|
| `checks.sh [--no-e2e]` | Every check CLAUDE.md lists, on the current commit, one PASS or FAIL line each. Takes one lock across worktrees, at low priority. About 10 minutes with the browser tests, so run it in the background, and again after any new commit. `--no-e2e` only when every changed file is on CLAUDE.md's skip list. |
| `e2e_spec.sh <spec>` | Formats, typechecks and lints `frontend/e2e`, builds once, runs one spec (`people.spec.ts`) and prints only failures. Read all of it before trusting a pass. |
| `e2e_only.sh` | The browser suite alone, for a rerun after a failure that wasn't the PR's. |
| `merge_main.sh` | Merges `origin/main` in. A roadmap conflict keeps both sides, then `roadmap_dedupe.py` leaves one line per task. **Then check `git diff origin/main -- docs/ROADMAP.yaml`**: a task done on main can come back as building or planned. |
| `bump.py <task> "<entry>" "<title>" [minor]` | The version bump (patch, or minor): five version files, a CHANGELOG section with "(#PR)" appended, the task set `done`, `uv lock`, OpenAPI and types, commit, push, PR title. Run with `uv run python`. Never for a major. |
| `merge.sh <pr>` | Waits for the PR to be mergeable, merges it (merge commit, branch deleted), retrying while GitHub rechecks. |
| `ship.sh <version\|-> <pr> <worktree> [<branch>]` | From the main checkout after a merge: pull, remove the worktree and branch, tag and release the version (`-` for none), rebuild the frontend, check the tracker answers. |
| `release_notes.py <version> <out>` | One version's CHANGELOG section with links made absolute (`ship.sh` uses it). |
| `i18n_snapshot.sh` | The before/after text check for UI text changes: main's build against the branch's, on one demo folder. `SNAP_PORT` picks the port. |
| `check_links.py [files]` | Relative links and anchors in the README and the guide (or the files given). |
| `pr_shots.sh [--setup <file.py>] "<label>=<path>[@375][@full][@light][@sel=<css>][@click=<text>]"…` | The before-and-after screenshots a UI PR carries (CLAUDE.md, *Git*): each view on main's build and this branch's, on one fresh demo folder (`--setup` adds data first, through main's API), uploaded to the long-lived `pr-shots` branch; prints the `\| Item \| Before \| After \|` table and saves it as `var/pr-shots/table.md`. `@sel` shoots one element, `@click` opens a menu or dialog first. Needs main's `frontend/dist` (ship.sh rebuilds it). `PR_SHOTS_PORT` picks the port. |
| `shot.py <url> <prefix> <path>[@light][@375][@full]…` | Screenshots with the system Chrome (`uv run --with playwright python`), flagging sideways scroll and console errors. |
| `after_compact.sh [--user]` | Tells the session to read `docs/agents/` right after a compaction (a SessionStart hook; see `docs/COMPACTION.md`). |
| `briefs/bug-fix.md` | The brief for a subagent fixing one roadmap bug. |

A typical PR, from its worktree: `tools/dev/merge_main.sh`, `uv run python tools/dev/bump.py …` (skip for internal
files), `tools/dev/checks.sh` in the background, then `tools/dev/merge.sh <pr>`, and from the main checkout
`tools/dev/ship.sh <version> <pr> <worktree>`. The translation helpers live in `scripts/i18n/translate/`.
