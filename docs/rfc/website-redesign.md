# Website redesign: design language and five concepts

Status: concepts on a dev server for Kai to pick from (draft PR, not to be merged). Kai, 2026-11-12: "redesign the
static page website … liquid glass things, clean, big graphics, movement, 3d, rounded edges … give me a new website
mockup locally (DO NOT MERGE IT) … a toggle/selector to choose from 5 concepts and we'll refine from there", and "i
quite like the 3d motion graphic of the phone with their app on it, perhaps we can do something similar with a web
browser". The reference Kai named is a fintech company's UK landing page and its blog.

We borrow a **way of designing**, not a brand: no logo, wording, photography, fonts, colours-as-a-set or illustrations
of theirs. Everything below is restated as our own rules, applied to our product (a private, local-first job tracker).

## 1. What the reference does (decomposed)

Read from screenshots of the landing page (desktop, top to bottom) and a blog post.

| # | Section | What it is |
|---|---|---|
| 1 | Hero | Full-viewport, dark-to-warm gradient field made of tiny **plus-shaped dots** (a halftone grid). A large **3D phone** floats centre-right and **turns on scroll** (front → side → back), its screen showing the real app. Headline top-left: two short lines, very light weight, ~54 px. A tiny mono uppercase eyebrow with a square bullet above it. One pill button. |
| 2 | Statement | White. Eyebrow left, one long paragraph right, in the same light display face at ~28 px. Lots of air. |
| 3 | Two cards | Two tall rounded media cards side by side (8 px gutter, ~32 px radius): one a 3D phone over a blurred photo, one the dot-motif shaping a map. A short title and two lines of copy sit at the bottom-left of each, on the image. |
| 4 | Big panel | Full-width rounded panel, dark, headline top-left, a photograph filling the right two thirds. |
| 5 | Centre line | Two centred lines of display type on white, nothing else. |
| 6 | Sticky feature | Left column sticky copy (eyebrow, heading, grey sub-line). Right: a huge rounded media panel with a **glass segmented control** floating at its top (three tabs), the phone filmed close, its screen text animating in word by word. |
| 7 | Closing panel | Rounded photo panel, headline top-left. |
| 8 | Get it | Cream section, centred headline, two pill buttons, a tilted rounded card (QR code) with a soft, wide shadow. |
| 9 | Footer | A big rounded **espresso-brown** panel inset from the page edges, small type in columns. |
| — | Chrome | Logo in a small rounded bubble top-left; nav as a **floating glass pill group** centred; CTA pill top-right; a small glass square button bottom-right. All stay fixed; their glass tint changes with what's behind them. |
| — | Blog | Warm beige gradient page; the article sits in one big rounded cream card; the table of contents is a thin left rail; body text in brown at weight 300. |

## 2. The design language we take from it

1. **Quiet type, loud pictures.** Display type is light (300), large (40–64 px), set in short two-line headlines; body
   300–400. Pictures, motion and colour carry the energy; type never shouts.
2. **The eyebrow.** Every section opens with a tiny monospaced uppercase label after a small filled square: `■ YOUR
   SEARCH, ON YOUR MACHINE`. It's the one place mono type appears besides code.
3. **Everything is rounded.** Panels 28–40 px radius, inset 8 px from the viewport and from each other, stacked like
   cards. Buttons and nav are full pills. One playful variant: a "speech-bubble" radius with one square corner
   (`40px 40px 40px 0`).
4. **Liquid glass for chrome only.** Nav, buttons, tabs and small floating controls are translucent (white 20–50 %),
   blurred (`backdrop-filter: blur(12–40px) saturate(1.4)`), with a 1 px inner highlight border and a soft sheen
   gradient across the top. Content panels are solid or photographic, never glass, so the glass reads as glass.
5. **One big 3D object per screen.** The hero object turns, tilts and drifts with scroll; inner screens change.
   For us: **a browser window showing the app** (Kai's ask), built live with CSS 3D (`perspective`, `rotateX/Y`,
   layered panes for depth) and real screenshots from `docs/screenshots/` (demo data only). Kai: "it would be good to
   have the browser window moving and also the app being interacted with / changing page etc". So the window is
   never still (a slow idle drift as well as scroll-linked turns), and the app inside it is used: a cursor moves and
   clicks (a press ripple), the sidebar's active item changes, pages slide or cross-fade (Today → board → a role →
   insights), long pages scroll inside the window, and where it's cheap a small piece is rebuilt in HTML so it can
   move for real (a card dragged across board columns, a to-do ticked, a stage badge changing). It plays on a loop
   while in view and pauses when out of view.
