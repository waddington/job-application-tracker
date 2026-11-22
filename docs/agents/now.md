# Now: state and live plan

Snapshot 2026-11-22, as of #436 (v1.24.46), written in that PR. Refresh this
file before each compaction. Before trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and
`docs/ROADMAP.yaml`.

## Kai's current request

**"do phone-nav and dark for the redesign"** (2026-11-22): finish both, report, then wait (Kai's scope wins over the
delivery loop).

1. **`app-redesign-phone-nav`, #427:** released as v1.24.45.
2. **`app-redesign-dark`, #436:** v1.24.46. If it isn't merged and released yet, finish that first.
3. **Stop and report**, with the restart reminder. Nothing below starts without Kai's word.

## Next, when Kai gives the word

1. **`fix-offline-requests-paused`** (high, `next`, ready): when the network drops with the tab open, the app stops
   loading and saving, and a save can be lost on reload. `networkMode: "always"` for queries and mutations in `App.tsx`,
   proved by injection in both browsers. Kai queued it ahead of the images; I offered to move it before dark ("offline
   before dark"), no answer: **after dark unless Kai says so.** Until it ships, Kai reloads the tab after losing the network.
2. **The images:** `app-redesign-docs`, `-gif-card`, `-website-shots`, each shown to Kai before it's applied. The social
   card keeps the four No's, also says it works offline (only once the fix has shipped), and Kai sees every option as a
   rendered image before picking.
3. **`app-redesign-wrap-up`**: close #354.
4. **After the redesign** (Kai queued them; each depends on the wrap-up): `fix-tablet-header-overflow` (768-970 px with
   a scrollbar), `fix-board-touch-drag`, `fix-slash-behind-modal`, `fix-phone-quick-view-buttons-cut`,
   `fix-phone-new-application-route-wide`.
5. Also `next`: `e2e-seed-once` and P13's `generic-*`. #359 when its author updates it.

## State

- **Released up to v1.24.46** (with #436). The redesign has 20 of its 24 tasks done, counting the five
  `loading-state-*` parts.
- **Open PRs:**
  - **#414** DO NOT MERGE: board concepts for per-round columns beside the quick view (`?board=N`). Parked for Kai
    ("park it for now, ill review another time"); its servers (5190, 8886) are off, its worktree kept
    (`board-rounds-concepts`). The bug is `fix-board-round-columns-cramped`; `board-card-round-ui` goes with it.
  - **#354** DO NOT MERGE: the redesign concepts, the reference implementation (read its files in
    `.claude/worktrees/agent-a1abf04926d779406`) until the wrap-up. Its servers are off; don't restart them unless asked.
  - **#359** (`windows-support`): on hold until its author updates it. When they push: review it fully, carry it, walk
    its PowerShell steps on the VM. A minor bump.
  - **#365** (`windows-snapshots`): on hold (Kai).
- **Running:** the PM dashboard on 8767 (a background job of the session: restart it after a session restart, from the
  main checkout, `python3 -m tools.pm`); Kai's tracker on 8770 (Kai runs it, never stop it).
- **Dependabot alerts:** one open, build-time only, no patched version when evaluated (#33 `minimatch`; GitHub withdrew #39).
  Left open.

## Done since v1.24.36

| Version | PR | What |
|---|---|---|
| 1.24.37 | #408 | the quick view docks beside the page from 992 px, full screen below |
| 1.24.38 | #412 | Today in three columns, by the page's own width |
| 1.24.39 | #413 | the board fills the window (columns 180-360 px, still while dragging); the list on a card |
| 1.24.40 | #415 | the record layout on an application and a company |
| 1.24.41 | #421 | the record layout on a person, an agency and a role |
| 1.24.42 | #423 | Roles, Recruiters and Companies; `SideScroll` with the edge fade |
| 1.24.43 | #424 | Interviews, Offers and the Timeline |
| 1.24.44 | #425 | Notes, Documents, Insights (a checked palette) and Search |
| 1.24.45 | #427 | a bottom bar on phones, the More sheet, the phone header on one row |
| 1.24.46 | #436 | the dark-mode and contrast pass, focus rings |

Internal: #407, #426 (notes); #410 and #411 (retros in `docs/retros/`, with `retro-actions` to act on them); ideas and
bugs: #409, #416, #417, #419, #420, #422, #428 to #434. #418 was closed and redone as #419 (a name from a screenshot;
Kai: fine as it is, no purge).

**How work runs** (keep doing it this way unless Kai says otherwise):

- One builder agent per change in its own worktree, one PR at a time. The brief settles focus, keyboard, breakpoints and
  widths up front, asks for 375 to 2,560 px and Firefox, and has the builder run the affected specs, not the full checks.
- An Opus reviewer who looks at the demo; Sonnet or Haiku for small and roadmap PRs; every fix commit re-reviewed.
- The lead bumps, runs the full checks once on the final commit, reads their FAIL and `failed` lines, then merges and
  ships. Roadmap-only PRs: `uv run pytest -q tests/pm`.
- A builder measures in full once; after its fixes it re-measures only what changed. The review can run beside the
  full checks, on a frozen copy of the build (#436 took too long sweeping twice; Kai: "hurry this one up").

## Waiting on Kai (don't start)

- **Bugs to pick:** 71 open at the snapshot (1 high, 16 medium, 54 low), six of them queued above. Raised lately, no go
  yet: `fix-round-waiting-after-heard-back` (the contradicting pills), `fix-e2e-only-exit-status` (maintainer tooling;
  it let a failed run look like a pass), `fix-board-drag-width-race`, `fix-back-link-full-width`,
  `fix-flaky-panel-keyboard-move-test`, `fix-insights-dialog-flake`, `fix-dev-proxy-other-port-writes`; and the older
  backlog.
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
  - whether CLAUDE.md's "fill in data when Kai asks" should point at the live-data rule.
- **Restore `worktree-pr-screenshots`?** (from #291's head `a283908`).
- **Repo gaps offered for contributors, no answer:** CONTRIBUTING asks contributors to update `CHANGELOG.md` though Kai
  asked them to leave it; PRs get no automatic checks.
- **Left alone:** `notes-documents-improve`, `timeline-improve` and `people-you-meet` (Kai, 2026-11-02); the Claude Code
  permission-rule warnings for `git -C *` in the user settings (Kai asked to ignore them, 2026-11-17).

## Noticed, not promised

- `docs-contributor-prs` is still `building` on the roadmap with no branch: check whether it's done.
- The website's hero demo shows an old app version; `app-redesign-website-shots` retakes it.
- The quick view's summary grows 28 px when a later request answers (CLS 0.031, seen in #401).
- A CNY role's pay reads "2800 CNY/天": `formatMoney` has symbols only for GBP, USD and EUR (now `generic-money`).
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- A failed startup write of `.gitattributes` is silent (no log); snapshots report it where they run.
