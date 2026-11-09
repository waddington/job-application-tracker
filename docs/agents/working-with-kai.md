# Working with Kai

Kai's standing instructions that aren't already rules in `CLAUDE.md` (which wins on any conflict), how Kai works, and
where things run. Quotes are Kai's words.

## Standing instructions

- **Keep going.** "keep going. im going afk. you have enough to work on for ages, you'll hit a rate limit before you
  finish. just wait it out." On a rate limit, wait about 30 minutes and retry. But Kai scopes the work: "stop after
  merge and release, dont start the next one". When Kai has named the items, finish those, report, and wait.
- **Commits:** "commit small and frequently and often". Conventional Commits, pushed after each commit, ending with the
  `Co-Authored-By:` trailer the harness gives (`Claude Opus 5.5 <noreply@anthropic.com>` as of 2026-11-07); PR bodies
  end with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- **Documents go in the repo, not artifacts.** Deleting anything of Kai's needs Kai's confirmation.
- **One PR at a time:** "handle PRs sequentially, review-fix cycle then merge, then handle the next PR. theres no point
  running reviews for PRs that will need ot be reviewed again ocne another PR merges". Don't combine fixes to save check
  time ("no dont ocmbine them"). After merging main into an already-reviewed PR, compare its own diff before and after
  (`git diff origin/main...HEAD --stat`, then `git diff origin/main --stat`); only a changed diff needs a fresh review.
- **Fan out only when Kai asks** ("fan out massively" meant a 20-agent workflow). On 2026-11-07, near the usage limit:
  "actually dont paralleisd im close to usage limit dont want to go over". Lifted on 2026-11-09: "my usage limit
  refreshed, do it in paralel with agents" (builder agents per bug, merged one at a time). If Kai mentions the limit
  again: no parallel builders, one reviewer per PR (Sonnet for small or docs PRs), no workflows.
- **Merging and releasing** follow CLAUDE.md; "merge once ready and update local main". A major needs Kai's explicit yes
  every time. If a permission check blocks a merge or release, ask Kai and give the `!` command; never work around it.
- **Plan before building when asked:** "dont do anything yet, give me a PR plan"; "noooo noo no no, dont buikld antyhing
  eyt … undo all of that. i want to know what each PR would be". Write the plan (an RFC in `docs/rfc/`, roadmap tasks)
  and stop; build on "lets get building" / "do the first item". Fact-check a plan before merging it (one plan had 15
  must_fix).
- **Small PRs:** about 500 changed lines, 1,000 at most; split a feature into roadmap tasks before any code (API, then
  screens, then insights).
- **Dependency updates:** "it might be best to do only a couple of version updates per PR in case something breaks";
  "be sure to run e2e tests for this as these updates have a high risk of breaking some behaviour".
