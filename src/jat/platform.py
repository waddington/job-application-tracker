"""What differs on Windows, in one place (docs/rfc/windows.md, step 1).

The rest of the code asks `is_windows()` and `snapshots_allowed()` and takes the lock through
`process_lock()`; nothing else imports `fcntl`. Step 2 swaps in a Windows lock here.
"""

from __future__ import annotations

import contextlib
import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path

try:
    import fcntl
except ImportError:  # Windows: no lock until step 2 adds one (msvcrt)
    fcntl = None

IS_WINDOWS: bool = sys.platform == "win32"
LOCK_NAME = "jat-snapshot.lock"


def is_windows() -> bool:
    """Read at call time, so tests can fake Windows by patching `jat.platform.IS_WINDOWS`."""
    return IS_WINDOWS


def snapshots_allowed(windows_snapshots: bool) -> bool:
    """Whether git snapshots and `jat init`'s commit may run here: always on Linux and macOS; on
    Windows only with JAT_WINDOWS_SNAPSHOTS=1, for testing on a test data folder."""
    return windows_snapshots or not is_windows()


def lock_path(data_dir: Path) -> Path:
    git_dir = data_dir / ".git"
    return (git_dir if git_dir.is_dir() else data_dir) / LOCK_NAME


class LockError(OSError):
    """Taking the snapshot lock failed (not an error from the work done while holding it)."""

    def __init__(self, path: Path, cause: OSError):
        super().__init__(f"couldn't lock {path}: {cause}")
        self.path = path
        self.cause = cause


@contextlib.contextmanager
def process_lock(data_dir: Path) -> Iterator[None]:
    """Exclusive across processes (the app and `jat snapshot`/`jat push`). On Windows a no-op
    until step 2. Only failing to take the lock raises LockError; errors from the caller's
    block pass through unchanged."""
    if fcntl is None:
        yield
        return
    path = lock_path(data_dir)
    with open(path, "w", encoding="utf-8") as fh:
        try:
            fcntl.flock(fh, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            try:
                fcntl.flock(fh, fcntl.LOCK_EX)  # wait for the other snapshot to finish
            except OSError as exc:
                raise LockError(path, exc) from exc
        try:
            yield
        finally:
            fcntl.flock(fh, fcntl.LOCK_UN)


def replace_with_retry(
    src: Path | str,
    dst: Path | str,
    *,
    attempts: int = 5,
    delay: float = 0.05,
) -> None:
    """Atomically replace dst with src, retrying briefly if dst is locked by another program
    (an editor, antivirus or OneDrive on Windows).
    """
    for i in range(attempts):
        try:
            os.replace(src, dst)
            return
        except OSError:
            if i == attempts - 1:
                raise
            time.sleep(delay)


def unlink_with_retry(
    path: Path | str,
    *,
    attempts: int = 5,
    delay: float = 0.05,
    missing_ok: bool = True,
) -> None:
    """Unlink path, retrying briefly if path is locked by another program."""
    p = Path(path)
    for i in range(attempts):
        try:
            p.unlink(missing_ok=missing_ok)
            return
        except OSError:
            if i == attempts - 1:
                raise
            time.sleep(delay)
