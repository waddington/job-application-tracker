# Now: state and live plan

Snapshot 2026-11-22 evening, after #442 (main at `9e0929ea`, v1.24.50), written in #443. Refresh this
file before each compaction. Before trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and
`docs/ROADMAP.yaml`.

## Kai's current request

"do readme-shorter-features and readme-visuals" (2026-11-22), then "dont merge without me, they can be the same PR
too": **one PR on `worktree-readme-shorter-features`. NEVER merge it without Kai's word on it**, however clean the
review and checks are (the standing merge permission doesn't cover it). It stays a draft until then.

- It's #444. Kai picked the art over four rounds (hero HA2, diagrams S2 and D1, light only, badges as they were), and
  then: "dont merge until ive reviewed the readme as a whole". So: review and checks, then give Kai the rendered
  READMEs on the branch, and wait.
- With it: the "next up" lines stop naming Docker (shelved) in both READMEs and `llms.txt`.
- The redesign is finished (#442, #443; #354 closed and removed).
- Kai's tracker reported 1.24.49 at v1.24.50's release: check it, and repeat the restart reminder if it still does.

**Nothing below starts without Kai's word** (Kai's scope wins over the delivery loop): report and wait.

## Next, when Kai gives the word

1. **Offered on 2026-11-22, no answer yet:**
   - **"fix the board race"** (`fix-board-drag-width-race`, about 1 h, with `fix-flaky-keyboard-add-agency-test`, 15
     min): the race failed all three full browser runs that evening, so it can block any app PR. I recommended it first
     of the tooling work, and it may be wanted before the next app PR.
   - **"cheap checks first"** (20 min, not on the roadmap yet): `checks.sh` runs the quick checks first and stops on a
     failure, so a formatting slip fails in a minute rather than 12.
2. **After the redesign** (Kai queued them, and the wrap-up they waited for is done): `fix-tablet-header-overflow`
   (768-970 px with a scrollbar), `fix-board-touch-drag`, `fix-slash-behind-modal`,
   `fix-phone-quick-view-buttons-cut`, `fix-phone-new-application-route-wide`.
3. **Two small website bugs from #442's review, no go yet:** `fix-website-board-dates` and
   `fix-website-story-phone-crop`.
4. Also `next`: `e2e-seed-once` and P13's `generic-*`. #359 when its author updates it.

## State

- **Released up to v1.24.50.** The redesign is done: all 24 tasks, counting the five `loading-state-*` parts.
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
- **Dependabot alerts:** one open, build-time only, no patched version when evaluated (#33 `minimatch`; GitHub withdrew
  #39). Left open.

## Done since v1.24.44

| Version | PR | What |
|---|---|---|
| 1.24.45 | #427 | a bottom bar on phones, the More sheet, the phone header on one row |
| 1.24.46 | #436 | the dark-mode and contrast pass, focus rings |
| 1.24.47 | #437 | keeps loading and saving when the network drops |
| 1.24.48 | #438 | the README's screenshots, both languages |
| 1.24.49 | #439 | the demo GIFs, the social card and the icons |
| 1.24.50 | #442 | the website's captures and its hero demo |

Internal: #440 (website and icon changes skip the browser tests), #443 (the redesign wrapped up). Earlier work: `CHANGELOG.md` and `git log`.

**How work runs** (keep doing it this way unless Kai says otherwise):

- One PR at a time. A small change the lead builds itself; a big one gets a builder agent in its own worktree, briefed
  on focus, keyboard, breakpoints and widths (375 to 2,560 px, Firefox), running the affected specs, not the full
  checks. A builder measures in full once, then only what changed.
- An Opus reviewer for app changes and anything that guards the checks; Sonnet or Haiku for small and docs PRs; every
  fix commit re-reviewed. The review runs beside the checks, on a frozen copy of the build.
- The lead bumps, runs the cheap checks (format included) before the long run, runs the full checks once on the final
  commit (or `--no-e2e` where the skip list allows), reads their FAIL and `failed` lines, then merges and ships.
  Roadmap-only PRs: `uv run pytest -q tests/pm`.
- Images: options on a local compare page, Kai directs in rounds, DAST before each round, nothing committed until
  approved.

## Waiting on Kai (don't start)

- **Bugs to pick:** the roadmap's phase B, five of them queued above.
  - Found on 2026-11-22, no go yet: `fix-timeline-detail-raw-markdown`, `fix-custom-stage-colour-contrast`,
    `fix-search-snippet-table-pipes`, `fix-note-preview-drops-hyphens`, `fix-flaky-keyboard-add-agency-test`.
    `fix-today-waiting-actions-clipped` also clips under *Your move* at 360 px and narrower.
  - Raised earlier: `fix-round-waiting-after-heard-back` (the contradicting pills), `fix-e2e-only-exit-status`,
    `fix-board-drag-width-race`, `fix-back-link-full-width`, `fix-flaky-panel-keyboard-move-test`,
    `fix-insights-dialog-flake`, `fix-dev-proxy-other-port-writes`; and the older backlog.
- **Backlog raised lately:** `panel-add-todo`, `board-card-round-ui`, `retro-actions`, `why-you-ended-it`,
  `calendar-ui-improve`, `timeline-list-wide`, `insights-tables-sidescroll`; tasks `orphan-files-sweep`,
  `scripts-lf-endings`, `tz-spring-forward-test`, `e2e-rebalance-slow-files` and `pytest-parallel`.
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
  - whether to rename the demo agency "Blue Yonder Recruitment" (a real software company's name, shown beside
    "Ghosted" in screenshots; the DAST reviewer's borderline note, left as is).
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
