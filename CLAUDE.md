# job-application-tracker: instructions for Claude

## What this is
A local-first tracker for Kai's software-engineering job search. Kai's brief (2026-09-30):
applications come in directly and through recruiters, and one recruiter can have several
roles. Each application moves through stages and statuses governed by a workflow or state
machine. Kai needs an overview, a clear view of what to chase, and somewhere to keep details:
notes on the role, interview and call notes (probably Markdown files or Google Doc links),
PDFs and email exports. It runs locally.

## Ownership
- Kai is hands-off on this repo. **Claude manages all PRs, merges and local state**, and Kai
  interacts only through Claude. Claude may merge its own PRs here once checks pass. This
  overrides the generic "never merge" default for this repo only.
- Remote: `git@github.com:waddington/job-application-tracker.git` (**public**). The default
  branch is `main`.
- License: Apache-2.0 (`LICENSE`) with a `NOTICE` crediting Kai. Keep both intact, and keep
  any third-party code's license notices when borrowing (e.g. from MIT-licensed JobSync).

## Public repo: personal data never gets committed
- This repo is public, but the data is Kai's job search: companies, recruiters, contacts,
  salaries, notes, CVs, PDFs and email exports. **None of it goes into git.**
- Personal data and runtime state live in git-ignored `data/` and `var/`, resolved to the main
  checkout path so they survive worktrees. Never delete them without asking.
- Tests, fixtures, screenshots, docs and examples use made-up data only (fake companies,
  `example.com` addresses). Real names, emails and phone numbers never appear in code,
  commits, PR descriptions or issues.
- Before every commit, check the diff for personal data. If any has been pushed, stop and tell
  Kai; don't rewrite history on your own.

## Git
- Follow `~/.claude/git-workflow.md`: a worktree per change set under `.claude/worktrees/`,
  a PR per change set, merge commits (`gh pr merge N --merge --delete-branch`), and
  Conventional Commits.
- **Commit and push small, frequent, logical units.**
- The main checkout (`/home/kai/Documents/Projects/job-application-tracker`) is where Kai's
  IntelliJ is open. After merging, fast-forward it:
  `git -C ~/Documents/Projects/job-application-tracker pull --ff-only`.

## Runtime
- Runs locally only. **Never install services** (systemd units, timers, cron entries).
  Long-lived things run as terminal processes.
- No hosted backends, telemetry or cloud sync. Any integration (Google Docs links, email
  import) is opt-in and read-only unless Kai says otherwise.

## Code
- The stack isn't chosen yet. Decide it in an RFC (see "Delivering an item"), then record the
  run, test and lint commands here.
- Once they exist, start with `docs/OVERVIEW.md` (the map: processes, data flow, state) and
  then `docs/ARCHITECTURE.md` (module contracts).
- Tests and lint must pass before merging.
- Prefer a plain-file data model (Markdown with frontmatter, attachments next to it) so the data
  stays readable and portable without the app.

## Keep going: the continuous delivery loop
**Never stop because a piece of work is finished.** After every merge, pick the next item and
start it in the same session. Stop only for a hard stop (below), a rate limit (wait 30 minutes
and retry, repeatedly) or when Kai says so. When Kai asks how it's going, give a short status
update and carry on. Don't pause the loop for a question that has a sensible default: make
the call, note the assumption in the PR, and keep going.

### Picking the next item, in this order
1. Unfinished work: open PRs, worktrees under `.claude/worktrees/` (check for uncommitted
   edits), and the "In flight" and follow-up lists in `var/RESUME.md`.
2. Review follow-ups and `should_fix` items left over from merged PRs.
3. `docs/ROADMAP.yaml`: the earliest phase's first task whose status is `planned` and whose
   `depends` are all `done`. Run independent tasks in parallel (worktree and PR each).
4. `var/RESUME.md` "Next" items that aren't on the roadmap yet: add them to the roadmap first.

### Delivering an item
- Big or unclear items get a PRD and an RFC first (`docs/prd`, `docs/rfc`), linked from the
  roadmap task.
- Worktree and PR per change set. Name the branch `worktree-<roadmap task id>`. Every PR gets a
  review pass (the `agent-team` reviewer roles), and `must_fix` findings are fixed before
  merging.
- **Every PR updates the docs it affects, in the same PR.** A reviewer treats a missing doc
  update as `must_fix`. Put this requirement in every agent prompt.
- The lead session merges (subagents can't). Then fast-forward main, restart anything running
  so it loads the new code, try the change for real, and fix anything that shows up.
- Keep `docs/ROADMAP.yaml` honest: set a task to `done` when it merges, and add any follow-ups
  as new tasks. Update `var/RESUME.md` at every milestone.

### When the roadmap runs out
The roadmap has run out when every task is `done` or `blocked` on Kai. Then, without waiting
to be asked, run an ideation round against Kai's brief above, deduplicate against
`docs/IDEAS.md`, add the survivors to `docs/ROADMAP.yaml` as a new phase, and start building.
Tell Kai in a line or two what was added and why.

### Hard stops: the loop never crosses these
- Never commit or push personal data (see above), and never rewrite history on `main`.
- Nothing contacts anyone on Kai's behalf: no sending emails or messages, no submitting
  applications, no replying to recruiters.
- No paid services, no API keys or accounts created for Kai, no service installs, and no runtime
  dependencies beyond the stack Kai signs off in the stack RFC without asking first.
- Never delete `data/` or `var/`.
