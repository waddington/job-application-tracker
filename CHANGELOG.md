# Changelog

Versions follow [semantic versioning](https://semver.org/): a patch for fixes and small
changes, a minor version for new features, a major version for anything that breaks how you
use it. Each version has a [GitHub release](https://github.com/waddington/job-application-tracker/releases).
Numbers in brackets are pull requests.

## 1.2.39 (2026-11-01)

- **Developers:** the app's text cutover is finished: a lint rule now stops hard-coded text in all frontend source except tests, the shadow helper is gone, and every count has its plural forms. A few rare API errors and validation messages still reach toasts in English (`i18n-uncoded-errors`). The English is unchanged (#177).

## 1.2.38 (2026-10-31)

- **Developers:** new reply, waiting, recruiter, Undo, "Followed up" and "No reply" events also save their message as a key and values (`data.msg`, so it appears in `export/events.jsonl`), and the Timeline, Today's recent list and search results show saved messages from the translation files, ready for other languages. The saved English and old events are unchanged, and search still matches the saved English (#176).

## 1.2.37 (2026-10-31)

- **Developers:** the remaining Timeline titles: stage moves, rounds, offer replies, calls, notes and people marked ghosted or not interested, read their text from the translation files, ready for other languages. The English is unchanged (#173).

## 1.2.36 (2026-10-31)

- **Developers:** the API's errors about documents, attachments and notes gain a `code` and `params` beside the unchanged English `detail`, and those errors and the remaining file and note toasts read their text from the translation files, ready for other languages (#174).

## 1.2.35 (2026-10-31)

- **Developers:** the API's errors about applications, people, companies, roles, calls and stage moves gain a `code` and `params` beside the unchanged English `detail`, and those errors and the "Couldn't delete…" toasts read their text from the translation files, ready for other languages (#172).

## 1.2.34 (2026-10-31)

- **Developers:** new round and offer events also save their message as a key and values (`data.msg`, so it appears in `export/events.jsonl`), and the application timeline shows it from the translation files, ready for other languages. The saved English and old events are unchanged (#171).

## 1.2.33 (2026-10-31)

- **Developers:** Timeline titles for roles, companies, agencies and people read their text from the translation files, ready for other languages. The English is unchanged (#170).

## 1.2.32 (2026-10-31)

- **Developers:** API errors can carry a `code` and `params` beside the unchanged English `detail`, starting with backup and to-do errors, and the app's error toasts read their text from the translation files, ready for other languages. Responses are the same as before except for those new fields; in `openapi.json`, every `/api/v1` route now declares one `ErrorOut` default response in place of the generated 422, so a regenerated client loses the `HTTPValidationError` type name (#169).

## 1.2.31 (2026-10-31)

- **Developers:** new events for links, notes, files and documents sent also save their message as a key and values (`data.msg`, so it appears in `export/events.jsonl`), and the application timeline shows it from the translation files, ready for other languages. The saved English and old events are unchanged (#168).

## 1.2.30 (2026-10-31)

- **Developers:** the Timeline page's filters, lanes and hover text read their text from the translation files, ready for other languages. The English is unchanged (#167).

## 1.2.29 (2026-10-31)

- **Developers:** The Sankey reads its text from the translation files, ready for other languages. The English is unchanged. A node in the API gains `code` and `stage_name` (#164).

## 1.2.28 (2026-10-31)

- **Developers:** Recruiter conversations and CV performance read their text from the translation files, ready for other languages. The English is unchanged (#163).
- **Fix:** on CVs and cover letters, a version shows its own label, where a document with " · " in its name also showed part of that name (#163).

## 1.2.27 (2026-10-31)

- **Developers:** The Insights page, its tables, the scorecard and weekly activity read their text from the translation files, ready for other languages. The English is unchanged (#162).

## 1.2.26 (2026-10-31)

- **Developers:** Notes and the search results page read their text from the translation files, ready for other languages. The English is unchanged. A search hit in the API gains `round`, `own_title`, `subkind` and `done` (#161).

## 1.2.25 (2026-10-31)

- **Developers:** The Files and Links cards read their text from the translation files, ready for other languages. The English is unchanged (#160).

## 1.2.24 (2026-10-31)

- **Developers:** The Documents page and the CV files card read their text from the translation files, ready for other languages. The English is unchanged (#159).

## 1.2.23 (2026-10-31)

- **Developers:** The Offers page, the Offer card and the offer form read their text from the translation files, ready for other languages. The English is unchanged (#157).

## 1.2.22 (2026-10-31)

- **Developers:** Calls and meetings read their text from the translation files, ready for other languages. The English is unchanged. A role's summary in the API gains `meeting_kind`, `meeting_title` and `meeting_contact_name` (#156).

## 1.2.21 (2026-10-31)

- **Developers:** The Interviews page, rounds, the round form and Reschedule read their text from the translation files, ready for other languages. The English is unchanged (#155).

## 1.2.20 (2026-10-31)

- **Developers:** people and companies read their text from the translation files, ready for other languages. The English is unchanged (#145).

## 1.2.19 (2026-10-31)

- **Developers:** browser tests for the application list: a notification left over from the application before no longer fails the test after it. Nothing in the app changes (#143).

## 1.2.18 (2026-10-31)

- **Developers:** browser tests for the frame: menu, theme, language, help, the connection dot, the backup download, not found and phone width. Nothing in the app changes (#142).

## 1.2.17 (2026-10-31)

- **Developers:** browser tests for Timeline and search: filters, the address, lanes, finding each kind of thing, and keeping up with changes. Nothing in the app changes (#141).

## 1.2.16 (2026-10-30)

- **Developers:** browser tests for Insights: every tab, the Sankey charts against the API, filters, hovering, what shows when something can't load, and weekly activity. Nothing in the app changes (#140).

## 1.2.15 (2026-10-30)

- **Developers:** browser tests for notes, links and files on every kind of page, with real uploads and downloads, and what happens when what they're on goes away. Nothing in the app changes (#139).

## 1.2.14 (2026-10-30)

- **Developers:** browser tests for Documents: creating CVs and cover letters, versions with real files, what can't be deleted, what was sent across pages, and CV files becoming versions. Nothing in the app changes (#138).

## 1.2.13 (2026-10-30)

- **Developers:** browser tests for Offers: adding, revising, editing and deleting offers, permanent, contract and fixed term, and comparing them. Nothing in the app changes (#137).

## 1.2.12 (2026-10-30)

- **Developers:** browser tests for people, second pass: real waits, known-bug tests any fix can satisfy, the Company box, and people moving agency. Nothing in the app changes (#136).

## 1.2.11 (2026-10-30)

- **Developers:** browser tests for interviews and calls: adding, editing and deleting rounds and calls from each page they start on, with and without people, rescheduling and outcomes. Nothing in the app changes (#135).

## 1.2.10 (2026-10-30)

- **Developers:** browser tests for companies and agencies: creating them from their pages and inside the person, role and New application dialogs, renaming and websites showing across pages, what a delete leaves behind and what it refuses. Nothing in the app changes (#134).

## 1.2.9 (2026-10-30)

- **Developers:** browser tests for people and agencies: creating and editing each in every order and from inside each other's dialogs, details, favourites, ghosts, merging, deleting and the person page. Nothing in the app changes (#131).

## 1.2.8 (2026-10-30)

- **Developers:** browser tests for Roles: creating and editing with every mix of company, person, call, pay and files, decisions, every view, and deleting. Nothing in the app changes (#128).

## 1.2.7 (2026-10-30)

- **Developers:** browser tests for an application's page: the summary and its links, moving and undoing, waiting and replies, details, log activity, people, documents sent, At a glance and deleting. Nothing in the app changes (#127).

## 1.2.6 (2026-10-30)

- **Developers:** browser tests for the Board: mouse and keyboard dragging, refused moves, closed stages and round columns. Nothing in the app changes (#126).

## 1.2.5 (2026-10-30)

- **Developers:** browser tests for the Applications list: filters, search, sorting, the quick view, New application and its errors, and every route with new and existing companies, agencies and people. Nothing in the app changes (#125).

## 1.2.4 (2026-10-30)

- **Developers:** browser tests for Today: its groups and sections, offers, replies, chasing, How did it go?, to-dos, follow-ups, snoozing, Ghosted and roles to decide. Nothing in the app changes (#124).

## 1.2.3 (2026-10-30)

- **Developers:** browser tests. `pnpm --dir frontend e2e` opens the real app in Chrome on
  throwaway demo data and uses it; any browser error fails the test. This first step covers
  starting up, every page in the menu and adding an application, and more areas follow. See
  *Checks* in `CONTRIBUTING.md`. Nothing in the app changes (#123).

## 1.2.2 (2026-10-30)

- Translations, step six: **Roles** now read their text from the translation files. It's still
  English and nothing looks different.
  - **What moved over:** the Roles page, a role's page, adding and editing a role, Apply /
    Interested / Pass, and role lines wherever they show (Today, people, companies, calls; the
    titles of those pages' role cards move with their pages).
  - **How it was checked:** every page's text, every Roles view and the roles dialogs were
    compared before and after, with no differences (#120).
- **Working in an office is "In office" everywhere.** It said "Office" when adding a role and on
  an application, "In the office" on a role's page and "office" in the roles list (#120).

## 1.2.1 (2026-10-30)

- Translations, step five: **Applications** now read their text from the translation files.
  It's still English and nothing looks different.
  - **What moved over:** the list and board, the quick view, the application page (details,
    people, role, documents sent, log activity and its timeline) and New application.
  - **How it was checked:** every page's text, and the area's dialogs, menus and board
    switches, were compared before and after, with no differences (#118).
- **The board's round columns** (*A column per interview round*) now go by the stage's id
  having "interview" in it, not its name, so they keep working whatever language your stage
  names are in. The default workflow's *Interviewing* is unchanged; a stage of your own named
  "Interview…" whose id doesn't say so no longer splits (#118).

## 1.2.0 (2026-10-29)

- **A language switch** at the top right, beside light/dark mode: English for now, with more
  languages *Coming soon!*. Your choice is kept in this browser; until you pick one, the app
  follows your browser's language when it has it. The page's language is set to match, for
  screen readers (#114).

## 1.1.4 (2026-10-29)

- Translations, step four: **Today** now reads its text from the translation files. It's still
  English and nothing looks different.
  - **What moved over:** the page itself, to-dos (wherever they show), the reply and chase
    buttons, ghost and favourite marks, reply habits, How did it go?, an application's At a
    glance card, and How it works.
  - **How it was checked:** every page's text was compared before and after, with no
    differences.
  - **Developers:** `scripts/i18n/` has that check, for the areas still to come. A language
    that's missing any key, or a plural form it needs, now fails the tests (#113).
- **Dates are day, month, year everywhere** ("31 Oct 2026", "30 Oct 2026, 19:25"), whatever
  your browser's language. An American browser used to show "Oct 31, 2026" and a 12-hour clock
  in some places, and September was sometimes "Sept". Date inputs show "31 Oct 2026", and
  date-and-time pickers "30 Oct 2026 19:25" (they showed "30/10/2026 19:25") (#113).

## 1.1.3 (2026-10-29)

- Translations, step three: the app's frame now reads its text from the translation files.
  It's still English and nothing looks different.
  - **What moved over:** the header, the menu, the footer, the Not found page, and the shared
    delete button, rename dialog, "+ Add" option and duplicate warning.
  - **Lint:** hard-coded text in those files is now an error.
  - **Developers:** `pnpm dev` with `?lang=pseudo` shows them accented, while pages not yet
    moved stay plain English (#112).

## 1.1.2 (2026-10-29)

- Translations, step two: a few real strings now go through the translation layer in **shadow
  mode**. The app still shows its own English, nothing on screen changes, and the results go
  to the browser console only.
  - **What's shadowed:** the menu, the theme button, the backup link, Today's group counts and
    date, reply habits, and one How it works sentence.
  - **Switching it on in your own tracker:** open it once with `?i18n=shadow`, then use
    `window.jatI18n.report()` in the console. `?i18n=off` switches it off.
  - **In tests,** a mismatch fails the test (#111).

## 1.1.1 (2026-10-29)

- Groundwork for other languages: the app can now be translated, though it's still English
  only and nothing looks different.
  - **Added:** i18next, with every text key and placeholder name checked by the type checker; date
    and number helpers that give the same output as today; a dev-only pseudo-language
    (`?lang=pseudo`) for spotting untranslated text.
  - **Tests** for plurals in English, Polish and Chinese, falling back to English, and unused
    or broken keys.
  - "Text in the UI" in the contributing guide. The pages move over in later versions
    ([plan](docs/rfc/i18n.md)) (#110).

## 1.1.0 (2026-10-27)

- **Today**: the Overview and Next actions are one home page, sorted by what you do about each
  thing. *Your move* (replies to read, offers to answer, how did it go?, to-dos due, follow-ups,
  roles to decide), *Coming up* (interviews, calls and dated to-dos, then rounds not booked yet)
  and *Waiting on them* (waiting to hear back, gone quiet), under one line of numbers and the
  pipeline; two columns on a wide screen. Each item is a tile, and most keep their buttons faint
  until you point at them. Old *Next actions* links open Today (#99).
- Rows keep the same shape in any width: name and status on one line, buttons underneath, so
  nothing squashes to a letter on a phone. Calls on person pages get the same layout (#99).
- The demo data now has something in every section of Today (#99).

## 1.0.0 (2026-10-25)

The first release. Everything in the [roadmap](docs/ROADMAP.yaml) (phases P0–P7) is built,
merged and in daily use for a real job search.

### Tracking
- **Applications list** with search and filters (stage, route, agency, "needs chasing",
  archived) and a quick view (#14).
- **Kanban board**: drag between stages, with the usual next stages highlighted (#15).
- **Flexible workflow**: configurable stages; move from any stage to any stage by default,
  or switch on Jira-style allowed transitions; full timestamped history and undo (#11, #23).
- **Application, company, recruiter and agency pages** (#16, #17).
- **Recruiter CRM**: agencies, recruiters and every way to reach them (#17).
- **Duplicate-submission warning** when two routes lead to the same job (#20).
- **Interview rounds and coding tasks**, numbered and described in your own words (#21).

### Notes, files and documents
- **Markdown notes** as real `.md` files, on anything or on their own (#24).
- **Links** to job ads, Google Docs and repos (#25).
- **File attachments** (#26) and **exported emails** (`.eml`) onto the timeline (#27).
- **CV and cover-letter versions**, and which one each application got (#28).

### Staying on top of it
- **Next actions** (the home page until #48): follow-ups due, applications gone quiet, interviews coming up,
  rounds waiting for an outcome (#29) and offers to answer (#38).
- **One-click follow-up, snooze and Ghosted** (#30).

### Insights
- **Sankey diagram** of how applications move through the stages (#34).
- **Funnel stats**: conversion and median time per stage, direct vs recruiter outcomes,
  weekly activity (#35).
- **Recruiter and agency scorecard** (#36).

### Extras
- **Offer comparison**: salary packages and contract day rates side by side, with a
  worth-a-year figure (#38).
- **One-click backup**: the whole data directory as a zip, or `jat archive` (#39).
- **Full-text search** across everything, notes included; press `/` (#40).

### Since real use began
- **Delete** companies, roles, agencies, people and applications (#43).
- **User guide** in `docs/guide/` (#44).
- **People pages**, in-house recruiters, adding people from a company or an application, and
  renaming companies and agencies (#45).
- **Waiting to hear back**, on applications and people (#46).
- **Overview** home page, a **Timeline** across everything (by day or as lanes), a grouped
  menu, **New application** and a numbered **How it works** on every page; Next actions moves
  to `/next-actions` (#48).
- **Calls and meetings** with people, booked or logged, outside any one application: on
  person pages, Next actions, the Overview, the Timeline and search (#49).
- **Roles to decide**: add roles a recruiter mentioned (from the call), then apply or pass on
  each; a Roles page, and roles on Next actions, the Overview and the Timeline (#50).
- **Docs refresh**: new screenshots and demo GIF of the current app; the Recruiters page's
  button now says *New person*; contact cards keep
  their buttons visible with long emails (#51).
- **Overview before the first application** shows your roles to decide, calls and people
  instead of only the getting-started steps (#52).
- **Favicon**: the header's target mark shows in the browser tab, and as the icon when the
  tracker is added to a phone's home screen (#54).
- **To-dos**: short reminders in your own words, on their own or about a person, company,
  agency, role or application, with an optional date. Add and tick them off on Next actions,
  the Overview and the page they're about; search finds them (#55).
- **Replies to read**: **They've replied** on an application or a person puts their reply at
  the top of Next actions and the Overview until you press **Read it** (#56).
- **Role pages and files on roles**: a page per role (details, where it came from, its
  application, to-dos, notes, links and files). Attach the job description to a role, even as
  you add it, and it shows on the application once you apply (#57).
- **Recruiters page as tiles**: everyone A to Z in small tiles with their agency or company
  as a chip and their contact details, a filter (at agencies, at companies, independent) and
  every agency as a chip (#58).
- **Chased, Ghosted and Not interested for people**: chase a recruiter (waiting again from
  today), or stop expecting anything so they leave Next actions; with Undo and Reopen (#59), as
  labelled buttons like the rest (#60).
- **At a glance** on every application: what needs attention and for how long, what's coming
  up, and key dates as "3 weeks ago" (#65).
- **Recruiter conversations** in Insights: calls, roles pitched, applied or passed, where
  pitched roles went, time to decide, per person and per agency, and why you passed; weekly
  activity counts calls and roles pitched (#66).
- **Timeline follows roles**: lanes default to one row per role, from the call and the pitch to
  the outcome; pitched and passed roles get their own kind (so they also show in the
  Overview's recent activity); bookkeeping (companies, agencies and people added) is hidden
  unless you ask; clearer filters; Timeline moves next to Insights (#67).
- **Merge people**: fold a duplicate record into the person you keep (details, calls,
  pitched roles, applications, interviews, notes, links, files and to-dos move over), with a
  nudge when someone looks like a duplicate; and one person per email address and LinkedIn
  profile (#68).
- **A timeline per person**: a **Timeline** button on each person, company and agency page
  opens the Timeline filtered to them, over all time (calls, the roles they pitched, the
  applications and interviews they're on, notes); the Timeline keeps its view, period and
  *About* in the address. Notes on a role now show for its company and the person who pitched
  it (#70).
- **Which CV works best**: an Insights tab comparing CV and cover-letter versions (an A/B
  test): heard back, screens or interviews with a 95% range, offers and typical reply time,
  with and without one recorded; pick two and it says whether the gap is likely real
  (Fisher's exact test) (#71).
- **Ghosts are easy to spot**: a ghost before the name of anyone you've marked *Ghosted*, on
  their page and tile, the applications they brought you, calls, Next actions, the Timeline,
  search and Insights; a *Ghosted* filter on the Recruiters page; and **Not a ghost** (or the
  **×** on their chip) to take it off whenever you like, with an Undo (#72).
- **Usually replies within N working days**: the app remembers how long each person takes to
  get back to you (weekends don't count; backfilled from your applications' history) and says
  so on their tile, their page and Next actions, with *longer than usual* when you're waiting
  past it (#73).
- **CV files become versions**: the Documents page finds CV files you attached to
  applications (by name, or the same file on several; identical files are one) and makes each
  a version recorded as sent with those applications, so Which CV works best can use them
  (#74).
- **CVs sent to recruiters and roles count too**: CV files on roles and people are found as
  well, for the applications they led to that have no CV yet; each says where it was found,
  and you tick the applications it went out with (#75).
- **Interested in a role**: an **Interested** button next to Apply tracks a role as an
  application at your starting stage with no applied date; the role shows *Interested* (and
  the Roles page has an *Interested* view) until it gets to Applied or is closed; moving an
  application to Applied fills in its applied date (#77).
- **Closed while Interested isn't Applied**: a role whose applications were all closed before
  any got to Applied (withdrawn, rejected or ghosted) shows how it ended, e.g. *Withdrawn*,
  with a *Closed* view on the Roles page, and counts as passed in Insights; applied and then
  withdrawn stays *Applied* (#79).
- **Roles in narrow cards** (a company's side column, phones): the buttons wrap under the role
  instead of squashing its name (#79).
- **Favourite people**: star the recruiters you rate; a gold star before their name across the
  app, a *Favourites* filter on the Recruiters page, and favourites listed first (#80).
- **The whole picture** in Insights: one Sankey diagram of every role, from where it came from
  (through a recruiter, referred, or you found it) to passed, deciding whether to apply, or its
  stages; both Sankeys end each stage with a spur to what's still waiting there (*Waiting to hear
  back*, *Still interviewing*, *Deciding on the offer*…) (#84), each just after its stage rather
  than on the right edge (#85). Each column is arranged so flows cross, or run through a stage,
  as little as possible, long labels wrap, and Recruiter conversations works the same way;
  roles you passed on read *Decided not to apply* in the diagrams, beside *Applied* (#86).
- **How did it go? asks for notes**: on Next actions, a round's *Done* asks for the debrief and
  questions asked, and *Didn't happen* (a round or a call) asks what happened, before saving
  (#87).
- **Fix**: pressing Enter (for a new line) in that dialog no longer crashes the page (#88).
- **Route links**: an application's *Route* links the recruiter, agency or company to their
  page, on the full page and the quick view (#89).
- **Reschedule an interview**: the Interviews page edits a round, or moves a booked one to a
  new time (and why); a *Rescheduled* badge shows it moved, and from when. Migration 0014
  counts reschedules already on your timelines (their earlier time wasn't recorded) (#90).
- **A column per interview round** on the board: a switch splits *Interviewing* into *No round
  yet*, *Round 1*, *Round 2*…, to see progression; cards only drop into *No round yet* (#91).
- **A role's recruiter carries over**: changing the person on a role gives its open applications
  the new person where they fit how you applied (never changing the route or agency), and a
  recruiter change is noted on the application's timeline (#92).
- **Every application starts at Interested**: one added at *Applied* (or later) gets an
  *Interested* step a second before, so Insights shows every application flowing from
  *Interested*; existing applications are filled in by migration 0013 (#83).
- **Today stands out in date pickers**: every calendar rings today in indigo, so you can see
  where you are when booking a round, a call or a follow-up (#82).

### Under the hood
- Python 3.12, FastAPI, SQLAlchemy, Alembic and SQLite; React 19, TypeScript, Mantine and
  TanStack Router/Query (#6–#9).
- Your data lives in its own folder: SQLite for speed plus a readable JSON Lines export,
  auto-committed to a private git repo after each burst of changes, pushed only when you
  ask (#7, #8, #13).
- Localhost only: refuses other hosts and cross-site writes (#26).
- A local project dashboard for the build itself (`python3 -m tools.pm`) (#4).
- The README's demo GIF is built from the screenshots by `scripts/demo_gif/make_demo_gif.py`:
  a styled scene per feature, 1.5 seconds each, with slides between (#63).
- **A website** (https://waddington.github.io/job-application-tracker/): an animated landing page built with Astro from `website/` and
  published to GitHub Pages; plus a contributing guide and issue templates (#64).
- **No account, no cloud, no AI, no tracking, said up front**: the README, `llms.txt` and a new
  social card (built by `scripts/social_preview/make_card.py`, readable at thumbnail size) lead
  with it; the website speaks to job seekers who aren't developers, with plainer words, an
  honest "about ten minutes" setup and a fuller FAQ. The API docs page (`/api/docs`) now
  serves Swagger UI from the app instead of a CDN, so nothing is fetched from the web (#96).

### Left out on purpose
No job-board searching or scraping, no quick-add from URLs, no MCP server and no `.ics`
calendar export.
