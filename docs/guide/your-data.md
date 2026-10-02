# Your data

Everything you put into the tracker lives in **one folder you choose**, separate from the
code. Copy that folder and you've copied everything.

## How the app finds your data

There's no settings page for this: you tell `jat` where the folder is when you run it. It
checks, in order:

1. **`--data-dir <path>`** on the command line. Always wins.
2. **`JAT_DATA_DIR`**, either as an environment variable or in a `.env` file in the repo
   root. `.env` is read from the folder you run `jat` in, so run it from the repo root.

There's no default: if neither is set, `jat` stops and says so. `~` is expanded, so
`JAT_DATA_DIR=~/job-search-data` works.

```bash
# .env (copy .env.example; it's git-ignored, never commit it)
JAT_DATA_DIR=~/job-search-data
```

`uv run jat info` prints the folder it resolved, whether it's a git repo, and the database
version.

The data folder must be **outside** the code repo; `jat` refuses a folder inside it, so your
job search can never end up in the public code.

## What's in the folder

```
job-search-data/
├── tracker.sqlite3   the database the app uses (not committed: rebuilt from export/)
├── export/           every table as JSON Lines, one record per line (committed)
│   ├── _meta.json    export format and database version
│   ├── applications.jsonl, companies.jsonl, contacts.jsonl, meetings.jsonl, roles.jsonl, …
├── notes/            your Markdown notes, one .md file each (committed)
├── files/            attachments: CVs, briefs, exported emails, as uploaded (committed)
├── config.toml       settings for this data folder: stages, snapshot timing (committed)
└── .gitignore        keeps the database and temporary files out of git
```

- **The database is a working copy.** `export/` is the readable, durable form: the app
  writes it on every snapshot, and `jat restore` rebuilds the database from it.
- **Notes are the real thing.** Each note is a Markdown file with a small YAML header
  (title, what it's attached to, dates). You can edit them in any editor while the app is
  running; it picks up changes the next time it lists notes.
- **Files are kept as they were uploaded**, under `files/YYYY/MM/`. Deleting something in
  the app detaches its files rather than deleting them.

## Snapshots: automatic local history

If the data folder is a git repo, the app commits a **snapshot** whenever you stop making
changes for a while (60 seconds by default): it writes `export/`, then commits `export/`,
`notes/`, `files/`, `config.toml` and `.gitignore`. A burst of edits becomes one commit, so
nothing shows up in `git log` until you've been idle for a minute.

- It only ever commits those paths; anything else you've staged in that repo is left alone.
- It never commits on a detached HEAD or in the middle of a rebase or merge.
- Stopping the app writes any pending snapshot first.
- Commit right now instead of waiting: `uv run jat snapshot`.
- See what's been saved: `git -C ~/job-search-data log --oneline`.
- Change the delay: `[snapshot] debounce_seconds` in [`config.toml`](customising.md#snapshot-timing).

If the folder isn't a git repo, snapshots are off and the app still works; the sidebar's
connection tooltip says "data dir isn't a git repo".

## Pushing: off-machine backup

Snapshots stay on your machine until you push them. The app **never pushes on its own**.

```bash
uv run jat push
```

This snapshots any pending changes, then runs a plain `git push` to the data repo's
remote (the first time, it also sets the branch to track that remote). It's never forced and never asks for a password interactively (set up an SSH key
or a credential helper for the remote). Your remote must be **private**: it holds your
whole job search.

## A single-file backup (zip)

For a copy to keep anywhere (a USB stick, cloud storage, an email to yourself):

- In the app: **Download a backup** at the bottom of the sidebar.
- From the command line: `uv run jat archive` (writes `./jat-backup-YYYY-MM-DD.zip`; use
  `-o PATH` to choose where; it never overwrites an existing file).

The zip holds one folder, `jat-backup-YYYY-MM-DD/`, with a fresh `export/`, `notes/`,
`files/`, `config.toml`, `.gitignore` and a `RESTORE.md`. It doesn't include the database (it's rebuilt
from `export/`) or git history (that's what pushing is for).

## Restoring

`jat restore` rebuilds `tracker.sqlite3` from `export/`:

```bash
uv run jat --data-dir <folder> restore
```

- If a database already exists it refuses; add `--force` to **move the old one aside**
  (to `tracker.sqlite3.bak-<time>`) and rebuild. Nothing is ever deleted.
- Stop `jat serve` for that folder first.
- `jat init` on a folder that has an `export/` but no database does the same restore for
  you, so after cloning a data repo, `jat init` is all you need.

**From a zip backup:**

```bash
unzip jat-backup-2026-09-30.zip -d ~/restored
uv run jat --data-dir ~/restored/jat-backup-2026-09-30 init
uv run jat --data-dir ~/restored/jat-backup-2026-09-30 serve
```

To keep snapshots going in the restored folder, make it a git repo (`git init` in it), then
run `uv run jat snapshot` for a first commit; after that they happen by themselves.

## Using it on a second computer

The data repo is how your tracker travels.

Both computers need the same version of the app (or the one restoring needs a newer one):
an export from a newer version is refused with "update the app first". Update the code on
both ([Updating](install.md#updating-to-a-newer-version)) when you update one.

**Set up the second computer once:**

1. Install the app ([Install](install.md#install)).
2. Clone your private data repo:

   ```bash
   git clone <your-private-repo-url> ~/job-search-data
   ```

3. Point the app at it: `JAT_DATA_DIR=~/job-search-data` in `.env` (repo root).
4. Build the database from the export, then start it:

   ```bash
   uv run jat init      # sees export/ and no database, so it restores
   uv run jat serve
   ```

**Moving between the two:** use one computer at a time.

1. On the computer you've been using: `uv run jat push` (then stop `jat serve`).
2. On the other: stop `jat serve` if it's running, then

   ```bash
   git -C ~/job-search-data pull
   uv run jat restore --force     # rebuild from what you pulled; the old database is kept as a .bak
   uv run jat serve
   ```

Don't edit on both at once: each computer's snapshots would change the same export files,
and git would ask you to merge them. If that happens, pick the side you want
(`git checkout --theirs` or `--ours` on `export/`), commit, and `jat restore --force`.

## Moving the data folder

Stop the app, move the folder (it's self-contained, including its `.git`), update
`JAT_DATA_DIR` in `.env`, and start the app again.

## Privacy

- Nothing leaves your machine unless you push the data repo or share a backup zip.
- The app only listens on `127.0.0.1` and refuses requests addressed to other hosts and
  write requests from other websites.
- No telemetry, no accounts, no external services.
