# RFC: running the tracker on Windows

**Status:** in progress (2026-11-05). Built: `windows-time-zones`, `windows-starts`, `static-file-types`,
`utf8-everywhere`, `data-gitattributes`, `windows-testing`. The tracker starts on Windows, but is
supported on Linux and macOS only until `windows-support`.
**Roadmap:** `windows-starts`, `utf8-everywhere`, `windows-time-zones`, `static-file-types`,
`data-gitattributes`, `locked-file-retry` and `windows-testing`, then `windows-support`; later,
`windows-snapshots`. `windows-starts` is planned first, but the small fixes don't depend on it
and can land in any order. Each is one small pull request.
**Raised in:** [issue #230](https://github.com/waddington/job-application-tracker/issues/230).

This is the path to Windows support: why the tracker doesn't run there today, what has to
change, in what order, and the decisions already made.

## 1. Why it doesn't run on Windows today

Every `jat` command fails straight away, even `jat --help`:

```
ModuleNotFoundError: No module named 'fcntl'
```

`fcntl` is part of Python on Linux and macOS but not on Windows. The tracker uses it for one
thing: a file lock around its **snapshots** (in `src/jat/snapshot/git.py`; since `windows-starts`, in
`src/jat/platform.py`).

A snapshot is the tracker's automatic git commit. When the data folder is a git repo, about a
minute after your last change the app writes the database out to `export/` as readable JSON
Lines, then commits `export/`, `notes/`, `files/`, `config.toml`, `.gitignore` and `.gitattributes` with git.
It never pushes; that's `jat push`. The lock makes sure two processes (the running app and a
`jat snapshot` or `jat push` in another terminal) never snapshot at the same moment.

That file imports `fcntl` at the top, and the CLI, the app, the backup API and the archive
download all import that file, so the whole program stops before it starts.

## 2. What else differs on Windows

Past that crash, a few smaller things behave differently on Windows:

| Problem | What goes wrong |
|---|---|
| **Text encoding** | Python on Windows reads and writes text in the system's encoding (often cp1252), not UTF-8, unless told otherwise. A `.env`, `config.toml` or `.gitignore` with a non-English character can be misread, and git's output can fail to decode. |
| **Time zones** | Windows has no time-zone database for Python to read, so Insights' weekly activity, which works in your browser's time zone, fails. |
| **File types** | The app's web server asks the system what type a file is. Windows often says `.js` is plain text, so the browser refuses to run the page and it loads blank. |
| **Line endings** | Git for Windows usually converts line endings. In a data folder that's a git repo, that can change uploaded files (an email saved as `.eml`, say) and line endings in notes. |
| **Locked files** | Windows won't replace a file another program has open. If an editor, antivirus or OneDrive has a note open when the app saves it, the save fails. |

None of these is big, and several also help people on Linux or macOS with unusual setups (a
non-UTF-8 locale, a file opened elsewhere).

## 3. The plan

### Step 1: basic Windows support

**`windows-starts`.** What can't work on Windows is gathered into one place behind one
is-Windows check, so the rest of the code never imports it. On Windows it's all off:

- the `fcntl` lock (on Windows the lock does nothing);
- automatic git snapshots, even when the data folder is a git repo;
- the commit `jat init` makes.

The sidebar's status dot, which today says "backups on" for any data folder that's a git repo,
will say snapshots are off on Windows. Just below it, the **Download a backup** link writes a
fresh export and zips your data (`export/`, `notes/`, `files/`, `config.toml`,
`.gitignore` and `.gitattributes`, with instructions for restoring), and it works without git. Copying the data
folder while the app is stopped is also a complete backup.

With snapshots off, `export/` isn't rewritten as you work, so between backups the database is
the only up-to-date copy. That's already the case today for any data folder that isn't a git
repo.

The download still writes its export under the lock. With no snapshots, the only thing that
lock would guard against is two backups in different processes at once (a download from the
app while `jat archive` runs in a terminal), so letting it do nothing on Windows is safe. On
Linux and macOS nothing changes.

**A switch to turn snapshots on for testing.** Setting `JAT_WINDOWS_SNAPSHOTS=1` turns
everything in that list back on on Windows, except the `fcntl` lock: automatic snapshots, `jat
snapshot`, `jat push` and `jat init`'s commit. The sidebar's status dot then says backups are
on, as it does elsewhere.
- It's an environment variable, or a line in the `.env` file in the folder you start the
  tracker from, which it already reads for its other `JAT_` settings.
- It's off by default, so nobody gets snapshots on Windows without asking for them.
- It's an environment variable rather than a setting in `config.toml`, so it isn't left on in
  someone's data folder after testing.

It's for testing only, on a test data folder, not your real one:
- Until step 2 adds a Windows lock, there's no lock between processes. While `jat serve` is
  running, don't run `jat snapshot`, `jat push` or `jat archive`: two processes writing
  `export/` at once can commit or zip a mix of two moments.

