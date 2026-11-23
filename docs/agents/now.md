# Now: state and live plan

Snapshot 2026-11-23, after #446 (main at `ada4c8e8`, v1.24.52), written before a compaction. Refresh this file before
each compaction. Before trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and
`docs/ROADMAP.yaml`.

## Kai's current request

Nothing is in flight. Kai is compacting ("then update compact docs and give me the compact procedure", 2026-11-23).

- **Kai's tracker reported 1.24.51** when this was written: v1.24.52 (#446) needs a restart. Check it after the
  compaction and repeat the reminder if it still does.
- **Last done, all merged and released:**
  - #444, v1.24.51: the shorter README with new artwork. Kai picked it over four rounds (hero HA2, diagrams S2 and D1,
    light only, badges as they were), reviewed it ("looks good, ship it") and merged it past one unrelated browser-test
    failure ("just merge now, this is unrelated"), recorded as `fix-flaky-phone-nav-bar-drag-test`.
  - #445 (internal): `scripts/readme_art/` skips the browser tests ("yes update the skiplist").
  - #446, v1.24.52: every search box ignores accents and case (Kai: "new feature, if a name has accents in it, search
    should work with both accent and no-accent version of letter").
- **Kai asked a question and got an answer:** rejection feedback can be added later, from the application's page or
  quick view, and Insights shows it at the rejection's own date.

**Nothing below starts without Kai's word** (Kai's scope wins over the delivery loop): after the compaction, give the
state in a few lines, recommend the first item, and wait.

## Next, when Kai gives the word

1. **New from #446's review, needs Kai's choice:** `fix-same-name-accented-capitals` (medium): quick-adding "École
   42", "école 42" and "ÉCOLE 42" makes three companies (people and role titles too). Ask: should "Ecole" also count
   as "École", or only case be ignored? For people I'd ignore case only (two people can share a name).
2. **Offered on 2026-11-22, no answer yet:**
   - **"fix the board race"** (`fix-board-drag-width-race`, about 1 h, with `fix-flaky-keyboard-add-agency-test` and
     `fix-flaky-phone-nav-bar-drag-test`): board mouse-drag tests keep failing full runs (#439 three times, #444
     once), so they can block any app PR. Recommended first of the tooling work.
   - **"cheap checks first"** (20 min, not on the roadmap yet): `checks.sh` runs the quick checks first and stops on a
     failure.
3. **After the redesign** (Kai queued them): `fix-tablet-header-overflow`, `fix-board-touch-drag`,
   `fix-slash-behind-modal`, `fix-phone-quick-view-buttons-cut`, `fix-phone-new-application-route-wide`.
4. **Website bugs from #442's review, no go yet:** `fix-website-board-dates`, `fix-website-story-phone-crop`.
5. **The README art's open notes, if Kai wants them changed:** the hero's small text is unreadable on a phone;
   "127.0.0.1" sits under "Your browser"; "with undo" means undo the last move; `jat push` sends the export, not the
   database file.
6. Also `next`: `e2e-seed-once` and P13's `generic-*`. #359 when its author updates it.

## State

- **Released up to v1.24.52.** The redesign is done (all 24 tasks); so are `readme-shorter-features`,
  `readme-visuals`, `skip-readme-art` and `search-accents`.
- **Open PRs:**
  - **#414** DO NOT MERGE: board concepts for per-round columns beside the quick view (`?board=N`). Parked for Kai
    ("park it for now, ill review another time"); its servers (5190, 8886) are off, its worktree kept
    (`board-rounds-concepts`). The bug is `fix-board-round-columns-cramped`; `board-card-round-ui` goes with it.
  - **#359** (`windows-support`): on hold until its author updates it. When they push: review it fully, carry it, walk
    its PowerShell steps on the VM. A minor bump.
  - **#365** (`windows-snapshots`): on hold (Kai).
- **Running:** the PM dashboard on 8767 (a background job of the session: restart it after a session restart, from the
  main checkout, `python3 -m tools.pm`); Kai's tracker on 8770 (Kai runs it in their terminal, never stop it). No demo or
  preview servers, no agents. Port 8778 is another project of Kai's: leave it.
