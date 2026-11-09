# Brief for a bug-fix builder

Give this to a subagent (started in its own worktree, no `name`) with the bug id. It fixes ONE bug from
`docs/ROADMAP.yaml` (phase B). The lead session reviews, bumps, merges and releases; the builder never does.

Read first: `CLAUDE.md`, then your bug's line in `docs/ROADMAP.yaml` (`detail`, and `root_cause`, `fix_outline`,
`pinned_by`, `related_bugs` where present), then `docs/agents/gotchas.md` (browser tests and harness sections).

## Setup
- Fetch, make sure you're on the latest `origin/main`, and rename your branch: `git branch -m worktree-<bug id>` (the
  PM dashboard reads this name).
- Run commands from the worktree root. Never `cd` to the main checkout, and don't use `git -C`.
- Put Node first on PATH for pnpm (`source tools/dev/env.sh` does it), then `pnpm --dir frontend install --frozen-lockfile --silent`.
- Set the bug's `status:` to `building`, commit, push with `-u`, and open a draft PR straight away:
  `gh pr create --draft --title "fix(<area>): <what>" --body "Draft: building."`. Push small commits.
- Commit messages: Conventional Commits, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- If Bash is refused in your worktree, stop and report at once. A refused command ran nothing; split `&&` chains that
  mix git with other tools. Never work around a permission refusal.

## Rules
- **Fix only your bug**, with the smallest change that fixes its root cause. If it turns out bigger or riskier than the
  roadmap says (more than ~150 changed lines, a data change, an API change, or different English), stop and report.
- **English stays the same** unless the brief says otherwise.
- If a `test.fail` in `frontend/e2e` pins the bug (`pinned_by`), remove the `test.fail` so it must pass. Otherwise add a
  test that fails before the fix and passes after: prove it by running it without the fix.
- Another real bug you find: don't fix it; report it with file:line and how you confirmed it.
- Made-up data only (fictional names, example.com). Never touch port 8770 or Kai's data folder.
- Edit files with the editor tools; no patch scripts; no new dependencies.
- **Don't bump the version, add a CHANGELOG entry, set the bug `done` or run `gh pr ready`.** The lead does those.

## Checks before you report
- Tests only through pnpm (`pnpm test`, `pnpm e2e e2e/<file>`): they limit workers, run at low priority and wait for each
  other. Waiting for the lock is normal. Never run `vitest` or `playwright` directly or set `TEST_WORKERS`/`TEST_LOCK`.
- `uv run pytest -q` if Python changed; `uv run ruff check src tests scripts tools`.
- In `frontend/`: `pnpm format >/dev/null` (never pipe it to `tail`), `pnpm lint`, `pnpm typecheck`, `pnpm test`.
- Browser tests for your area only (`tools/dev/e2e_spec.sh <file>`); the lead runs the whole suite.

Write the PR body to a file under `/tmp/jat-<bug id>-…` and set it with
`gh api -X PATCH repos/waddington/job-application-tracker/pulls/N -F body=@file` (`gh pr edit` fails): what was asked in
your own words (never quote Kai), "## The bug", "## What changed", "## Version" ("Patch: <what>"), "## Checks" with honest
results, ending with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. Say whether Kai must restart the
tracker (only if Python changed). If the fix changes what the app looks like, add "## Before and after": run
`tools/dev/pr_shots.sh` from your worktree root with a view for each thing changed (`--setup <script>` when the demo data
doesn't show the bug) and paste the table it prints. If it can't run in your worktree, say so and the lead runs it.

## Your report
PR number, branch, worktree path, last commit, changed lines, how you proved the test catches the bug, each check's real
result, any new bug, any decision the lead should check. Under 200 words. Report failures plainly.
