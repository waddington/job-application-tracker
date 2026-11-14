"""What differs on Windows, in one place (docs/rfc/windows.md).

The rest of the code asks `is_windows()` and `snapshots_allowed()` and takes the lock through
`process_lock()`; nothing else imports `fcntl` or `msvcrt`.
"""

from __future__ import annotations

import contextlib
import sys
import time
from collections.abc import Iterator
from pathlib import Path

try:
    import fcntl
except ImportError:
    fcntl = None

try:
    import msvcrt
except ImportError:
    msvcrt = None

IS_WINDOWS: bool = sys.platform == "win32"
LOCK_NAME = "jat-snapshot.lock"


def is_windows() -> bool:
    """Read at call time, so tests can fake Windows by patching `jat.platform.IS_WINDOWS`."""
    return IS_WINDOWS


def snapshots_allowed(windows_snapshots: bool = True) -> bool:
    """Whether git snapshots and `jat init`'s commit may run here: on by default
    everywhere, including Windows with msvcrt lock (docs/rfc/windows.md step 2)."""
    return True


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
    """Exclusive across processes (the app and `jat snapshot`/`jat push`).
    On Linux and macOS uses fcntl.flock; on Windows uses msvcrt.locking with retries
    so it waits as long as Linux does and never empties the lock file.
    Only failing to take the lock raises LockError; errors from the caller's
    block pass through unchanged."""
    path = lock_path(data_dir)
    if fcntl is not None:
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
    elif msvcrt is not None:
        try:
            fh = open(path, "a+b")  # noqa: SIM115
        except OSError as exc:
            raise LockError(path, exc) from exc
        with fh:
            while True:
                try:
                    fh.seek(0)
                    msvcrt.locking(fh.fileno(), msvcrt.LK_NBLCK, 1)
                    break
                except OSError as exc:
                    if exc.errno in (13, 36):  # EACCES (Permission denied) or EDEADLK
                        time.sleep(0.05)
                        continue
                    raise LockError(path, exc) from exc
            try:
                yield
            finally:
                fh.seek(0)
                with contextlib.suppress(OSError):
                    msvcrt.locking(fh.fileno(), msvcrt.LK_UNLCK, 1)
    else:
        yield