- **Kept from the redesign:** #354's concept screenshots in the main checkout's git-ignored `var/app-redesign-concepts/`.
- **Dependabot alerts:** one open, build-time only, no patched version when evaluated (#33 `minimatch`). Left open.

## Done since v1.24.47

| Version | PR | What |
|---|---|---|
| 1.24.48 | #438 | the README's screenshots, both languages |
| 1.24.49 | #439 | the demo GIFs, the social card and the icons |
| 1.24.50 | #442 | the website's captures and its hero demo |
| 1.24.51 | #444 | the shorter README with new artwork |
| 1.24.52 | #446 | every search box ignores accents and case |

Internal: #440 and #445 (skip-list additions), #443 (the redesign wrapped up). Earlier work: `CHANGELOG.md` and `git log`.

**How work runs** (keep doing it this way unless Kai says otherwise):

- One PR at a time. A small change the lead builds itself; a big one gets a builder agent in its own worktree, briefed
  on focus, keyboard, breakpoints and widths (375 to 2,560 px, Firefox), running the affected specs, not the full
  checks. A builder measures in full once, then only what changed.
- An Opus reviewer for app changes and anything that guards the checks; Sonnet or Haiku for small and docs PRs; every
  fix commit re-reviewed. The review runs beside the checks, on a frozen copy of the build.
- The lead bumps, runs the cheap checks (format included) before the long run, runs the full checks once on the final
  commit (or `--no-e2e` where the skip list allows), reads their FAIL and `failed` lines, then merges and ships.
  Roadmap-only PRs: `uv run pytest -q tests/pm`.
- Prove a new test catches the bug by breaking the code and watching it fail (gotchas.md, *Other*).
- Images: options on a local compare page, Kai directs in rounds, DAST before each round (and a fresh-eyes DAST
  reviewer), nothing committed until approved. Kai may hold a PR for a whole-page review ("dont merge until ive
  reviewed the readme as a whole"): then wait for Kai's word.

## Waiting on Kai (don't start)

- **Bugs to pick:** the roadmap's phase B, including the ones queued above.
  - Found lately, no go yet: `fix-same-name-accented-capitals`, `fix-flaky-phone-nav-bar-drag-test`,
    `fix-timeline-detail-raw-markdown`, `fix-custom-stage-colour-contrast`, `fix-search-snippet-table-pipes`,
    `fix-note-preview-drops-hyphens`, `fix-flaky-keyboard-add-agency-test`. `fix-today-waiting-actions-clipped` also
    clips under *Your move* at 360 px and narrower.
  - Raised earlier: `fix-round-waiting-after-heard-back` (the contradicting pills), `fix-e2e-only-exit-status`,
    `fix-board-drag-width-race`, `fix-back-link-full-width`, `fix-flaky-panel-keyboard-move-test`,
    `fix-insights-dialog-flake`, `fix-dev-proxy-other-port-writes`; and the older backlog.
- **A product question from #446, nothing needed:** in pickers that can add a new entry, typing "Jose" when "José"
  exists now shows José and also offers to add "Jose" (they could be two people). Left as is.
- **Backlog raised lately:** `panel-add-todo`, `board-card-round-ui`, `retro-actions`, `why-you-ended-it`,
  `calendar-ui-improve`, `timeline-list-wide`, `insights-tables-sidescroll`, `website-simple-wording`; tasks
  `orphan-files-sweep`, `scripts-lf-endings`, `tz-spring-forward-test`, `e2e-rebalance-slow-files` and
  `pytest-parallel`.
- **The user-level hook:** add to `~/.claude/settings.json` next to `"env"` (the auto-mode check refuses this edit):
  ```json
  "hooks": { "SessionStart": [ { "matcher": "compact", "hooks": [ { "type": "command",
    "command": "/home/kai/Documents/Projects/job-application-tracker/tools/dev/after_compact.sh --user", "timeout": 30 } ] } ] },
  ```
- **Decisions:**
  - `fix-double-save-locked`;
  - `i18n-zh-cn-offer-word` and `i18n-zh-cn-brand-name`;
  - MCP §14 and `hosted-mcp`'s open questions;
  - the GitHub repo description, when those tasks run;
  - whether to dismiss the build-time Dependabot alert #33;
  - whether CLAUDE.md's "fill in data when Kai asks" should point at the live-data rule;
  - whether to rename the demo names "Blue Yonder Recruitment" (a real software company's name) and "Alex Morgan" (a
    well-known footballer's name): both DAST reviewers' borderline notes, left as is; renaming means every screenshot.
- **Restore `worktree-pr-screenshots`?** (from #291's head `a283908`).
- **Repo gaps offered for contributors, no answer:** CONTRIBUTING asks contributors to update `CHANGELOG.md` though Kai
  asked them to leave it; PRs get no automatic checks.
- **Left alone:** `notes-documents-improve`, `timeline-improve` and `people-you-meet` (Kai, 2026-11-02); the Claude Code
  permission-rule warnings for `git -C *` in the user settings (Kai asked to ignore them, 2026-11-17).

## Noticed, not promised

- `docs-contributor-prs` is still `building` on the roadmap with no branch: check whether it's done.
- The real offline test (Wi-Fi off) was never done: #437 was tried with the browser's offline event only.
- The quick view's summary grows 28 px when a later request answers (CLS 0.031, seen in #401).
- A CNY role's pay reads "2800 CNY/天": `formatMoney` has symbols only for GBP, USD and EUR (now `generic-money`).
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- A failed startup write of `.gitattributes` is silent (no log); snapshots report it where they run.
- The two text folds differ on a few non-Latin scripts and Greek's final sigma (`jat/textfold.py` says where); nothing
  compares across them today.
