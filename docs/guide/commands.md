# Command reference

Run everything from the repo root with `uv run jat …`. Every command takes
`--data-dir <path>` (before the command name) to choose the data folder; without it, `jat`
uses `JAT_DATA_DIR` ([how the app finds your data](your-data.md#how-the-app-finds-your-data)).

```bash
uv run jat --data-dir ~/job-search-data <command> [options]
```

| Command | What it does |
|---|---|
| `init` | Creates the folder layout (`export/`, `notes/`, `files/`, `config.toml`, `.gitignore`) and the database, and commits the layout if the folder is a git repo. Safe to run again. On a folder with an `export/` but no database (a fresh clone), it rebuilds the database from the export. `--no-commit`: don't commit the layout. |
| `serve` | Runs the app (http://127.0.0.1:8770). Upgrades the database first if needed. `--port N`, `--host ADDR`, `--dev` (reload on code changes, for development). |
| `info` | Shows the data folder, whether it's a git repo, the database version, and the address. |
| `snapshot` | Writes `export/` and commits to the data repo now, instead of waiting for the automatic snapshot. |
| `push` | Snapshots, then `git push`es the data repo (never forced; the first push also sets the branch to track the remote). |
| `archive` | Writes the whole data folder to one zip (`./jat-backup-YYYY-MM-DD.zip`). `-o PATH` to choose where. Never overwrites. |
| `restore` | Rebuilds the database from `export/`. Refuses if there's already a database; `--force` moves the old one aside (`tracker.sqlite3.bak-<time>`) first. Stop `serve` before restoring. |
| `export` | Writes `export/*.jsonl` from the database without committing. |
| `migrate` | Upgrades the database to the current version (`serve` does this for you). |

Other scripts:

- `uv run python scripts/seed_demo.py <new empty folder>`: made-up demo data.
- `python3 -m tools.pm`: the project's build dashboard (roadmap and PR status) at
  http://127.0.0.1:8767; only interesting if you're working on the tracker itself.

## Settings

Set these in `.env` in the repo root (copy `.env.example`), or as environment variables.
Command-line options win over both, and an environment variable wins over `.env`.

| Setting | Default | Meaning |
|---|---|---|
| `JAT_DATA_DIR` | none (required) | Your data folder. `~` is expanded. Must be outside the code repo. |
| `JAT_PORT` | `8770` | Port for `jat serve`. |
| `JAT_HOST` | `127.0.0.1` | Address for `jat serve`. Keep it on localhost: the app has no login. |

Settings that belong to your data (stages, snapshot timing) are in the data folder's
`config.toml`: see [Customising](customising.md).

## The local JSON API

Everything the app does goes through a JSON API on the same address, documented
interactively at **http://127.0.0.1:8770/api/docs** (`/api/openapi.json` for the schema). It's
handy for scripts, or for asking an AI assistant running on your machine to fill in data for
you.

It only answers requests addressed to localhost, and refuses writes coming from other
websites. There's no authentication, so don't expose it to a network.
