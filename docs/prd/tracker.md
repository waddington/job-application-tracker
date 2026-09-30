# PRD: Job application tracker

| | |
|---|---|
| **Status** | Draft (rev 2: open questions answered 2026-09-30) |
| **Owner** | lead |
| **Date** | 2026-09-30 |
| **Roadmap** | P1–P6 in [docs/ROADMAP.yaml](../ROADMAP.yaml) |
| **Source idea** | Kai's request, 2026-09-30 |
| **RFC** | [docs/rfc/stack.md](../rfc/stack.md) |

> The app never contacts anyone, never sends email and never fetches job data from the web.
> All data comes from Kai, or from Claude looking things up and filling them in when Kai asks.
> This repo is public: Kai's data never enters it.

## 1. Problem and motivation

Kai is a software engineer applying for jobs directly and through recruiters. One recruiter
often has several roles. Each application goes through its own stages (screen, tech
interview, coding task, final, offer), and the details are scattered across email,
recruiter calls, Google Docs, PDFs and memory. Kai can't easily see:

- the overall state of the search, and how applications turn into interviews and offers;
- which applications have gone quiet and need chasing;
- which CV and cover letter went to which company;
- everything known about one recruiter, role or interview in one place.

Existing tools don't fit. JobSync (self-hosted, MIT) is closest but has no configurable
workflow, stores little besides CVs, and centres on searching for jobs, which Kai doesn't
want. The Obsidian plugins work on plain files but aren't a web app and have no real workflow.

## 2. Users and jobs to be done

- **Kai** uses it daily: logs what happened, checks what to chase, and prepares for
  interviews.
- **Claude** fills in data when Kai asks (for example company details, or notes from a
  pasted email) and builds the app.

## 3. Goals

- **G1:** One place for every application, role, recruiter, contact, interview, note and
  document.
- **G2:** A clear view of progress: a list, a board and a Sankey diagram of the funnel.
- **G3:** Nothing goes quiet unnoticed. A Next actions page shows what to chase and what's
  coming up.
- **G4:** Kai's data stays private, local, easy to back up and readable without the app.

## 4. Non-goals

- Searching for jobs, scraping, job-board imports or any external job feed.
- Quick-add from a pasted URL, and an MCP server (Kai, 2026-09-30).
- Sending email or messages, or submitting applications.
- Multi-user use, authentication, hosting or cloud sync. It is one person on localhost.
- Obsidian integration. This is a standalone web app.

## 5. User stories

- **US1:** As Kai, I add a recruiter from a fictional agency ("Northwind Talent"), with their
  phone, email and LinkedIn, and then log three roles they sent me.
- **US2:** As Kai, I record that I applied to "Contoso" directly *and* that a recruiter
  later offered me the same role, and get warned about a duplicate submission.
- **US3:** As Kai, I move an application from Screen to Tech interview. The change is
  timestamped, and the timeline shows every stage it has been through.
- **US4:** As Kai, I filter the applications list by stage, recruiter, company, source
  (direct or recruiter), tag and "no activity in 7+ days".
- **US5:** As Kai, I open Next actions each morning and see: chase Contoso (applied 9 days
  ago, no reply), a coding task due Friday, an interview tomorrow at 14:00, and a
  recruiter follow-up I snoozed until today.
- **US6:** As Kai, I attach a coding-interview brief (a PDF plus a repo link, deadline and
  instructions) to an application and write notes against it.
- **US7:** As Kai, I record that "CV v3 (backend)" and a tailored cover letter went to
  Contoso, and later see every application that used CV v3.
- **US8:** As Kai, I write Markdown notes on a recruiter, a role, a call or an interview, or
  a general note, and link Google Docs alongside them.
- **US9:** As Kai, I drop an exported `.eml` into an application. Its date, sender and
  subject go onto the application's timeline.
- **US10:** As Kai, I look at a Sankey diagram (applications → screens → interviews →
  offers, with the rejections, withdrawals and ghostings leaving at each step) and see how
  direct and recruiter-sourced applications compare.

## 6. Functional requirements

### Data model
- **FR1:** Entities are companies, recruitment agencies, contacts (recruiters, hiring
  managers, interviewers), roles, applications, interviews, notes, documents and
  attachments.
- **FR2:** A **role** is a job at a company. An **application** is Kai pursuing a role
  through one **route**: direct, or through a given recruiter or agency. A recruiter can
  have many roles and applications.
- **FR3:** Contacts hold several contact details: emails, phones, LinkedIn and other links,
  each with a label. An application can link several contacts, each with a role in it
  (recruiter, hiring manager, interviewer).
- **FR4:** Roles have optional pay and terms: salary range and currency, or day rate with
  IR35 status for contracts; location; remote, hybrid or office; employment type.
- **FR5:** Creating a second application for the same company and role (or a close title
  match at the same company) shows a duplicate-submission warning.

### Workflow
- **FR6:** Stages and allowed transitions are configurable, with a sensible default:
  Interested → Applied → Screen → Interviewing → Final → Offer → Accepted. Declined,
  Rejected, Withdrawn and Ghosted are terminal and reachable from any active stage.
- **FR7:** Every stage change is stored as a timestamped event with an optional note. Stage
  history is never lost. Undo appends a correcting event rather than deleting one.
- **FR8:** Timeline events can also be manual (a call, an email, a note), attached files
  and imported emails.

