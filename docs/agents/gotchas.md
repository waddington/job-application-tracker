# Gotchas already learned

Each of these cost time once. Add a line when something new does.

## Harness and shell

- **Bash in a worktree-isolated session is refused** when the harness can't prove it stays in the worktree: heredocs and
  inline Python (especially mentioning git), `for` loops, `cd` before git, `git -C`, `&&` chains mixing git with other
  tools. Split the commands; edit files with Edit. A refused command ran nothing. Subagents inherit the limit: run a
  review from the worktree it reviews, or give the reviewer the diff as a file (`gh pr diff N > <tmp>/prN.diff`).
- **`PATH=…:$PATH pnpm …` is refused in a worktree session** ("a value computed at runtime"): spell the whole PATH out
  (`PATH=/home/kai/.nvm/versions/node/v22.23.3/bin:/home/kai/.local/bin:/usr/bin:/bin pnpm …`).
- **A `cd` persists** to later Bash calls: after `cd frontend`, relative paths break. Use absolute paths, or `cd` back.
- **zsh aborts a whole command line on an unmatched glob** (`grep --include=*.tsx`): later commands never run, so "no
  output" can mean "not run". Quote globs or use plain paths.
- **Never `open(p, "w").write(f(open(p).read()))`**: write mode truncates first. Recover tracked files with
  `git checkout -- <file>`; copy a file aside before a test-the-test break, or checkout drops your edits too.
- **`export PATH=…node…`** hides `uv` for the rest of that call; keep `/home/kai/.local/bin` on PATH (without it the
  browser tests fail with `spawnSync uv ENOENT`).
- **Don't test a script by running it with odd arguments** from a checkout's root: `checks.sh` with a bad argument once
  started a full check run (it now refuses), and `e2e_only.sh` started the browser suite. Test guards from a subfolder.
- **Killing by PID is refused**; stop your own background jobs with TaskStop. `pkill -f` can match its own shell.
- **A session restart stops background jobs** (PM dashboard, demo and dev servers): restart the dashboard at once.
- **Never give a one-off agent a `name`**: it becomes a teammate that never reports back by itself.
- **Isolated agents** (`isolation: "worktree"`) can't write to the job folder; their worktrees stay locked after they
  finish (`git worktree remove -f -f` once merged). A forked agent can't use EnterWorktree from the main checkout.
- **EnterWorktree refuses** when the worktree is already the cwd; you're isolated anyway.
- **The main checkout is read-only for edits** in this session (pull, worktree remove and `pnpm build` are fine). When
  Kai wants a file there, write it in the job folder and give Kai a `!` command to copy it in.
- **Reviewer agents' Bash is refused while the lead's session is inside a worktree** (2026-11-09): set up a PR's
  worktree with `git worktree add` and work in it by absolute path, without EnterWorktree, until the reviewers finish.
- **The auto-mode check won't let an agent run an external contributor's code**: the lead runs the checks itself.
- **`!` commands run in the session's current folder**, maybe a worktree: tell Kai to run things like
  `playwright --ui` in their own terminal.
- **The auto-mode permission check** can block `gh pr merge` or a release: ask Kai, never work around it. It also refused
  editing `~/.claude/settings.json` ("self-modification"): give Kai the JSON to add instead.
- **Builder agents have no Workflow tool** (2026-11-08): brief them to stop at each workflow step with an args file; the
  lead runs the workflow and copies `.result` from the task output file into the builder's `var/`. Agents were also
  refused `source tools/dev/env.sh`; they put Node on PATH with `export PATH=…` instead.
- **A subagent's report can arrive as a message, not a notification**, and a second report in the same run is refused:
  when an agent says it reported again, SendMessage it to ask for what's new.

## Git and GitHub

- **`gh pr edit` fails silently**: set title and body with `gh api -X PATCH …/pulls/N -f title=… -F body=@file`.
- **`gh pr merge` right after a push** can fail (still rechecking) or 504; `tools/dev/merge.sh` retries. From the main
  checkout it prints "'main' is already used by worktree": harmless.
- **Roadmap merges revert statuses**: `merge_main.sh` keeps the longer of two lines, so a `done` task can come back as
  `building` or `planned`. Always check `git diff origin/main -- docs/ROADMAP.yaml` after merging main.
