# Changelog

## Unreleased (0.1.0)

Everything in the [roadmap](docs/ROADMAP.yaml) (phases P0–P7)
is built and merged, but not yet tested in real use. Numbers in brackets are pull requests.

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

### Under the hood
- Python 3.12, FastAPI, SQLAlchemy, Alembic and SQLite; React 19, TypeScript, Mantine and
  TanStack Router/Query (#6–#9).
- Your data lives in its own folder: SQLite for speed plus a readable JSON Lines export,
  auto-committed to a private git repo after each burst of changes, pushed only when you
  ask (#7, #8, #13).
- Localhost only: refuses other hosts and cross-site writes (#26).
- A local project dashboard for the build itself (`python3 -m tools.pm`) (#4).

### Left out on purpose
No job-board searching or scraping, no quick-add from URLs, no MCP server and no `.ics`
calendar export.
