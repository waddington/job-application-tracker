# Now: state and live plan

Snapshot 2026-11-15, after #366 (main at `238a210`, v1.24.17). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.24.17**. Branches on GitHub: `main`, `worktree-app-redesign-concepts` (draft #354, not for
  merging) and this refresh until it merges. Local: `main`, `pr324` (old, left alone).
- **Open PRs:**
  - **#354** DO NOT MERGE: the app redesign concepts (task `app-redesign-concepts`). Four looks behind a dev-only
    switch (`?design=1`–`4`, `0` = today's look). Waiting for Kai to look ("ill look at the redesigns later"). The
    builder's worktree is `.claude/worktrees/agent-a1abf04926d779406` (locked); its screenshots are in its
    `var/concepts/`. Its servers: Vite on 5183, demo API on 8893 (data `/tmp/jat-concepts-data`), run by that builder.
  - **#357–#365**, the outside contributor's nine Windows PRs (one per planned roadmap task). Planned, not reviewed:
    the overview, the plan comparison and the order are in Kai's local report
    `ignorable-docs/contributor-prs-357-365-plan.md` (git-ignored, in the main checkout). Order: #362, #363, #360, #358,
    #361, #357, #364, #359. **#365 is on hold** (Kai, below). Kai said not to start the reviews yet.
  - **#356** Dependabot: Astro 7.3.8 → 7.4.7 for the website. Not looked at.
- **Dependabot alerts:** 5 on main (3 moderate, 2 low), up from 1 (#33). Not looked at.
- Kai's tracker on 8770 needs a restart (Ctrl+C, `uv run jat serve`) for v1.24.17 (Python changed); the main
  checkout's frontend is rebuilt.
- Background jobs of this session: the PM dashboard on 8767 (`bcw6m4eu1`), plus the concept servers above.
- The user-level after-compaction hook is still **not** in `~/.claude/settings.json` (JSON under *Waiting on Kai*).

## Done since the last snapshot (2026-11-12)

| Version | PR | What |
|---|---|---|
| 1.24.14 | #348 | The website's GitHub links show the star count, live (baked in at build, refreshed in the browser) |
| 1.24.15 | #350 | Google Search Console verification tag on the website |
| 1.24.16 | #352 | The website's h1 carries "Job application tracker"; the description leads with "job search tracker" |
| 1.24.17 | #355 | Marking a round Done moves its application to Waiting to hear back, from the round's day |

Internal: #347 (last refresh), #349 (app redesign P12, ten `next` tasks heading Up next), #351 (`readme-visuals`),
#353 (P13 "For any job", four `next` tasks; `website-404`, `website-simple-wording`, `readme-shorter-features` in the
backlog), #366 (`/ignorable-docs/` ignored; a `.gitignore` change now takes `checks.sh --website`), this refresh.

## Kai's asks this round (2026-11-12 to 15)

1. "i want the github stars count shown live on the website, ship it" → #348.
2. "new roadmap item, redesign the UI of the app to match the new website … component at a time or page at a time" →
   "put the new item at the top of the backlog", "in next up" → #349 (P12 first in the file). Then "continue" → the
   concepts round, draft #354 → "ill look at the redesigns later".
3. "what is that missing branch for?" → `worktree-pr-screenshots`: the shelved before/after screenshot tool (#291,
   commit `a283908`). Offered to restore it; no answer.
4. "can i add search console to the webste" → Kai pasted the tag → #350. "is it worth setting up actual google
   analytics" → "the privacy promises are just about the app, not the static github pages site", "the analytics inside
   github is pretty rubbish" → "i will stick to just search console for now". Sitemap "Couldn't fetch" was just Google
   not having crawled yet; "ive done the index request, dont do anything".
5. "can we have gifs/mp4 in the readme?" → answered (GIFs autoplay; MP4 only as a user-attachments upload Kai makes).
   → "add a roadmap item to upgrade all the images/etc in the readme … like … ai-job-search" → #351.
6. "saerch google for some related terms" → not found for any term; a fork outranked the repo on the site's title.
   "do some seo research … does github static sites even get listed?" → yes; ideas offered (AlternativeTo, selfh.st,
   Show HN, r/selfhosted, dev.to; awesome-selfhosted from about 25 Feb 2027). Kai did the index request.
7. "do the h1 change", "job search tracker seems like a ver releavnt term" → #352.
8. "also is there a way to add a custom error page?" → "put 404 on backlog"; "add a roadmap item up next to make this
   non-swe-focused"; "perhaps add the word simple somewhere, make it a roadmap item"; "new roadmap item to shorten the
   huge list of features in the readme" → all in #353.
9. "when clicking done when an interview is on the left side, it should automatically move to waiting to hear back" →
   #355 (data-safety reviewed twice). New bug: `fix-round-waiting-after-heard-back`.
10. "that external guy has opened ~9 PRs … light report in …/ignorable-docs … which order to review/merge them in. Do
    not do the reviews yet" → the report. Decisions: "dont review/merge 365 yet, and yes we can say we support windows
    even without the snapshots" (recorded in the report and decisions.md).
11. "commit/merge the gitignore changes for the ignorable docs folder … do not push the ignorable docs" → #366;
    "what checks run for the gitignore PR?" → "stop it and merge, add the skip rule".
12. "update the compaction doc" → this refresh.

## Next

Nothing Kai asked for is unfinished. Report and wait; Kai picks. In line:

- **The contributor PRs**, in the report's order, once Kai says go: security read of every changed line first, then
  the two reviews against the plan, Linux checks, the Windows VM one PR at a time, carry with our fixes and bump
  (contributor-prs.md). #357 likely needs coded errors (`CodedError`, zh-CN text). #359 after #357, #358 and #364.
- **The app redesign** (P12): Kai picked concept 11 from #354 (2026-11-15); the plan is `docs/rfc/app-redesign.md` and
  P12's tasks. Building starts once Kai has seen the plan.
- **Up next after it:** P13 "For any job" (round types for any job and editable, default currency, generic examples,
  marketing), loading-state parts 2–4.
- **Bugs:** 55 open (9 medium, 46 low); mediums as before (`fix-double-save-locked` needs a decision).

**How work ran this round** (keep doing it this way unless Kai says otherwise): one builder agent per change in its own
worktree (`isolation: worktree`), Opus reviewers for data safety or structure, Sonnet or Haiku for small and docs
PRs, every fix commit re-reviewed; the lead bumps, merges and ships. Roadmap-only PRs: `uv run pytest -q tests/pm`.

## Waiting on Kai (don't start)

- **The redesign plan** (`docs/rfc/app-redesign.md`): 11 is picked; Kai sees the plan before building starts.
- **The contributor PRs:** the go-ahead to start reviewing in the planned order.
- **Restart the tracker** for v1.24.17.
- **The user-level hook:** add to `~/.claude/settings.json` next to `"env"` (the auto-mode check refuses this edit):
  ```json
  "hooks": { "SessionStart": [ { "matcher": "compact", "hooks": [ { "type": "command",
    "command": "/home/kai/Documents/Projects/job-application-tracker/tools/dev/after_compact.sh --user", "timeout": 30 } ] } ] },
  ```
- **Dependabot:** 5 alerts and #356.
- **Restore `worktree-pr-screenshots`?** (from #291's head `a283908`); useful for the redesign's PRs.
- **Decisions:** `fix-double-save-locked`; `i18n-zh-cn-offer-word`, `i18n-zh-cn-brand-name`; MCP §14; `hosted-mcp`'s
  open questions; the new app fonts (Inter, JetBrains Mono) when the redesign is built; the GitHub repo description
  (for-any-job and "simple" wording) when those tasks run.
- **The VM's README** (Kai's `windows-vm` project): `virsh shutdown` didn't stop Windows; `ssh winvm 'Stop-Computer -Force'` did.
- **Repo gaps offered for contributors, no answer:** CONTRIBUTING asks contributors to update `CHANGELOG.md` though Kai
  asked them to leave it; PRs get no automatic checks.
- **Left alone** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.

## Noticed, not promised

- `docs-contributor-prs` is still `building` on the roadmap with no branch: check whether it's done.
- The website's hero demo shows the app at 1.24.7; re-capture when the app's look changes (CONTRIBUTING *The website*).
- A CNY role's pay reads "2800 CNY/天": `formatMoney` has symbols only for GBP, USD and EUR (now `generic-money`).
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- A failed startup write of `.gitattributes` is silent (no log); snapshots report it where they run.
- A plain fork of the repo outranks it for the site's exact title in search; harmless.
