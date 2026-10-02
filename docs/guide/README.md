# User guide

Everything you need to run Job Application Tracker day to day, look after your data, and
move it between computers. Start at the top if you're new.

1. [Install and first run](install.md): what you need, trying it with demo data, setting it
   up for real, and updating to a newer version.
2. [Your data](your-data.md): where it lives, how the app finds it, what's in the folder,
   snapshots and pushing, backups, restoring, and using it on a second computer.
3. [Using the app](using-the-app.md): a tour of every page, from Next actions to Insights,
   including archiving and deleting.
4. [Customising](customising.md): your own stages and staleness thresholds, strict
   Jira-style transitions, and snapshot timing (`config.toml`).
5. [Command reference](commands.md): every `jat` command, settings and environment
   variables, and the local JSON API.
6. [Troubleshooting](troubleshooting.md): common problems and how to fix them.

The short version:

```bash
uv run jat --data-dir ~/job-search-data init     # once: set up the data folder
uv run jat --data-dir ~/job-search-data serve    # every day: http://127.0.0.1:8770
uv run jat --data-dir ~/job-search-data push     # now and then: back up to your private repo
```

Put `JAT_DATA_DIR=~/job-search-data` in `.env` (in the repo root) and you can leave out
`--data-dir` from then on.
