# Why the docked panel PR (#408) took so long

**Date:** 2026-11-18. **PR:** #408, roadmap task `app-redesign-dock` (the application panel docks beside the page).
**Sources:** the lead session's transcript and the builder's and reviewers' transcripts (timestamps below are theirs,
UTC), `git log` of `worktree-app-redesign-dock`, `gh pr view 408`, `docs/rfc/app-redesign.md` §2, §7 and §8.

From the request to build it (09:36:37) to the start of the last full checks run (11:16:55) took **100 minutes**. The
merge followed that run at 11:28:46, so the request-to-merge time was **112 minutes**. A clean
run of the same process (build, one review, one short fix round, one full checks run) would take about
**50 minutes**.

## Timeline

| # | Step | Start | End | Duration | Who |
|---|------|-------|-----|----------|-----|
| 1 | Read notes and task, write the brief, create the worktree | 09:36:37 | 09:37:08 | 0.5 min | Lead |
| 2 | Build: component, four pages, 11 new browser tests, guide, zh-CN (about 14 min of it single-spec runs) | 09:37:08 | 10:00:25 | 23 min | Builder (Opus) |
| 3 | Builder's full checks run (passed: pytest 1,489, e2e 773) | 10:00:25 | 10:11:20 | 11 min | Builder |
| 4 | Review 1: no code `must_fix`, 4 `should_fix` | 10:11:58 | 10:16:53 | 5 min | Reviewer (Opus) |
| 5 | Fix round 1 (about 10 min of it spec runs and focus debugging) | 10:17:08 | 10:36:06 | 19 min | Builder |
| 6 | Review 2: 1 `must_fix` caused by fix round 1, plus 1 `should_fix` | 10:36:18 | 10:42:12 | 6 min | Reviewer (Opus) |
| 7 | Fix round 2 (about 6 min of spec runs) | 10:42:23 | 10:53:29 | 11 min | Builder |
| 8 | Review 3: Firefox-only `should_fix` (round 1's Escape fix doesn't hold there) | 10:53:36 | 10:56:11 | 2.5 min | Reviewer (Opus) |
| 9 | Firefox fix (a `returnFocus` attempt failed, then a keydown fallback) | 10:56:14 | 11:00:12 | 4 min | Lead |
| 10 | Review 4 of the Firefox fix: 2 `should_fix` | 11:00:33 | 11:01:35 | 1 min | Reviewer (Sonnet) |
| 11 | Fix round 4 (Sonnet's two items), then re-review (clean) | 11:01:37 | 11:03:09 | 1.5 min | Lead, Sonnet |
| 12 | Version bump to 1.24.37 | 11:02:49 | 11:02:55 | 0.1 min | Lead |
| 13 | Full checks: **failed**, 1 of 779 browser tests (`docked-panel.spec.ts:161`) | 11:03:01 | 11:13:23 | 10.4 min | Lead |
| 14 | Fix round 5: the regression the Firefox fix caused, then re-review (clean) | 11:13:27 | 11:17:15 | 4 min | Lead, Sonnet |
| 15 | Full checks again, then merge and release | 11:16:55 | 11:28:46 | 12 min | Lead |

**Correction to the expected outline:** the lead didn't stop the builder's full checks run part-way. The first run
(step 3) finished and passed. At 10:23 the lead told the builder not to start a *second* full run after fix round 1,
before that run had begun. That instruction saved about 11 minutes.

## Where the time went

| Bucket | Minutes | Share |
|---|---|---|
| First build | 23 | 21% |
| Full checks runs (3) | ~33 | 29% |
| Rework (5 fix rounds) | ~39 | 35% |
| Waiting on reviews (6 passes) | ~16 | 14% |
| Lead overhead (brief, bump) | ~1 | 1% |

About half the builder's active time (27 of about 53 minutes) went on single-spec browser runs, at 1-3 minutes each.
Every fix round pays for them again.

## What caused the rework

**1. One behaviour nobody specified caused fix rounds 2-5 and part of round 1.** RFC §8 says "Escape closes it from
inside" and "closing returns [focus] to the row or card that opened it". It doesn't say what happens when the
focused element inside the panel *disappears*. Picking a stage from the panel's "Move to…" menu unmounts the menu item, and
on the board it remounts the opener card in another column. Focus then falls to `<body>`, which is neither inside nor
outside the panel. It took four approaches:

- Round 1: a document-level Escape listener that used `checkVisibility()`. Review 2 found it also closed the panel
  when Escape was meant for a modal opened from it (Mantine's Modal closes first, so its textarea already looks
  hidden). That `must_fix` was **caused by the fix**.
- Round 2: a `focusout` listener, which the reviewer had suggested. Review 3 found that Firefox fires no `focusout`
  when the focused element is removed, so the round-1 bug was still there in Firefox. The browser tests run Chromium
  only.
- Rounds 3 and 4 (lead): a keydown fallback for focus on `<body>`. The Sonnet review found two holes (stale ownership
  after a click on the page, and any key pulling focus back), fixed in round 4.
- Round 5 (lead): the full checks showed that the fallback brought back round 2's `must_fix`, the panel closing on
  Escape in the feedback dialog. The browser test that caught it (`docked-panel.spec.ts:161`) was the one added in round 2 for
  that very bug.

Cost of the focus problem from review 2 on: about 11 + 6 + 2.5 + 4 + 1 + 1.5 + 10.4 + 4 = **40 minutes**, plus its
share of round 1.

**2. Spec gaps the RFC could have settled up front.** Review 1's four items were all missing behaviour, not mistakes
in the code:

- *Tablet width.* The RFC switches to the overlay only below 768 px. At 768 px, a 230 px menu and a 356 px panel left
  the page **102 px** wide. The fix moved the breakpoint to 992 px, which the lead had to assume, since the RFC was
  silent.
- *State across the breakpoint.* Switching between the docked panel and the overlay remounted the contents, so a
  half-typed note was lost.
- *Opener gone.* The RFC says focus returns to the opener, but not what happens when the opener has been unmounted.
- *Escape after a keyboard move* (point 1 above).

A ten-minute checklist before the build would have raised all four.

**3. Reviews found one layer at a time.** Each review checked the latest commits in Chrome. Firefox only came into it
in review 3. The reviewer had suggested the Chrome-only `focusout` approach in review 2, without checking it in a
second browser. Reviewers were also told to run "at most one spec", and the Sonnet reviewer ran none. So the two
Sonnet reviews that passed the Firefox fix couldn't have caught the regression that the full run found 10 minutes later.

**4. Duplicated or wasted test runs.**

- The builder's full run (11 min) proved a commit that ten more commits changed before the merge. The rules require
  a full run on the commit that merges, so this run gated nothing.
- After the real Firefox fix, the lead ran typecheck, lint, the unit tests and a Firefox probe, but not
  `docked-panel.spec.ts`. That spec had been run at 10:56:31 on the abandoned `returnFocus` attempt, not on the code
  that was committed. A 40-second spec run would have saved a 10-minute failed run and its fix.

## Avoidable vs inherent

| | Minutes |
|---|---|
| **Inherent:** the build, one review, one fix round for real findings, one full checks run on the merge commit | ~50-55 |
| **Clearly avoidable:** the builder's full run (11), the failed full run plus its fix (14) | ~25 |
| **Likely avoidable** with a settled spec and a review in both browsers: most of rounds 2-4 and their reviews | ~25-30 |
| Debugging Mantine's focus behaviour, needed whichever way it was fixed | ~5-10 |

Size wasn't the main cause, so smaller PRs aren't the lever here. The PR was +968 / -23 lines over 27 files (about
450 of them tests), but the rework all went into `DockedPanel.tsx`. A split would have added a second
checks-and-release cycle (about 12 minutes) without avoiding the focus rounds.

## Recommendations, ranked by time saved against risk

1. **Run the affected specs before any commit goes to re-review or a full checks run, including the lead's own
   fixes.** Use `tools/dev/e2e_spec.sh` on the specs the change touches, and always on the spec of the
   component being fixed. *Saves about 14 min here; no risk; costs 1-2 min.* Record it in `docs/agents/gotchas.md`.
2. **The builder doesn't run the full `checks.sh`** when the lead will run it after the bump. The builder runs
   typecheck, lint, format, the unit tests and the affected specs. *Saves about 11 min on every PR; low risk, since the
   lead's full run still gates the merge.* Change the brief template (process step 5) to match.
3. **Settle focus and keyboard behaviour before the build** for any interactive component. Put a short checklist in the
   RFC or brief:
   - where focus goes when the opener unmounts;
   - where focus goes when the focused element inside is removed (a menu pick);
   - who handles Escape when a modal, menu or drag sits on top;
   - every width between the breakpoints (menu + panel + page);
   - whether state survives a breakpoint or resize;
   - behaviour in Firefox.

   *Saves a review round, about 20-25 min here; low risk; costs about 10 min of the lead's time.*
4. **Reviewers of focus or keyboard work check it in Chromium and Firefox**, using Playwright's Firefox, which is
   already cached; review 3 used it. They also check any fix they suggest in both browsers, and run the PR's new or
   changed specs (one or two at a time, within the CPU limits). *Saves about 10-20 min; little risk, adding 2-3 min per
   review.*
5. **Start review 1 as soon as the code is pushed**, alongside any checks run, rather than after it. *About 5 min;
   no risk.* The lead already did this for the last two reviews.
6. **Think about running `docked-panel.spec.ts` in Firefox too**: a second Playwright project for the
   focus-sensitive specs only. *It would have caught round 3 without a reviewer; it adds run time and possible flakes,
   and touching the test config needs Kai's go-ahead.*
Together, 1-5 would most likely have brought #408 down from about 112 minutes to about 60-65.
