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
- **Merging and releasing** follow CLAUDE.md; "merge once ready and update local main". Confirmed 2026-11-09: "yes you
  can merge and release going forward as long as you follow review-fix iterative cycle. i thought i had alrady granted
  express permssion for you to auto merge and release". So after the cycle (review, fix, re-review the fixes, checks
  on the final commit), merge and release without asking. A major needs Kai's explicit yes every time. The auto-mode
  check doesn't read CLAUDE.md and can still block a merge ("Merge Without Review", often after fixes landed post-
  review): `.claude/settings.json` allows `tools/dev/merge.sh` and `ship.sh`, which should let them run (run them as
  `tools/dev/merge.sh N`, relative, as the rules match the text). If it still blocks, ask Kai and give the `!`
  command; never work around it.
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
- **Branches:** "also delete branches on remote that are no longer needed". After each merge only `main` remains. Kai,
  2026-11-12: "cleanup old branches when you're done with them too": delete the branch, its worktree and any builder
  `worktree-agent-*` branch right after each merge, and throwaway branches (concepts, `pr-shots/*`) once their PR closes.
- **PM dashboard:** "keep the PM dashboard up to date, or even backfill items if they were not added". Every task gets a
  roadmap entry (P7, or P8 for i18n; id = branch minus `worktree-`), `building` while its PR is open, `done` just before
  merging. Pull main after every merge, roadmap-only ones too, or the dashboard goes stale.
- **Roadmap words:** a request to build is `next` (or `building` in its own PR); an idea or "add a roadmap item" is
  `planned` (Backlog) unless Kai says to build it. With nothing up next: report the backlog and wait.
- **Docs:** "ensure docs are up to date, readme, images, etc". **Images and GIFs go to Kai before they're applied:** "i
  want to see the new gif(s) before you apply them".
- **Visibility:** after each merge, fast-forward main, rebuild the frontend there, and say in a line what's live.
  **Every release needs Kai to restart the tracker** (Ctrl+C, `uv run jat serve` in the main checkout), frontend-only
  ones too, so always say so: the rebuilt page shows a version warning while the server reports the old version
  (Kai, 2026-11-22: "every release, frontend-only ones too, needs Kai to restart the tracker, so always say so").
- **"whats taking so long":** give the time per step and offer concrete speed-ups (Kai took a website-only check mode
  and a second parallel builder, 2026-11-12). Cap long measurement loops in builders; ask for interim results.
