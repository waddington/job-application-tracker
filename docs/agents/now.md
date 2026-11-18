# Now: state and live plan

Snapshot 2026-11-18, after #406 (main at `83c74041`, v1.24.36). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.24.36**. Branches on GitHub: `main`, `worktree-app-redesign-concepts` (draft #354, not for
  merging), the contributor's forks for #359 and #365, and this refresh until it merges.
- **The redesign:** parts 1-4b are done (the theme, the frame, cards and lists, forms), and the loading-state chain
  it needed (parts 2-6) is too. **Paused:** Kai picks each next task. The next in order is `app-redesign-dock` (part
  5); the rest is under *Next*.
- **Open PRs:**
  - **#354** DO NOT MERGE: the redesign concepts (concept 11 picked). The reference implementation (read its files in
    `.claude/worktrees/agent-a1abf04926d779406`); stays open until `app-redesign-wrap-up`. Its demo servers (5183,
    8893) are off at Kai's request; don't restart them unless Kai asks.
  - **#359** (`windows-support`, the milestone): on hold until its author merges main and updates it (comment posted at
    Kai's request). When they push: review it fully, carry it, walk its PowerShell steps on the VM. A minor bump.
  - **#365** (`windows-snapshots`): on hold (Kai).
- **Dependabot alerts:** 2 open, both build-time only, with no patched version yet: #39 `picomatch` (high, ReDoS, the
  website's and frontend's Astro/Vite/Vitest tooling) and #33 `minimatch` (medium). Evaluated for Kai 2026-11-17:
  neither is reachable when the app runs (the app ships no Node; the globs come from our own config). Left open so the
  fix arrives as a Dependabot PR; Kai hasn't asked to dismiss them.
- **Running:** the PM dashboard on 8767 (restarted 2026-11-18 after a session restart). Kai's tracker on 8770 was down
  after that restart; Kai runs it (`uv run jat serve` in the main checkout).
- The user-level after-compaction hook is still **not** in `~/.claude/settings.json` (JSON under *Waiting on Kai*).

## Done since v1.24.28 (main `ce51a7e`)

| Version | PR | What |
|---|---|---|
| 1.24.29 | #387 | `loading-state-failed-loads`: Timeline and Weekly activity show a skeleton, and "Couldn't load this." with Retry |
| 1.24.30 | #395 | `loading-state-silent-cards`: To-dos, rounds, Files and Links get skeletons and Retry; Add round waits for the rounds. Also the live-data rule in working-with-kai.md |
| 1.24.31 | #396 | `loading-state-page-skeletons`: ten list pages show a skeleton, not a spinner (CLS on Documents 0.102 → 0, Insights 0.139 → 0.005); split, with the record pages as their own task |
| 1.24.32 | #399 | `loading-state-page-skeletons-records`: the five record pages; a failed record keeps its back link |
| 1.24.33 | #401 | `loading-state-card-spinners`: Insights' cards, the quick view, Offers and Notes cards, NoteBody, WhereUsed (Insights' Conversations tab CLS 0.255 → 0) |
| 1.24.34 | #402 | `app-redesign-components` (part 4): roomy cards, `variant="well"` for cards holding cards, pill stage badges, segmented pastel bars, Today's dark tiles (hover contrast ≥ 4.8) |
| 1.24.35 | #405 | `fix-calendar-day-number-apart`: the calendar's day numbers sit above their dots on a wide screen (a regression from #384's full width). Kai checked it on a demo first |
| 1.24.36 | #403 | `app-redesign-forms` (part 4b): dialogs, input outlines ≥ 3.36:1, red delete actions, table rows, hints under one-line boxes (fixes `fix-new-application-fields-misaligned`), dropdowns open below a hint (`clearHint` in theme.ts), the offer dialog's dates two a row |

Internal (roadmap only, no release): #383 and #385 (notes), and the ideas and bugs below: #386, #388, #389, #390, #391,
#392, #393, #394, #397, #398, #400, #406. #404 was closed, folded into #405.

## Kai's asks this round (2026-11-15 to 2026-11-18)

