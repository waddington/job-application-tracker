# Changelog

Versions follow [semantic versioning](https://semver.org/): a patch for fixes and small
changes, a minor version for new features, a major version for anything that breaks how you
use it. Each version has a [GitHub release](https://github.com/waddington/job-application-tracker/releases).
Numbers in brackets are pull requests.

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