- **Stacked PRs:** merging the lower PR with `--delete-branch` closes the upper one for good. Prefer one base, main.
- **New commits make running checks stale**: TaskStop `checks.sh` and start it again on the final commit.
- **Run `checks.sh` from the worktree root** (it refuses elsewhere). Wait for a PR's checks with a background `until`
  loop on `mergeStateStatus` (or `merge.sh`), never a foreground `sleep`. A piped e2e run can exit 0 on failure: read
  the pass and fail counts. Don't write "(#N)" in `bump.py`'s entry: it appends it.
- **`checks.sh` keeps only the last 25 lines** of a failing check: read `frontend/test-results/*/error-context.md`.
- **A flaky `test.fail`** (`fix-offer-kind-pin-flaky`) can block a merge: rerun just the browser suite
  (`tools/dev/e2e_only.sh`) when everything else passed and the failure isn't the PR's.
- **CI:** only the website builds on GitHub; `mergeStateStatus` is UNSTABLE until it passes.

## Browser tests (`frontend/e2e/`)

- `fixtures.ts` starts a server per test file on seeded demo data. Any console error, uncaught exception or failed request
  fails the test unless `problems.allow(/…/)` (keep it narrow). Tests in a file share data: unique names, make what you
  need through the API, don't rely on counts.
- Run one spec with `pnpm e2e e2e/<file>` or `tools/dev/e2e_spec.sh <file>` (a bare word matches paths: "today" once
  matched the worktree's name). A TypeScript error stops the build, so every test fails for one reason.
- A `test.fail` must not rest on timing: freeze time with `page.clock.setFixedTime`, hold requests in `page.route`. It must
  go green for any shape of fix: check the outcome, not the wording.
- Check `toBeHidden` only after something else has loaded. After "nothing happened", watch for non-GET requests. A mocked
  request can't prove the server's state. "Save is disabled" isn't proof a save finished (Mantine disables while
  loading): poll the API.
- Mantine: `getByLabel` needs `exact: true` or `.first()`; SegmentedControl: click the label text; switches:
  `check({force:true})`; options via `getByRole("option")`; choosing a Select's current value clears it; Escape takes
  two presses when a dropdown is open; the role dialog opens with Company's list covering the form.
- Board: a 3800 px viewport, and wait for dnd-kit's "X is over Y" before releasing. `window.confirm` needs
  `page.once("dialog", …)`.
- Demo data: Alex Morgan, Sam Patel, Jordan Lee (no Riley Chen); stages Interested, Applied, Screen, Interviewing, Final,
  Offer, Accepted, then Rejected, Withdrawn, Ghosted; Backend CV (v2, v3 (impact first)), Short cover letter.
