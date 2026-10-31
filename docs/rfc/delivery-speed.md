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
| Building, first pass | ~185 min | ~53% | 18–33 min |
| Fix rounds | ~80 min | ~23% | 2–32 min |
| Final checks | ~50 min | ~14% | 7–8 min, one at a time |
| Review | ~31 min | ~9% | 1–6 min, 9 reviews |
| Merge and release | ~10 min | ~3% | 1–2 min |

Elapsed time was 2h25 from the start of #166, with 7 PRs released: about 21 minutes each.

### Draft to merge

| PR | Task | Draft created | Ready | Merged | Draft to merge |
|---|---|---|---|---|---|
| #167 | `i18n-timeline-page` | 20:19 | | 20:44 | 26 min |
| #168 | `i18n-events-setup` | 20:20 | | 20:56 | 36 min |
| #169 | `i18n-errors-setup` | 20:30 | 21:03 | 21:11 | 41 min |
| #170 | `i18n-timeline-titles` | 20:47 | 21:14 | 21:20 | 33 min |
| #171 | `i18n-events-rounds-offers` | 21:11 | 21:21 | 21:29 | 18 min |
| #172 | `i18n-errors-applications` | 21:14 | 21:51 | 22:07 | 53 min |
| #174 | `i18n-errors-files` | 21:31 | 22:22 | 22:39 | 67 min |
| #173 | `i18n-timeline-records` | 21:24 | 22:39 | not yet | over 75 min |

The draft time slightly understates #171, which opened late in its build. Ready to merge was 6 to 17 minutes
wherever it was recorded, so most waiting came before that.

### What's avoidable

1. **The same tests run repeatedly.** Builders ran browser tests and the text comparison, ran them
   again after fixes, and then the final check ran everything. Only the final run decides a merge.
   #169's builder ran 503 browser tests when the whole suite is 648, and later 506. This comes from
   the builder brief, which asks for those checks before reporting. Without timings its size is an
   estimate, but it's probably the largest single waste.
2. **Slow checks ran before review.** `docs/COMPACTION.md` already says to review before the slow checks.
   The brief had builders do the slow checks first, so every review finding meant repeating them.
3. **Fix rounds cost far more than the fixes.** #173's round took about 32 minutes for a rename, one
   test case and a PR description. Most of that was merging main twice as other PRs landed, and then
   retesting. Nits also got a full round, and a resumed builder repeats its checks.
4. **Overlapping PRs waited on each other.** #172 and #174 changed the same error-code map and test,
   and #174's fixes had to wait for #172 to merge. Running both at once saved little, and they took 53
   and 67 minutes.
5. **Merges are one at a time, about 8 minutes each.** Each needs its own version and a full check run
   on that exact commit. This limits throughput however many builders run: at most about 7 merges an
   hour, and a third builder mostly adds to the queue.
6. **Parallel work slows each run.** The browser suite took 4.2 minutes before the batch and up to 6.0
   during it. Part of that may be load; the test count barely changed (645 to 648).
7. **Merge conflicts sit in the same few files.** Five merges hit conflicts:
   `docs/rfc/i18n.md` (3), `CONTRIBUTING.md` (3), and `frontend/eslint.config.js`, `docs/ROADMAP.yaml`,
   `frontend/openapi.json`, `frontend/src/api/schema.d.ts` and `locales/en/index.ts` (1 each). Almost
   all were entries added on both sides, or generated files.

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
| 3 | Sort review findings: fix cheap ones in one batch without rerunning browser tests, log or drop nits | Medium | Fewer nits fixed, and a judgement call each time |
| 4 | Merge main only once, right before the final check | Medium | A conflict is found later; a long-running branch is further behind |
| 5 | Plan waves by which files PRs touch, keeping overlapping PRs in different waves | Medium | Needs a look at the code first, which planning did anyway |
| 6 | Match builders to the merge queue: two rather than three | Medium | Less work in progress; less risk of waiting and machine load |
| 7 | Group changes to shared docs: builders report their RFC and CONTRIBUTING text, and it's added at merge time, as the version and changelog already are | Low to medium | Docs arrive later in the PR; the reviewer sees them last |
| 8 | Regenerate `openapi.json` and `schema.d.ts` on conflict automatically, e.g. a git merge driver or a script step | Low | A small tool to keep working |
| 9 | Give each agent its own port range, and have reviewers start their own servers | Low | Prevents false alarms only |
| 10 | Record a timestamp at each stage | None directly | Replaces this doc's estimates with real numbers, so do it first if any of this goes ahead |
| 11 | Speed up the browser suite itself: profile it, and check worker count | Unknown, needs its own look | Could expose tests that depend on order or timing |
| 12 | **Rule change:** check a group of ready PRs together, then merge and release them in order | High when PRs queue | Breaks "checks on the exact commit being merged"; a failure needs bisecting; version numbers need care |
| 13 | **Rule change:** skip a rerun when only the changelog or a doc changed since a passing run | Low to medium | Same rule; needs a reliable way to prove what changed |
| 14 | **Rule change:** allow a bigger PR where a split forces extra waits | Unknown | Goes against "I want smaller PRs", and reviews get weaker |

**What I'd try first:** 10, then 1, 2, 3 and 4 together, on a small batch. They change only how the
builder brief and the merge loop work, not `CLAUDE.md`, and are easy to undo. Then compare against the table
above. Ideas 12 to 14 only make sense if that isn't enough.

## Not looked at

- How much of each builder's time is spent reading context. Builders used about 140,000 to 220,000 tokens
  each, so a shorter brief might help, but nothing here measures that.
- Whether a builder per PR beats the lead building some itself.
- Token cost overall. Fan-out spends more for the same work; this doc only looks at time.