6. **A signature texture.** Theirs is a halftone of plus-dots that forms shapes. Ours must be our own: a dot/grid field
   that can draw *our* shapes (a board's columns, a funnel, a calendar), animated subtly.
7. **The page changes colour as you scroll.** Sections don't sit on a fixed background: the page's base tint moves
   (dark → light → warm → dark) as each section takes the screen, so the fixed glass chrome re-tints too.
8. **Sticky storytelling.** Copy pinned on one side while media on the other side advances through states (tabs or
   scroll steps).
9. **Generous air and few words.** One idea per screen; a centred one-line statement between big panels.
10. **A deep, warm closing panel.** The footer is a rounded inset panel in the darkest colour of the palette.
11. **Motion rules.** Scroll-linked, eased, never bouncy; respects `prefers-reduced-motion` (static poses, no
    scroll-jacking); nothing blocks reading; 60 fps on a laptop (transform and opacity only).

## 3. Our content (unchanged in meaning)

The concepts keep the current site's message and facts (`website/src/data.ts`, the README): a self-hosted job
application tracker for software engineers; private (no AI, no cloud, no account, no tracking; data stays on your
computer); the board, Today, recruiters and agencies, interviews and the calendar, offers, insights and Sankey,
notes and files; English and 简体中文; open source (Apache-2.0); install with a few commands. English only in the
concepts; the chosen one gets its zh-CN text when it's built for real (CLAUDE.md *Languages*).

## 4. The five concepts

Each lives at `/concepts/<n>/` with a floating switcher (1–5, plus "Current site") to jump between them. They share
the language above and differ in structure as well as mood (Kai: "the concepts dont just have to be colour related"):

| # | Structure |
|---|---|
| 1 Espresso | The classic long-scroll story, closest to the reference: a pinned hero where the browser turns, sticky copy beside advancing media, big rounded panels, centred one-line statements between. |
| 2 Liquid | Immersive: the browser grows to fill the screen and the tour happens inside the app; scroll drives it from page to page with glass captions over it, then it shrinks back out for quick start and the footer. |
| 3 Paper | An editorial magazine: numbered chapters, an asymmetric grid with big numerals and pull quotes, a sticky contents rail on the left; the stack of windows fans out between chapters. |
| 4 Night shift | A journey spine: the page is the job search itself, a glowing pipeline (Interested → Applied → Screen → Interview → Offer) running down it, each stage a chapter showing the app at that moment, with a fixed stage tracker. |
| 5 Bubbles | A bento playground: after the hero, a grid of tiles that are each a small interactive demo (tick a to-do, drag a card, flip a stage, star a recruiter, compare offers); section intros read as a chat of questions and answers. |

Mood, palette and how the browser moves:

| # | Name | Mood and palette | The browser | Texture and scroll colour |
|---|---|---|---|---|
| 1 | **Espresso** | Warm and grown-up: near-black, cream, taupe, espresso brown, one copper accent. The closest translation of the reference. | Floats at an angle in the hero; turns on scroll to face you, then swings away showing a second window behind (the app's depth). | Dot field in copper-to-grey that draws a kanban board's columns; black → white → taupe → cream → espresso footer. |
| 2 | **Liquid** | Glass-forward and bright: a slow soft gradient mesh (lilac, sky, peach) behind everything. | Made of glass panes: the window frame is frosted, screenshots sit on separate layers that separate in depth as you scroll (exploded view). | No dots: the mesh itself moves and shifts hue per section. |
| 3 | **Paper** | Calm editorial: off-white paper, ink-brown text, one green accent; lots of white space. | A stack of browser windows like cards that fans out in 3D as you scroll, each a different page of the app. | A faint dot grid like graph paper; white → cream → sand → ink footer. |
| 4 | **Night shift** | Dark and cool: ink blue, teal glow, white type. | A browser over a glowing floor, rotating slowly; its screen cycles board → Today → insights. | Dot particles flowing left to right through the stages, like the Sankey; deep navy → teal → violet → black. |
| 5 | **Bubbles** | Playful: each section a different pastel block with speech-bubble corners; bold yet light type. | A tilted browser that pops and wobbles slightly as you scroll; smaller UI chips (a stage badge, a to-do, a round) orbit it in 3D. | Chunky dots; each section's pastel takes over the page tint as it arrives. |

## 5. After Kai picks

Narrow down in rounds (sub-variations of the favourites), then plan the real change: tokens in `landing.css`, the
components reworked, zh-CN parity, performance and accessibility checks, screenshots before and after. If the live
3D browser is too heavy on phones, HyperFrames (Apache-2.0, HTML to MP4) could render the same animation to a video
for small screens; that would be a build-time tool, not a site dependency.

## 6. Round 2 (Kai, 2026-11-12)

Kai's notes on round 1:

- **Espresso** leads ("colours are nice"), but its dot texture is "way too similar to cleo, its too close to a straight
  rip off", and the sticky "whole search" section has "too much scroll jacking that it feels like youve reached the
  end of the page, need more obvious that youre still scrolling down the page".
- **Liquid**: "cool colour scheme … it feels good but the graphics/motion just arent as good".
- **Paper**: "too similar to what we have now". Dropped.
- **Night shift**: "the moving dots feel like data moving through cloud or space/time, an agentic feel which is the
  opposite of what this project is … feels too dark, the motion of the app views not enough". Dropped.
- **Bubbles**: "interesting".

So the signature texture can't be a dot or halftone field at all (rule 6 now reads: no dots). Round 2's variations,
with round 1's 1, 2 and 5 kept in the switcher to compare:

| Page | What changes |
|---|---|
| 1a Espresso: line work | Fine contour lines that draw themselves into our shapes (board columns, a calendar, a funnel); no dots. |
| 1b Espresso: grain and light | No pattern: film grain, soft copper light and frosted glass cards. |
| 1c Espresso: card mosaic | Small rounded application cards in stage colours that tile, stack and move: the motif comes from the app. |
| 2a Liquid: deeper 3D | Same palette; real depth layers, smoother page transitions, a richer cursor, better graphics. |
| 2b Liquid in Espresso's layout | Liquid's palette and glass on Espresso's long-scroll structure. |
| 6 Espresso × Liquid | Kai: "try a new version a cross between espresso and liquid". Espresso's palette and long-scroll story, with Liquid's immersive moment: the browser grows to fill the screen and the tour happens inside the app under glass captions; a slow gradient in copper and cream; no dots; stronger motion than round 1's Liquid. |
| 5a Bubbles: calmer | Softer pastels, better motion. |
| 5b Bubbles in espresso | The bento playground in Espresso's warm palette. |

Every Espresso variation also fixes the sticky section: shorter, with a visible progress line, and the next section
peeking in below so it's clear the page goes on.

## 7. Round 3 (Kai, 2026-11-12)

Kai's notes on round 2: 1a's line board "is very cool, it would be cool if the outlines were more like what the app
looked like", but not "the moving lines in the hero", and "the colour scheme perhaps feels too dark"; "1b and 1c are
better, drop 1a"; "from espresso i like the header from 1c and [1b's frosted glass board], perhaps all of 1b except
header"; 2a's "main graphic is scroll jacked for nearly the whole page"; "2b is quite good"; "from bubbles i like 5a";
"dont like 6". Kai narrows from these, shown in this order:

| Page | What it is |
|---|---|
| 1d | 1c's hero (stage-coloured cards drifting behind the browser) with all of 1b below it (grain, copper light, the frosted glass board), the board's cards drawn like the app's real cards, and a slightly lighter palette. |
| 1e | 1d in Liquid's colours (Kai: "for the new espresso cross id also like to see it in the liquid colour scheme"). |
| 2b | Liquid in Espresso's layout, with its caption label and phone search results fixed. |
| 5a | Bubbles, calmer. |

The switcher shows only these now; the other pages stay in the branch.

## 8. Round 4 (Kai, 2026-11-12)

"show me 1e, and 1e in the same colour scheme as 5a". The switcher shows 1e and 1f, the same page in Bubbles 5a's
calmer pastels.

## 9. Round 5 (Kai, 2026-11-12)

Kai picked 1f: "1f but with the screenshots in light mode not dark mode". 1f's app now shows in its light theme
everywhere (the hero window and its live sequence, the Today card, Insights, the sticky section's panels).

## 10. Round 6 (Kai, 2026-11-12)

"now show me a version(s) where the hero animation plays slightly faster to varying degrees. I want to be able to
see different screens sooner". 1g, 1h and 1i are 1f with the hero's app sequence about 1.3, 1.6 and 2 times faster
(mostly shorter holds on each screen, gentler speed-up of the movements); `?speed=` fine-tunes any of them.
