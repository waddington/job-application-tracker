# Gotchas already learned

Each of these cost time once. Add a line when something new does.

## Harness and shell

- **Bash in a worktree-isolated session is refused** when the harness can't prove it stays in the worktree: heredocs and
  inline Python (especially mentioning git), `for` loops, `cd` before git, `git -C`, `&&` chains mixing git with other
  tools. Split the commands; edit files with Edit. A refused command ran nothing. Subagents inherit the limit: run a
  review from the worktree it reviews, or give the reviewer the diff as a file (`gh pr diff N > <tmp>/prN.diff`).
- **A `cd` persists** to later Bash calls: after `cd frontend`, relative paths break. Use absolute paths, or `cd` back.
- **The Edit tool drops a trailing space at the end of new_string** (2026-11-09/10, twice in ROADMAP.yaml: `{id: x, `
  became `{id: x,name:`). Don't end an old_string/new_string pair on a space; anchor on a whole field (`name: "…`)
  instead, and check `git diff origin/main -- docs/ROADMAP.yaml` shows only your lines.
- **zsh aborts a whole command line on an unmatched glob** (`grep --include=*.tsx`): later commands never run, so "no
  output" can mean "not run". Quote globs or use plain paths.
- **Never `open(p, "w").write(f(open(p).read()))`**: write mode truncates first. Recover tracked files with
  `git checkout -- <file>`; copy a file aside before a test-the-test break, or checkout drops your edits too.
- **`export PATH=…node…`** hides `uv` for the rest of that call; keep `/home/kai/.local/bin` on PATH (without it the
  browser tests fail with `spawnSync uv ENOENT`).
- **Don't test a script by running it with odd arguments** from a checkout's root: `checks.sh` with a bad argument once
  started a full check run (it now refuses), and `e2e_only.sh` started the browser suite. Test guards from a subfolder.
- **Stopping what you started:** TaskStop for background jobs; for a server started in the same command, keep its pid
  (`… & SP=$!`, then `kill $SP`; killing by pid is refused in some isolated sessions). `pkill -f` can match its own
  shell: write the pattern as `"[s]erve --port 8884"`.
- **A session restart stops background jobs** (PM dashboard, demo and dev servers): restart the dashboard at once.
- **Never give a one-off agent a `name`**: it becomes a teammate that never reports back by itself.
- **Isolated agents** (`isolation: "worktree"`) can't write to the job folder; their worktrees stay locked after they
  finish (`git worktree remove -f -f` once merged). A forked agent can't use EnterWorktree from the main checkout.
- **EnterWorktree refuses** when the worktree is already the cwd; you're isolated anyway.
- **The main checkout is read-only for edits** in this session (pull, worktree remove and `pnpm build` are fine). When
  Kai wants a file there, write it in the job folder and give Kai a `!` command to copy it in.
- **Reviewer agents' Bash is refused while the lead's session is inside a worktree** (2026-11-09): set up a PR's
  worktree with `git worktree add` and work in it by absolute path, without EnterWorktree, until the reviewers finish.
- **The auto-mode check won't let an agent run an external contributor's code**: the lead runs the checks itself. It
  isn't consistent for the lead either (2026-11-10/11: it refused `checks.sh`, `pnpm install` and pytest on contributor
  branches some times, allowed them others). Run contributor code in the Windows VM when it refuses; once their branch
  is carried with our commits on top, the checks have gone through.
- **`!` commands run in the session's current folder**, maybe a worktree: tell Kai to run things like
  `playwright --ui` in their own terminal.
- **The auto-mode permission check** can block `gh pr merge` or a release: ask Kai, never work around it. It also refused
  editing `~/.claude/settings.json` ("self-modification"): give Kai the JSON to add instead. "Gave no verdict … reviewed
  this call without its leading cd" (2026-11-11, `cd <main> && tools/dev/ship.sh …` sent right after a call in another
  folder) isn't a refusal: send the exact same command again, alone, and it goes through.
- **Builder agents have no Workflow tool** (2026-11-08): brief them to stop at each workflow step with an args file; the
  lead runs the workflow and copies `.result` from the task output file into the builder's `var/`. Agents were also
  refused `source tools/dev/env.sh`; they put Node on PATH with `export PATH=…` instead.
- **In a worktree-isolated session** a Bash line that mixes git with other commands (or `cd`s first) is refused:
  split it, or put the steps in a script file under the job folder and run `bash <file>`.
- **A subagent's report can arrive as a message, not a notification**, and a second report in the same run is refused:
  when an agent says it reported again, SendMessage it to ask for what's new. A builder's second SubagentHandback is
  usually a duplicate: ask once, then ignore further repeats.
