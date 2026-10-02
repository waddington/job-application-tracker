# Install and first run

## What you need

- **Python 3.12 or newer** and [uv](https://docs.astral.sh/uv/) (it installs everything
  else on the Python side).
- **Node.js 22.12 or newer** and [pnpm](https://pnpm.io/), to build the web interface. You
  only need them when installing or updating, not to run the app.
- **git**, for automatic snapshots of your data (optional, but strongly recommended).
- Linux or macOS. Windows isn't supported: the app uses Unix file locking.

## Install

```bash
git clone https://github.com/waddington/job-application-tracker.git
cd job-application-tracker
uv sync
pnpm --dir frontend install
pnpm --dir frontend build
```

Run `jat` commands from this folder (the repo root): that's where it reads `.env`.

## Try it with demo data

Demo data is made up (Contoso, Fabrikam, Northwind Talent…), so you can click around
without touching anything real. It needs a new or empty folder:

```bash
uv run python scripts/seed_demo.py /tmp/jat-demo
uv run jat --data-dir /tmp/jat-demo serve
```

Open http://127.0.0.1:8770. Delete `/tmp/jat-demo` when you're done.

## Set it up for real

Your data lives in its own folder, **outside the code**, so updating the app never touches
it. Make that folder a private git repo and the app commits a readable snapshot after each
burst of changes: full history and an off-machine backup for free.

1. Create the data folder and make it a git repo:

   ```bash
   mkdir -p ~/job-search-data
   git -C ~/job-search-data init
   ```

2. Optionally, connect it to a **private** remote repository (GitHub, GitLab, your own
   server) so you can push backups there:

   ```bash
   git -C ~/job-search-data remote add origin <your-private-repo-url>
   ```

3. Tell the app where the folder is. In the repo root:

   ```bash
   cp .env.example .env
   ```

   then edit `.env` so it says `JAT_DATA_DIR=~/job-search-data`. (Or pass
   `--data-dir ~/job-search-data` to every command instead.) See
   [how the app finds your data](your-data.md#how-the-app-finds-your-data).

4. Create the folder layout and the database:

   ```bash
   uv run jat init
   ```

5. Start the app and open http://127.0.0.1:8770:

   ```bash
   uv run jat serve
   ```

   It keeps running until you stop it (Ctrl+C). Stopping it is safe: any pending snapshot
   is written first.

`uv run jat info` shows which data folder the app is using, whether it's a git repo, and the
database version. Use it whenever you're not sure.

## Every day

```bash
uv run jat serve
```

That's it. The home page is **Next actions**: what to chase, what's coming up, and offers to
answer. See [Using the app](using-the-app.md).

## Updating to a newer version

```bash
git pull
uv sync
pnpm --dir frontend install
pnpm --dir frontend build
```

Then restart `jat serve`. It upgrades the database automatically when it starts; your data
folder is never part of the code repo, so `git pull` can't overwrite it.

## Next

- [Your data](your-data.md): backups, restoring, and a second computer.
- [Customising](customising.md): your own stages.
