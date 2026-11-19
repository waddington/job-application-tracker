# RFC: the app redesign (concept 11)

Status: concept 11 is picked (2026-11-15); this is the build plan. Building starts once Kai has seen it. The roadmap
tasks are phase P12 in `docs/ROADMAP.yaml`; the decision is in `docs/agents/decisions.md` (*App redesign*).

Kai, 2026-11-12: "redesign the UI of the app to match the new website … perhaps component at a time or page at a time
… i dont much want to change the contents of pages moreso how it looks". Kai, 2026-11-15: "i like 11", then "go for
11. plan it out, create the roadmap items. we'll also need to regenerate screenshots for all
docs/guides/website/social image, etc".

## 1. How we got here

Draft PR #354 (branch `worktree-app-redesign-concepts`, never merged) put the concepts behind a dev-only switch
(`?design=N` on a Vite dev server over demo data). Three rounds:

1. Four looks in the website's style (concept 1i: pastels and plum, Inter and JetBrains Mono). Kai kept **4, Soft
   cards**; 1-3 were "overwhelming and not calm".
2. Variations of 4: one background, full width, a slow drift, three-column Today, a docked panel, and a top bar. Kai
   kept the drift, three columns, the docked panel and the side menu ("on desktop i prefer side menu").
3. 9 (the pick so far), 10 (plus a full-width board) and 11 (plus wider sub-page layouts). **Kai picked 11.**

**The reference implementation** is `?design=11` on #354's dev server: `frontend/src/design/concepts.ts` (the theme
override and the flags), `concepts.css` (everything else, keyed on `<html data-…>`) and `BottomNav.tsx`. It is CSS
laid over today's pages, often through Mantine's class names and `:has()`. The build takes its values (colours,
sizes, timings) and its behaviour, not its selectors: each part is built into the component or page it belongs to.

## 2. The spec

