# Delivery speed: where a parallel batch spent its time

**Status:** investigation only. Nothing here has changed how work is done. Each idea below needs
Kai's go-ahead before it's used.

Kai, 2026-10-31: "its been hours, do some reflection and tell me which parts of the sdlc is taking
the longest", then "create another PR with a doc about these findings and some possible ideas to use
going forward to speed this process up. dont actual change behaviour yet this is just investigation
for niow".

## What was measured

The batch was P8's items 11, 12 and 13, split into nine PRs, with up to three builder agents at once
(`docs/rfc/i18n.md`). This covers the roadmap split #166 and the eight PRs #167 to #174, up to about
22:40 UTC, when #167 to #172 and #174 had merged (v1.2.30 to v1.2.36) and #173 was on its final checks.
The ninth, `i18n-events-activity`, hadn't started.

**How good the numbers are:**

- **Solid:** when each PR was created, marked ready and merged (GitHub), and how long each check run
  took (the check script's output).
- **Approximate:** agent run times, from the harness's task notifications. They weren't consistent when
  an agent was resumed, so some fix-round times could be off by several minutes. Treat them as sizes,
  not measurements.
- **Unknown:** how a builder's time split between reading, coding and testing. Nothing recorded it.
  The findings about repeated testing come from what builders reported running, not from timings.

## Findings

### Time per stage

Added up across the eight PRs. These total more than the elapsed time because the work overlapped.

| Stage | Time | Share | Per PR |
|---|---|---|---|
| Building, first pass | ~185 min | ~52% | 18–33 min |
| Fix rounds | ~80 min | ~22% | 2–32 min |
| Final checks | ~50 min | ~14% | 7–8 min, one at a time |
| Review | ~31 min | ~9% | 1–6 min, 9 reviews |
| Merge and release | ~10 min | ~3% | 1–2 min |

Elapsed time was 2h25 from the start of #166, with 7 PRs released: about 21 minutes each.

### Draft to merge

| PR | Task | Draft created | Ready | Merged | Draft to merge |
|---|---|---|---|---|---|
| #167 | `i18n-timeline-page` | 20:19 | 20:37 | 20:44 | 26 min |
| #168 | `i18n-events-setup` | 20:20 | 20:47 | 20:56 | 36 min |
| #169 | `i18n-errors-setup` | 20:30 | 21:03 | 21:11 | 41 min |
| #170 | `i18n-timeline-titles` | 20:47 | 21:14 | 21:20 | 33 min |
| #171 | `i18n-events-rounds-offers` | 21:11 | 21:21 | 21:29 | 18 min |
| #172 | `i18n-errors-applications` | 21:14 | 21:51 | 22:07 | 53 min |
| #174 | `i18n-errors-files` | 21:31 | 22:22 | 22:39 | 67 min |
| #173 | `i18n-timeline-records` | 21:24 | 22:39 | not yet | over 75 min |

The draft time slightly understates #171, which opened late in its build. Ready to merge was 7 to 16 minutes, so most
of the time came before that.

### What's avoidable

1. **The same tests run repeatedly.** Builders ran browser tests and the text comparison, ran them
   again after fixes, and then the final check ran everything. Only the final run decides a merge.
   #169's builder ran 503 browser tests when the whole suite is 648, and later 506. This comes from
   the builder brief, which asks for those checks before reporting. Without timings its size is an
   estimate, but it's probably the largest single waste.
2. **Slow checks ran before review.** `docs/COMPACTION.md` says to review before the slow checks in
   its i18n loop, though its older cutover steps put the text comparison first. The brief had builders
   do the slow checks first, so every review finding meant repeating them.
3. **Fix rounds can cost far more than the fixes.** #173's round took about 32 minutes for a rename, one
   test case and a PR description. It also merged main twice as other PRs landed, and retested, which
   looks like the bulk of it, though nothing timed the parts. Nits also got a full round, and a resumed
   builder repeats its checks.
4. **Overlapping PRs waited on each other.** #172 and #174 changed the same error-code map and test,
   and #174's fixes had to wait for #172 to merge. They took 53 and 67 minutes, the longest of those
   merged, but with no comparison it isn't known how much the overlap itself cost.
5. **Merges are one at a time, about 8 minutes each.** Each needs its own version and a full check run
   on that exact commit, so the ceiling is about 7 merges an hour. The batch didn't reach it: 7 merges
   took 115 minutes, about half that rate, with 32 to 38 minutes between some of them. So the queue was
   often not what PRs were waiting for, and this batch doesn't show that a third builder was wasted.
6. **Parallel work may slow each run.** The browser suite took 4.2 minutes before the batch and up to 6.0
   during it. Load is a likely part of that, as the test count barely changed (645 to 648), but it
   wasn't tested.
7. **Merge conflicts sit in a few files.** Merge conflicts landed mostly in `docs/rfc/i18n.md`,
   `CONTRIBUTING.md`, `docs/ROADMAP.yaml`, `frontend/openapi.json` and `frontend/src/api/schema.d.ts`,
   usually as entries added on both sides, or generated files. #174's merge with #172 was the exception,
   with real overlap in source: `api/errors.py`, `errors.ts`, `test_error_codes.py` and `ErrorsText.test.tsx`.

### What wasn't a problem

- **Review was cheap and useful.** At 9% of the time, it found a "never seen" error that a person can
  reach, a real bug in how a missing file is shown, and a test scan that would have silently skipped new
  errors. Cutting it would save little.
- **The parallel start worked.** Builders could run in their own worktrees. No check failed on a
  final commit, so no PR needed a late rework.
- **One false alarm cost time.** A text comparison on #173 showed a difference because another PR's
  reviewer was posting test data to a server on the same port.

## Ideas

Rough savings are judgement, not measurement. "Rule change" means it alters something in `CLAUDE.md`,
so it's Kai's decision in particular.

| # | Idea | Likely effect | Cost or risk |
|---|---|---|---|
| 1 | Builders run only unit tests and their own area's specs, once. Full browser suite and comparison only in the final check | High | A failure elsewhere is found later, and a late failure costs one more 8-minute run |
| 2 | Review before any slow check | Medium | None known; it's already the written rule |
| 3 | Fix review findings in one batch without rerunning browser tests before the final check. **Rule change** if nits may also be logged or dropped, as `CLAUDE.md` says to fix the findings | Medium | A judgement call each time; fewer nits fixed if dropping is allowed |
| 4 | Merge main only once, right before the final check | Medium | A conflict is found later; a long-running branch is further behind |
| 5 | Plan waves by which files PRs touch, keeping overlapping PRs in different waves | Medium | Needs a look at the code first, which planning did anyway |
| 6 | Try two builders against three on similar work and compare | Unknown: the queue wasn't full here, so three may be right | Takes a batch to find out; two may simply be slower |
| 7 | Group changes to shared docs: builders report their RFC and CONTRIBUTING text, and it's added just before review, as the version and changelog are added just before the final check | Low to medium | Docs arrive later in the PR; the reviewer sees them last |
| 8 | Regenerate `openapi.json` and `schema.d.ts` on conflict automatically, e.g. a git merge driver or a script step | Low | A small tool to keep working |
| 9 | Give each agent its own port range, and have reviewers start their own servers | Low | Prevents false alarms only |
| 10 | Record a timestamp at each stage | None directly | Replaces this doc's estimates with real numbers, so do it first if any of this goes ahead |
| 11 | Speed up the browser suite itself: profile it, and check worker count | Unknown, needs its own look | Could expose tests that depend on order or timing |
| 12 | **Rule change:** check a group of ready PRs together, then merge and release them in order | High when PRs queue | Breaks "checks on the exact commit being merged"; a failure needs bisecting; version numbers need care |
| 13 | **Rule change:** skip a rerun when only the changelog or a doc changed since a passing run | Low to medium | Same rule; needs a reliable way to prove what changed |
| 14 | **Rule change:** allow a bigger PR where a split forces extra waits | Unknown | Goes against "I want smaller PRs", and reviews get weaker |

**What I'd try first:** 10, then 1, 2, 3 (fixing every finding, in one batch) and 4 together, on a small
batch. Done that way they change only how the builder brief and the merge loop work, not `CLAUDE.md`, and
are easy to undo. Then compare against the table above. The rule changes only make sense if that isn't enough.

## Not looked at

- What filled the gaps of 32 to 38 minutes between some merges (see 5). Stage timestamps (idea 10) would show it.
- How much of each builder's time is spent reading context. Builders used about 140,000 to 220,000 tokens
  each, so a shorter brief might help, but nothing here measures that.
- Whether a builder per PR beats the lead building some itself.
- Token cost overall. Fan-out spends more for the same work; this doc only looks at time.
