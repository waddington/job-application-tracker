# Changelog

Versions follow [semantic versioning](https://semver.org/): a patch for fixes and small
changes, a minor version for new features, a major version for anything that breaks how you
use it. Each version has a [GitHub release](https://github.com/waddington/job-application-tracker/releases).
Numbers in brackets are pull requests.

## 1.24.53 (2026-11-24)

- Rejection feedback now has its own card, right under the Rejected badge on an application's page and in the quick view, with Add or Edit feedback beside its heading. (#448).

## 1.24.52 (2026-11-23)

- Every search box ignores accents and case: the Applications, Recruiters, Companies and Notes searches and every list you type into to pick something find José from jose, and the other way round (#446).

## 1.24.51 (2026-11-22)

- A shorter README in both languages, with new artwork: an animated hero and diagrams of how an application moves and where your data lives (#444).

## 1.24.50 (2026-11-22)

- The website shows the redesigned app: its screenshots are retaken and the animated demo at the top follows the new look (#442).

## 1.24.49 (2026-11-22)

- The app's icon is plum to violet, and the README's demo GIFs and the social card have the new look. The card now also says No internet needed (#439).

## 1.24.48 (2026-11-22)

- The README's screenshots show the app's new look, in English and Chinese, and their descriptions say what's in them (#438).

## 1.24.47 (2026-11-22)

- The app keeps loading and saving when your computer loses its network with the app open. It used to pause every request until the network came back, and a save still waiting was lost if you reloaded (#437).

## 1.24.46 (2026-11-22)

- The redesign's dark-mode and contrast pass: text, the marks that are a thing's only cue and keyboard focus rings are easier to see in light and dark, on every background tint. Today's faint buttons stay faint but read better, a picked segment and a switch that's off have a thin ring, and Weekly activity's colours are easier to tell apart (#436).

## 1.24.45 (2026-11-22)

- The app's new look, part twelve: on a phone a bottom bar has Today, Applications, Interviews, Notes and More in place of the menu button. More opens the other pages, with the connection, Download a backup and the version under them, and shows a dot when one of those needs attention. The header fits on one row on a phone, so its buttons no longer spill out of it or cover the page's title (#427).

## 1.24.44 (2026-11-20)

- The app's new look, part eleven: Notes and Documents as grids of cards that take more columns on a wider screen, Insights' charts in the new palette (checked for contrast and colour-blind separation in light and dark), and Search's results as soft rows at a reading width. Badges in Search and Insights keep their whole words on a phone (#425).

## 1.24.43 (2026-11-20)

- The app's new look, part ten: Interviews, Offers and the Timeline. On a wide screen Interviews puts Still to book beside a month (a year keeps the whole width, its months in more columns) and its list in two columns; a round's badges keep their whole words. Offers stays one comparison table with each offer's column at most about 420 px, and the Timeline sits on the new cards with its lanes scrolling inside theirs on a phone (#424).

## 1.24.42 (2026-11-19)

- The app's new look, part nine: the Roles, Recruiters and Companies lists. The companies table sits on one of the new cards and scrolls inside it on a phone, recruiters' tiles fill a wide screen (up to six across), and the views at the top of Roles and Recruiters scroll in their own row, so nothing pushes a phone's page sideways. A row or table with more past its edge fades there, here and on the Applications list (#423).

## 1.24.41 (2026-11-18)

- The app's new look, part eight (b): a person's, an agency's and a role's page use the same record layout as an application's and a company's, so all five lay their cards out by the room the page has. A stage badge in a record page's applications table now wraps rather than being cut short or pushing the table out of its card (#421).

## 1.24.40 (2026-11-18)

- The app's new look, part eight: an application's page and a company's page lay their cards out by the room the page has. On a wide page the main cards sit in two columns with the to-dos, role and people in a narrow column beside them (an application's summary across the top); with less room the main cards share one column beside that side column, and on a phone everything stacks (#415).

## 1.24.39 (2026-11-18)

- The app's new look, part seven: the Applications board fills the window beside the menu (or the quick view), its columns sharing the width from about 180 to 360 px each and holding still while you drag a card; the title, filters and the list stay at the usual width, and the list sits on one of the new soft cards (#413).

## 1.24.38 (2026-11-18)

- The app's new look, part six: Today lays out by the room the page has. On a wide page Your move, Coming up and Waiting on them sit in three columns with their cards level; with less room (or with the quick view open) Your move sits beside the other two, or they stack. A row's name no longer runs under its stage badge on a phone or in a narrow column (#412).

## 1.24.37 (2026-11-18)

- The app's new look, part five: an application's quick view docks beside the page on Applications (list and board), Today, a company's page and an agency's page, and the page makes room for it. It stays open while you scroll or click around, another row or card swaps what it shows, and Escape or × closes it with focus back where you were. Below 992 px wide it opens full screen over the page (#408).

## 1.24.36 (2026-11-17)

- The app's new look, part four: dialogs, forms and tables. Input outlines are easier to see, delete actions read red, a field's hint sits under its box so the boxes in a row line up (New application, the offer dialog and an application's dates), a dropdown opens below the hint, and the offer dialog's dates show in full (#403).

## 1.24.35 (2026-11-17)

- On a wide screen, the Interviews calendar's day numbers now sit just above their own dots instead of far to their left, under the day before (#405).

## 1.24.34 (2026-11-17)

- The app's new look, part three: roomier cards, a card that holds cards (a board column, interview rounds, notes, offers) as a soft well of the page's tint, stage badges as pills, the stage bars as separate pastel segments, and Today's rows standing out in dark mode (#402).

## 1.24.33 (2026-11-17)

- Insights' cards, the application quick view, the Offers and Notes cards, an opened note and Documents' where-used list show a skeleton instead of a spinner while they load, so Insights' tabs no longer jump; the Offers and Notes cards, an opened note and where-used say when they can't load, with Retry, instead of spinning for ever or showing nothing (#401).

## 1.24.32 (2026-11-16)

- An application's, role's, person's, company's and agency's page show a skeleton of their header and first cards instead of a spinner while they load, and a page that can't load keeps its back link (#399).

## 1.24.31 (2026-11-16)

- Ten list pages (Applications, Companies, Roles, Recruiters, Interviews, Offers, Notes, Documents, Today and Insights) show a skeleton shaped like the page instead of a spinner while they load, so the page no longer jumps when it arrives; a page that can't load says so with Retry instead of saying there's nothing there or spinning for ever (#396).

## 1.24.30 (2026-11-16)

- To-dos, interview rounds, files and links show a skeleton while they load, and "Couldn't load this." with Retry when they can't, instead of showing nothing; Add round waits until the rounds have loaded (#395).

## 1.24.29 (2026-11-16)

- Timeline and Insights' Weekly activity show a skeleton while they load, and "Couldn't load this." with a Retry button when they can't load, where Timeline used to say there was nothing here and Weekly activity spun for ever (#387).

## 1.24.28 (2026-11-15)

- The app's new look, part two: one background on every page that fades very slowly through five calm tints (still under reduced motion), pages that use the full width of the window up to a limit, and a restyled side menu and page titles. Notes and documents keep a readable line length (#384).

## 1.24.27 (2026-11-15)

- The app's new look, part one: plum as the main colour (lavender in dark mode), soft pastel stage colours, the Inter font with small mono labels on menu groups and table headers, soft rounded cards and pill buttons, and dark mode tinted plum. Nothing moves; layout changes come in later releases (#382).

## 1.24.26 (2026-11-15)

- The website is built with Astro 7.4.7, which fixes two security advisories (#356).

## 1.24.25 (2026-11-15)

- **Developers:** the notes and demo-data tests read the files the app writes as UTF-8, so they pass on Windows too, making the whole test suite pass there; the PM dashboard prints dates without `%-d`, which Windows rejects (#378, carrying #364).

## 1.24.24 (2026-11-15)

- **Fix:** on Windows, when another program (an editor, antivirus or OneDrive) has a note, an uploaded file or an export file open, saving or deleting a note, uploading a file or a CV version, or downloading a backup tries again for about a second and a half, then says the file is open in another program instead of failing with a server error, and nothing is half-saved. Deleting a file, a CV version or a document still goes through: a file that's open is left in `files/` and named in the server's log. `jat restore --force` puts your old database back if it can't swap in the restored one (even on Ctrl-C) and says to stop `jat serve`, instead of printing a traceback (#376, carrying #357).

## 1.24.23 (2026-11-15)

- **Guide:** a Windows test-run checklist for people helping test Windows, on a throwaway data folder (Windows still isn't supported) (#375, carrying #358).
- **Developers:** tests that need symlinks are skipped, with a reason, where symlinks can't be made, as on Windows without Developer Mode (#375, carrying #358).

## 1.24.22 (2026-11-15)

- **Developers:** `/api/v1/health` has a typed response model, so the OpenAPI schema describes it, and the sidebar's connection status reads it through the typed API client (#374, carrying #361).

## 1.24.21 (2026-11-15)

- **Developers:** the tests of the maintainer-only tooling (the PM dashboard, the tools/dev scripts and the i18n translate helpers) skip on Windows, so `uv run pytest` there checks the app; Windows support leaves those tools out (#373).

## 1.24.20 (2026-11-15)

- **Developers:** the Insights clock-change test runs on the bundled tzdata package alone, through a shared tzdata_only fixture, so it behaves the same on Windows, macOS and Linux; a duplicate time-zone test goes (#371, carrying #360).

## 1.24.19 (2026-11-15)

- **Developers:** the encoding check also catches `codecs.open` without an encoding, `SpooledTemporaryFile` in a text mode, and subprocess calls with `errors=` but no `encoding=` (#370, carrying #363).

## 1.24.18 (2026-11-15)

- Scripts read and write text as UTF-8, so the translation and demo tools work on Windows (#368, carrying #362).

## 1.24.17 (2026-11-13)

- Marking a round done moves its application to Waiting to hear back, from the day the round happened (#355).

## 1.24.16 (2026-11-12)

- The website's main heading says it's a job application tracker, and its search snippet says job search tracker (#352).

## 1.24.15 (2026-11-12)

- The website is verified in Google Search Console, which adds no script or cookie (#350).

## 1.24.14 (2026-11-12)

- The website's GitHub links show the repo's star count, kept live (#348).

## 1.24.13 (2026-11-12)

- The website is redesigned: soft pastels, a 3D browser window showing the app in use, a frosted glass board and a sticky tour of the features (#346).

## 1.24.12 (2026-11-12)

- The redesigned hero doesn't jump on phones while its font loads (#345).

## 1.24.11 (2026-11-12)

- The redesigned page's languages, quick start and FAQ at /preview/; the quick start, FAQ and footer note now have one source (#344).

## 1.24.10 (2026-11-12)

- The redesigned page's sticky story at /preview/: recruiters, interviews, offers and notes, with a progress rail (#342).

## 1.24.9 (2026-11-12)

- The redesigned page's middle sections at /preview/: the statement, a frosted glass board, the Today card, the Insights panel and the centre line (#343).

## 1.24.8 (2026-11-12)

- The redesigned page's hero shows the app in use: Today, a card dragged on the board, a role's stage changed and the Sankey drawn in (#340).

## 1.24.7 (2026-11-12)

- The redesigned page's hero at /preview/: pastel cards drifting behind a 3D browser that turns and opens onto the app in Chinese (#339).

## 1.24.6 (2026-11-12)

- The redesigned website's page takes shape at a hidden /preview/ address; the homepage is unchanged (#336).

## 1.24.5 (2026-11-12)

- The website's page head is one shared component; the page looks the same (#338).

## 1.24.4 (2026-11-12)

- Cards show grey placeholder lines while they load and Couldn't load this. with Retry if they fail, never their empty text: Roles, Calls, Done recently and Recent activity (#333).

## 1.24.3 (2026-11-12)

- Emptying a person's Agency or Company box and saving now takes them off it (#331).

## 1.24.2 (2026-11-12)

- Deleting a call asks first (#330).

## 1.24.1 (2026-11-12)

- Applications can be saved again after their recruiter moves agency, or their agency or recruiter is deleted (#329).

## 1.24.0 (2026-11-12)

- Interviews has a calendar, now the default view: a Month of dots and a Year of twelve dot months, each round's day coloured by how it went, a summary of the month or year against the one before, and a side panel with the chosen day's rounds and their Done, Reschedule and Edit buttons. List keeps the tables. (#317).

## 1.23.16 (2026-11-11)

- The website says the app comes in English and 简体中文: a feature card and a FAQ entry, linking the Chinese README. (#323).

## 1.23.15 (2026-11-11)

- The README in Simplified Chinese (README.zh-CN.md), with the Chinese screenshots; the English README links to it under its title. (#319).

## 1.23.14 (2026-11-11)

- Chinese versions of the README screenshots and the demo GIF, under docs/screenshots/zh-CN/, for the Chinese README; make_demo_gif.py --lang zh-CN builds the Chinese tour. (#318).

## 1.23.13 (2026-11-11)

- Groundwork for the Interviews calendar view: date and summary helpers, with tests (nothing changes on screen yet). (#325).

## 1.23.12 (2026-11-11)

- Search results show a note's text without its Markdown marks (**bold**, links, headings…) in the snippet; titles, names, file names and links stay as written. (#320).

## 1.23.11 (2026-11-11)

- A role's pay shows in its own currency (dollars, euros, yuan…) instead of always in pounds, and editing a role keeps its currency instead of turning it into pounds. (#321).

## 1.23.10 (2026-11-11)

- The Chinese demo data (seed_demo.py --lang zh-CN) labels contact details in Chinese (工作, 手机) instead of English. (#322).

## 1.23.9 (2026-11-11)

- Reopening Edit right after saving shows what you just saved, so saving again can't put the old values back: people, agencies, companies, offers, interview rounds, calls, roles and notes. A note's check for changes made elsewhere now compares against the version you opened. (#315).

## 1.23.8 (2026-11-11)

- The X on a link's rename box cancels again instead of saving what you typed, and the tick saves once, so it no longer shows That didn't work. (#311).

## 1.23.7 (2026-11-11)

- In the person dialog, an agency or company typed but not chosen from the list is no longer dropped on save: the matching one is used, or it's added as + Add would. Saving a person while their new company or agency is still being made no longer loses the link either. (#314).

## 1.23.6 (2026-11-11)

- Today keeps what you're typing when the date changes at midnight, and an open Reschedule dialog on Today stays open when the round's or call's start time passes; while Today loads the new day it dims what it shows. (#310).

## 1.23.5 (2026-11-11)

- Saving an application's Details after moving it to Applied no longer wipes the applied date, and renaming a company no longer throws away words typed but not yet saved in About: forms on a page now follow what's saved and keep only your own unsaved edits, and Save sends just the fields you changed. (#313).

## 1.23.4 (2026-11-11)

- Installing no longer needs a C compiler: the repo's `.python-version` asks uv for Python 3.12 to 3.14, so a computer with no Python gets one with ready-built packages, not 3.15 (on Windows, `uv sync` failed asking for Visual C++). (#312).

## 1.23.3 (2026-11-11)

- The data folder gets a .gitattributes that stops git changing line endings: uploads are committed byte for byte and notes and the export keep Unix line endings, including with Git for Windows. Existing data folders get it when the app starts (#308, carrying #302).

## 1.23.2 (2026-11-11)

- Text files and git's output are read and written as UTF-8, not the system's default: on Windows a non-English character in .env, config.toml, .gitignore, a note or a commit message no longer comes out garbled, and a BOM from Notepad is accepted (#306, carrying #284).

## 1.23.1 (2026-11-11)

- The app's own files are served with fixed types instead of the system's guess, so the page no longer loads blank on a Windows computer that maps .js to text/plain (#305, carrying #301).

## 1.23.0 (2026-11-10)

- The tracker starts on Windows, as the first step to supporting it: what can't work there yet (Unix file locking, git snapshots, `jat init`'s commit) is off on Windows, and the sidebar's connection tooltip says snapshots are off. `JAT_WINDOWS_SNAPSHOTS=1` turns snapshots back on there, for testing on a test data folder. Windows isn't supported yet. (#300, carrying #283).
- `/api/v1/health` says whether snapshots are on and whether it's running on Windows. (#300).

## 1.22.1 (2026-11-10)

- The IANA time-zone database (`tzdata`) now comes with the tracker on every platform, so Insights' weekly activity will work on Windows once the tracker runs there. (#298).
- Insights: a time zone like `Europe`, a folder in the database rather than a zone, gives the unknown time zone error instead of a server error. (#298).

## 1.22.0 (2026-11-10)

- Recruiters has an In progress filter: the people you have an open application with (as its recruiter, Interested included) or a pitched role still to decide, with how many on the tab; each person's card says how many applications are in progress and roles are to decide. (#296).

## 1.21.1 (2026-11-09)

- Chinese demo data: scripts/seed_demo.py --lang zh-CN fills a demo folder with made-up Chinese companies, recruiters, roles, notes and offers in CNY, for trying the app or taking screenshots in Chinese. The English demo is unchanged. (#293).

## 1.21.0 (2026-11-09)

- Simplified Chinese (简体中文) is switched on: choose it from the language menu, or get it automatically from a browser set to Simplified Chinese (zh, zh-CN, zh-Hans, zh-SG); dates, numbers and the tab's title follow, and the menu's Coming soon! is now More coming soon. The README has a Languages section. (#294).

## 1.20.0 (2026-11-09)

- Round pills on the board, the list and the quick view show what a round is waiting for: a separate pink badge says Not booked yet, Waiting to hear back (a done round with no decision since) or Needs a new time, and At a glance says when a done round is waiting to hear back. The API's current round gains waiting_to_hear_back. (#289).

## 1.19.12 (2026-11-09)

- On Today, a round or call happening today has an orange Today pill under its title in Coming up, like a to-do due today; and a call's buttons now fade until you point at the row, like a round's (#286).

## 1.19.11 (2026-11-08)

- An application with an offer no longer says No offer yet while its offers are loading, or after they fail to load (#281).

## 1.19.10 (2026-11-08)

- When a delete is refused (a company that has gained an application, a document that has been sent), the page now refreshes to show why, instead of staying out of date (#279).

## 1.19.9 (2026-11-08)

- A new document version's suggested label no longer repeats one that's there: it goes one above the highest vN label (#277).

## 1.19.8 (2026-11-08)

- A person's or an agency's page now marks Recruiters in the menu (#275).

## 1.19.7 (2026-11-08)

- Documents now notices an application deleted on its page: its sent counts and where-it-was-used lists refresh straight away (#276).

## 1.19.6 (2026-11-08)

- `jat archive` no longer leaves an unignored lock file in a data folder that isn't a git repository: `jat-snapshot.lock` is now in its `.gitignore`, and `jat init` adds it to older ones (#278).

## 1.19.5 (2026-11-08)

- **Developers:** the browser test that pins the offer-kind bug holds the roles request until the offer form is open (for 5 s at most) instead of waiting a fixed time, so it can no longer pass by luck and fail the browser suite (#271).

## 1.19.4 (2026-11-08)

- **Fix:** after *Add and add another* in the role dialog, the next role no longer keeps the last one's type, work mode and IR35, so it can't silently save as a contract (#270).

## 1.19.3 (2026-11-06)

- Sentences shown one after another (the edit form of a round or call waiting for a new time, a round's days moved, a rejection's line and Insights' Calls moved, Rescheduling and Rejections round counts) join the way each language does, so a translation no longer gets a stray space after a full stop; English is unchanged (#259).

## 1.19.2 (2026-11-06)

- Lists of names the app builds (a round's interviewers, a person's relations to an application, a role's files, an Insights week's counts) use the language's own separator, so a translation no longer shows an English comma; English is unchanged (#258).

## 1.19.1 (2026-11-06)

- An applied role whose applications have all ended says how on its badge (*Rejected*, *Withdrawn*, *Accepted*…) instead of *Applied*, wherever it shows: a person's *Roles they've mentioned*, the Roles page, the role's and company's pages. Role summaries gain `ended_as`, `ended_stage` and `ended_kind` (#254).

## 1.19.0 (2026-11-06)

- Mark an interview round **Done** (with its debrief and the questions asked) from the application page's Interviews card and the Interviews page, not only from Today; **Didn't happen** is there too once the round's time has passed (#253).

## 1.18.12 (2026-11-05)

- Quicker checks: test runs use half the CPU threads by default (up from a quarter), and CONTRIBUTING lists the changes that can skip the browser tests, which test a production build (#243).

## 1.18.11 (2026-11-05)

- Translation helpers for adding a language with AI agents, a string file at a time: scripts in scripts/i18n/translate/ and translate, review and re-review workflows for Claude Code; the guide on adding a language points to them (#242).

## 1.18.10 (2026-11-05)

- Translators can add a language a few areas at a time, as a draft that only a dev server shows (?lang=<code> or the language switch); the checks pass with areas missing, and a language needs every area once it's switched on. The guide's "Translating in parts" has the steps (#237).

## 1.18.9 (2026-11-03)

- On the Applications board, click the recruiter's name on a card to open their page, or the agency's name when the card shows only the agency (#229).

## 1.18.8 (2026-11-03)

- The tagline now leads with No AI: "No AI. No cloud. No account. No tracking." on the social preview card, the README and the website (#227).

## 1.18.7 (2026-11-03)

- A CV attached on a role's or person's page now shows on Documents straight away (#220).

## 1.18.6 (2026-11-03)

- Closing the New agency dialog now clears what you typed, so it opens empty next time (#221).

## 1.18.5 (2026-11-03)

- Deleting a person no longer makes a failed request for their page (#222).

## 1.18.4 (2026-11-03)

- The menu no longer marks a section for an address that only starts like it (such as a mistyped one) (#224).

## 1.18.3 (2026-11-03)

- Closing the New company dialog now clears what you typed, so it opens empty next time (#223).

## 1.18.2 (2026-11-03)

- The demo data (`scripts/seed_demo.py`) now has files, links, a declined and a withdrawn offer, a CV file waiting to be made a version and a document with no versions, each on its timeline as the app records them; the text snapshot (`scripts/i18n/text_snapshot.py`) opens those pages (#218).

## 1.18.1 (2026-11-03)

- Test runs no longer max out the computer: `pnpm test` and `pnpm e2e` use a quarter of the CPU threads (`TEST_WORKERS` changes it), run at the lowest CPU priority, and run one at a time across worktrees (`TEST_LOCK=off` skips the wait) (#217).

## 1.18.0 (2026-11-02)

- **See the rounds in the Sankeys:** a *Show interview rounds* switch on The whole picture and the Applications flow splits Interviewing into the rounds each application reached, so you can follow Round 1 → Round 2 → Rejected. It's off at first and remembered. Restart the tracker and rebuild the frontend to use it (#214).

## 1.17.0 (2026-11-02)

- **Which round rejections came after:** the Rejections tab on Insights now counts every rejection by the last round it came after, by kind (for example "4 of 6 rejections came after a coding task") and by round number, with those before any round on their own. Only rounds that had happened count: a round booked for later, cancelled, waiting for a new time, or marked done after the rejection doesn't. Plain counts, not a pattern. Restart the tracker and rebuild the frontend to see it (#213).

## 1.16.0 (2026-11-02)

- **All your rejection feedback in one place:** a new *Rejections* tab on Insights lists every application with feedback, newest first: company and role, the recruiter, when it was rejected and from which stage, where it is now if it's moved since, and the feedback as you wrote it. The period goes by when it was rejected. Restart the tracker and rebuild the frontend to see it (#212).

## 1.15.0 (2026-11-02)

- **Feedback when you're rejected:** moving an application to Rejected (a board drop, or Move to… on the application page or quick view) asks for any feedback first; it's optional, kept exactly as written, and filled in if you reject it again. Cancel leaves the application where it was. Add, edit or clear it later under *Rejection feedback* on the application page and quick view. Rebuild the frontend after updating (#211).

## 1.14.0 (2026-11-02)

- **Groundwork for rejection feedback:** the API can keep feedback on a rejected application (one per application, editable any time, kept as written), sent with the move to Rejected or saved later with `PUT /applications/{id}/rejection-feedback`, and applications gain `rejection_feedback`. Feedback works with the stage whose id is `rejected`. The dialog and the Insights view come in the next releases. Restarting the tracker runs migration 0017, which only adds an empty column (#209).

## 1.13.0 (2026-11-02)

- **Calls moved, on Insights:** the Recruiter conversations tab counts calls moved to another time and their moves, split by who needed the change, as plain counts. A call waiting for a new time counts as moved, but not as held or booked ahead. Restart the tracker and rebuild the frontend to see it (#208).

## 1.12.0 (2026-11-02)

- **When a call can't go ahead and no new time is agreed yet:** tick *A new time isn't agreed yet* in the call's Reschedule dialog, say who needed the change and why, and add a to-do to book the new time (on by default, due today; it starts open). The call shows *Needs a new time* on the person's page and in Today's *Your move*, with its to-do beside it. *Set new time* books it as one move and ticks the to-do off; Undo, or *Keep the old time*, takes the mark back. Rebuild the frontend after updating (#207).

## 1.11.0 (2026-11-02)

- **Groundwork for calls that need a new time:** the API can mark a call as needing a new time (who and why, the old time kept, an optional to-do to book it, on the application or the person), take the mark back, and books it later as one move; the to-do is ticked off when the call is booked, happens, is cancelled or removed, or its application or person closes. The screens come in the next release. Restart the tracker and rebuild the frontend after updating (#206).

## 1.10.0 (2026-11-02)

- **Reschedule a call:** every booked call has a Reschedule button, on the person's page and on Today (Coming up and How did it go?). Pick the new time, say who needed the change (required) and, if you like, why. A moved call shows Rescheduled, and each move shows on the Timeline with its old and new time, who and why; a call about an application has the move on that application's timeline too. Restart the tracker and rebuild the frontend so the Timeline shows calls' moves (#205).

## 1.9.1 (2026-11-02)

- **The recruiter on every card:** interview and offer rows (Today, Interviews, Offers and a person's page) now name the application's recruiter, linked to their page with the star and ghost, and a direct application's in-house recruiter shows on the board, the list and its company's page. Restart the tracker to see the names on interview and offer rows (#202).

## 1.9.0 (2026-11-02)

- **Calls remember their moves:** changing a booked call's time now records it as a move, with who needed the change and why when they're sent, and a call keeps its length when it moves (moving one later from its Edit form no longer fails). A call with an application gets an entry on that application's timeline. The API takes `reschedule_by` and `reschedule_reason` on `PATCH /meetings/{id}`, and calls gain `rescheduled_count`, `rescheduled_from` and `moves`. Restart the tracker to run migration 0016, which only adds empty columns and a table; the dialog for calls comes in the next release (#201).

## 1.8.2 (2026-11-02)

- **Developers:** the rescheduling text is ready for other languages: the moved count on Insights has its own plural forms, and each timeline move line is one whole sentence a translator can reorder. The English is unchanged (#199).

## 1.8.1 (2026-11-02)

- **See which version you're running:** the bottom of the sidebar shows the app's version, linked to that release on GitHub. If the running server and the page in your browser are different versions, it says so: restart the tracker when the server is older, or refresh the page when the page is older (#200).

## 1.8.0 (2026-11-02)

- **When a round can't go ahead and no new time is agreed yet:** tick *A new time isn't agreed yet* in the Reschedule dialog, say who needed the change and why, and add a to-do to book the new time (on by default, due today; it starts open). The round keeps its old time and shows as *Needs a new time* on Today (in *Your move*, with its to-do), the Interviews page, the board, the list, the quick view and the application page. *Set new time* books it as one move from the old time and ticks the to-do off for you. Undo, or *Keep the old time*, takes the mark back (a to-do you've edited is ticked off rather than deleted). Restart the tracker after updating: until you do, marking a round shows an error and saves nothing (#196).

## 1.7.0 (2026-11-02)

- **Groundwork for rounds that need a new time:** the API can mark an interview round as needing a new time (who needed it and why, the old time kept, an optional to-do to book it) and books it later as one move. A marked round shows a red badge on the board, list, quick view and Interviews, and Insights says how many are waiting. There's nothing in the app to mark one yet: that's the next release. Restarting the tracker runs migration 0015, which only adds three empty columns to interview rounds (#197).

## 1.6.0 (2026-11-02)

- **A Rescheduling block on Insights:** the Applications tab shows how many booked rounds moved, and moves split by who needed the change, with older moves under *Not recorded*. Companies and recruiters show from 3 moved rounds, as plain counts. An application's rounds also say how many days their moves pushed them back or brought them forward in total. Restart the tracker to see them (#195).

## 1.5.0 (2026-11-02)

- **API:** a new `GET /api/v1/insights/rescheduling` counts booked rounds, moved rounds and moves by who needed the change, with raw counts per company and recruiter, and interview rounds gain a `moves` list. Nothing changes in the app yet (#194).

## 1.4.0 (2026-11-01)

- **See every reschedule on the timelines:** a moved round now shows its old time, new time, who needed the change and why, for example *Moved from Tue 3 Nov, 10:00 to Thu 5 Nov, 14:00 · They needed the change · Their manager is away*, on the application timeline, the Timeline page and Today's Recent activity. Moves saved before 1.3.0 keep the text they had. Restart the tracker to see the new lines; nothing breaks before you do (#192).

## 1.3.0 (2026-11-01)

- **Say who needed a reschedule:** rescheduling a round now asks who needed the change (me, them, both of us, neither of us) as well as why, and each move keeps its own old time, new time, who and why on the application's timeline. The Reschedule button is now on the application page, in the quick view (the current round, in an active stage) and on Today, as well as Interviews. On a phone, the Interviews table scrolls sideways so its buttons can be reached. After updating, restart the tracker: until you do, Reschedule fails with an error and saves nothing, though a round's Edit form still works (#191).

## 1.2.48 (2026-11-01)

- **A shorter, friendlier install page:** the [install guide](docs/guide/install.md) now leads with the one path most people need. Updating moved to the [command reference](docs/guide/commands.md#updating-to-a-newer-version), and turning on snapshots and connecting a private remote to [Your data](docs/guide/your-data.md#snapshots-automatic-local-history), which now also says plainly that without git the database is the only copy. On the website, the FAQ answer to "Do I need to be technical?" and the Quick start intro now say what the guide does: uv fetches Python for you (#189).

## 1.2.47 (2026-11-01)

- **Security:** updates undici and zod in the frontend's test and lint tools, fixing five Dependabot alerts and moving past a sixth that had been auto-dismissed. minimatch alert 32 stays open: it affects development tools only, and those tools can't take the fixed version yet. Nothing changes in the app (#190).

## 1.2.46 (2026-11-01)

- **Security:** updates undici and fast-uri in the website's dependencies to fix twelve Dependabot alerts. The website looks and works the same (#186).

## 1.2.45 (2026-11-01)

- **Security:** updates vite and seroval to fix eight Dependabot alerts. Nothing changes in how the app works (#188).

## 1.2.44 (2026-11-01)

- **Security:** updates certifi and opentelemetry-api to fix two Dependabot alerts, one of them critical. The app itself doesn't change (#187).

## 1.2.43 (2026-11-01)

- **Developers:** the API's last uncoded errors gain a `code` and `params` beside the unchanged English `detail`, and validation messages read their text from the translation files by Pydantic's `type`, ready for other languages. Validation responses only gain keys in `ctx`. A few rare validation types stay in Pydantic's English (#181).

## 1.2.42 (2026-11-01)

- **The language switch is easier to spot:** it's now an outlined button with a globe, your current language's name and an arrow, in place of a faint icon. On a phone it shows the globe alone (#182).

## 1.2.41 (2026-11-01)

- **Don't see your language?** The language switch now links to a [guide to adding a language](docs/guide/adding-a-language.md). `scripts/i18n/new_language.mjs` writes a new language's starting files, with every line marked `[TRANSLATE]`, and a test fails until none is left (#180).

## 1.2.40 (2026-11-01)

- **Developers:** a stage that still has its default id and English name now shows translated wherever stages appear, ready for other languages. Renamed and added stages show as written, `config.toml` never changes, and the English is unchanged. The API adds raw stage ids beside its names (#179).

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