- **Explain plainly:** "you didnt explain it to me, file changes got in the way". Say what changed in plain words before
  file details. Answer a mid-turn "sitrep" briefly and honestly, then carry on. When Kai asks for links or status, give
  them in a clean final message (mid-turn text doesn't always reach Kai).
- **Questions first:** when Kai asks a question, check the code or the running thing and answer before proposing work.
- **Outward-facing things** (repo description, topics, Pages, issue replies) need Kai's yes. Kai uploads the social
  preview by hand; Kai's branch ruleset on `main` blocks deletion and force pushes. Draft replies as Markdown
  for Kai to post; never post for Kai. Dates in English are day, month, year ("31 Oct 2026").
- **Privacy:** never copy names from Kai's screenshots (real companies and recruiters) into the repo, commits or PRs.
  Never POST, PATCH or DELETE against Kai's tracker on 8770; GETs to check health or a migration are fine.
- **Agents never edit Kai's live data directly** (2026-11-16: "i dont want you editing any live data. there is a plan for
  an mcp layer (or other) which should help make it safer for agents to modify data"). Not through the API, the
  database or the data folder, even when it would save Kai time (e.g. entering LinkedIn messages). Changes by an agent
  wait for that safer layer (`docs/rfc/mcp.md`, `mcp-write`).
- **No agent-team skill here** unless Kai names it ("use /agent-team to do a code review" for contributors' PRs, with
  `/code-review:code-review` alongside, saying which found each finding); otherwise plain `general-purpose` subagents.
  **Never give a one-off agent a `name`**: named agents become teammates that don't report back by themselves.
- **UI changes: Kai sees them first** when asked (not the redesign's PRs, see below) ("show me the mock server before merging so i can review the ui"): a
  demo URL on seeded data with the case on screen, then build the test and ship on "ship it". For a layout PR Kai
  asked for a before-and-after table of screenshots in the PR description ("| Item | Before | After |"), and to merge it
  himself ("this one dont automerge"): images on a throwaway `pr-shots/<task>` branch, demo data only.
- **The app redesign's PRs (roadmap phase P12) don't need Kai's screenshot approval** (2026-11-15: "i dont need to approve the
  screenshots, your reviews are fine"): the review cycle and the checks are enough, then merge and release as usual. No
  `pr-shots/` branch or before-and-after table; keep a demo server up for the reviewer. Images that get *applied* (README
  screenshots, GIFs, the social card, icons) still go to Kai first.
- **Designs: several concepts on a dev server, with a switch** (2026-11-11: "the dev server should have a toggle for 3-5
  different designs/concepts"). A dev-only switch (`import.meta.env.DEV`, plus `?design=N`) on a Vite dev server over a
  seeded demo API, screenshots of each, a draft PR marked do-not-merge; Kai narrows it in rounds ("give me a few sub
  variations"), then the pick goes into the real PR and the concepts PR is closed. The Interviews calendar (#317) went
  five concepts, then eight variations, then two kept as Month and Year.
  The website redesign (2026-11-12) went 5 concepts → sub-variations → crosses → speed variants, then was built
  behind a hidden route in small PRs and swapped in with a before/after table Kai approved ("go, ship it").
- **New bugs found along the way:** "if new bugs are discovered report them here and add them to the backlog" (2026-11-11).
  Fixing them waits for Kai unless it's the PR's own data safety. When many PRs are open, Kai may freeze new work:
  "dont pick up anything new (except recording things in backlog) until these are merged".
- **English text and layout are Kai's call in translation work:** a fix that changes English waits for Kai's yes, and
  language-specific CSS stays as small as possible (`docs/rfc/zh-cn.md`, *Layout*).
- **The Windows VM runs one PR at a time** (2026-11-11: "proably only 1 PR can be checked on the VM at a time",
  "multiple instances would bog the computer"): one VM, one branch in it at once, never a second VM or clone in
  parallel; builders running alongside don't use it.
- **Contributors' PRs** (issue #230's author sends the Windows work): the whole process, with Kai's instructions, is in
  [contributor-prs.md](contributor-prs.md). Never comment on their PR or issue; Kai posts. One exception: Kai may
  approve posting a specific drafted comment ("you can post that comment", 2026-11-15, for #359). That covers that
  comment only; drafting in chat stays the rule.
- **Dependabot PRs aren't carried** (2026-11-15: "for dependabot PRs you dont need to carry them you can do it directly
  on the PR because its not from a person, its from our own repo bot"). Commit directly on Dependabot's branch (merge
  main in, bump, fix), then merge its PR.

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
- **Node for pnpm:** `/home/kai/.nvm/versions/node/v22.23.5/bin` (the website needs >= 22.23.4) first on PATH, with `/home/kai/.local/bin` (uv) kept.
  `tools/dev/env.sh` does both.
- **Kai's local reports:** `ignorable-docs/` at the root of the main checkout, git-ignored (#366). When Kai asks for
  a report there, write it there and never commit or push it (Kai, 2026-11-15: "do not push the ignorable docs").
- **Scratch files:** the session's job folder, `/home/kai/.claude/jobs/cf5328f4/tmp` for the current session (also
  `$CLAUDE_JOB_DIR/tmp`; a new session gets a new folder); PR bodies there. Agents in their own worktree
  can't write there: they use their worktree's `var/` or a `/tmp/jat-<task>-…` folder.
- **Scripts:** `tools/dev/` (checks, merge main, bump, merge, ship, text snapshot, links, screenshots);
  `scripts/i18n/translate/` and `.claude/workflows/` (translation); `scripts/demo_gif/`, `scripts/social_preview/`.
- **PR body:** set with `gh api -X PATCH repos/waddington/job-application-tracker/pulls/N -F body=@file`
  (`gh pr edit` fails silently).
