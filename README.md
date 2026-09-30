<div align="center">

# 🎯 Job Application Tracker

**Stop losing track of your job hunt.**
A self-hosted, local-first job application tracker for software engineers, with a recruiter
CRM, interview rounds, duplicate warnings and git-backed backups. Notes, CV tracking and a
*"who should I chase today?"* page are next.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
![Status: early development](https://img.shields.io/badge/status-early%20development-orange)
![Local-first](https://img.shields.io/badge/data-100%25%20local-brightgreen)
![No tracking](https://img.shields.io/badge/telemetry-none-brightgreen)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-blueviolet.svg)](#-contributing)

⭐ **Star the repo to follow along. It's being built in the open, one PR at a time.**

</div>

---

## What is it?

**Job Application Tracker** is an open-source, self-hosted web app for managing a job search.
It runs on your own machine and keeps your data in a folder you control. It's built for the
way tech hiring actually works:

- 🧑‍💼 **Recruiters send you several roles.** Track every recruiter and agency, their contact
  details, and every role they've put you forward for.
- 🔀 **Applications have messy, multi-stage processes.** Screen → tech interview → take-home
  → final → offer. Stages are configurable, and every change is timestamped.
- 📝 **The details are scattered everywhere.** Notes on calls, interviews and roles, Google
  Doc links, PDFs, exported emails, and the exact CV and cover letter you sent: all in one
  place.
- ⏰ **Things go quiet.** A *Next actions* page shows which applications have stalled, what's
  due, and who to chase.

No job-board scraping. No SaaS. No account. **Your job search stays on your disk.**

## 📸 Screenshots

*All names and companies below are made-up demo data (`scripts/seed_demo.py`).*

**Kanban board.** Drag applications between stages, see who's gone quiet (red) and which
interview round each one is at.

![Kanban board of job applications by stage, with interview round badges](docs/screenshots/board.png)

**Application page.** Stage, interview rounds in your own words ("Round 3 · System design
test"), details and the full timestamped history.

![An application page showing three interview rounds](docs/screenshots/application.png)

<table>
<tr>
<td width="50%"><b>Applications list</b> with filters, route, stage, round and staleness<br><img src="docs/screenshots/list.png" width="100%" alt="Applications list with filters"></td>
<td width="50%"><b>Recruiter CRM</b>: agencies, recruiters and every way to reach them<br><img src="docs/screenshots/recruiters.png" width="100%" alt="Recruiters grouped by agency"></td>
</tr>
</table>

## ✨ Features

> 🚧 **Early development, but usable.** Tracking works today: list, board, application pages,
> recruiters, interview rounds, duplicate warnings and git-backed backups. Notes, documents
> and the *Next actions* page are next. Everything marked ✅ is merged and running.

| | Feature | Status |
|---|---|---|
| 📋 | **Applications list** with search (company, role, recruiter) and filters (stage, route, agency, "needs chasing", archived) | ✅ Available |
| 🗂️ | **Kanban board**: drag applications between any stages, with the usual next stages highlighted | ✅ Available |
| 🔁 | **Flexible workflow**: move from any stage to any stage (or switch on Jira-style allowed transitions), full timestamped history and undo | ✅ Available |
| 🧑‍💼 | **Recruiter CRM**: agencies, recruiters, multiple contact details, every role they've sent | ✅ Available |
| ⚠️ | **Duplicate-submission warning**: know before two agencies put you forward for the same job | ✅ Available |
| 📝 | **Markdown notes** on applications, companies, agencies and people, plus general notes: real `.md` files you can edit anywhere | ✅ Available |
| 🔗 | **Links** on applications, companies and agencies: job ads, Google Docs, take-home repos, with icons and default titles | ✅ Available |
| 📎 | **Files and emails**: drop PDFs, images or exported emails (`.eml`) on an application, company or agency; emails land on the timeline at the time they were sent | ✅ Available |
| 📄 | **CV and cover-letter versions**: every tailored version with its file, which one each application got, and where each was used | ✅ Available |
| 💻 | **Interview rounds and coding tasks**: numbered rounds in your own words ("Round 2 · System design test") shown on the board, plus times, interviewers, prep, debrief, questions asked and take-home briefs | ✅ Available |
| ⏰ | **Next actions** (the home page): follow-ups due, applications gone quiet, interviews and deadlines coming up, and rounds waiting for an outcome | ✅ Available |
| 😴 | **One-click chasing**: set a follow-up reminder, snooze, or mark Ghosted straight from Next actions | ✅ Available |
| 📊 | **Sankey diagram** of your funnel: applications → screens → interviews → offers | Planned |
| 📈 | **Insights**: conversion per stage, time in stage, direct vs recruiter, recruiter scorecard | Planned |
| 💷 | **Offer comparison**: salary, bonus, equity, pension, day rate and IR35 for contracts | Planned |
| 🗓️ | **`.ics` export** of interviews for your calendar | Planned |
| 💾 | **Backups built in**: automatic git snapshots of your private data folder, readable JSON Lines export, one-command restore | ✅ Available |

The full plan is in the [product requirements](docs/prd/tracker.md) and the
[roadmap](docs/ROADMAP.yaml).

## 🤔 Why not a spreadsheet, Notion, Huntr or Teal?

| | Spreadsheet or Notion | Hosted trackers (Huntr, Teal, …) | **Job Application Tracker** |
|---|---|---|---|
| Your data stays on your machine | Sometimes | ❌ | ✅ |
| Recruiters with several roles | Manual | Partial | ✅ First-class |
| Real stage workflow and history | ❌ | Partial | ✅ |
| Notes, files, emails and CV versions per application | Messy | Partial | 🚧 Next up |
| "Who do I chase today?" | ❌ | Partial | 🚧 Planned |
| Free and open source | ✅ | ❌ | ✅ Apache-2.0 |

It's also deliberately **not** a job-search engine. There's no scraping and there are no
job-board feeds. It tracks the applications *you* make.

## 🔒 Privacy by design

- Runs on `localhost`. No accounts, no cloud and no telemetry.
- All your data lives in **one directory outside the code**, in open formats you can read
  without the app. Back it up by copying the folder, or keep it in a private git repo.
- The app never sends email, never contacts anyone, and never fetches data from the web.

## 🚀 Getting started

You need Python 3.12+ with [uv](https://docs.astral.sh/uv/), and Node.js 22.12+ with
[pnpm](https://pnpm.io/) to build the web UI.

```bash
git clone https://github.com/waddington/job-application-tracker.git
cd job-application-tracker
uv sync
pnpm --dir frontend install && pnpm --dir frontend build
```

**Try it with demo data** (made-up companies and people):

```bash
uv run python scripts/seed_demo.py /tmp/jat-demo    # needs a new or empty folder
uv run jat --data-dir /tmp/jat-demo serve          # → http://127.0.0.1:8770
```

**Use it for real.** Your data lives in its own folder, outside the code. Make it a private
git repo and the app commits a readable snapshot after each burst of changes, so you have
full history and backups for free.

```bash
mkdir -p ~/job-search-data && git -C ~/job-search-data init
git -C ~/job-search-data remote add origin <your-private-repo-url>   # optional, for jat push
cp .env.example .env        # then set JAT_DATA_DIR=~/job-search-data (or pass --data-dir each time)
uv run jat init
uv run jat serve            # → http://127.0.0.1:8770 (keeps running)
```

Later, from another terminal, `uv run jat push` sends the snapshots to your private remote
(never forced). Run `jat` from the repo root, where it reads `.env`.

The server only listens on `127.0.0.1` by default. `uv run jat --help` lists the other
commands (`export`, `restore`, `snapshot`, `migrate`, `info`).

**Project dashboard.** `python3 -m tools.pm` (→ http://127.0.0.1:8767) shows the roadmap,
progress and live PR status of the build itself. It needs nothing but Python; the
[`gh` CLI](https://cli.github.com/) adds PR status.

## 🗺️ Roadmap

| Phase | What ships |
|---|---|
| **P0** Foundations | Planning, project dashboard, stack decision |
| **P1** Core | Data directory, entities, workflow engine, local JSON API, app shell |
| **P2** Tracking views | List, board, detail pages, recruiters, duplicate warning |
| **P3** Notes and documents | Notes, links, attachments, `.eml`, CV versions, interviews |
| **P4** Next actions | Stale applications, follow-ups, snooze, upcoming items |
| **P5** Insights | Sankey, funnel stats, recruiter scorecard |
| **P6** Extras | Offers, `.ics`, backup archive, full-text search |

## ❓ FAQ

**Is it free?** Yes. It's open source under the Apache-2.0 licence.

**Where is my data stored?** In a single directory on your own machine that you choose, kept
separate from the code. Nothing is uploaded anywhere.

**Does it scrape LinkedIn or job boards?** No. By design, it tracks the applications you
make and doesn't search for jobs.

**Can I use it for non-software jobs?** Yes. It's built with tech hiring in mind (recruiters,
coding interviews, take-home tasks), but the workflow is configurable.

**What format is my data in?** A SQLite database for speed, plus a plain-text export
(one JSON Lines file per table) that's committed to your data repo. You can read it, diff it,
and rebuild the database from it with `jat restore`.

**Can I track which interview round I'm at?** Yes. Each application has numbered rounds
with your own description ("Round 2 · Engineering manager chat", "Round 3 · System design
test"), and the board shows the current one.

**Does it work offline?** Yes. It's a local web app with no external services.

**Is it multi-user?** No. It's a personal tool for one job seeker, running on localhost.

## 🤝 Contributing

Issues, ideas and PRs are welcome. The roadmap in [`docs/ROADMAP.yaml`](docs/ROADMAP.yaml)
shows what's next, and [`docs/planning/README.md`](docs/planning/README.md) explains how work is
planned. Please use made-up data in issues, tests and screenshots.

If this looks useful, **⭐ star the repo**. It helps other job seekers find it.

## 📜 License

[Apache-2.0](LICENSE) © 2026 Kai Waddington. If you redistribute this project or build on
it, please keep the [NOTICE](NOTICE) file crediting the original author.
