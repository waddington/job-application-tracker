# Troubleshooting

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

## An upload is refused as too large

Files are limited to 50 MB each.

## The page is blank or says the API is offline

`jat serve` isn't running, or the web interface wasn't built. Start `uv run jat serve`; if
it's running but the page is blank, run `pnpm --dir frontend build` and reload.

## I edited a note in my editor and the app doesn't show it

Notes are picked up the next time the app lists them: reload the page. The file must stay
under `notes/` and keep its `---` header.

## Something's gone wrong and I want yesterday's data back

If the data folder is a git repo, every snapshot is a commit. Stop `jat serve`, check out
the commit you want (`git -C <folder> log --oneline`, then
`git -C <folder> checkout <commit> -- export notes files config.toml`), run
`uv run jat restore --force`, and start the app. Commit the result to keep it.
