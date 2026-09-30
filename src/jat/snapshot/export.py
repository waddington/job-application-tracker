"""JSONL export and restore: the committed, human-readable backup of the database.

export/<table>.jsonl holds one JSON object per row, ordered by id, with columns in schema
order. export/_meta.json records the schema revision and each table's row count, so restore
can check the export is complete and rebuild against the schema it was written with.
The SQLite file itself is never committed; `restore` rebuilds it from export/.

Safety rules:
- Export reads every table inside one transaction, so it's one consistent snapshot.
- Restore validates everything it can first, builds the new database in a temporary file,
  and only swaps it in once it's complete. On any failure the existing database and export
  are left untouched. A replaced database is moved aside, never deleted.
"""

from __future__ import annotations

import json
import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import JSON, Boolean, Engine, MetaData, Table, text

from ..datadir import DB_NAME
from ..db import current_revision, db_path, head_revision, is_known_revision, make_engine, migrate
from ..db.models import DERIVED_TABLES, exported_tables

FORMAT_VERSION = 1
META_FILE = "_meta.json"
SKIP_TABLES = DERIVED_TABLES | {"alembic_version"}


class RestoreError(RuntimeError):
    pass


class ExportError(RuntimeError):
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
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)
        fh.flush()
        os.fsync(fh.fileno())
    os.replace(tmp, path)


def _lines(path: Path) -> list[str]:
    # Split on "\n" only: str.splitlines() also splits on U+2028/U+2029/U+0085, which
    # json.dumps(ensure_ascii=False) leaves unescaped inside strings.
    return [line for line in path.read_text(encoding="utf-8").split("\n") if line.strip()]


def export_db(engine: Engine, export_dir: Path) -> list[Path]:
    """Write every exported table to export_dir as one consistent snapshot."""
    export_dir.mkdir(parents=True, exist_ok=True)
    contents: dict[str, str] = {}
    counts: dict[str, int] = {}
    with engine.begin() as conn:  # one read transaction for every table and the revision
        revision = current_revision(conn)
        if revision != head_revision():
            raise ExportError(f"database schema is {revision}, expected {head_revision()}; run `jat migrate` first")
        for table in exported_tables():
            cols = ", ".join(f'"{c.name}"' for c in table.columns)
            rows = conn.execute(text(f'SELECT {cols} FROM "{table.name}" ORDER BY id')).all()
            contents[table.name] = "".join(_dump_row(table, row) + "\n" for row in rows)
            counts[table.name] = len(rows)
    written = []
    for name, content in contents.items():
        path = export_dir / f"{name}.jsonl"
        _write_atomic(path, content)
        written.append(path)
    meta = {"format": FORMAT_VERSION, "schema_revision": revision, "tables": counts}
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


def _read_export(export_dir: Path) -> tuple[str, dict[str, list[dict]]]:
    """Load and validate the export. Raises RestoreError before anything is written."""
    meta_path = export_dir / META_FILE
    if not meta_path.exists():
        raise RestoreError(f"No export found: {meta_path} is missing.")
    try:
        meta = json.loads(meta_path.read_text())
    except json.JSONDecodeError as exc:
        raise RestoreError(f"{meta_path} is not valid JSON: {exc}") from exc
    if meta.get("format") != FORMAT_VERSION:
        raise RestoreError(f"Unsupported export format {meta.get('format')!r}.")
    revision = meta.get("schema_revision")
    if not revision:
        raise RestoreError("The export has no schema revision.")
    if not is_known_revision(revision):
        raise RestoreError(f"The export was written by a newer or unknown schema ({revision}); update the app first.")
    tables = meta.get("tables")
    if not isinstance(tables, dict):
        raise RestoreError("The export's _meta.json has no table list.")

    rows: dict[str, list[dict]] = {}
    for name, expected in tables.items():
        file = export_dir / f"{name}.jsonl"
        if not file.exists():
            raise RestoreError(f"The export is incomplete: {file.name} is missing.")
        parsed = []
        for number, line in enumerate(_lines(file), start=1):
            try:
                parsed.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise RestoreError(f"{file.name} line {number} is not valid JSON: {exc}") from exc
        if len(parsed) != expected:
            raise RestoreError(f"{file.name} has {len(parsed)} rows but _meta.json says {expected}.")
        rows[name] = parsed
    extra = {p.stem for p in export_dir.glob("*.jsonl")} - set(tables)
    if extra:
        raise RestoreError(f"Unexpected export files not listed in _meta.json: {sorted(extra)}")
    return revision, rows


def _remove_db_files(path: Path) -> None:
    for suffix in ("", "-wal", "-shm", "-journal"):
        Path(str(path) + suffix).unlink(missing_ok=True)


def _backup_name(path: Path) -> Path:
    stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
    candidate, n = Path(f"{path}.bak-{stamp}"), 1
    while any(Path(str(candidate) + s).exists() for s in ("", "-wal", "-shm")):
        n += 1
        candidate = Path(f"{path}.bak-{stamp}-{n}")
    return candidate


def _build(tmp: Path, revision: str, rows: dict[str, list[dict]]) -> dict[str, int]:
    """Create a complete database at `tmp` from the export's rows."""
    migrate(tmp, revision, wal=False)
    engine = make_engine(tmp, wal=False)
    counts: dict[str, int] = {}
    try:
        with engine.begin() as conn:
            metadata = MetaData()
            metadata.reflect(conn)  # the schema as of the export's revision, not today's models
            known = {t.name for t in metadata.sorted_tables} - SKIP_TABLES
            unknown = set(rows) - known
            if unknown:
                raise RestoreError(f"Export has tables the schema at {revision} doesn't: {sorted(unknown)}")
            for table in metadata.sorted_tables:
                if table.name in SKIP_TABLES:
                    continue
                data = rows.get(table.name, [])
                if data:
                    conn.execute(table.insert(), data)
                counts[table.name] = len(data)
    finally:
        engine.dispose()
    migrate(tmp, "head", wal=False)
    return counts


def restore_data_dir(data_dir: Path, force: bool = False) -> dict[str, int]:
    """Rebuild tracker.sqlite3 from export/. Returns row counts per table."""
    path = db_path(data_dir)
    if path.exists() and not force:
        raise RestoreError(f"{path} already exists. Use --force to move it aside and restore.")
    revision, rows = _read_export(data_dir / "export")

    tmp = data_dir / f"{DB_NAME}.restoring"
    _remove_db_files(tmp)
    try:
        counts = _build(tmp, revision, rows)
    except RestoreError:
        _remove_db_files(tmp)
        raise
    except Exception as exc:  # e.g. IntegrityError, MigrationError
        _remove_db_files(tmp)
        raise RestoreError(f"Restore failed; nothing was changed: {exc}") from exc

    if path.exists():
        backup = _backup_name(path)
        for suffix in ("", "-wal", "-shm"):
            old = Path(str(path) + suffix)
            if old.exists():
                old.rename(Path(str(backup) + suffix))
    os.replace(tmp, path)
    return counts