1. The redesign, one task at a time on Kai's word, each paused after (this session only, not a standing rule: "that
   note about one task at a time is just for this session so dont put that in a note"). Done this round: the
   loading-state parts 2-6, `app-redesign-components` and `app-redesign-forms` ("do app-redesign-components then
   app-redesign-forms"), with the record pages split out ("definitely split it") and part 6 added so the redesign
   picks it up ("ensure it gets picked up in the redesign initiative").
2. "i dont want you editing any live data …" → working-with-kai.md (#395). CLAUDE.md still says Claude may fill in data
   when Kai asks; I offered to point that line at the rule, no answer yet.
3. New ideas, all `planned` in P7: `insights-timing-patterns`, `cv-link-finder` (with Kai's follow-up on links, files
   the card misses and no CV), `interview-type-tidy`, `linkedin-messages-import` (batches optional; agents change data
   only through an MCP-style layer), `recruiter-first-message-date`, `search-waves`, `added-toast-link`,
   `recruiters-sort`, `person-cv-sent`, `reapply`, `reply-buttons-clearer`, `settings-page`, `update-check` (decided:
   an opt-in `config.toml` setting, off by default, later in the Settings page; decisions.md),
   `general-tracker-discovery` and `calendar-ui-improve`. A PWA was discussed and dropped ("forget it").
4. Bugs Kai found: the New application boxes misaligned → "fold that bug into the app-redesign-forms task" (fixed in
   #403); the calendar's day numbers → "have an agent work on this UI bug now", "dont merge the calendar fix until i
   review a locally running dev version", then "the ui fix is good enough for now … you can merge and release
   yourself" (#405).
5. Questions answered, nothing built: Heard back vs They've replied (→ `reply-buttons-clearer`); deleting an Interested
   application sends its role back to To decide; SPA vs PWA (it's already a SPA); the security alerts.
6. "evaluate the new security vulnerability reported on github" → answered (see *State*).

## Next

- **The redesign, on Kai's word, one task at a time:** `app-redesign-dock` (part 5, one larger PR: the side panel on
  Applications, Today, a company and an agency), then `app-redesign-today`, `-applications`, `-records`,
  `-records-people`, `-people`, `-schedule`, `-rest`, `-phone-nav`, `-dark`, then the images (`-docs`, `-gif-card`,
  `-website-shots`, each shown to Kai before it's applied) and `-wrap-up`. Kai doesn't approve the redesign PRs'
  screenshots (working-with-kai.md): a demo server for the reviewer, then merge and release after the cycle.
- `e2e-seed-once` (next).
- #359 when its author updates it.
- **Bugs:** 61 open (11 medium, 50 low). Recorded this round: `fix-tablet-header-overflow`, `fix-guide-role-actions`,
  `fix-role-form-label-wrap`, `fix-contact-detail-row-phone`, and `fix-person-new-org-race` (a recurrence of
  `fix-person-saved-before-new-company`, with its likely cause). Fixing waits for Kai. `fix-double-save-locked` still
  needs a decision.

**How work runs** (keep doing it this way unless Kai says otherwise): one builder agent per change in its own worktree,
Opus reviewers for data safety or structure, Sonnet or Haiku for small and docs PRs, every fix commit re-reviewed; the
lead bumps, merges and ships. Roadmap-only PRs: `uv run pytest -q tests/pm`.

## Waiting on Kai (don't start)

- **The go for the next redesign task** (`app-redesign-dock`).
- **Start the tracker** if it's still down after the session restart.
- **Bugs to pick:** the five above and the older backlog (`fix-merge-people-notes-half-relinked`,
  `fix-note-held-open-not-found`, `fix-pnpm-version-mismatch-install`, …); tasks `orphan-files-sweep`,
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
  - whether to dismiss the two build-time Dependabot alerts;
  - whether CLAUDE.md's "fill in data when Kai asks" should point at the live-data rule.
- **Restore `worktree-pr-screenshots`?** (from #291's head `a283908`).
- **Repo gaps offered for contributors, no answer:** CONTRIBUTING asks contributors to update `CHANGELOG.md` though Kai
  asked them to leave it; PRs get no automatic checks.
- **Left alone:** `notes-documents-improve`, `timeline-improve` and `people-you-meet` (Kai, 2026-11-02); the Claude Code
  permission-rule warnings for `git -C *` in the user settings (Kai asked to ignore them, 2026-11-17).

## Noticed, not promised

- `docs-contributor-prs` is still `building` on the roadmap with no branch: check whether it's done.
- The website's hero demo shows an old app version; `app-redesign-website-shots` retakes it.
- The quick view's summary grows 28 px when a later request answers (CLS 0.031, seen in #401); worth a look in the
  redesign's dock part.
- A CNY role's pay reads "2800 CNY/天": `formatMoney` has symbols only for GBP, USD and EUR (now `generic-money`).
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- A failed startup write of `.gitattributes` is silent (no log); snapshots report it where they run.
