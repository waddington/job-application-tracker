# RFC: Stack and data format

| | |
|---|---|
| **Status** | Accepted (Kai, 2026-09-30: "then get building") |
| **Authors** | lead |
| **Date** | 2026-09-30 |
| **Roadmap** | P0 `stack-rfc`; unblocks P1 (`data-dir`, `schema`, `workflow`, `api`, `app-shell`) |
| **PRD** | [docs/prd/tracker.md](../prd/tracker.md) |
| **Source idea** | Kai's request, 2026-09-30 |

Kai chose each of these (2026-09-30):

- **Backend:** Python and FastAPI.
- **Data:** SQLite for records, Markdown files for notes, plain files for attachments.
- **Frontend:** a TypeScript React single-page app built with Vite.
- **UI kit:** Mantine.
- **Backup:** the app auto-commits to the private data repo, and pushes when Kai asks.

## 1. Summary

A single local process, `uv run jat serve`, runs a FastAPI app on `127.0.0.1`. It serves:

- a versioned JSON API under `/api/v1`, with its OpenAPI schema;
- the built React app for every other path.

Kai's data lives in the private data repo (`~/Documents/Projects/job-application-tracker-data`):

- **Records:** structured records go in SQLite.
- **Notes:** each note is a real `.md` file.
- **Attachments:** normal files.
- **Git snapshots:** after a period with no edits, the app writes a text export of the database
  and commits it to the data repo. The SQLite file itself isn't committed.
- **Pushing:** only on demand.

## 2. Repository layout

```
job-application-tracker/            (public)
├── pyproject.toml                  uv project: package `jat`, deps, ruff and pytest config
├── uv.lock
├── src/jat/
│   ├── __main__.py / cli.py        `jat serve | init | export | restore | push`
│   ├── config.py                   settings from env / .env (JAT_DATA_DIR, JAT_PORT, ...)
│   ├── app.py                      FastAPI factory: API routers + static SPA
│   ├── db/                         SQLAlchemy 2.0 models, session, Alembic migrations
│   ├── domain/                     workflow engine, staleness rules, duplicate detection
│   ├── api/                        routers per entity (Pydantic v2 schemas)
│   ├── storage/                    notes (.md), attachments, .eml parsing
│   └── snapshot/                   JSONL export/restore, git auto-commit, push
├── frontend/                       Vite + React + TS (pnpm)
│   ├── src/api/                    generated types (openapi-typescript) + openapi-fetch client
│   ├── src/routes/                 TanStack Router file routes
│   └── src/components/
├── tests/                          pytest (tests/pm stays for the PM dashboard)
└── tools/pm/                       PM dashboard (standard library only, unchanged)
```

## 3. Backend

| Concern | Choice | Why |
|---|---|---|
| Runtime | Python 3.12, **uv** | Same as hype-pie; fast, locked installs |
| Web | **FastAPI** + Uvicorn | Typed routes, OpenAPI for the TypeScript client (FR23) |
| Models | **SQLAlchemy 2.0** (typed ORM) + **Pydantic v2** schemas | Mature; clear split between database and API shapes |
| Migrations | **Alembic** | The schema will change; Kai's data must migrate safely |
| Database | **SQLite** (WAL mode, foreign keys on) | One file; fast filters and stats; no server |
| Search | SQLite **FTS5** | Full-text search over notes and entities, no extra dependency |
| Email | Standard-library `email` package | Parses `.eml` headers for FR13 |
| Settings | **pydantic-settings** | `JAT_DATA_DIR` from the environment or a git-ignored `.env` |
| Quality | **pytest**, **ruff** (lint and format) | Must pass before merging |

IDs are UUIDv7 strings: sortable by time and stable across export and restore. Times are UTC in
ISO 8601.

## 4. Data directory layout

```
job-application-tracker-data/       (private git repo, already exists)
├── README.md
├── tracker.sqlite3                 working database (git-ignored; rebuilt by `jat restore`)
├── export/                         committed: one JSONL file per table, sorted by id
│   ├── applications.jsonl
│   ├── events.jsonl
│   └── ...
├── notes/                          committed: one Markdown file per note
│   └── 2026/09/0192f…-call-with-northwind.md
├── files/                          committed: attachments, CVs, cover letters, .eml
│   └── 2026/09/0192f…-cv-v3-backend.pdf
└── config.toml                     committed: workflow stages, staleness thresholds (editable in-app)
```

- **Notes** are the source of truth on disk. Each has YAML frontmatter (`id`, `title`,
  `links: [{type, id}]`, `created`, `updated`) and a Markdown body. SQLite keeps an index
  (path, links, title, FTS). On startup, and when listing notes, the app rescans changed
  files, so edits made in an editor or by Claude show up.
- **Attachments** are stored with their SHA-256 in SQLite. File names are made safe, and the
  app refuses any path outside `files/`.
- **Readable without the app (FR22):** everything except the git-ignored SQLite file is JSONL,
  Markdown or the original files.
- **Restore (M3):** `jat restore` rebuilds `tracker.sqlite3` from `export/`, `notes/` and
  `files/`. A test checks that export → restore → export produces identical output.

## 5. Git snapshots (backup)

- After any write, a background task waits for **60 s with no further writes**. It then
  runs `export`, `git add export notes files config.toml` and
  `git commit -m "snapshot: <n> changes (<entities>)"` in the data repo.
- **Push backup** (a button in the UI, or `jat push`) runs a plain `git push` to the data
  repo's own remote. It never force-pushes, never rewrites history, and never touches the
  code repo.
- If the data directory isn't a git repo, snapshots are turned off and the UI shows a warning.
- The data repo's `.gitignore` gets `tracker.sqlite3*` added, via a commit to the data repo.

## 6. Domain model (first cut; detailed in `schema`)

