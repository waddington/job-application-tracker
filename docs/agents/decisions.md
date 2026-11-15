# Decisions already made

Product decisions Kai has made or accepted. Don't re-litigate them; change one only when Kai asks. The guide
(`docs/guide/using-the-app.md`) and the RFCs hold the detail.

## Workflow and applications

- Any-to-any stage moves by default; `transitions = "configured"` enforces `next`. *Screen* stays in the default
  workflow. Kai's own stages live in their data folder's `config.toml`: give snippets, never edit it.
- Every application starts at the workflow's first stage: implied events (`data.implied`) fill it in; they aren't undoable
  and don't count as a stay, update, reply or move.
- Staleness: not stale if snoozed, a follow-up is planned later, a round is booked ahead, you're waiting to hear back, or
  there's a reply to read. `awaiting_reply_since` and `reply_to_read_since` never coexist; a stage move clears both.
- At a glance follows Today's rules for one application; key dates count only what has happened.
- Today: one home page with three groups (Your move / Coming up / Waiting on them), "Tiles + faint buttons" (Kai: "Lines
  is least fav"; "I like the new one, ship that"); no per-row menu, no folding long lists.

## Roles

- Status is derived: *applied* > *passed* > *to decide*. *Interested* while every application is in an open stage before
  Applied. Closed before reaching Applied → *Closed* (badge = how it ended), counted as passed in Insights; applied then
  withdrawn stays *Applied*, with an ended badge once every application has ended (a success wins, else the latest).
- Same title at the same company reuses the role; role files show on the application.
- A role's person changing never changes an application's route or agency; only open, unarchived, non-referral
  applications that had the old person or nobody, and only where the new person fits. Notes are bookkeeping.

## People

- One agency or company each; one person per email and LinkedIn profile. Two people can share a name (Kai: "yes there can
  be 2 people with the same name"); keep that test pinned.
- Merge: the kept person's fields win; notes are relinked in the file. Deleting a person deletes their calls and unlinks
  the rest (for duplicates, merge).
- Ghosts: only `closed_as == "ghosted"` gets a ghost; taking it off is a plain action with an Undo toast. Favourites are
  one star, separate from ghosted, listed first.
- Reply times: recorded when waiting ends with a reply or a move that isn't yours; chasing and Ghosted aren't replies;
  weekdays only; no guessing at PATCH "undos". Merging people keeps replies.

## Interviews, calls and offers

- Reschedules count only when a booked round's time moves. "Who needed the change?" (Me / Them / Both of us / Neither of
  us; `me | them | mutual | neither`), required in the dialog, optional in the API; each move keeps its own who and why.
- "A new time isn't agreed yet" is a mark beside the status, not a status: the old time is kept, the to-do is made in the
  same request and starts open ("Add a to-do to book the new time"), booking counts as one move. Calls mirror rounds.
- "Reached" a round: not cancelled, not waiting for a new time, and started (or due) by the cutoff, or marked done by then.
- Rejection feedback: by the stage id `rejected`; one per application, editable, kept as written; undo keeps it. The
  Rejections list takes the date and from-stage from the latest standing move to Rejected.
- Rescheduling insights show raw counts, companies and recruiters only from 3 moved rounds, and never claim reschedules
  lengthen time in stage.
- Notes dialogs: nothing saves until confirmed; they can't close while saving.
- Interested roles count as *still deciding* in Recruiter conversations; Today's *roles to decide* lists only roles with
  no application.
- Offers: the newest per application counts; a year's worth = salary + bonus + equity + employer pension, or day rate ×
  220.

## Insights

- Sankeys: a holding spur for every active stage; outcomes on the right edge; *Decided not to apply* beside Applied;
  column order searched for fewest crossings; "Passed" is never a Sankey label. The whole picture's sources: referral >
  recruiter > found; a role applied to twice counts twice.
- Recruiter conversations: calls held = marked Happened; booked = scheduled ahead; best outcome per role: offer > in
  progress > closed > ghosted.
- CV A/B: CVs told apart by the version recorded per application; Wilson 95% ranges; Fisher's exact test, "too few" under
  5 each. CV files grouped by content; originals never touched; you tick the applications.
- Board rounds: only stages named "interview" split; only *No round yet* takes drops.
- Timeline: lanes by role by default; `added` bookkeeping off by default.

## Product and positioning

- "No AI. No cloud. No account. No tracking." in that order (Kai, 2026-11-03). Not "no external dependencies"; "plain
  files" only with the SQLite caveat; git backups are optional. The app never calls out to the web. No coined phrase.
  Keep the repo name `job-application-tracker`.
- Scope cuts: no job searching or scraping, no quick-add from URLs, no `.ics` export, no Google Analytics, no CI
  test workflow. Search Console is in (Kai, 2026-11-12: "can i add search console to the webste"): verified by a meta
  tag in `SiteHead.astro`, which adds no script or cookie, so the footer's "no cookies, analytics or trackers" stays
  true. The MCP server is planned (`docs/rfc/mcp.md`).
- The website: one landing page, the paper palette, docs on GitHub, no analytics; it speaks to non-developers, the README
  to developers. Docker is for self-hosters (shelved, `docs/rfc/docker.md`); the lay-person path is a one-command
  install, then Windows support, then a desktop app.
- Promotion: Claude drafts posts and Kai posts them; posts say it's built with Claude Code.
- Search: every word must match, accent- and case-insensitive.
- English dates are day, month, year, through the dayjs patterns in `utils/format.ts`, never the browser's locale.

## Translations

- The frontend does all translating; the backend sends codes and ids next to its English. One namespace per area; English
  as `.ts` `as const`, other languages JSON. Your data (companies, notes, renamed stages) is never translated; a default
  stage you haven't changed is. Saved summaries stay English; new events also save `data.msg`.
- The language switch: an outlined button with a globe, the name and an arrow (globe alone on a phone); languages by their
  own names; pseudo in dev only.
- New languages: AI-translated, corrections by issue or PR, no native-speaker review; a big language goes in as a draft,
  one string file per PR, smallest first, in context (code and screenshots), reviewed per screen area. Chinese specifics
  are in [now.md](now.md).

## Website

- The 2026 redesign is concept 1i (`docs/rfc/website-redesign.md`): pastels and plum, the app shown in light mode, a
  3D browser whose app demo plays at twice the concept's speed. No dot or halftone textures (too close to the
  reference site, Kai: "too close to a straight rip off"); no long scroll-jacked stretches; the old site's anchors
  stay. The website is English only.