### Interviews
- **FR9:** An interview has a type (screen, technical, coding task, system design,
  behavioural, final), date and time or deadline, format and location or link,
  interviewers, prep notes, debrief notes and questions asked.
- **FR10:** Coding interviews and take-home tasks also hold instructions, repo or platform
  links, a deadline and attachments.

### Notes, documents and attachments
- **FR11:** Notes are Markdown, rendered in the app, and belong to a recruiter, contact,
  company, role, application, interview, or none (a general note).
- **FR12:** Any entity can hold external links, such as Google Docs, with a title.
- **FR13:** Attachments (PDF, `.eml`, images, anything) are stored in the data directory and
  linked to an entity. `.eml` files have their date, from, to and subject extracted.
- **FR14:** CVs and cover letters are versioned documents. An application records which
  versions were sent, and each document shows where it was used.

### Views
- **FR15:** An applications list with sorting and filtering by stage, source, recruiter,
  company, tag, date range and days since last activity, plus text search.
- **FR16:** A board view of applications in stage columns. Moving a card applies a
  transition, and only allowed moves are possible.
- **FR17:** Detail pages for applications, roles, companies, recruiters and agencies, and
  contacts. The recruiter page lists all their roles and applications, with contact
  details and notes.
- **FR18:** A Next actions page showing: applications past a per-stage staleness threshold
  (configurable, e.g. Applied 7 days, post-interview 5 days); follow-up dates that are due,
  with snooze; upcoming interviews and task deadlines; offer deadlines. Stale applications
  can be marked Ghosted in one click.
- **FR19:** A Sankey diagram of stage flows built from event history, filterable by date
  range and source.
- **FR20:** Stats: conversion per stage, median time in stage, direct vs recruiter
  outcomes, a recruiter scorecard (roles sent, interview rate, responsiveness), and
  weekly activity.

### Data and operations
- **FR21:** All data lives in one directory set by config or an environment variable,
  default `~/Documents/Projects/job-application-tracker-data`. Copying that directory is a
  complete backup, and the app can export a single archive.
- **FR22:** The data is readable without the app: open formats, with attachments as normal
  files.
- **FR23:** Every action is available through a local JSON API, so Claude can fill in data
  when Kai asks. There is no MCP server.
- **FR24:** The app runs as a single terminal process on localhost with no installed
  services.

## 7. UX

- Navigation: Next actions (home), Applications (list and board), Recruiters, Companies,
  Interviews, Documents, Notes, Insights.
- Desktop first, but usable on a phone-width window. Light and dark themes.
- Keyboard-friendly: `/` focuses search, and there are shortcuts for changing stage and
  adding a note.

## 8. Success metrics

| # | Metric | Target | How measured |
|---|---|---|---|
| M1 | Kai uses it rather than ad-hoc notes | All active applications are in it within a week | Kai's judgement |
| M2 | Nothing goes quiet unnoticed | 0 applications past their staleness threshold that are neither chased nor snoozed | Next actions page |
| M3 | Backup works | Restoring a copied data directory gives an identical app state | Automated test |
| M4 | No personal data in git | 0 incidents | Review before every commit |

## 9. Risks and mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Personal data committed to the public repo | Low | High | Data directory outside the repo; fake fixtures only; diff check before commit |
| Workflow too rigid for odd processes | Medium | Medium | Configurable stages; manual timeline events; notes |
| Data loss | Low | High | Append-only event history; single-directory backup; export archive |
| Scope creep before the core works | Medium | Medium | Phased roadmap; the core (P1–P4) comes before insights and extras |

## 10. Ethics and privacy

The app stores data about third parties (recruiters, interviewers): names and contact
details Kai gives it. It stays on Kai's machine, is never published, and is used only for
Kai's own job search.

## 11. Dependencies

None yet. The stack and data format are chosen in the stack RFC (`stack-rfc`), which Kai
signs off before any runtime dependency is added.

## 12. Milestones and estimates

| # | Milestone | Scope | Estimate (agent h) |
|---|---|---|---:|
| P0 | Foundations | PM dashboard, stack and data-format RFC, Kai's sign-off | 8 |
| P1 | Core data and workflow | Data directory, schema, workflow engine, JSON API, app shell | 14 |
| P2 | Tracking views | List and filters, board, detail pages, recruiters, duplicate warning | 14 |
| P3 | Notes, documents and interviews | Markdown notes, links, attachments, `.eml`, CV and cover-letter versions, interviews and coding tasks | 14 |
| P4 | Next actions | Staleness rules, follow-ups, snooze, upcoming items, Ghosted | 6 |
| P5 | Insights | Sankey, funnel stats, recruiter scorecard, weekly activity | 9 |
| P6 | Extras | Offer comparison, `.ics` export, backup archive, full-text search | 8 |

Total is about 73 agent hours. P0 can start now. P1 onwards waits for the stack sign-off.

## 13. Open questions

1. **Contract roles:** do you want contract fields (day rate, IR35)? *Default: yes, as
   optional fields on a role.*
2. **Data format:** *Answered (Kai, 2026-09-30):* SQLite for records, Markdown files for
   notes, plain files for attachments, with a JSONL export for backups. See the
   [RFC](../rfc/stack.md).
3. **Backup:** *Answered:* the data directory is a private git repo. The app auto-commits
   snapshots, and pushes when Kai asks.
4. **Version 1 scope:** *Default: P1–P4 is version 1, with P5 and P6 following.*
