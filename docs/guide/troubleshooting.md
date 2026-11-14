# Troubleshooting

## Windows

Windows is supported. The tracker runs on Windows, with git snapshots turned off by default for now
(the sidebar status indicates snapshots are off on Windows). The **Download a backup** link in the
sidebar provides complete single-file backups without git.

To verify a Windows installation or test run, follow the [Windows run checklist](install.md#checking-a-windows-run).

### Keep your data folder out of OneDrive

OneDrive and other cloud-sync tools lock files while uploading changes. Because SQLite and the
tracker write and rename database files, journal files and notes frequently, a data folder inside
OneDrive (for example `C:\Users\<user>\OneDrive\...`) can encounter file locking errors.

Always keep your data folder in a standard local path outside OneDrive, such as
`C:\Users\<user>\job-search-data`.

## `uv sync` asks for a C compiler, or "Microsoft Visual C++ 14.0 or greater is required"

uv is building a package from source because it picked a Python too new to have ready-built
packages for it. The repo's `.python-version` asks for Python 3.12 to 3.14, so `uv sync` in the
repo folder picks one of those; if you've set `UV_PYTHON` or passed `--python`, choose 3.12, 3.13
or 3.14 instead, for example `uv sync --python 3.13`.

The range in `.python-version` is something uv understands; pyenv, asdf and mise expect a single
version there and complain inside the repo folder. Use uv's commands (`uv sync`, `uv run`), or
set your tool's version for the folder another way (for example `PYENV_VERSION=3.13`).

## "No data directory configured"

`jat` doesn't know where your data is. Add `JAT_DATA_DIR=~/your-data-folder` to `.env` in
the repo root, or pass `--data-dir`. Make sure you're running `jat` from the repo root
(that's where it reads `.env`). `uv run jat info` shows what it resolved.

## "No database at …. Run `jat init` first."

The folder has no `tracker.sqlite3` yet. Run `uv run jat init`. If the folder came from a
clone or a backup (it has an `export/`), `init` rebuilds the database from it.

## "Refusing to use …: it is inside the public code repo"

Your data folder is inside the code checkout. Move it somewhere else (for example
`~/job-search-data`) and update `JAT_DATA_DIR`.

## I changed something but there's no new commit in the data repo

Snapshots wait until you've made no changes for 60 seconds, then commit. Wait a minute, or
run `uv run jat snapshot`. If there's still nothing, check the folder is a git repo
(`jat info`), isn't on a detached HEAD, and isn't mid-rebase or merge. The last snapshot
and any error are at http://127.0.0.1:8770/api/v1/backup.

## The remote doesn't have my changes

The app never pushes by itself. Run `uv run jat push`.

## "The data repo has no remote to push to"

Add one: `git -C <folder> remote add origin <your-private-repo-url>`, then `uv run jat push`.

## `jat push` fails

It runs a plain `git push` that never prompts. Check the data repo has a remote
(`git -C <folder> remote -v`) and that you can push to it without typing a password (SSH
key or credential helper). Run `git -C <folder> push` yourself to see git's message.

## "… already exists. Use --force to move it aside and restore."

`jat restore` won't overwrite a database. Stop `jat serve`, then `uv run jat restore --force`:
the old database is kept as `tracker.sqlite3.bak-<time>`.

## After pulling on my other computer, the app shows old data

The database isn't in git; `export/` is. Stop `jat serve`, run `uv run jat restore --force`,
and start it again. See [Using it on a second computer](your-data.md#using-it-on-a-second-computer).

## Git says the export files conflict

Both computers changed data since they last synced. Keep one side
(`git -C <folder> checkout --theirs export/` or `--ours`), commit, then
`uv run jat restore --force` on that computer. Use one computer at a time to avoid this.

## A page says "invalid workflow in config.toml"

There's a mistake in the `[workflow]` part of your data folder's `config.toml`; the
message says what. Fix it and reload. See [Customising](customising.md).

## "Contoso has an application. Delete it first, or archive it instead."

Companies and roles with applications can't be deleted. Delete or archive the applications
first. See [Archiving and deleting](using-the-app.md#archiving-and-deleting).

## A CV or cover-letter version can't be deleted

A version that was sent with applications is part of their record. Remove it from those
applications' *Documents sent* first.

## An upload is refused as too large

Files are limited to 50 MB each.

## "The frontend isn't built yet"

The app is running but the web interface hasn't been built. Run
`pnpm --dir frontend install` and `pnpm --dir frontend build`, then reload.

## The page won't load, or the sidebar says "API offline"

`jat serve` isn't running (or stopped). Start it again with `uv run jat serve`.

## The sidebar says the server and this page are different versions

The app comes in two halves that are released together: the tracker you start with `jat serve`,
and the page in your browser, which `jat serve` reads from `frontend/dist` on disk. They can
still drift apart, because updating changes the code on disk, not what's already running:

- **"Restart the tracker to update."** The page is newer. After an update rebuilt the frontend,
  `jat serve` keeps running the code it started with. Stop it (<kbd>Ctrl</kbd>+<kbd>C</kbd>) and
  start it again; the note goes once both match.
- **"Refresh this page to update."** The tracker is newer: this browser tab was opened before
  it was restarted or updated. Reload the page.

Until they match, some things may fail in confusing ways, because the page asks for things the
tracker doesn't know about yet (or the other way round). If the note stays after a restart and a
reload, the frontend wasn't rebuilt: see [Updating](commands.md#updating-to-a-newer-version).

## I edited a note in my editor and the app doesn't show it

Notes are picked up the next time the app lists them: reload the page. The file must stay
under `notes/` and keep its `---` header.

## Something's gone wrong and I want yesterday's data back

If the data folder is a git repo, every snapshot is a commit. Stop `jat serve`, check out
the commit you want (`git -C <folder> log --oneline`, then
`git -C <folder> checkout <commit> -- export notes files config.toml`), run
`uv run jat restore --force`, and start the app. Commit the result to keep it.