- The GitHub links show the star count, live (Kai, 2026-11-12): baked in at build, refreshed by the visitor's browser
  from `api.github.com` (GitHub again, which already hosts the site); no cookies, credentials or analytics.
- The privacy promises are the app's, not the website's (Kai, 2026-11-12: "the privacy promises are just about the app,
  not the static github pages site"). Even so, the site has Search Console only, no analytics ("i will stick to just
  search console for now"); if that changes, a cookie-free counter (Umami, GoatCounter) or GA4 with a consent banner,
  and the footer's "no cookies, analytics or trackers" changes with it.
- Search words: "job application tracker" in the title and h1, "job search tracker" in the description (#352).

## App redesign (P12)

- **Concept 11 is picked; building waits for Kai's go** (Kai, 2026-11-15: "i like 11", then "go for 11. plan it
  out, create the roadmap items"). The plan is `docs/rfc/app-redesign.md`, reviewed with Kai before building starts;
  the tasks are P12. The reference implementation is draft #354, branch `worktree-app-redesign-concepts` (never merged): `?design=11`
  on its dev server, code in `frontend/src/design/`.
- What 11 is: round 1's 4 (calm soft cards); one background on every page that fades very slowly between calm tints,
  a ten-minute cycle tied to the clock (it carries across page changes and reloads), static under reduced motion;
  pages full width up to 2,400 px, starting right after the menu; Today in three columns; side panels that slide in and
  dock, pushing the page aside, never overlaying (the application panel on Applications list and board, Today, Company
  and Agency); a board that fills the window, columns at least about 180 px; record pages (application, company,
  person, agency, role) in two columns plus a narrow side column; Notes as a card grid; Documents as side-by-side cards;
  Interviews with the calendar beside "still to book"; on phones (below 768 px) a bottom bar of Today, Applications,
  Interviews, Notes and More (a sheet with the other seven pages, and the sidebar's footer at its bottom: the plan's
  default, Kai can change it), panels full-screen there.
- The side menu on desktop ("on desktop i prefer side menu"), not a top bar. Concepts 1-3 are out ("overwhelming and
  not calm"). Fonts: Inter and JetBrains Mono, as in the concepts.
- The look changes, not what pages hold or do. Every image (README in both languages, demo GIFs, social card, the
  website's captures) is retaken after the build, and Kai sees each before it's applied.

## Loading states

- Skeletons, not spinners, for cards and whole pages (Kai, 2026-11-12: "yes skeletons instead of page spinners");
  a failed load says "Couldn't load this." with Retry; the empty text only for a successful empty result.

## Windows

- Basic support first (`docs/rfc/windows.md`): the Windows-unsafe parts behind one is-Windows check and off there;
  `JAT_WINDOWS_SNAPSHOTS=1` for testing; `tzdata` on every platform; each Windows change is run on real
  Windows before merging, since 2026-11-11 in Kai's Windows VM driven by the agent (no CI job unless Kai asks).
- Windows counts as supported without git snapshots (Kai, 2026-11-15: "yes we can say we support windows even without
  the snapshots"): the data is on disk either way; Download a backup is the backup there. `windows-snapshots` (#365)
  is on hold ("dont review/merge 365 yet"); when it's picked up it updates the docs that say snapshots are off.
- The maintainer tooling (`tools/dev`, `tools/pm`) is outside Windows support: its tests skip on Windows (#373), and
  making it work there is separate backlog, `windows-dev-tooling` ("the new roadmap item is not part of the current
  windows support plan").

## Maintainer checks

- `checks.sh --no-e2e` accepts a version-only bump alongside the skip list (#369, via `tools/dev/scope.sh`).