When the switch is set, the app says at startup that Windows snapshots are experimental.

### Small fixes, in any order

Each is its own small pull request:

- **`utf8-everywhere`:** every text file and git's output read and written as UTF-8, with a
  check on Linux that fails on any text read or write that doesn't name an encoding, so it
  stays fixed.
- **`windows-time-zones`:** the `tzdata` package, the standard time-zone database for Python,
  on every platform.
- **`static-file-types`:** the app's own files served with fixed types, not the system's
  guess.
- **`data-gitattributes`:** a `.gitattributes` in the data folder, so git stores uploaded
  files byte for byte and keeps the export and notes with Unix line endings. `jat init` writes
  it, and it's added to existing data folders.
- **`locked-file-retry`:** when another program has a note, an uploaded file or an export
  file open, retry briefly, then show a clear error instead of a server error. `jat restore
  --force` says to stop `jat serve` first instead of printing a traceback.
- **`windows-testing`:** the Windows check (run in the Windows VM, see Decisions) written down as a
  short checklist in the guide:
  install, `jat init`, `jat serve`, the pages load, add an application, a note and a file,
  Download a backup, Insights' weekly activity, and `uv run pytest`.

### Windows supported

**`windows-support`:** Windows install steps in the guide (the current steps use Unix commands
such as `cp`, `~` and `/tmp`), the README, the website FAQ and the troubleshooting page
updated, and a note on keeping the data folder out of OneDrive. From here Windows is
supported, with Download a backup as the backup.

### Step 2: git snapshots on Windows

**`windows-snapshots`:** automatic git snapshots turned back on for Windows, with a Windows
lock. Python's `msvcrt` module ships with Python on Windows, so this adds no dependency. The
lock has to:

- wait for as long as the Linux lock does: `msvcrt`'s blocking call gives up after about ten
  seconds, while zipping a large data folder or a slow commit can take longer;
- not empty the lock file when it opens it.

It needs `utf8-everywhere` and `data-gitattributes` first, so snapshots on Windows don't
change line endings or misread git's output. The lock is built and tested with
`JAT_WINDOWS_SNAPSHOTS=1`; once it works, snapshots are on by default on Windows, as they are
elsewhere, and the switch goes.

## 4. Decisions

- **Basic support first, by switching the problem parts off.** Kai: on Windows "simply
  globaly disable the parts that would be an issue after isolating them and minimising the
  problematic surface, that as a first step". The snapshot lock guards the commits of real
  data, so it isn't the first thing to port.
- **A switch to test snapshots on Windows while they're off.** Kai agreed to
  `JAT_WINDOWS_SNAPSHOTS=1`, off by default, as an environment variable (section 3, step 1).
- **`tzdata` on every platform.** It's a new runtime dependency, which Kai approved: "this is
  reasonable to include and then use same dependency on all platforms". It's data only, about
  350 KB, maintained by the Python core team.
- **Tested by hand on Windows.** Kai: "i can test on windows". Each Windows change gets a
  Windows run before it merges. A GitHub Actions Windows job is added only if Kai asks later
  (the project has no test CI). Since 2026-11-11 the run happens in a Windows 11 virtual
  machine on the maintainer's computer, which the maintaining agent drives over SSH.
- **Versions:** decided per pull request by the rules in `CLAUDE.md` when it's built. Making
  the tracker start on a new platform is likely a minor release; the small fixes are likely
  patches.

## 5. Why not Docker instead?

A Docker image (planned separately in `docs/rfc/docker.md`) would run on Windows, because
Docker Desktop runs Linux in WSL2 there. It doesn't replace Windows support:

- It means installing Docker Desktop and WSL2, which can mean a reboot and a few GB of memory.
  That's a lot to ask of someone who just wants to track their job search.
- A data folder in a normal Windows folder, reached from inside the container, is slow, and
  SQLite, which the tracker uses, can lock badly there; SQLite's own docs warn against
  network-style file systems like it. Kept inside WSL instead, the files work well but are
  hard to find from Explorer.

Docker is for self-hosters; Windows support is for everyone else. They're complementary.

**In the meantime:** WSL2 (Ubuntu on Windows) should run the tracker with today's Linux
install steps, as long as the data folder lives inside WSL (for example `~/job-search-data`),
not under `/mnt/c`. This hasn't been tested.

## 6. Not covered

- A one-command install (`packaged-install`) and a double-click desktop app (`desktop-app`).
  They're separate roadmap work, not part of Windows support.
- The project's own development tools: the PM dashboard (`tools/pm`), the demo GIF and social
  card scripts, and the frontend's test runner. The test runner already handles Windows
  (`frontend/scripts/test-run.mjs`); the rest are maintainer-only.
- Symlink tests: Windows needs Developer Mode or admin rights to make symlinks, so the few
  tests that make one should skip there instead of failing. That's part of `windows-testing`,
  getting `uv run pytest` through on Windows.
