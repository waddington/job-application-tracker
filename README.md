<div align="center">

# 🎯 Job Application Tracker

**Stop losing track of your job hunt.**
A self-hosted, local-first job application tracker for software engineers, with recruiter
CRM, interview notes, CV tracking and a *"who should I chase today?"* page.

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

## ✨ Features

> 🚧 **Early development.** The core is built (data model, workflow, backups, applications list) and the rest is under way. Here's what's
> coming, in order.

| | Feature | Status |
|---|---|---|
| 📋 | **Applications list** with filters (stage, source, recruiter, company, tags, "no activity in 7+ days") | ✅ Available |
| 🗂️ | **Kanban board**: drag applications between stages, with only valid moves allowed | ✅ Available |
| 🔁 | **Configurable workflow**: your stages, your transitions, full timestamped history | ✅ Available |
| 🧑‍💼 | **Recruiter CRM**: agencies, recruiters, multiple contact details, every role they've sent | ✅ Available |
| ⚠️ | **Duplicate-submission warning**: know before two agencies put you forward for the same job | ✅ Available |
| 📝 | **Markdown notes** on recruiters, roles, calls and interviews, plus general notes | Planned |
| 📎 | **Attachments and links**: PDFs, Google Docs, exported emails (`.eml`) added to the timeline | Planned |
| 📄 | **CV and cover-letter versions**: see exactly what you sent where | Planned |
| 💻 | **Interview rounds and coding tasks**: numbered rounds in your own words ("Round 2 · System design test") shown on the board, plus times, interviewers, prep, debrief, questions asked and take-home briefs | ✅ Available |
| ⏰ | **Next actions**: stale applications, follow-ups, snooze, upcoming interviews, offer deadlines | Planned |
| 📊 | **Sankey diagram** of your funnel: applications → screens → interviews → offers | Planned |
| 📈 | **Insights**: conversion per stage, time in stage, direct vs recruiter, recruiter scorecard | Planned |
| 💷 | **Offer comparison**: salary, bonus, equity, pension, day rate and IR35 for contracts | Planned |
| 🗓️ | **`.ics` export** of interviews for your calendar | Planned |
| 💾 | **Backups built in**: automatic git snapshots of your private data folder, readable JSONL + Markdown, one-command restore | ✅ Available |

The full plan is in the [product requirements](docs/prd/tracker.md) and the
[roadmap](docs/ROADMAP.yaml).

## 🤔 Why not a spreadsheet, Notion, Huntr or Teal?

| | Spreadsheet or Notion | Hosted trackers (Huntr, Teal, …) | **Job Application Tracker** |
|---|---|---|---|
| Your data stays on your machine | Sometimes | ❌ | ✅ |
| Recruiters with several roles | Manual | Partial | ✅ First-class |
| Real stage workflow and history | ❌ | Partial | ✅ |
| Notes, files, emails and CV versions per application | Messy | Partial | ✅ |
| "Who do I chase today?" | ❌ | Partial | ✅ |
| Free and open source | ✅ | ❌ | ✅ Apache-2.0 |

It's also deliberately **not** a job-search engine. There's no scraping and there are no
job-board feeds. It tracks the applications *you* make.

## 🔒 Privacy by design

- Runs on `localhost`. No accounts, no cloud and no telemetry.
- All your data lives in **one directory outside the code**, in open formats you can read
  without the app. Back it up by copying the folder, or keep it in a private git repo.
- The app never sends email, never contacts anyone, and never fetches data from the web.

## 🚀 Getting started

The tracker itself is still being built. What you can run today is the **project dashboard**
used to build it in the open (roadmap, progress and live PR status):

```bash
git clone https://github.com/waddington/job-application-tracker.git
cd job-application-tracker
python3 -m tools.pm          # → http://127.0.0.1:8767
```

It needs Python 3.12 or newer and nothing else. The [`gh` CLI](https://cli.github.com/) is
optional and adds live PR status.

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
