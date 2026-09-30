"""Debounced git snapshots of the data directory, and push on demand (docs/rfc/stack.md §5).

After a write, the service waits until there have been no writes for `debounce_seconds`, then
exports the database to export/*.jsonl and commits export/, notes/, files/, config.toml and
.gitignore to the data repo. Only those paths are ever committed; anything else Kai has staged
stays staged. Pushing is explicit (`jat push` or the UI button), uses a plain `git push`, and
never force-pushes.

Safety:
- git never prompts (no terminal, no SSH passphrase or host-key questions): it fails fast
  instead of hanging a request thread.
- A lock file inside .git stops the running app and the CLI snapshotting at the same time.
- Snapshots refuse to commit on a detached HEAD or mid-rebase/merge.
- After close() nothing new starts, so shutdown can't leave a half-finished commit behind.
"""

from __future__ import annotations

import contextlib
import fcntl
import os
import subprocess
import threading
import tomllib
from collections.abc import Iterator
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import Engine

from ..datadir import is_git_repo
from .export import export_db

TRACKED = ("export", "notes", "files", "config.toml", ".gitignore")
DEFAULT_DEBOUNCE = 60.0
LOCK_NAME = "jat-snapshot.lock"
NO_PROMPT_ENV = {
    "GIT_TERMINAL_PROMPT": "0",
    "GIT_SSH_COMMAND": "ssh -o BatchMode=yes",
    "GCM_INTERACTIVE": "never",
}


class SnapshotError(RuntimeError):
    pass


@dataclass
class SnapshotStatus:
    enabled: bool
    dirty: bool
    debounce_seconds: float
    last_snapshot_at: str | None = None
    last_commit: str | None = None
    last_error: str | None = None
    unpushed_commits: int | None = None
    has_remote: bool = False
    last_push_at: str | None = None

    def as_dict(self) -> dict:
        return asdict(self)


def debounce_from_config(data_dir: Path) -> float:
    path = data_dir / "config.toml"
    try:
        value = tomllib.loads(path.read_text()).get("snapshot", {}).get("debounce_seconds", DEFAULT_DEBOUNCE)
    except (OSError, tomllib.TOMLDecodeError):
        return DEFAULT_DEBOUNCE
    if isinstance(value, bool) or not isinstance(value, int | float) or value < 0:
        return DEFAULT_DEBOUNCE
    return float(value)