- **More isolated-Bash refusals** (2026-11-12/15): any line whose text contains "github" (a `waddington.github.io` URL,
  a PR title or bump entry saying "GitHub"), `source …`, or a `PATH=… cmd` prefix. Put the commands in a script under
  the worktree's `var/` and run `bash var/x.sh`. Isolation also blocks Edit on files in the main checkout (such as
  `ignorable-docs/`): change them with a small Python script by absolute path.
- **An agent that hosts servers** keeps sending "waiting on its own background work" notices for hours; nothing to do.

## Fresh worktrees

- **No `var/`:** `tools/dev/checks.sh > var/checks.log` fails before any check starts (it looks like a failed run).
  `mkdir -p var` first.
- **No `frontend/node_modules`:** `bump.py` stops at `pnpm gen:api` (`openapi-typescript: not found`) after it has
  already changed the version files. Don't run it again (it would bump twice): `pnpm --dir frontend install
  --frozen-lockfile`, `pnpm --dir frontend gen:api`, then commit, push and set the PR title "<title> (<version>)" by
  hand. Install first next time.
- **Playwright's own browser may be missing** for the installed `@playwright/test`: launch with
  `executablePath: /home/kai/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome`.
- **An agent's worktree stays locked**, so `ship.sh` leaves it: `git worktree unlock <path>`, `git worktree remove
  <path>`, `git branch -D <branch>`.

## Git and GitHub

- **`gh pr close N --delete-branch` can leave the remote branch** (#418, 2026-11-18: it printed only the local
  deletion, and `git ls-remote` still showed the branch): check `git ls-remote origin | grep <branch>` and delete it
  with `git push origin --delete <branch>`.
- **Quoting Kai: drop names from screenshots.** A roadmap detail may quote Kai's words, but Kai often names a real
  company or person from the screenshot they're describing, e.g. calling a card by its company. Replace it ("[one
  card]") before committing: #418 pushed one to a public branch and had to be closed and redone as #419 (Kai: fine as
  it is, no purge).
- **`gh pr edit` fails silently**: set title and body with `gh api -X PATCH …/pulls/N -f title=… -F body=@file`.
- **`gh pr merge` right after a push** can fail (still rechecking) or 504; `tools/dev/merge.sh` retries. From the main
  checkout it prints "'main' is already used by worktree": harmless.
- **Roadmap merges revert statuses**: `merge_main.sh` keeps the longer of two lines, so a `done` task can come back as
  `building` or `planned`. Always check `git diff origin/main -- docs/ROADMAP.yaml` after merging main.
- **Stacked PRs:** merging the lower PR with `--delete-branch` closes the upper one for good. Prefer one base, main.
- **`merge.sh` stops on a stale "CONFLICTING DIRTY"** from `gh pr view` even when the branch is main plus commits
  (2026-11-13, #353, for minutes and across a new push). Check `gh api repos/<repo>/pulls/N --jq .mergeable_state`:
  if it says `clean`, merge with `gh pr merge N --merge --delete-branch`.
- **New commits make running checks stale**: TaskStop `checks.sh` and start it again on the final commit.
- **Run `checks.sh` from the worktree root** (it refuses elsewhere). Wait for a PR's checks with a background `until`
  loop on `mergeStateStatus` (or `merge.sh`), never a foreground `sleep`. A piped e2e run can exit 0 on failure: read
  the pass and fail counts. Don't write "(#N)" in `bump.py`'s entry: it appends it.
- **`checks.sh` keeps only the last 25 lines** of a failing check: read `frontend/test-results/*/error-context.md`,
  before a later run overwrites it. `e2e_only.sh` ends in `tail -15` too; for the whole output run the suite through
  pnpm: `pnpm --dir frontend e2e > var/e2e.log 2>&1`.
- **`ship.sh` takes the worktree's name** (`app-redesign-forms`), not its path; given a path it leaves the worktree
  ("missing or locked") and you remove it by hand.
- **A read-only reviewer can still move your worktree:** one ran `git checkout <commit>` in the PR's worktree, so the
  lead's next commit landed on a detached HEAD and never reached the PR. Tell reviewers never to check out or switch;
  run `git status -sb` before committing in a worktree a reviewer has used.
- **Merging main into a branch makes its running checks moot:** stop that run and check once on the final commit
  (after the merge and the bump) instead of twice.
- **A flaky `test.fail`** (`fix-offer-kind-pin-flaky`) can block a merge: rerun just the browser suite
  (`tools/dev/e2e_only.sh`) when everything else passed and the failure isn't the PR's.
- **CI:** only the website builds on GitHub; `mergeStateStatus` is UNSTABLE until it passes.
- **Carries merging in sequence:** the second takes main's version and re-bumps by hand (`bump.py` always adds a
  CHANGELOG entry), keeping main's CHANGELOG sections unchanged.
- **`checks.sh --no-e2e` refuses `tools/pm` changes** (they aren't on the skip list): run the full checks.
- **A PR touching the app and the website** runs `checks.sh` plus, with `pnpm --dir website`: `install
  --frozen-lockfile`, `format:check`, `check` and `build` (`checks.sh --website` refuses app changes; `--no-e2e`
  runs them itself when `website/` changed). Run the format check straight after editing an .astro file (#439's
  one-line edit failed a 12-minute run).
- **A bump costs about 14 changed lines:** leave room under the limit, counted with `git diff origin/main --shortstat
  -- . ':!uv.lock' ':!frontend/openapi.json' ':!frontend/src/api/schema.d.ts'`.
- **`gh pr view N` without `--json` can fail** on a deprecated Projects GraphQL field: pass `--json` with the fields.
- **A reviewer probing while the lead runs checks** uses its own copy of the build and its own port: `checks.sh`
  rebuilds `frontend/dist` under a server.
- **Dependabot:** push our commits onto its branch as a fast-forward (`git push origin HEAD:<dependabot branch>`),
  never force.

## Browser tests (`frontend/e2e/`)

- **A Vite dev server proxies `/api` to 8770, Kai's live tracker, by default:** always start it with
  `JAT_API_URL=http://127.0.0.1:<demo port>`, and check it serves demo companies before showing or testing it. On a port
  other than 5173 its writes are refused (`fix-dev-proxy-other-port-writes`).
- **Read a browser run's failed line and exit code, not its passed count.** `e2e_only.sh`'s tail can end "830 passed"
  just under "1 failed" and "ELIFECYCLE … exit code 1"; on 2026-11-20 that was misread and #425 merged on a failure
  (the known `fix-board-drag-width-race` flake, in a file #425 didn't touch; the board spec then passed on main).
  Before merging, grep the output for `failed` / `ELIFECYCLE`: `e2e_only.sh` pipes into `tail`, so it exits 0 even
  when tests fail (`fix-e2e-only-exit-status`); `checks.sh`'s FAIL lines are reliable.
- **The board's mouse-drag tests can flake under a full run** (2026-11-18, on #415, which doesn't touch the board):
  `board.spec.ts` "onto its own column does nothing" (~:284) once and "while dragging, the columns keep their width"
  (~:555) once, each passing alone. The second was 45 px off (225 → 180), so it may be a real one-frame race in the
  width freeze: `fix-board-drag-width-race`. Rerun with `tools/dev/e2e_only.sh` before blaming the PR. On
  2026-11-22 ~:555 failed three full runs in a row on #439 and passed 15 of 15 alone, so a rerun may not clear it:
  don't keep rerolling (working-with-kai.md, *A check that keeps failing*).
- **A `test.fail` can fail the run by passing:** "Expected to fail, but passed" means the known bug didn't happen that
  time (`fix-double-save-locked`'s double click at `companies.spec.ts` ~:596 is racy; 2026-11-12). Rerun the browser
  tests (`tools/dev/e2e_only.sh`) before blaming the PR. A fix can also turn another bug's `test.fail` green for good
  (#314 fixed `fix-person-saved-before-new-company`): rerun that spec a few times (`--repeat-each=3`) to tell which.
- **`companies.spec.ts`'s "still being made keeps them at it" pair (~:448, ~:467) fails now and then under a full run**
  and passes alone: it's a real race in the app (`fix-person-new-org-race`), not the PR, until that's fixed.
- `fixtures.ts` starts a server per test file on seeded demo data. Any console error, uncaught exception or failed request
  fails the test unless `problems.allow(/…/)` (keep it narrow). Tests in a file share data: unique names, make what you
  need through the API, don't rely on counts.
- Run one spec with `pnpm e2e e2e/<file>` or `tools/dev/e2e_spec.sh <file>` (a bare word matches paths: "today" once
  matched the worktree's name). A TypeScript error stops the build, so every test fails for one reason.
  `e2e_spec.sh` printed nothing when a spec failed to load at all (a JSON import), which looked like a pass: confirm
  with `pnpm e2e e2e/<file>` and read its "N passed" line. A spec can't `import` the locale JSON files (Node wants an
  import attribute): read them with `readFileSync` (`frontend/e2e/chinese.spec.ts`).
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

- **Headless Chrome hides scrollbars**, so a layout that wraps at a 970 px window passes at 970. To match a real
  browser, launch with `ignore_default_args=["--hide-scrollbars"]`, or test 15 px narrower.
- **Firefox fires no focusout when the focused element is removed**, and the browser tests are Chromium only: check
  focus and Escape work in Firefox by hand (`uv run --with playwright==1.54.0 python`, `p.firefox`).
- **A grep of `frontend/src` doesn't show Mantine's CSS** (a card's `touch-action: manipulation` comes from Paper): check
  computed styles or `node_modules/@mantine/core/styles` before saying a style isn't set.
- **Nothing moves or scrolls on a pointer press:** a scroll on focus under a press selected text that typing then
  deleted (found in #427's review).
- No `Date.now()` or `dayjs()` in render: `useToday()`, `useNow()`. Never read `e.currentTarget.value` inside a state
  updater (React clears it first).
- CSS modules: no `light-dark()` (the build drops it); use a custom property overridden under
  `:where([data-mantine-color-scheme="dark"])`. Mantine 9 `Grid` takes `gap`.
- jsdom: Mantine options and menu items render hidden (`hidden: true`); Selects have two elements per label; no
  `scrollIntoView` (stubbed); notifications persist across tests; `mouseenter` doesn't bubble. React Query retries a
  failed request 3 times (~7 s): mock every query a page waits on. `src/test/mockApi.ts` has the fixtures.
- Key an editor by its record's id, never by `updated_at`, a version, the date, a list index or the section its row is
  in. A form on a page holds its fields in `useDraft` (`src/utils/useDraft.ts`): it follows saved changes, keeps
  unsaved edits, and Save sends only `draft.changes`.
- Never default query data to `[]` before deciding it's empty: loading and failed then read as "nothing here". Cards
  and lists use `QueryState` (`src/components/QueryState.tsx`; CONTRIBUTING, *Where things are*); pages show a
  skeleton (`Pending` and `PageSkeleton.tsx`; a role's, person's, company's or agency's page `RecordSkeleton`, an
  application's `ColumnsSkeleton` and the line and button pieces), not `Loader`; so do cards that load on their own
  (Insights' parts through `Loading`, keeping their failed text; the rest through `Pending`, for its Retry).
  A browser test waiting for a page to settle waits for `[data-testid=query-loading]` to go, not just the spinner.
- Prove a test catches a bug by breaking the code and watching it fail.
- TanStack Router: routes built from `NAV` aren't typed for `navigate({ to })`; navigate to `"."`.
- **An edit saved from a dialog ends with `settleSave`** (`src/api/hooks.ts`): it merges the reply by id into the
  cached queries Edit opens from, then waits (at most 3 s) for their refetch, so a dialog closed on success can't
  reopen from old data and save it back (fix-stale-key-pattern). A new Edit source goes in its `store` list. Don't
  re-sync an open form on a refetch instead: it wipes what someone is typing.

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

- **Every UI text change lands in zh-CN too, and every README change in `README.zh-CN.md`** (CLAUDE.md *Languages*).
  `catalog.test.ts` ("has every key…") catches a missing or extra key but not changed English under an old key;
  `tests/test_readme_parity.py` catches a README section or image the other lacks. Put both in builders' briefs.
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
- **`merge_main.sh` reverted a done task** again (`i18n-zh-cn-people` came back as `next`; on 2026-11-11/12 it put
  three or four just-merged tasks back to `next` on #319, #323 and #324): check the roadmap diff after every merge of
  main, statuses included (`git diff origin/main -- docs/ROADMAP.yaml | grep -o "id: [a-z0-9-]*\|status: [a-z]*"`). Its dedupe can also drop a task's `status:` field (`fix-offer-loading-says-none`), and then
  `bump.py` fails: put the status back by hand. `bump.py` also needs `pnpm install` in the worktree first
  ("openapi-typescript: not found").
- **Screenshot pixel diffs prove English didn't change**: `screenshots.py <url> <lang> layout en` before and after,
  then compare the PNGs with Pillow (`ImageChops.difference(...).getbbox()`); same size and no box means identical.

## Website (Astro)

- **Astro doesn't scope `@keyframes`**: two components' `drift` collide and one silently replaces the other. Prefix
  every keyframe with its component (`hero-drift`, `story-nudge`).
- **Node:** Astro 7.4.2+ needs Node ≥ 22.23.4 (`bin/astro.mjs` exits otherwise); 22.23.5 is in nvm, with pnpm 10.28.2
  installed into it.
- **Layout shift from fonts:** preload the font used above the fold and give it a metric-matched fallback
  (`size-adjust`, ascent/descent overrides). Playwright's bundled headless shell has different fallback fonts from
  system Chrome: measure CLS in both, with the font delayed.
- **`astro dev`/`astro preview` can detach** as daemons (they did here, from `pnpm dev`): stop them with `npx astro dev stop` / `npx astro preview stop`
  from the same `website/`, or they hold ports for days.
- **The website has no GIFs:** what moves is `AppDemo.astro` over still captures (`website/src/assets/`). Only the
  social card, the icons and `overview.png` follow the repo's files by themselves (`website/scripts/sync.mjs`).
- **Taking a set of captures** (#438's recipe; its script wasn't committed):
  - Seed outside the repo (`seed_demo.py` refuses a folder inside it), English and `--lang zh-CN`, in the job folder.
  - Serve from the worktree's fresh build. Playwright with `channel="chrome"`, `color_scheme="light"`,
    `reduced_motion="reduce"` (the still lilac background), localStorage `mantine-color-scheme-value` and
    `jat.language` set first, and every non-GET request aborted.
  - Keep each old image's size and framing unless the layout cuts something. Look at every one, then DAST.
  - A compare page in `var/review/`, served on 127.0.0.1 only, before anything is committed.
  - Demo times follow the seeding time: at night, seed, serve and shoot in one daytime zone (`TZ=America/Chicago`,
    Playwright's `timezone_id`).
- **Retaking the hero demo's captures** moves every overlay in `AppDemo.astro` (measure them in the app), the role
  URL's id, and alt text that names a day. Then film a whole loop in Chrome and Firefox, and look at each crop in
  place at desktop and phone widths.
- **DAST catches:** a plug on a cable heading for a socket reads as a sperm (any head with a tail aimed at an
  opening does), and "AI" in Inter reads "Al" without the serifed I (`font-feature-settings: "cv08"`).
- **Screenshots from the demo app:** restart it after a release, or the app shows a red version-mismatch warning in
  every capture.
- **Sites behind Cloudflare** refuse headless browsers; ask Kai for screenshots or let Kai pass the check in a
  visible window. Never try to get round the check.
- **`ship.sh … keep-agent-worktree`** releases without removing a builder's worktree that's still in use.

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
- **Windows VM** (`ssh winvm`; first used on #300, 2026-11-11): the real check, and where contributor code runs.
  - Reset it to its clean snapshot before running a contributor's code, check out the branch in its `jat` clone
    (`git fetch origin <branch>; git checkout -B <branch> FETCH_HEAD`), and shut it down when done.
  - Plain `uv sync` since #312 (`.python-version` asks for 3.12 to 3.14). Before it, uv picked 3.15, where
    `httptools` and `uuid-utils` have no Windows wheels and the build needs Visual C++ or Rust (bug
    `fix-python-315-install`); a branch older than #312 still needs `--python 3.13`.
  - The remote shell is PowerShell 5.1: `;` not `&&`, and native tools' stderr comes back as red `NativeCommandError`
    noise (filter it). `--lf` needs pytest's cache, so don't pass `-p no:cacheprovider` with it.
  - `jat serve` blocks: start it with `Start-Process -PassThru -RedirectStandardOutput …` (set
    `PYTHONUNBUFFERED=1` to see its output), query `/api/v1/health` with `Invoke-RestMethod`, then stop the `python`/`uv` processes.
  - The VM has no global git identity: set `git config user.name/user.email` in each test data repo before a
    snapshot can commit.
  - The suite is green there since #378 (0 failures); a new failure is real.
  - Never run it while browser tests run: the load flipped board.spec.ts:351's drag-scroll and the
    `fix-double-save-locked` `test.fail`.
  - Its corepack pnpm is 12.x; the project pins 10.28.2: use `npx pnpm@10.28.2`.
  - `virsh` needs `sg libvirt -c '…'`. It sometimes ignores a clean shutdown: `virsh destroy` after a wait.
  - On real Windows, `open()` reports a sharing violation as PermissionError errno 13 with no winerror (only
    `os.replace`/`unlink` give winerror 32).
- **Concept CSS over Mantine:** inspect the real DOM in a browser rather than guessing class selectors (the board width
  rule matched nothing at first).
- **Vite's hot reload can silently keep old code** on `TodayPage.tsx` ("Could not Fast Refresh (useNextActions export
  is incompatible)"): if a dev page doesn't show a change, restart Vite with `--force` before debugging the code.
