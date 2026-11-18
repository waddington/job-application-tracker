# Install and first run

Hi, and thanks for giving this a try. It all runs on your own computer, with no account to set up.

Apologies that there's no proper installer yet - one's on the way. For now you'll need a Mac,
Linux or Windows computer with [git](https://git-scm.com/), [uv](https://docs.astral.sh/uv/),
[Node.js](https://nodejs.org/) 22.12 or newer and [pnpm](https://pnpm.io/). uv fetches Python
for you if you need it. After that, it takes about ten minutes.

## Get it running

Download the app and build it:

```bash
git clone https://github.com/waddington/job-application-tracker.git
cd job-application-tracker
uv sync
pnpm --dir frontend install
pnpm --dir frontend build
```

Then set up your data folder and start the app:

On macOS and Linux:

```bash
cp .env.example .env
uv run jat init
uv run jat serve
```

On Windows (PowerShell):

```powershell
Copy-Item .env.example .env
uv run jat init
uv run jat serve
```

`jat init` will say snapshots are disabled. That's fine for now - more on that below.

Now open http://127.0.0.1:8770 and you're in! Press New application at the top right to add
your first one, or **?** to see how it works.

When you're done, press Ctrl+C. Next time, just run `uv run jat serve` from the same folder.
Your data stays in `~/job-search-data` (or `C:\Users\<you>\job-search-data` on Windows), away
from the code.

> **Keep your data folder out of OneDrive:** Cloud sync tools like OneDrive lock files while
> syncing, which interferes with SQLite database transactions and note saves. Always keep
> your data directory in a plain local folder outside OneDrive.

## When you're ready for more

Fancy a look around with made-up companies and people? Stop the app, run this, then open
http://127.0.0.1:8770 again. Delete the demo directory when you're done.

On macOS and Linux:

```bash
uv run python scripts/seed_demo.py /tmp/jat-demo
uv run jat --data-dir /tmp/jat-demo serve
```

On Windows (PowerShell):

```powershell
uv run python scripts/seed_demo.py "$env:TEMP\jat-demo"
uv run jat --data-dir "$env:TEMP\jat-demo" serve
```

It's well worth turning on [automatic history, and backups if you want them](your-data.md#snapshots-automatic-local-history)
at some point. Everything else is in the [guide](README.md), including
[updating](commands.md#updating-to-a-newer-version) and [getting unstuck](troubleshooting.md).

Good luck with the search.

## Checking a Windows test run

Windows isn't supported yet (see [Troubleshooting](troubleshooting.md#windows)). If you're helping
test it, this is the run to try, on a throwaway test data folder rather than your real one. Pick a
new folder outside the code, such as `C:\jat-test`, and use it in place of `<folder>` below.

1. **Install and build:** `uv sync`, `pnpm --dir frontend install` and `pnpm --dir frontend build`
   finish without errors.
2. **Set up the test folder:** `uv run jat --data-dir <folder> init` creates it.
3. **Start the tracker:** `uv run jat --data-dir <folder> serve`, then open http://127.0.0.1:8770.
4. **The pages load:** Today, Applications (both the list and the board), Interviews and Insights
   open without errors.
5. **Add an application:** press **New application** at the top and save a made-up one.
6. **Add a note:** on the application's page, press **Add note** in the Notes card and save it.
7. **Add a file:** on the same page, **Upload** a file in the Files card.
8. **Download a backup:** at the bottom of the sidebar, press **Download a backup**, and check the
   zip opens and holds your note and file.
9. **Weekly activity:** on **Insights**, **Weekly activity** shows this week's application.
10. **The tests:** run `uv run pytest -q` from the code folder. On Windows the tests of the
    maintainer-only tools (the PM dashboard, the dev scripts and the translation helpers) are
    skipped, and so are the symlink tests unless Developer Mode is on (or you run as an
    administrator). Some tests still fail on Windows:
    compare any failures with the known list in the task `windows-tests-green` on the
    [roadmap](../ROADMAP.yaml).

Stop the tracker with Ctrl+C and delete the test folder when you're done.