**Look (round 1's 4, Soft cards).**
- Plum as the primary colour: the website's ink `#2a1e3f` in light, its lavender `#c9b8f0` in dark with dark text on it.
  Mantine's dark greys tinted plum (page `#1d1729`, cards `#2d2541`).
- The stage and status pastels, each with an ink to read on it (light), or as light text on a faint wash (dark).
  Coloured text darkened to at least 4.5:1 on the tints.
- Inter for text, JetBrains Mono for small labels: nav group headings and table headers become the website's eyebrow
  (mono capitals after a small square). Light (300-400) display titles.
- Big radii (cards about 34 px, inputs 12-18 px), soft wide shadows, roomy top-level cards; a card that holds cards
  (a board column) is a soft well of the page's tint. Pill buttons; the plum one carries the website's gradient.

**Frame.**
- **The side menu on desktop and tablet.** No top bar.
- **One background on every page** that fades very slowly through five calm tints (light: lilac `#f4f1fb`, butter
  `#fcf8ea`, mint `#eff8f2`, sky `#eef3fb`, apricot `#fcf3ea`; dark: `#17121f`, `#1b1712`, `#111a16`, `#111722`,
  `#1c1510`) over **ten minutes**. The phase comes from the clock (the animation's delay is minus the time into the
  cycle), so changing pages or reloading never restarts it. **Static under reduced motion** (lilac).
- **Pages full width up to a 2,400 px cap**, starting right after the menu (left-aligned, not centred); pages' own
  narrower limits (`maw` 720-1,600) go.

**Panels.** The app's one side drawer, the application panel (`ApplicationDrawer`), **docks**: it slides in under the
header, opaque, with no overlay, and the page (the board included) shrinks to make room rather than being covered. It
opens from Applications (list and board), Today, a company's page and an agency's page. The page behind still scrolls
and takes clicks; picking another item swaps what the panel shows. Phones keep a full-screen overlay. *As built
(#408):* it docks from 992 px; below that, small tablets get the phone's full-screen overlay too, since at 768 px
the page beside the menu and the panel was about 100 px wide (the lead's call; Kai can change it).

**Pages.**
- **Today in three columns** from 1,200 px: Your move, Coming up, Waiting on them. Narrower screens stack as now. *As
  built (#412):* laid out by the page's own width (container queries), since the docked panel takes 440-540 px of
  the window: three columns from 1,200 px of page (about a 1,490 px window), Your move beside the other two from
  880 px, stacked below that. Three at a 1,200 px window left the side columns about 260 px wide, too cramped.
- **The Applications board fills the window** beside the menu (it escapes the cap, a 16 px gutter), its columns
  sharing the width down to **about 180 px** each instead of a fixed 250 px. *As built (#413):* each column is 180
  to 360 px (a few columns stop at 360 rather than stretching across a 4K screen), laid out by the board's own
  width, so beside the docked panel they share what's left; closed-stage columns share like the others. While a
  card is dragged the columns keep their widths, and the closed stages that appear for the drop come in after them
  at 200 px, so nothing shifts under the pointer. Only the board passes the cap: the title and filters keep it, so
  the List/Board switch stays put. The list stays at the 2,400 px cap, on a soft card.
- **Record pages** (an application, company, person, agency or role), from 1,280 px: the main cards flow in two
  columns, the side cards (to-dos, role, people) in a narrow third (about 420 px); an application's summary spans the top.
  *As built (#415, an application and a company; #421, a person, an agency and a role):* one
  `RecordLayout` (`summary`, `main` as one or two columns, `side`), laid out by the page's own width as Today is:
  three columns (the side one 420 px) from 1,280 px of page (about a 1,570 px window, or 2,110 px with the panel
  open), each main column then at least about 400 px; from 760 px the main cards in one column with the side ones
  beside it (at least 320 px), as the old 8:4 grid did; stacked below that. The main cards are split between the two
  columns by hand rather than flowing (CSS columns would move a card across as an autosizing box grows while you
  type). Cards keep their own height and the columns start level; the DOM and Tab order is summary, main, side.
  All five pages use two main columns. A person: calls and meetings | roles mentioned, applications, interviews,
  notes (so stacked, the page keeps its old order) | how to reach them, to-dos, links, files. An agency, as a
  company: its applications | notes, links, files | to-dos, recruiters (on a phone, after the notes, links and
  files, as a company's people are). A role: about it and its application (kept out of the side, where the stage badge
  was cut short) | notes, links | to-dos, files. Only an agency's page opens the quick view of these three.
- **The Roles, Recruiters and Companies lists** at the page's full width (2,400 px cap). *As built (#423):* the
  Companies table on a soft card as the Applications list is (16 px padding), at least 560 px wide so on a phone it
  scrolls sideways inside the card; the Roles list was already one card. The recruiters' tiles are laid out by the
  list's own width (a container grid), a column for about every 280 px up to six: 4 at a 1,440 px window as before,
  5 at 1,920, 6 at 2,560, rather than four ever-wider tiles. The Roles and Recruiters views scroll sideways in their
  own row when they don't fit (Roles at 375 px, Recruiters in Chinese), so the page never does
  (`fix-phone-sideways-scroll`, `fix-phone-recruiters-views-cut`). What each list shows, filters and sorts is unchanged.
- **Notes** as a grid of note cards (notes still open in their editor dialog). **Documents**: the CV files and each
  document as cards side by side. **Interviews**: the calendar with "still to book" beside it; the list view's cards
  side by side. Offers stays one comparison table.

**Phones (below 768 px).** A glass bottom bar of four tabs (Today, Applications, Interviews, Notes) plus **More**,
which opens a sheet with the other seven pages as an icon grid. It replaces the slide-out menu and its burger. Panels
stay full-screen overlays.

The sidebar's footer (whether the app is connected, *Download a backup*, the version and the version-mismatch
warning) is behind the burger on a phone today, so with the burger gone it moves to **the bottom of the More sheet**.
That's the default chosen for this plan (the concept hid the footer on phones); Kai can change it.

## 3. How it lands

- **No feature flag and no switch.** Each PR changes the real theme, layout and components on `main`; the dev-only
  concept switch never leaves #354's branch. When the build is done, #354 is closed and its branch, worktree and
  servers removed.
- **Small PRs that each work alone** (about 500 changed lines), in the order below. Every PR leaves the app
  consistent: the theme lands for every page at once (no page half old, half new), and later PRs change layout one
  area at a time on top of it.
- Each PR: light and dark; English and zh-CN checked; a demo URL for the reviewer; the full checks including
  `pnpm e2e`; every guide passage that describes what it changes updated in the same PR (§4, *The guide rule*). The
  first PR (#382) also went to Kai with before-and-after screenshots; since 2026-11-15 Kai doesn't approve these PRs'
  screenshots, and the review cycle is enough (`docs/agents/working-with-kai.md`). Images that get applied (§5) still
  go to Kai first.
- **Versions:** each PR is a patch (it changes how the app looks and is laid out, adds no capability and breaks
  nothing). The bottom bar and docked panel change how you get around but not what you can do. If a PR turns out to
  remove something someone relies on, it's a major and needs Kai's yes.

## 4. The PRs, in order

| # | Task | What | Touches | Guide (`using-the-app.md`) |
|---|---|---|---|---|
| 1 | `app-redesign-theme` | Fonts (as runtime dependencies), plum palette, tinted dark greys, stage pastels and their inks, radii, shadows, pill buttons, mono eyebrow labels (nav group headings and table headers), soft cards; light and dark tokens | `frontend/src/theme.ts`, `theme.module.css`, a new `tokens.css`, `main.tsx`, `package.json`; stage colour helpers | none expected (colour names, if any) |
| 2 | `app-redesign-shell` | Side menu styling, header, page titles, one background and the drift, the 2,400 px cap, left-aligned | `components/Layout.tsx` (AppShell), a page wrapper replacing each page's `<Stack maw=…>` | the sidebar (top of the page), *Language* (the header's buttons) |
| 3 | `app-redesign-components` | Cards and wells, stage badges and the stage bar, buttons, lists | shared components in `components/` | none expected |
| 4 | `app-redesign-forms` | Modals, forms, tables, empty states and skeletons | modals, `theme.ts` component defaults | none expected |
| 5 | `app-redesign-dock` | The docked panel on all four pages that open it (Applications list and board, Today, a company, an agency), and the browser tests that find the panel | `ApplicationDrawer.tsx` → a `DockedPanel`; `ApplicationsPage`, `TodayPage`, `CompanyPage`, `AgencyPage`; Layout makes room; `frontend/e2e/` | the quick view wherever Applications, Today, Companies and agencies mention it |
| 6 | `app-redesign-today` | Three columns | `pages/TodayPage.tsx`, `TodayPage.module.css` | *Today*: where the three groups sit |
| 7 | `app-redesign-applications` | The list, and the full-width board with ~180 px columns | `pages/ApplicationsPage.tsx`, `components/Board.tsx` | *Applications: list and board* if it describes widths |
| 8 | `app-redesign-records` | The shared two-plus-one record layout, on an application's and a company's page | a record layout component; `ApplicationPage`, `CompanyPage` | *An application's page*, *Companies* |
| 9 | `app-redesign-records-people` | The same layout on a person's, an agency's and a role's page | `PersonPage`, `AgencyPage`, `RolePage` | *People, recruiters and agencies*, *Roles to decide* |
| 10 | `app-redesign-people` | The list pages: Roles, Recruiters, Companies | those pages | none expected |
| 11 | `app-redesign-schedule` | Interviews (calendar beside still to book, list cards), Offers, Timeline | those pages, `InterviewCalendar` | *Interviews*: "Under the calendar, Still to book" becomes beside it, and where the day panel goes |
| 12 | `app-redesign-rest` | Notes grid, Documents cards, Insights' charts in the palette, Search | those pages, chart colours | *Notes*, *Documents* if they describe the layout |
| 13 | `app-redesign-phone-nav` | The bottom bar and More sheet, with the sidebar's footer at the bottom of the sheet | `Layout.tsx`, a `BottomNav` component, `nav.ts`, locales | the sidebar's footer ("behind the menu button on a phone" becomes "under More") and the tour's mention of the sidebar on a phone |
| 14 | `app-redesign-dark` | A dark-mode and contrast pass over every page | wherever it finds | *Dark mode* if anything changes |
| 15 | `app-redesign-docs` | README screenshots, both languages | `docs/screenshots/`, `docs/screenshots/zh-CN/` | none (the guide has no images) |
| 16 | `app-redesign-gif-card` | The demo GIFs, the social card and the app's icons | `scripts/demo_gif/`, `scripts/social_preview/`, `docs/social-preview.png`, `frontend/public/favicon.svg`, `apple-touch-icon.png` | none |
| 17 | `app-redesign-website-shots` | The website's captures | `website/src/assets/{hero,demo,story}/`, `AppDemo.astro` overlays | none |
| 18 | `app-redesign-wrap-up` | Close #354, remove its branch and worktree; mark this RFC built | docs only | none |

**The guide rule.** Every PR updates the guide passages that describe what it changes, checked against the code. The
last column comes from searching the guide for layout words (sidebar, menu, beside, under, column, panel, quick view,
on a phone, wide screen); each task searches again when it runs, since the guide changes in between.

Rows 6-8 and 10-12 depend on 4 or 5 only (9 follows 8), not on each other, so they can run in parallel worktrees if Kai allows parallel
builders; they merge one at a time.

## 5. Images

Every image is retaken from the demo data (`scripts/seed_demo.py`, fictional), in light mode unless it says otherwise,
and **shown to Kai before it's applied** (Kai: "i want to see the new gif(s) before you apply them"). Restart the demo
app after a release, or every capture shows the version warning (gotchas.md).

- **README** (`app-redesign-docs`): the 18 screenshots in `docs/screenshots/` and their 17 Chinese twins in
  `docs/screenshots/zh-CN/` (`language-menu.png` is shared and also retaken). `tests/test_readme_parity.py` checks the
  two READMEs reference matching images. The website's build (`website/scripts/sync.mjs`) copies `overview.png` to its
  `public/screenshot.png`, the structured data's screenshot, so the new one reaches the site at its next build. The
  guide (`docs/guide/`) has no images today, and `llms.txt` only links the README, so neither needs new pictures; check
  again when the task runs. The README's feature table and `llms.txt` were checked for this plan: they describe what
  the app does, not how it looks, and need no change.
- **Demo GIF, social card and icons** (`app-redesign-gif-card`): `scripts/demo_gif/make_demo_gif.py` builds `demo.gif`
  and `--lang zh-CN` its twin from the new screenshots; `scripts/social_preview/make_card.py` builds
  `docs/social-preview.png` from `insights.png`. Both templates are in the old indigo (`card.html`: `#3b4fd8`,
  `#2d3aa6`, `#4c6ef5`; `scene.html`: `#4c6ef5`, `#dbe4ff`) and move to the plum palette. So do the app's icons,
  `frontend/public/favicon.svg` (`#4c6ef5`) and `apple-touch-icon.png`. `sync.mjs` copies the card to the website's
  `og.png` and both icons to its `public/`; Kai uploads the card to GitHub's settings by hand. The restyled templates
  and icons are shown to Kai too.
- **Website** (`app-redesign-website-shots`): `website/src/assets/hero/` (`today-light.png`, `today-zh-light.png`),
  `demo/` (today, board, role, insights, chrome) and `story/` (recruiters, interviews, offers, notes). The hero demo
  (`AppDemo.astro`) places HTML overlays at pixel positions on the app's screenshots, so each overlay is re-checked
  against the new layout; `Features.astro` uses `hero/today-light.png` and `demo/insights.png` from the same folders.
  A website PR runs `tools/dev/checks.sh --website`.
- `readme-visuals` (backlog) waits for these.

## 6. Text and languages

- New UI text: only `nav.more` ("More"; zh-CN 更多), which also labels the More sheet. The sidebar's footer in the
  More sheet reuses its existing strings. The docked panel may need a close button's
  label if it loses Mantine's; reuse the existing one where it can. Each PR adds its zh-CN text in step, following
  `docs/i18n/zh-CN.md`.
- Chinese text runs in the system's CJK fonts after Inter (the stack keeps the CJK fallbacks), checked per PR in
  `chinese.spec.ts` and on the zh-CN demo. Mono eyebrows in Chinese fall back to the CJK sans; letter-spacing for
  capitals doesn't apply to Chinese, so it's set for Latin text only.

## 7. Browser tests at risk

Read from `frontend/e2e/` (viewport 1,400 × 1,000 by default):

- **The board** (`board.spec.ts`): most tests run at 3,800 px so every column fits, and drag by bounding boxes. With
  columns that share the width, the boxes move but the tests should hold. The edge-scroll test at 1,400 px ("the board
  scrolls while dragging") needs a column off-screen: at 180 px columns more fit, so the test may need more columns
  (rounds on) or a narrower window.
- **The panel** (`board.spec.ts`, `today.spec.ts`, `companies.spec.ts`, `applications-list.spec.ts` and others): they
  find it as `getByRole("dialog")` and close it with Escape. The docked panel stays a labelled, non-modal dialog
  (`aria-modal` false) so those selectors hold, and Escape still closes it while focus is inside. New tests: the page
  makes room (the panel covers no row), another row swaps the panel, and on a phone it's still an overlay.
- **The phone menu** (`shell.spec.ts`, "phone width"): tests the burger ("Toggle navigation") and the slide-out menu.
  Rewritten for the bottom bar and More. The known-bug test `fix-phone-header-overflow` (a `test.fail`) may start
  passing, which fails the run: then the bug is fixed, the mark comes off and the roadmap bug is closed. The footer's
  tests move to the More sheet.
- **Phone sideways scroll** (`shell.spec.ts`, "doesn't scroll sideways"): a `test.fail` for Roles and Companies, the
  known bug `fix-phone-sideways-scroll`. The frame (full width, page wrapper) or the list pages' restyle
  (`app-redesign-people`) may fix it in passing; the same rule applies: take the mark off and close the bug.
- **Mantine class selectors** (`.mantine-Card-root`, `.mantine-Badge-root`, `.mantine-Modal-content`,
  `.mantine-SegmentedControl-root`): they hold while the build keeps Mantine's components, restyled rather than replaced.
- **Layout-dependent checks**: `toBeInViewport` in the shell tests, the Today groups by `#your-move`, and
  `reschedule.spec.ts`'s scroll area. Three columns and wider pages change what's in view.
- The unit test `theme.test.tsx` checks the theme; it changes with row 1 (`app-redesign-theme`).

## 8. Accessibility

- **Docked panel focus.** Opening moves focus to the panel's heading; closing returns it to the row or card that
  opened it. No focus trap (the page stays usable), so Tab moves from the panel back into the page in order; the
  panel follows the main content in the DOM. Escape closes it from inside. Swapping the shown application announces
  the new heading (focus moves to it).
- **Reduced motion.** The drift is off (one static lilac, or plum night in dark) under `prefers-reduced-motion:
  reduce`; so is the panel's slide and the page making room (instant).
- **Contrast.** Text on every drift tint and on each pastel is checked at 4.5:1 (3:1 for large text and UI parts) in
  light and dark, across the whole cycle (the tints are close, the check covers the lightest and darkest). The
  concepts already darkened coloured text; row 14 (`app-redesign-dark`) audits every page. Focus rings stay visible on the plum buttons and
  on tinted wells.
- The bottom bar: real buttons with `aria-current` for the page you're on, the More sheet a labelled dialog that
  closes with Escape and returns focus to More.

## 9. Risks

- **Size.** The record layout is already split in two (§4: the layout with an application and a company, then the
  other three). The dock isn't: `ApplicationDrawer` is one component shared by four pages, so docking it on some
  and not others would leave pages overlaying in between, against §3. It lands everywhere at once with its browser
  tests, and may go over 500 lines; its PR says why. The theme may also pass 500 lines; split it if so (e.g. the
  dark tokens apart from the light).
- **The concepts are overrides.** Their `:has()` and Mantine class selectors work over today's DOM; porting them as
  they are would be fragile. Each part goes into its component.
- **The docked panel** changes behaviour on four pages: focus, scroll lock, clicks outside. Data is unaffected, but
  the board's drag and drop runs beside it and needs testing with the panel open.
- **Performance.** An animated custom property (`@property --c-page`) repaints the background; the concepts were
  smooth, but check CPU on a long session (Kai's tracker is open all day). If it costs, step it (a change a minute).
- **Fonts** become runtime dependencies (`@fontsource-variable/inter`, `@fontsource-variable/jetbrains-mono`), bundled,
  never fetched from the web. They add to the build's size.
- **Screenshots and the website's hero overlays** drift out of step until §4's rows 15-17 land; the README says "version
  1.0" only, so text doesn't go stale.
- **zh-CN layouts** (longer or shorter labels in three columns and 180 px board columns).

## 10. Out of scope

- What a page holds or does: no new features, no removed fields, no changed flows (Kai: "i dont much want to change
  the contents of pages"). Notes keep their editor dialog; Offers keeps its table.
- A top bar on desktop, concepts 1-3, per-area page tints, glass beyond the phone's bar.
- The website (already redesigned), except retaking its captures.
- A settings page (there is none; settings stay in `config.toml`).
- A theme switch between old and new looks.
