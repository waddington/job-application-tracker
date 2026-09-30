"""Debounced git snapshots of the data directory, and push on demand (docs/rfc/stack.md §5).

After a write, the service waits until there have been no writes for `debounce_seconds`, then
exports the database to export/*.jsonl and commits export/, notes/, files/, config.toml and
.gitignore to the data repo. Only those paths are ever staged. Pushing is explicit (`jat push`
or the UI button), uses a plain `git push`, and never force-pushes.
"""

from __future__ import annotations

import contextlib
import subprocess
import threading
import tomllib
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import Engine

from ..datadir import is_git_repo
from .export import export_db

TRACKED = ("export", "notes", "files", "config.toml", ".gitignore")
DEFAULT_DEBOUNCE = 60.0


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
    return subprocess.run(
        ["git", "-C", str(data_dir), *args], capture_output=True, text=True, timeout=timeout, check=False
    )


def _now() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


class SnapshotService:
    def __init__(self, data_dir: Path, engine: Engine, debounce_seconds: float | None = None):
        self.data_dir = data_dir
        self.engine = engine
        self.enabled = is_git_repo(data_dir)
        self.debounce = debounce_from_config(data_dir) if debounce_seconds is None else debounce_seconds
        self._lock = threading.RLock()
        self._timer: threading.Timer | None = None
        self._dirty = False
        self._last_snapshot_at: str | None = None
        self._last_commit: str | None = None
        self._last_error: str | None = None
        self._last_push_at: str | None = None

    # --- scheduling -----------------------------------------------------------------------

    def mark_dirty(self) -> None:
        """Called after every committed write; (re)starts the debounce timer."""
        if not self.enabled:
            return
        with self._lock:
            self._dirty = True
            if self._timer is not None:
                self._timer.cancel()
            self._timer = threading.Timer(self.debounce, self._fire)
            self._timer.daemon = True
            self._timer.start()

    def _fire(self) -> None:
        with contextlib.suppress(SnapshotError):  # recorded in last_error; the next write retries
            self.snapshot_now()

    def close(self) -> None:
        """Stop the timer and write any pending snapshot (called on shutdown)."""
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None
            if self._dirty:
                with contextlib.suppress(SnapshotError):
                    self.snapshot_now()

    # --- snapshot ---------------------------------------------------------------------------

    def snapshot_now(self, message: str | None = None) -> str | None:
        """Export and commit now. Returns the new commit sha, or None if nothing changed."""
        if not self.enabled:
            raise SnapshotError("The data directory isn't a git repo, so snapshots are off.")
        with self._lock:
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None
            try:
                export_db(self.engine, self.data_dir / "export")
                paths = [p for p in TRACKED if (self.data_dir / p).exists()]
                add = _git(self.data_dir, "add", "--all", "--", *paths)
                if add.returncode != 0:
                    raise SnapshotError(f"git add failed: {add.stderr.strip()}")
                staged = _git(self.data_dir, "diff", "--cached", "--name-only", "--", *paths)
                files = [f for f in staged.stdout.splitlines() if f]
                self._dirty = False
                if not files:
                    self._last_error = None
                    return None
                commit = _git(self.data_dir, "commit", "-q", "-m", message or _message(files), "--", *paths)
                if commit.returncode != 0:
                    raise SnapshotError(f"git commit failed: {commit.stderr.strip() or commit.stdout.strip()}")
                sha = _git(self.data_dir, "rev-parse", "--short", "HEAD").stdout.strip()
                self._last_commit, self._last_snapshot_at, self._last_error = sha, _now(), None
                return sha
            except SnapshotError as exc:
                self._last_error = str(exc)
                self._dirty = True
                raise
            except Exception as exc:  # export failure etc.: keep the app running, report it
                self._last_error = f"snapshot failed: {exc}"
                self._dirty = True
                raise SnapshotError(self._last_error) from exc

    # --- push -------------------------------------------------------------------------------

    def _has_remote(self) -> bool:
        return bool(_git(self.data_dir, "remote").stdout.strip())

    def unpushed(self) -> int | None:
        r = _git(self.data_dir, "rev-list", "--count", "@{upstream}..HEAD")
        return int(r.stdout.strip()) if r.returncode == 0 and r.stdout.strip().isdigit() else None

    def push(self) -> str:
        """Snapshot any pending changes, then `git push` (never forced)."""
        if not self.enabled:
            raise SnapshotError("The data directory isn't a git repo.")
        if not self._has_remote():
            raise SnapshotError("The data repo has no remote to push to. Add one with `git remote add origin ...`.")
        if self._dirty:
            self.snapshot_now()
        has_upstream = _git(self.data_dir, "rev-parse", "--abbrev-ref", "@{upstream}").returncode == 0
        args = ["push"] if has_upstream else ["push", "-u", "origin", "HEAD"]
        result = _git(self.data_dir, *args, timeout=120)
        if result.returncode != 0:
            self._last_error = f"git push failed: {result.stderr.strip()}"
            raise SnapshotError(self._last_error)
        self._last_push_at = _now()
        return (result.stderr or result.stdout).strip()

    def status(self) -> SnapshotStatus:
        with self._lock:
            return SnapshotStatus(
                enabled=self.enabled,
                dirty=self._dirty,
                debounce_seconds=self.debounce,
                last_snapshot_at=self._last_snapshot_at,
                last_commit=self._last_commit,
                last_error=self._last_error,
                unpushed_commits=self.unpushed() if self.enabled else None,
                has_remote=self._has_remote() if self.enabled else False,
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