`company`, `agency`, `contact` (+ `contact_detail`: kind, label, value), `role` (company, title,
pay fields, remote, location, employment type, day rate, IR35), `application` (role, route:
direct or agency/contact, current stage, tags, follow-up date, snooze), `application_contact`
(role in the process), `stage` and `transition` (the configurable workflow), `event`
(append-only: stage change, call, email, note, file, interview; timestamp, payload),
`interview` (type, time or deadline, link, prep, debrief, questions, coding-task fields),
`document` + `document_version` (CVs and cover letters) and `application_document`, `link`
(URL + title on any entity), `attachment`, and `note_index`.

The current stage is a cached value. The `event` history is the truth: undo appends a
correcting event (FR7).

## 7. Frontend

| Concern | Choice |
|---|---|
| Build | **Vite**, React 18+, TypeScript (strict), **pnpm** |
| UI kit | **Mantine** (`core`, `hooks`, `form`, `dates`, `notifications`, `spotlight`, `modals`) |
| Routing and data | **TanStack Router** + **TanStack Query** |
| API client | **openapi-typescript** + **openapi-fetch**, generated from FastAPI's schema |
| Tables | **mantine-react-table** (TanStack Table) for the applications list |
| Board | **dnd-kit** |
| Charts and Sankey | **ECharts** (`echarts-for-react`) |
| Markdown | Editor: **@uiw/react-md-editor**; rendering: **react-markdown** + remark-gfm + rehype-sanitize |
| Quality | **Vitest** + Testing Library, ESLint (typescript-eslint), Prettier, `tsc --noEmit` |

In production, `pnpm build` writes `frontend/dist`, which FastAPI serves, so there's one port.
In development, Vite runs on `:5173` and proxies `/api` to FastAPI on `:8770`.

## 8. Running

| Command | What it does |
|---|---|
| `uv run jat init` | Creates the data directory layout and the database, and runs migrations |
| `uv run jat serve` | Runs the app on http://127.0.0.1:8770 |
| `uv run jat serve --dev` + `pnpm --dir frontend dev` | Development with reload |
| `uv run jat export` / `restore` / `push` | Backup operations |
| `python3 -m tools.pm` | PM dashboard (unchanged, :8767) |

`JAT_DATA_DIR` is set in the git-ignored `.env`. `.env.example` documents it with a placeholder
path.

## 9. Security and privacy

- Binds to `127.0.0.1` only. There is no auth (single user), and CORS is limited to the Vite
  dev origin.
- Markdown is sanitised before rendering. Uploads are size-limited and stored under
  generated names. Every file path is resolved and checked to be inside the data directory.
- Test fixtures use invented data only. A CI check greps for the data directory path and
  real-looking email addresses (anything outside `example.com`).

## 10. Testing

- **Backend:** pytest with a temporary data directory per test. It covers the workflow
  engine (allowed and blocked transitions, undo), the duplicate detector, staleness rules,
  API contract tests, note rescan, the export → restore round trip, and snapshot commits in
  a temporary git repo.
- **Frontend:** Vitest for components and hooks; typecheck and lint in the check script.
- **One command:** `scripts/check` runs ruff, pytest, `tsc`, eslint and vitest.

## 11. Dependencies needing Kai's sign-off

- **Python:** fastapi, uvicorn[standard], sqlalchemy, alembic, pydantic, pydantic-settings,
  python-multipart, uuid-utils (UUIDv7).
- **Python dev:** pytest, httpx, ruff.
- **JS:** react, react-dom, @mantine/{core,hooks,form,dates,notifications,spotlight,modals},
  dayjs, @tanstack/react-router, @tanstack/react-query, mantine-react-table,
  @dnd-kit/{core,sortable}, echarts, echarts-for-react, @uiw/react-md-editor, react-markdown,
  remark-gfm, rehype-sanitize, openapi-fetch.
- **JS dev:** vite, @vitejs/plugin-react, typescript, openapi-typescript, vitest,
  @testing-library/react, eslint, typescript-eslint, prettier.
- **`.gitignore`:** add the github/gitignore Node template.

## 12. Rollout (maps to the P1 tasks)

1. **`data-dir`:** pyproject, `jat init`, config and `.env`, the data-directory layout, and
   the data repo's `.gitignore`.
2. **`schema`:** models, the first Alembic migration, and the export/restore round trip.
3. **`workflow`:** stages and transitions from `config.toml`, the event log, and undo.
4. **`api`:** routers for every entity, and the OpenAPI schema.
5. **`app-shell`:** Vite + Mantine shell, navigation, dark mode, the generated client, and
   FastAPI serving `dist`.
6. **Snapshots:** the auto-commit and push service ships with `data-dir` and `schema`.

**Exit criterion for P1:** `jat init && jat serve` shows the app shell, an application can be
created and moved through stages through the API, and snapshots appear in the data repo.

## 13. Alternatives considered

- **Next.js:** rejected. It would mean a second server beside FastAPI and overlapping
  backend features.
- **Plain files as the only store:** rejected. Every query would need an in-memory index,
  with more risk of inconsistency. JSONL plus Markdown still gives readable, diffable backups.
- **Committing the SQLite file:** rejected. It's a binary that git can't diff and that bloats
  history. JSONL export is diffable, and restore is tested.
- **shadcn/ui, Ant Design, MUI, Radix Themes:** compared on 2026-09-30. Mantine has the most
  built-in coverage for this app (pickers, timeline, forms, Spotlight, notifications).

## 14. Open questions

1. **Port:** 8770 for the app? *Default: yes (the PM dashboard is on 8767).*
2. **Snapshot debounce:** 60 s? *Default: yes, configurable in `config.toml`.*
3. **Package name `jat` (Job Application Tracker):** *Default: yes.*
