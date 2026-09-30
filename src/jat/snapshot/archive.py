"""A single-file backup of the data directory (PRD FR21): one zip you can keep anywhere.

It holds what the data repo tracks: a fresh export/ (JSON Lines), notes/, files/,
config.toml and .gitignore, under one top-level folder, plus RESTORE.md. The SQLite
database isn't included: `jat restore` rebuilds it from export/. Nor is .git (the history
lives in the data repo) or .tmp. Symlinks are skipped, so nothing outside the data
directory can end up in the archive.
"""

from __future__ import annotations

import zipfile
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from .git import TRACKED, SnapshotService

RESTORE = """# Restoring this backup

1. Unzip it somewhere new, for example `~/jat-restored`.
2. Rebuild the database from `export/`:

       uv run jat --data-dir ~/jat-restored/{root} restore

3. Start the tracker on it:

       uv run jat --data-dir ~/jat-restored/{root} serve

Everything is plain files: `export/*.jsonl` (one JSON object per line), `notes/*.md`
(Markdown with YAML front matter) and `files/` (your attachments, as they were uploaded).
"""


@dataclass
class ArchiveInfo:
    path: Path
    name: str  # the file name to offer: jat-backup-2026-09-30.zip
    files: int
    bytes: int  # uncompressed size of what's inside


def archive_name(day: date | None = None) -> str:
    return f"jat-backup-{(day or date.today()).isoformat()}"


def _members(data_dir: Path) -> list[Path]:
    found: list[Path] = []
    for name in TRACKED:
        path = data_dir / name
        if path.is_symlink():
            continue
        if path.is_file():
            found.append(path)
        elif path.is_dir():
            for f in sorted(path.rglob("*")):
                # Skip symlinks, and anything under a symlinked directory.
                if f.is_file() and not any(p.is_symlink() for p in [f, *f.parents] if data_dir in p.parents):
                    found.append(f)
    return found


def write_archive(service: SnapshotService, dest: Path, *, day: date | None = None) -> ArchiveInfo:
    """Write the zip to `dest` (a new file). Exports first, so the archive is up to date."""
    data_dir = service.data_dir
    root = archive_name(day)
    files = total = 0
    with service.fresh_export(), zipfile.ZipFile(dest, "x", zipfile.ZIP_DEFLATED) as zf:
        for path in _members(data_dir):
            # Notes and files aren't under the export lock: one deleted meanwhile is skipped.
            try:
                size = path.stat().st_size
                zf.write(path, f"{root}/{path.relative_to(data_dir).as_posix()}")
            except FileNotFoundError:
                continue
            files += 1
            total += size
        zf.writestr(f"{root}/RESTORE.md", RESTORE.format(root=root))
    return ArchiveInfo(path=dest, name=f"{root}.zip", files=files, bytes=total)