- A one-off 500 on `GET /offers` (#258) passed on rerun; the fixtures don't keep the server's stderr after start.

## Frontend and unit tests

- No `Date.now()` or `dayjs()` in render: `useToday()`, `useNow()`. Never read `e.currentTarget.value` inside a state
  updater (React clears it first).
- CSS modules: no `light-dark()` (the build drops it); use a custom property overridden under
  `:where([data-mantine-color-scheme="dark"])`. Mantine 9 `Grid` takes `gap`.
- jsdom: Mantine options and menu items render hidden (`hidden: true`); Selects have two elements per label; no
  `scrollIntoView` (stubbed); notifications persist across tests; `mouseenter` doesn't bubble. React Query retries a
  failed request 3 times (~7 s): mock every query a page waits on. `src/test/mockApi.ts` has the fixtures.
- Prove a test catches a bug by breaking the code and watching it fail.
- TanStack Router: routes built from `NAV` aren't typed for `navigate({ to })`; navigate to `"."`.

## Backend

- Call `_sync(request)` (the notes index) before the request's session reads, or a later write can hit "database is
  locked".
- Migrations that read config get `cfg.attributes["data_dir"]`; a `config.toml` that doesn't load stops the migration.
- After any route or schema change (docstrings too): `uv run python -m jat.openapi`, then `pnpm --dir frontend gen:api`.
- Stay additive in API responses: a changed field can be a major. The rebuilt frontend may meet a tracker not yet
  restarted, so fall back to the old English field and don't send a body field an older server rejects (#176).
- Demo servers don't reload code: restart them (and the zh-CN API on 8891) after a backend change.
- `ruff check src tests` misses `scripts/` and `tools/`; `checks.sh` includes them.
- A model change: a migration (check `tests/test_db.py`), new tables or columns in `tests/factories.py` `populate()`.
  Frontend hooks invalidate every query key that shows the data.

## Text and translations

- `t()` from `useTranslation("x")` refuses namespace-prefixed keys; use bare keys or `useTranslation(["x", "common"])`.
  Keys in a map outside a component are whole `"ns:key"`. Pass `TFunction<"namespace">`.
- `<Trans>` tags named after void elements (`<link>`, `<br>`) render empty. Your words go into `<Trans>` as components.
- **An empty translation falls back to English** (`returnEmptyString: false`): a separator empty in one language must be
  a pattern, as `common:twoSentences` is. Lists use `joinList`, sentence pairs `joinSentences`; grep both `{" "}` and
  template literals with a leading space when hunting joins.
- English must stay exactly the same in a text move: check with `tools/dev/i18n_snapshot.sh` ("0 view parts differ"). A
  run across the hour or midnight differs on default times: run it again. A bug found mid-move stays for its own task
  (`fix-offer-plurals` keeps "1 months", or its `test.fail` goes green).
- Check what the API sends as English (round, call and search titles and Sankey names did): build the words in the
  frontend from raw parts and keep the English field as the fallback.
- A `*Text.test.tsx` pins what the snapshot can't reach (plurals, titles, errors); say "most of" unless a test covers all.
  A regex containing `//` goes on its own line, for the unused-key scanner. Review before the slow checks; run the
  checks on the final commit.
- The lint plugin's word filters have no `u` flag (no `\p{L}`). Intl's en-GB writes "Sept"; all dates go through dayjs
  patterns. A Tooltip inside `Menu.Target` steals the menu's ARIA.
- The translate workflow's consistency pass once added `_one` keys Chinese doesn't have: drop unknown keys before
  `assemble.py`. `prepare.py` leaves files uncommitted with markers: assemble and commit before merging another branch.
- Branch file N+1 from file N's branch when both are open, so `index.ts` doesn't clash. Or branch both from main in
  parallel: the second merges main after the first lands, keeping both sides of `index.ts`, the glossary and `pages.json`.
- **Keys with the namespace prefix** (`errors.contact_detail_taken`, `insights:rejections.loadFailed`): the consistency
  pass and the judge sometimes return them. `assemble.py` refuses them as extra keys, and `apply_review.py` silently
  skips them. Strip the prefix, and compare the judge's changed keys with `review-fixes.json` by hand.
- **`screenshots.py` only opens pages**: Insights tabs (local state; the rounds switch is localStorage
  `jat.insights.rounds`) and error toasts need a click or a failed save. Builders wrote throwaway helpers in `var/`;
  fake every non-GET request so the shared demo data never changes.
- **`merge_main.sh` reverted a done task** again (`i18n-zh-cn-people` came back as `next`): check the roadmap diff after
  every merge of main. Its dedupe can also drop a task's `status:` field (`fix-offer-loading-says-none`), and then
  `bump.py` fails: put the status back by hand. `bump.py` also needs `pnpm install` in the worktree first
  ("openapi-typescript: not found").
- **Screenshot pixel diffs prove English didn't change**: `screenshots.py <url> <lang> layout en` before and after,
  then compare the PNGs with Pillow (`ImageChops.difference(...).getbbox()`); same size and no box means identical.

## Other

- Don't pipe `pnpm format` into `tail` (it stops Prettier part way); send it to `/dev/null`.
- Formatting rewraps lines, so an Edit from memory can miss: read the lines first.
- Headless screenshots: reduced motion, and `html{scroll-behavior:auto}` for scripted scrolling. Astro 7 `dev` runs as a
  daemon (`npx astro dev stop`); Astro drops the space before an element on the next line (add `{" "}`).
- Reviewers find real bugs in code that passes its tests, usually false claims when a source fails: ask them to check what
  a page claims, and look at real pages (a screenshot found #150's broken logo). Fact-check public docs and plans before
  merging them. Agents disagree: check the code.
- **Small fixes rarely get a must_fix; that's fine** (2026-11-08, `review-process-check`): planted bugs were all caught.
  A brief with only the bug and the diff, plus "try to break it", found more on #281 than briefs describing the fix.
- **Simulating Windows on Linux:** Linux's `fcntl` is built in, so a stub on `PYTHONPATH` can't hide it. A launcher that
  sets `sys.modules["fcntl"] = None` before `from jat.cli import main`, then (optionally) `sys.platform = "win32"`
  *after* the import (earlier, asyncio looks for Windows-only modules), then `main(argv)`. For time zones,
  `PYTHONTZPATH=` (empty) leaves only the `tzdata` package, as on Windows. Neither proves it runs on real Windows.
- **Vite's hot reload can silently keep old code** on `TodayPage.tsx` ("Could not Fast Refresh (useNextActions export
  is incompatible)"): if a dev page doesn't show a change, restart Vite with `--force` before debugging the code.
