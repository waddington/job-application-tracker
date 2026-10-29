# RFC: running the tracker in Docker

**Status:** planned, shelved (Kai, 2026-10-29: "lets shelve this for now"). Nothing is built.
**Roadmap:** `docker-image` (built locally from a clone), then `docker-image-publish` (an image
on GHCR).

Kai's questions, and the answers agreed while planning.

## 1. Version

A **minor** bump (1.1.x → 1.2.0). It isn't a breaking change: Docker is an extra way to run
the tracker, and `uv run jat serve`, the data folder layout and the API stay the same. It would
be major only if Docker became the only supported way, or the data folder changed.

## 2. The data folder stays on your disk

Use a **bind mount** of your existing data folder, not a Docker-managed named volume. A
named volume lives inside Docker's storage, where you can't easily open the files or
`git push` them.

```yaml
volumes:
  - ${JAT_DATA_DIR:?set JAT_DATA_DIR in .env}:/data
environment:
  JAT_DATA_DIR: /data
```

## 3. Keeping git snapshots working

The snapshot code (`src/jat/snapshot/git.py`) shells out to `git` in the data folder, so
three things need care:

- **Your user id.** Run as `user: "${UID}:${GID}"`. Otherwise new files are owned by root,
  and git refuses the repo ("dubious ownership"). If the ids don't match after all, set
  `safe.directory=/data` in the container's git config.
- **Git identity.** A container has no `~/.gitconfig`, so `git commit` fails without a name and
  email. Set `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME` and
  `GIT_COMMITTER_EMAIL` from `.env`, falling back to the data repo's own `user.name` and
  `user.email` when they're set there. The startup check should say clearly when neither is
  set.
- **Pushing.** Auto-commit works inside the container; pushing needs credentials.
  - **Default:** push from your own terminal (`git push` in the data folder, which is on your
    disk). The UI's **Push** button reports the error clearly.
  - **Optional, documented:** pass your SSH agent socket in
    (`SSH_AUTH_SOCK=/ssh-agent` plus a mount of `$SSH_AUTH_SOCK`) and a read-only
    `known_hosts`, so **Push** works from the UI. `NO_PROMPT_ENV`'s `BatchMode=yes` already
    stops it hanging on a prompt.
- The snapshot lock (`fcntl.flock` in `.git/jat-snapshot.lock`) works across a bind mount
  on Linux. Don't count on it across Docker Desktop's file sharing.

## 4. Other things to handle

- **Podman.** The same Dockerfile and compose file work with `podman compose`. Rootless
  Podman needs `userns_mode: keep-id` so files come out owned by you. Fedora and other
  SELinux systems need `:Z` on the mount. Both go in the guide, maybe as a
  `compose.podman.yaml` override.
- **Time zone (important).** Reply days, applied dates and "today" use the machine's local
  time (`astimezone()` in `domain/applications.py`, `api/documents.py` and migration 0011).
  Containers default to UTC, so pass `TZ` (from `.env`, defaulting to the host's) and
  install `tzdata` in the image.
- **Security: the host check.** `security.py` turns off its DNS-rebinding host check when
  bound to `0.0.0.0`, which a container must do. Two fixes:
  - publish the port only on loopback (`127.0.0.1:8770:8770`);
  - add a `JAT_ALLOWED_HOSTS` setting (default `localhost,127.0.0.1,::1`), so the check
    stays on inside the container even though the bind address is `0.0.0.0`.

  The CSRF check is unaffected. Exposing the tracker on a LAN or the internet stays an
  explicit, documented opt-in, with a warning that the app has no login.
- **`.dockerignore`.** Exclude `.env`, `.git`, `node_modules`, `frontend/dist`, `.venv`,
  `.claude/` and any data folder, so nobody's `.env` or data is baked into an image.
- **Running alongside the usual install.** Don't run Docker and `uv run jat serve` on the
  same data folder at once: both default to port 8770, and two servers on one SQLite file
  is asking for trouble. The guide says so; the port can be changed in `.env`.
- **Docker Desktop (macOS, Windows).** Bind-mount file sharing is slower, and SQLite on a
  Windows-side folder (`/mnt/c/...`) can lock badly. On Windows, keep the data folder in the
  WSL file system. This overlaps with `windows-support`.

## 5. Compose, not anything heavier

Docker Compose (`compose.yaml`): self-hosters expect it, Podman supports it, and every
setting sits in one file next to `.env`. The guide also gives the plain `docker run`
equivalent. No Kubernetes, Helm or Nomad: it's a single-user app.

## 6. Updating

- **`docker-image` (local build):** `git pull && docker compose up -d --build`. Migrations
  already run on start (`cmd_serve` calls `migrate()`), and the data lives outside the
  container, so a rebuild never touches it.
- **`docker-image-publish` (later):** GitHub Actions builds on each `v*` tag for
  `linux/amd64` and `linux/arm64` (buildx), pushes `ghcr.io/waddington/job-application-tracker`
  tagged `X.Y.Z`, `X.Y` and `latest`, and the compose file uses `image:`. Updating becomes
  `docker compose pull && docker compose up -d`. This step makes the package public, which
  needs Kai's yes.

## 7. Everything else

- **First run.** An entrypoint script:
  - an empty data folder → `jat init`;
  - `export/` with no database → `jat restore`;
  - then `jat serve --host 0.0.0.0`.

  It must never overwrite an existing database.
- **CLI commands.** They run in the container: `docker compose exec tracker jat push`
  (likewise `jat archive`, `jat info` and `jat snapshot`).
- **Running.** A health check on `GET /api/v1/health` (with Python's `urllib`, so no curl
  is needed), and `restart: unless-stopped` so it comes back after a reboot.
- **Shutting down.** Uvicorn as PID 1 (`exec` in the entrypoint), or `init: true`, so
  SIGTERM reaches the app and the snapshot service's `close()` finishes cleanly.
- **The image.** A multi-stage build:
  1. `node:22-slim` with pnpm builds `frontend/dist` (including `dist/api-docs/`).
  2. `python:3.12-slim` with uv (`uv sync --frozen --no-dev`) adds `git` and `tzdata`, and
     copies `dist` in.

  Pin the base images, and aim for roughly 150–200 MB.
- **Tests.** A smoke test (a script, and later CI on the publish workflow) that builds the
  image, starts it on a scratch data folder seeded with `scripts/seed_demo.py`, checks
  `/api/v1/health`, makes one write, and confirms a snapshot commit lands after the debounce.
- **Docs.** In the same PR:
  - a new `docs/guide/docker.md`, linked from `docs/guide/install.md`;
  - a README row;
  - `llms.txt`;
  - a `CHANGELOG.md` entry;
  - the 1.2.0 bump.

  The website can mention Docker for self-hosters; the lay-person path stays the
  one-command install, then the desktop app.

## Not doing

- A named volume for the data.
- Baking credentials or SSH keys into the image.
- Running as root.
- Exposing the tracker beyond localhost by default.
