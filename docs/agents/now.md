# Now: state and live plan

Snapshot 2026-11-15, after #382 (main at `9762beb`, v1.24.27). Refresh this file before each compaction. Before
trusting it, check `gh pr list`, `git worktree list`, `git log --oneline -5` and `docs/ROADMAP.yaml`.

## State

- Released up to **v1.24.27**. Branches on GitHub: `main`, `worktree-app-redesign-concepts` (draft #354, not for
  merging), the contributor's forks for #359 and #365, and this refresh until it merges.
- **The redesign build is paused by Kai** after the theme (#382; the roadmap's part 2, the RFC's row 1). Kai: "pause after this PR is done, ill
  continue it another time". Resume only on Kai's word; the agreed scope for then is under *Next*.
- **Open PRs:**
  - **#354** DO NOT MERGE: the redesign concepts, round 3, with concept 11 picked. It's the reference implementation
    (read its files) and stays open until `app-redesign-wrap-up`; worktree `.claude/worktrees/agent-a1abf04926d779406`
    (locked). Its demo servers (5183, 8893) are shut down at Kai's request: "you can shutdown the current redesign
    demo that showed the different options". Don't restart them unless Kai asks.
  - **#359** (`windows-support`, the milestone): on hold. A comment was posted at Kai's request asking the author to
    merge main and update it (conflicts; snapshots off on Windows; no `&&` in PowerShell 5.1; `llms.txt`). When they
    push: review it fully, carry it, walk its PowerShell steps on the VM. A minor bump (a new supported platform).
  - **#365** (`windows-snapshots`): on hold (Kai).
- **Dependabot alerts:** 1 open (`minimatch`). The astro alerts closed after #356.
- Kai's tracker on 8770 has run since before v1.24.22 and needs a restart (Python changed); the main checkout's
  frontend is rebuilt.
- The user-level after-compaction hook is still **not** in `~/.claude/settings.json` (JSON under *Waiting on Kai*).

## Done since v1.24.17 (main `9f3dcb9`)

| Version | PR | What |
|---|---|---|
| 1.24.18 | #368 | Carrying #362: scripts read and write UTF-8 |
| 1.24.19 | #370 | Carrying #363: the encoding check's edge cases |
| 1.24.20 | #371 | Carrying #360: the `tzdata_only` fixture |
| 1.24.21 | #373 | Dev-tooling tests skip on Windows (`windows-dev-tooling` is separate backlog) |
| 1.24.22 | #374 | Carrying #361: a typed `/health` |
| 1.24.23 | #375 | Carrying #358: the Windows test-run checklist, symlink skips |
| 1.24.24 | #376 | Carrying #357: locked-file retry (6 attempts, 50/100/200/400/800 ms, winerror 5/32/33 on Windows only, a coded `file_locked` 409 with no path, logging, restore rollback) |
| 1.24.25 | #378 | Carrying #364: the Windows suite has 0 failures (1170 passed, 319 skipped on the VM) |
| 1.24.26 | #356 | Dependabot's Astro 7.4.7, done on its own branch; the repo's Node moved to 22.23.5 (Astro 7.4.2+ needs ≥ 22.23.4). #379 opened, then closed for it |
| 1.24.27 | #382 | The redesign's theme (roadmap part 2) (plum, pastel stages, Inter and JetBrains Mono, soft cards, pill buttons, plum-tinted dark mode). Kai saw the demo and said \"looks good ship it\" |

Internal: #369 (`checks.sh --no-e2e` accepts a version-only bump, via the new `tools/dev/scope.sh`), #372
(`fix-scope-tests-windows` recorded; contributor rules), #377 (`fix-pnpm-version-mismatch-install` recorded), #380
(the redesign plan `docs/rfc/app-redesign.md` and P12's tasks, the pick of 11, the Dependabot and approved-comment
rules), this refresh.

## Kai's asks this round (2026-11-15)

1. Review the contributor PRs in the planned order (#362, #363, #360, then #358, #361, #357, then #364, #359) with
   Kai's sorting rules → all carried and released except #359 (on hold) and #365 (on hold).
2. "use agents so as to not consume your own context window" → builders and reviewers as subagents.
3. "thank you notes are fine, i dont need to see them, keep them brief".
4. Don't run the VM and the browser tests at the same time (gotchas.md *Windows VM*).
5. Speed up the browser tests: option 1 → #369; 2 and 3 → roadmap; 4 → `e2e-seed-once` (next).
6. Restrict the dev-only tooling tests on Windows → #373; "the new roadmap item is not part of the current windows
   support plan" (`windows-dev-tooling`, backlog).
7. "those 357 suggestions are fine" → #376 with those numbers.
8. "hold for 359", then "you can post that comment" → posted on #359.
9. "look at pr 356 … review and fix and merge/release" → #356; "for dependabot PRs you dont need to carry them" → done
   on its branch; #379 closed.
10. Redesign rounds 2 and 3 → "i like 11" → "go for 11, plan it out, create the roadmap items. we'll also need to
    regenerate screenshots…" → #380 → "before starting the build we will do a compact … you will finish the plan, i
    will compact, then i will tell you to build" → #381.
11. "build, sequentially" → #382. "only do up to and including redesign 4*, dont start 5", then "continue up to and
    include 4*, and also do the things those require, but dont start 5 and its requirements", "yes include skeletons"
    (see *Next*). "you can shutdown the current redesign demo" → done. Then "pause after this PR is done, ill continue
    it another time. but we will see this 1 in-progress PR through" → #382 merged, the build paused, this refresh.

## Next

- **The redesign build, paused; resume on Kai's word only.** The scope Kai set, one PR at a time, then stop:
  1. `app-redesign-shell`;
  2. `loading-state-failed-loads`;
  3. `loading-state-silent-cards`;
  4. `loading-state-page-skeletons`;
  5. `app-redesign-components`, which depends on the loading-state chain;
  6. `app-redesign-forms`. Its roadmap task now lists what #382's review left for it.
  Don't start `app-redesign-dock` (part 5) or anything only it needs. Each redesign PR, `loading-state-silent-cards` and
  `loading-state-page-skeletons` are shown to Kai on a demo URL with before-and-after screenshots, and merge only on
  Kai's OK. `loading-state-failed-loads` isn't shown first: it merges after the usual review cycle. New images go to Kai before they're applied.
- `e2e-seed-once` (next).
- #359 when its author updates it.
- **Bugs:** 58 open (9 medium, 49 low); `fix-double-save-locked` still needs a decision.

**How work runs** (keep doing it this way unless Kai says otherwise): one builder agent per change in its own worktree,
Opus reviewers for data safety or structure, Sonnet or Haiku for small and docs PRs, every fix commit re-reviewed; the
lead bumps, merges and ships. Roadmap-only PRs: `uv run pytest -q tests/pm`.

## Waiting on Kai (don't start)

- **The go to resume the redesign build** (paused after #382).
- **Restart the tracker** (running since before v1.24.22).
- **New backlog bugs and tasks:** `fix-merge-people-notes-half-relinked`, `fix-note-held-open-not-found`,
  `fix-pnpm-version-mismatch-install`, `orphan-files-sweep`, `scripts-lf-endings`, `tz-spring-forward-test`;
  `e2e-rebalance-slow-files`, `pytest-parallel`.
- **The user-level hook:** add to `~/.claude/settings.json` next to `"env"` (the auto-mode check refuses this edit):
  ```json
  "hooks": { "SessionStart": [ { "matcher": "compact", "hooks": [ { "type": "command",
    "command": "/home/kai/Documents/Projects/job-application-tracker/tools/dev/after_compact.sh --user", "timeout": 30 } ] } ] },
  ```
- **Decisions:** `fix-double-save-locked`; `i18n-zh-cn-offer-word`, `i18n-zh-cn-brand-name`; MCP §14; `hosted-mcp`'s
  open questions; the GitHub repo description (for-any-job and "simple" wording) when those tasks run.
- **Restore `worktree-pr-screenshots`?** (from #291's head `a283908`); useful for the redesign's PRs.
- **Repo gaps offered for contributors, no answer:** CONTRIBUTING asks contributors to update `CHANGELOG.md` though Kai
  asked them to leave it; PRs get no automatic checks.
- **Left alone** (Kai, 2026-11-02): `notes-documents-improve`, `timeline-improve`, `people-you-meet`.

## Noticed, not promised

- `docs-contributor-prs` is still `building` on the roadmap with no branch: check whether it's done.
- The website's hero demo shows an old app version; `app-redesign-website-shots` retakes it.
- A CNY role's pay reads "2800 CNY/天": `formatMoney` has symbols only for GBP, USD and EUR (now `generic-money`).
- Ghost and star marks are missing in the Timeline *About* select and to-do "about" text.
- `tools/pm/yamlish.py` and `scripts/i18n/translate/pages.json` aren't formatter-clean (neither is in the checks).
- A failed startup write of `.gitattributes` is silent (no log); snapshots report it where they run.
