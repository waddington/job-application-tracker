"""What differs on Windows, in one place (docs/rfc/windows.md, step 1).

The rest of the code asks `is_windows()` and `snapshots_allowed()` and takes the lock through
`process_lock()`; nothing else imports `fcntl`. Step 2 swaps in a Windows lock here.
Files are replaced and deleted through `replace_with_retry()` and `unlink_with_retry()`, which ride
out a file another program has open on Windows (`locked-file-retry`).
"""

from __future__ import annotations

import contextlib
import logging
import os
import sys
import time
from collections.abc import Callable, Iterator, Sequence
from pathlib import Path

try:
    import fcntl
except ImportError:  # Windows: no lock until step 2 adds one (msvcrt)
    fcntl = None

IS_WINDOWS: bool = sys.platform == "win32"
LOCK_NAME = "jat-snapshot.lock"
log = logging.getLogger(__name__)


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


# Windows refuses to replace or delete a file another program has open (an editor, antivirus,
# OneDrive). These are the errors that means; anything else is a real failure.
_LOCK_WINERRORS = frozenset({5, 32, 33})  # access denied, sharing violation, lock violation
# (5 also covers a read-only destination, which is then retried too: accepted, it costs 1.5 s.)
# The waits between attempts: 6 attempts over about 1.5 seconds.
LOCK_RETRY_DELAYS: tuple[float, ...] = (0.05, 0.1, 0.2, 0.4, 0.8)


class FileLocked(OSError):
    """Another program kept a file open through every retry. Only raised on Windows."""

    def __init__(self, path: Path, cause: OSError):
        super().__init__(f"{path} is open in another program; close it there and try again")
        self.path = path
        self.cause = cause


def is_lock_error(exc: BaseException) -> bool:
    """Whether `exc` is Windows saying another program has the file open."""
    return is_windows() and isinstance(exc, OSError) and getattr(exc, "winerror", None) in _LOCK_WINERRORS


def is_read_lock_error(exc: BaseException) -> bool:
    """Like is_lock_error, for reading a file with open(): that goes through the C runtime, which
    reports Windows' sharing violation as a plain PermissionError with no winerror (seen in the
    Windows VM, #376). So on Windows, any PermissionError without one counts."""
    if is_lock_error(exc):
        return True
    return is_windows() and isinstance(exc, PermissionError) and getattr(exc, "winerror", None) is None


def _retry_on_lock(op: Callable[[], None], path: Path, what: str, delays: Sequence[float] | None) -> None:
    waits = LOCK_RETRY_DELAYS if delays is None else delays
    for attempt in range(1, len(waits) + 2):
        try:
            op()
            return
        except OSError as exc:
            if not is_lock_error(exc):
                raise
            if attempt > len(waits):
                log.error("couldn't %s %s: still open in another program after %d attempts", what, path, attempt)
                raise FileLocked(path, exc) from exc
            log.warning("couldn't %s %s (attempt %d): open in another program; retrying", what, path, attempt)
            time.sleep(waits[attempt - 1])


def replace_with_retry(src: Path | str, dst: Path | str, *, delays: Sequence[float] | None = None) -> None:
    """os.replace(src, dst), retried briefly while Windows says another program has a file open,
    then FileLocked. Any other error raises at once. `delays` defaults to LOCK_RETRY_DELAYS."""
    _retry_on_lock(lambda: os.replace(src, dst), Path(dst), "replace", delays)


def remove_temp(path: Path | str) -> None:
    """Delete a temporary file after a failed write. Never raises, so the write's own error is the
    one that propagates (antivirus may be holding the temp file too); one left behind is logged."""
    try:
        Path(path).unlink(missing_ok=True)
    except OSError:
        log.warning("couldn't delete the temporary file %s; it's left behind", path, exc_info=True)


def unlink_with_retry(path: Path | str, *, missing_ok: bool = True, delays: Sequence[float] | None = None) -> None:
    """Path.unlink, retried and raising like replace_with_retry."""
    p = Path(path)
    _retry_on_lock(lambda: p.unlink(missing_ok=missing_ok), p, "delete", delays)