def _git(data_dir: Path, *args: str, timeout: float = 30) -> subprocess.CompletedProcess:
    """Run git non-interactively. Failures to run at all become SnapshotError."""
    try:
        return subprocess.run(
            ["git", "-C", str(data_dir), *args],
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
            stdin=subprocess.DEVNULL,
            env={**os.environ, **NO_PROMPT_ENV},
        )
    except subprocess.TimeoutExpired as exc:
        raise SnapshotError(f"git {args[0]} timed out after {timeout:.0f}s") from exc
    except OSError as exc:
        raise SnapshotError(f"couldn't run git: {exc}") from exc


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class SnapshotService:
    def __init__(self, data_dir: Path, engine: Engine, debounce_seconds: float | None = None):
        self.data_dir = data_dir
        self.engine = engine
        self.enabled = is_git_repo(data_dir)
        self.debounce = debounce_from_config(data_dir) if debounce_seconds is None else debounce_seconds
        self._state = threading.Lock()  # short critical sections: flags and the timer
        self._work = threading.Lock()  # held while exporting and committing
        self._timer: threading.Timer | None = None
        self._dirty = False
        self._closed = False
        self._last_snapshot_at: str | None = None
        self._last_commit: str | None = None
        self._last_error: str | None = None
        self._last_push_at: str | None = None

    # --- scheduling -----------------------------------------------------------------------

    def mark_dirty(self) -> None:
        """Called after every committed write; (re)starts the debounce timer. Never blocks on a snapshot."""
        if not self.enabled:
            return
        with self._state:
            self._dirty = True
            if self._closed:
                return
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self.debounce, self._fire)
            self._timer.daemon = True
            self._timer.start()

    def _fire(self) -> None:
        with self._state:
            if self._closed:
                return
        with contextlib.suppress(SnapshotError):  # recorded in last_error; the next write retries
            self.snapshot_now()

    def close(self) -> None:
        """Stop scheduling, then write any pending snapshot (called on shutdown)."""
        with self._state:
            self._closed = True
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None
            dirty = self._dirty
        if dirty and self.enabled:
            with contextlib.suppress(SnapshotError):
                self.snapshot_now(_force=True)

    # --- snapshot ---------------------------------------------------------------------------

    @contextlib.contextmanager
    def _process_lock(self) -> Iterator[None]:
        """Exclusive across processes (the app and `jat snapshot`/`jat push`)."""
        git_dir = self.data_dir / ".git"
        lock_path = (git_dir if git_dir.is_dir() else self.data_dir) / LOCK_NAME
        with open(lock_path, "w") as fh:
            try:
                fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                try:
                    fcntl.flock(fh, fcntl.LOCK_EX)  # wait for the other snapshot to finish
                except OSError as exc:
                    raise SnapshotError(f"couldn't lock {lock_path}: {exc}") from exc
            try:
                yield
            finally:
                fcntl.flock(fh, fcntl.LOCK_UN)

    def _check_repo_state(self) -> None:
        head = _git(self.data_dir, "symbolic-ref", "-q", "HEAD")
        if head.returncode != 0:
            raise SnapshotError("The data repo is on a detached HEAD; check out a branch so snapshots aren't lost.")
        git_dir = Path(_git(self.data_dir, "rev-parse", "--absolute-git-dir").stdout.strip() or self.data_dir / ".git")
        for marker in ("rebase-merge", "rebase-apply", "MERGE_HEAD", "CHERRY_PICK_HEAD"):
            if (git_dir / marker).exists():
                raise SnapshotError("The data repo is mid-rebase/merge; finish it and snapshots will resume.")

    def snapshot_now(self, message: str | None = None, *, _force: bool = False) -> str | None:
        """Export and commit now. Returns the new commit sha, or None if nothing changed."""
        if not self.enabled:
            raise SnapshotError("The data directory isn't a git repo, so snapshots are off.")
        with self._state:
            if self._closed and not _force:
                raise SnapshotError("snapshots are shut down")
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None
            self._dirty = False  # writes from now on mark it dirty again
        try:
            with self._work, self._process_lock():
                self._check_repo_state()
                export_db(self.engine, self.data_dir / "export")
                paths = [p for p in TRACKED if (self.data_dir / p).exists()]
                add = _git(self.data_dir, "add", "--all", "--", *paths)
                if add.returncode != 0:
                    raise SnapshotError(f"git add failed: {add.stderr.strip()}")
                staged = _git(self.data_dir, "diff", "--cached", "--name-only", "--", *paths)
                files = [f for f in staged.stdout.splitlines() if f]
                if not files:
                    self._last_error = None
                    return None
                # Commit exactly the staged snapshot files (a path git doesn't know would fail the pathspec).
                commit = _git(self.data_dir, "commit", "-q", "-m", message or _message(files), "--", *files)
                if commit.returncode != 0:
                    raise SnapshotError(f"git commit failed: {commit.stderr.strip() or commit.stdout.strip()}")
                sha = _git(self.data_dir, "rev-parse", "--short", "HEAD").stdout.strip()
                self._last_commit, self._last_snapshot_at, self._last_error = sha, _now(), None
                return sha
        except Exception as exc:
            with self._state:
                self._dirty = True  # try again on the next write or snapshot
            self._last_error = str(exc) if isinstance(exc, SnapshotError) else f"snapshot failed: {exc}"
            if isinstance(exc, SnapshotError):
                raise
            raise SnapshotError(self._last_error) from exc

    # --- push -------------------------------------------------------------------------------

    def _remote(self) -> str | None:
        head = _git(self.data_dir, "symbolic-ref", "-q", "--short", "HEAD").stdout.strip()
        if head:
            branch_remote = _git(self.data_dir, "config", "--get", f"branch.{head}.remote").stdout.strip()
            if branch_remote:
                return branch_remote
        remotes = _git(self.data_dir, "remote").stdout.split()
        return "origin" if "origin" in remotes else (remotes[0] if remotes else None)

    def unpushed(self) -> int | None:
        r = _git(self.data_dir, "rev-list", "--count", "@{upstream}..HEAD")
        return int(r.stdout.strip()) if r.returncode == 0 and r.stdout.strip().isdigit() else None

    def push(self) -> str:
        """Snapshot any pending changes, then `git push` (never forced, never prompts)."""
        if not self.enabled:
            raise SnapshotError("The data directory isn't a git repo.")
        remote = self._remote()
        if not remote:
            raise SnapshotError("The data repo has no remote to push to. Add one with `git remote add origin ...`.")
        with self._state:
            dirty = self._dirty
        if dirty:
            self.snapshot_now()
        has_upstream = _git(self.data_dir, "rev-parse", "--abbrev-ref", "@{upstream}").returncode == 0
        args = ["push"] if has_upstream else ["push", "-u", remote, "HEAD"]
        result = _git(self.data_dir, *args, timeout=120)
        if result.returncode != 0:
            self._last_error = f"git push failed: {result.stderr.strip()}"
            raise SnapshotError(self._last_error)
        self._last_push_at = _now()
        return (result.stderr or result.stdout).strip()

    def status(self) -> SnapshotStatus:
        with self._state:
            dirty = self._dirty
        try:
            unpushed = self.unpushed() if self.enabled else None
            has_remote = bool(self._remote()) if self.enabled else False
        except SnapshotError:
            unpushed, has_remote = None, False
        return SnapshotStatus(
            enabled=self.enabled,
            dirty=dirty,
            debounce_seconds=self.debounce,
            last_snapshot_at=self._last_snapshot_at,
            last_commit=self._last_commit,
            last_error=self._last_error,
            unpushed_commits=unpushed,
            has_remote=has_remote,
            last_push_at=self._last_push_at,
        )


def _message(files: list[str]) -> str:
    tables = sorted({Path(f).stem for f in files if f.startswith("export/") and f.endswith(".jsonl")})
    others = sorted({f.split("/")[0] for f in files if not f.startswith("export/")})
    parts = []
    if tables:
        parts.append(", ".join(tables[:6]) + (" …" if len(tables) > 6 else ""))
    if others:
        parts.append(", ".join(others))
    return f"snapshot: {'; '.join(parts) or 'data'} ({len(files)} files)"
