# Install and first run

Hi, and thanks for giving this a try. It all runs on your own computer, with no account to set up.

Apologies that there's no proper installer yet - one's on the way. For now you'll need a Mac or
Linux computer with [git](https://git-scm.com/), [uv](https://docs.astral.sh/uv/),
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

```bash
cp .env.example .env
uv run jat init
uv run jat serve
```

Now open http://127.0.0.1:8770 and you're in! Press New application at the top right to add
your first one.

When you're done, press Ctrl+C. Next time, just run `uv run jat serve` from the same folder.
Your data stays safely in `~/job-search-data`, away from the code.

## When you're ready for more

Fancy a look around first? This shows you made-up companies and people, using a new folder:

```bash
uv run python scripts/seed_demo.py /tmp/jat-demo
uv run jat --data-dir /tmp/jat-demo serve
```

It's well worth [turning on automatic history and backups](your-data.md#snapshots-automatic-local-history)
at some point. Everything else is in the [guide](README.md), including
[updating](commands.md#updating-to-a-newer-version) and [getting unstuck](troubleshooting.md).

Good luck with the search.
