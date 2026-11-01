# Install and first run

Hi, and thanks for giving this a try. Everything runs on your own computer, with no account
to set up. You paste a few commands into your terminal once, and after that it's just a page
in your browser.

Apologies that there's no proper installer yet - one's on the way. For now you'll need a Mac
or Linux computer (Windows isn't supported yet, sorry) with [git](https://git-scm.com/),
[uv](https://docs.astral.sh/uv/), [Node.js](https://nodejs.org/) 22.12 or newer and
[pnpm](https://pnpm.io/). uv fetches Python for you if you haven't got version 3.12 or newer.
Once those are in place, it takes about ten minutes.

## Get it running

First, download the app and build it:

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
your first one, or the ? button to see how it all works.

The app keeps running until you press Ctrl+C, which is perfectly safe. Next time, just run
`uv run jat serve` from the same folder. Your data stays in `~/job-search-data`, away from the
code, so updating the app won't touch it.

## When you're ready for more

Fancy a look around first? Once the app is built, this fills a new or empty folder with
made-up companies and people, and leaves your own data alone. You can delete the folder
afterwards.

```bash
uv run python scripts/seed_demo.py /tmp/jat-demo
uv run jat --data-dir /tmp/jat-demo serve
```

It's well worth [turning on automatic history and backups](your-data.md#snapshots-automatic-local-history)
at some point, which only takes a minute. The rest can wait until you need it:
[using the app](using-the-app.md), [updating to a newer version](commands.md#updating-to-a-newer-version),
[keeping your data somewhere else](your-data.md#how-the-app-finds-your-data),
[your own stages](customising.md) and [what to do if something goes wrong](troubleshooting.md).

Good luck with the search.
