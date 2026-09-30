"""JSONL export and restore: the committed, human-readable backup of the database.

export/<table>.jsonl holds one JSON object per row, ordered by id, with columns in schema
order. export/_meta.json records the schema revision so restore can migrate correctly.
The SQLite file itself is never committed; `restore` rebuilds it from export/.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import JSON, Boolean, Engine, Table, text

from ..db import current_revision, db_path, make_engine, migrate
from ..db.models import exported_tables

FORMAT_VERSION = 1
META_FILE = "_meta.json"


class RestoreError(RuntimeError):
    pass


def _dump_row(table: Table, row) -> str:
    out = {}
    for column, value in zip(table.columns, row, strict=True):
        if value is not None and isinstance(column.type, JSON):
            value = json.loads(value)
        elif value is not None and isinstance(column.type, Boolean):
            value = bool(value)
        out[column.name] = value
    return json.dumps(out, ensure_ascii=False, separators=(",", ":"))


def _write_atomic(path: Path, content: str) -> None:
    tmp = path.with_name(path.name + ".tmp")
    tmp.write_text(content, encoding="utf-8")
    os.replace(tmp, path)


def export_db(engine: Engine, export_dir: Path) -> list[Path]:
    """Write every exported table to export_dir. Returns the files written."""
    export_dir.mkdir(parents=True, exist_ok=True)
    written = []
    with engine.connect() as conn:
        for table in exported_tables():
            cols = ", ".join(f'"{c.name}"' for c in table.columns)
            rows = conn.execute(text(f'SELECT {cols} FROM "{table.name}" ORDER BY id')).all()
            content = "".join(_dump_row(table, row) + "\n" for row in rows)
            path = export_dir / f"{table.name}.jsonl"
            _write_atomic(path, content)
            written.append(path)
    meta = {"format": FORMAT_VERSION, "schema_revision": current_revision(engine)}
    meta_path = export_dir / META_FILE
    _write_atomic(meta_path, json.dumps(meta, indent=2) + "\n")
    written.append(meta_path)
    return written


def export_data_dir(data_dir: Path) -> list[Path]:
    engine = make_engine(db_path(data_dir))
    try:
        return export_db(engine, data_dir / "export")
    finally:
        engine.dispose()


def restore_data_dir(data_dir: Path, force: bool = False) -> dict[str, int]:
    """Rebuild tracker.sqlite3 from export/. Returns row counts per table.

    An existing database is refused unless `force`, in which case it is moved aside to
    tracker.sqlite3.bak-<timestamp> (never deleted).
    """
    export_dir = data_dir / "export"
    meta_path = export_dir / META_FILE
    if not meta_path.exists():
        raise RestoreError(f"No export found: {meta_path} is missing.")
    meta = json.loads(meta_path.read_text())
    if meta.get("format") != FORMAT_VERSION:
        raise RestoreError(f"Unsupported export format {meta.get('format')!r}.")

    path = db_path(data_dir)
    if path.exists():
        if not force:
            raise RestoreError(f"{path} already exists. Use --force to move it aside and restore.")
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
        for suffix in ("", "-wal", "-shm"):
            old = Path(str(path) + suffix)
            if old.exists():
                old.rename(Path(f"{path}.bak-{stamp}{suffix}"))

    revision = meta.get("schema_revision")
    migrate(path, revision or "base")
    counts: dict[str, int] = {}
    engine = make_engine(path)
    try:
        with engine.begin() as conn:
            for table in exported_tables():
                file = export_dir / f"{table.name}.jsonl"
                rows = []
                if file.exists():
                    for line in file.read_text(encoding="utf-8").splitlines():
                        if line.strip():
                            rows.append(json.loads(line))
                if rows:
                    conn.execute(table.insert(), rows)
                counts[table.name] = len(rows)
    finally:
        engine.dispose()
    migrate(path, "head")
    return counts