- **Data safety:** a feature that rewrites applications from another edit gets a reviewer told to focus on data safety
  (#92's first version flipped routes and was reworked).
- **Don't max out Kai's PC:** "you are maxing out my PC". Tests only through `pnpm` or `tools/dev/checks.sh`; never two
  heavy runs at once; skip browser tests when CLAUDE.md allows.
- **Branches:** "also delete branches on remote that are no longer needed". After each merge only `main` remains, plus
  the long-lived `pr-shots` branch, which holds the screenshots PR descriptions show: never delete it.
- **PM dashboard:** "keep the PM dashboard up to date, or even backfill items if they were not added". Every task gets a
  roadmap entry (P7, or P8 for i18n; id = branch minus `worktree-`), `building` while its PR is open, `done` just before
  merging. Pull main after every merge, roadmap-only ones too, or the dashboard goes stale.
- **Roadmap words:** a request to build is `next` (or `building` in its own PR); an idea or "add a roadmap item" is
  `planned` (Backlog) unless Kai says to build it. With nothing up next: report the backlog and wait.
- **Docs:** "ensure docs are up to date, readme, images, etc". **Images and GIFs go to Kai before they're applied:** "i
  want to see the new gif(s) before you apply them".
- **Visibility:** after each merge, fast-forward main, rebuild the frontend there, and say in a line what's live and
  whether Kai must restart the tracker (any backend change: Ctrl+C, `uv run jat serve`).
- **Explain plainly:** "you didnt explain it to me, file changes got in the way". Say what changed in plain words before
  file details. Answer a mid-turn "sitrep" briefly and honestly, then carry on. When Kai asks for links or status, give
  them in a clean final message (mid-turn text doesn't always reach Kai).
- **Questions first:** when Kai asks a question, check the code or the running thing and answer before proposing work.
- **Outward-facing things** (repo description, topics, Pages, issue replies) need Kai's yes. Kai uploads the social
  preview by hand; Kai's branch ruleset on `main` blocks deletion and force pushes. Draft replies as Markdown
  for Kai to post; never post for Kai. Dates in English are day, month, year ("31 Oct 2026").
- **Privacy:** never copy names from Kai's screenshots (real companies and recruiters) into the repo, commits or PRs.
  Never POST, PATCH or DELETE against Kai's tracker on 8770; GETs to check health or a migration are fine.
- **No agent-team skill here** unless Kai names it ("use /agent-team to do a code review" for contributors' PRs, with
  `/code-review:code-review` alongside, saying which found each finding); otherwise plain `general-purpose` subagents.
  **Never give a one-off agent a `name`**: named agents become teammates that don't report back by themselves.
- **UI changes: Kai sees them first** when asked ("show me the mock server before merging so i can review the ui"): a
  demo URL on seeded data with the case on screen, then build the test and ship on "ship it". When Kai says a PR
  waits for him ("this one dont automerge"), merge only on his word.
- **Every UI PR shows before and after** (CLAUDE.md, *Git*): "when making a UI change the PR should have before/after
  screenshot(s) … it doesnt need a huge amount for every data scenario but soenmthign to see what was
  changed/added/removed". `tools/dev/pr_shots.sh` makes the table.
- **English text and layout are Kai's call in translation work:** a fix that changes English waits for Kai's yes, and
  language-specific CSS stays as small as possible (`docs/rfc/zh-cn.md`, *Layout*).
- **Contributors' PRs** (issue #230's author sends the Windows work):
  - Never comment on a PR or issue: "dont comment on the PR, report back to me here". Kai posts.
  - Don't trust the contributor's testing: "i cant trust the external contributor, i would do testing myself". Check
    lockfile hashes against PyPI, read every line (tests and `conftest.py` run as Kai), run the full checks and the
    browser tests in a throwaway worktree on seeded data, and simulate Windows where possible (gotchas.md, *Other*).
    Kai tests on Windows himself.
  - The draft is one top-level comment ("i will leave only top-level comments, not on specific lines of code"),
    leading with encouragement ("nice job etc"), asking only for what blocks merging ("that feels like a lot of
    feedback"); the rest becomes Kai's follow-ups. Precise enough for the contributor's AI to act on (their PRs look
    AI-assisted), with a short why per ask.
  - **A draft claims only what Kai did:** "you lie in that comment, i didnt run it with fcntl unavailable". Say "the
    review (partly AI-assisted) shows…", never "I ran…" for work the lead did.

## How Kai works

- Uses the tracker for a real job search and reports gaps as they come, often several at once or mid-turn: split them
  into PRs, or fold a small one into the PR in progress.
- Thinks out loud in questions ("how will…", "what did you mean…"): answer plainly; record the answers in the RFC when
  Kai says "commit the plan".
- Sometimes wants to see a change running before it lands ("i want to check the dev version before merging"): give a
  local URL then, and only then.
- Refines visual things in quick rounds: a demo URL each round, follow-ups folded into the open PR.
- Values honesty about state, docs and images that match the code, a tidy repo, and discoverability on GitHub.

## Where things are

- **Code:** `/home/kai/Documents/Projects/job-application-tracker` (`waddington/job-application-tracker`, public).
  Worktrees in `.claude/worktrees/<name>`, branch `worktree-<name>`.
- **Kai's data:** `/home/kai/Documents/Projects/job-application-tracker-data`. Never touch it beyond reading status.
- **Kai's tracker:** http://127.0.0.1:8770, run by Kai in their own terminal (`uv run jat serve` in the main checkout,
  data folder from `.env`). Never stop it. Check: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8770/api/v1/health`.
  If it's down, say so and offer to start it as a background job from the main checkout.
- **PM dashboard:** http://127.0.0.1:8767, `python3 -m tools.pm` from the main checkout as a background job of the
  session. Restart it when gone (a session restart stops it) and after a `tools/pm` change. Preview a branch's with
  `python3 -m tools.pm --port 8768 --root <main checkout>`.
- **Demo servers:** seed with `uv run python scripts/seed_demo.py <new dir>`, serve with
  `uv run jat --data-dir <dir> serve --port 88xx` (one port per server and reviewer). The zh-CN demo API is on 8891.
- **Node for pnpm:** `/home/kai/.nvm/versions/node/v22.23.3/bin` first on PATH, with `/home/kai/.local/bin` (uv) kept.
  `tools/dev/env.sh` does both.
- **Scratch files:** the session's job folder, `/home/kai/.claude/jobs/cf5328f4/tmp` for the current session (also
  `$CLAUDE_JOB_DIR/tmp`; a new session gets a new folder); PR bodies there. Agents in their own worktree
  can't write there: they use their worktree's `var/` or a `/tmp/jat-<task>-…` folder.
- **Scripts:** `tools/dev/` (checks, merge main, bump, merge, ship, text snapshot, links, screenshots);
  `scripts/i18n/translate/` and `.claude/workflows/` (translation); `scripts/demo_gif/`, `scripts/social_preview/`.
- **PR body:** set with `gh api -X PATCH repos/waddington/job-application-tracker/pulls/N -F body=@file`
  (`gh pr edit` fails silently).
