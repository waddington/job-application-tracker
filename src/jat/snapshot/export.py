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
import logging
import os
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import JSON, Boolean, Engine, MetaData, Table, text

from ..datadir import DB_NAME
from ..db import current_revision, db_path, head_revision, is_known_revision, make_engine, migrate
from ..db.models import DERIVED_TABLES, exported_tables
from ..platform import FileLocked, remove_temp, replace_with_retry

log = logging.getLogger(__name__)
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
    try:
        replace_with_retry(tmp, path)
    except BaseException:
        remove_temp(tmp)
        raise


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
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
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

    _swap_in(tmp, path)
    return counts


def _swap_in(tmp: Path, path: Path) -> None:
    """Move the old database files aside and the restored one into place. If any step fails, or
    the restore is interrupted (Ctrl-C during a retry's wait), put the old files back first, so
    either everything changed or nothing did."""
    backup = _backup_name(path) if path.exists() else None
    try:
        if backup is not None:
            for suffix in ("", "-wal", "-shm"):
                old = Path(str(path) + suffix)
                if old.exists():
                    replace_with_retry(old, Path(str(backup) + suffix))  # a free name: _backup_name checked
        replace_with_retry(tmp, path)
    except BaseException as exc:
        why = f"{DB_NAME} is open in another program" if isinstance(exc, FileLocked) else str(exc)
        stuck = _put_back(path, backup)
        if stuck:
            # Keep the restored copy as well: with the old files half moved, nothing is deleted.
            raise RestoreError(
                f"Couldn't swap in the restored database ({why or type(exc).__name__}), nor put the old one "
                f"back. Nothing was deleted: your old database files are at {', '.join(map(str, stuck))}, and "
                f"the restored one is at {tmp}. Stop `jat serve`, then rename the old files back to {path.name}."
            ) from exc
        try:
            _remove_db_files(tmp)
        except OSError:  # the old database is back; a leftover copy mustn't hide that
            log.warning("couldn't delete the unused restored database %s", tmp, exc_info=True)
        if not isinstance(exc, OSError):
            raise  # Ctrl-C and the like, with everything put back
        raise RestoreError(
            f"Couldn't swap in the restored database ({why}); nothing was changed. "
            "Stop `jat serve` if it's running, then run `jat restore --force` again."
        ) from exc


def _put_back(path: Path, backup: Path | None) -> list[Path]:
    """Move each old database file set aside back to its own name; return those still aside.
    Checked by name, not by a list of moves, so a file moved just before an interrupt counts."""
    stuck = []
    for suffix in ("", "-wal", "-shm") if backup is not None else ():
        was, now = Path(str(path) + suffix), Path(str(backup) + suffix)
        if now.exists() and not was.exists():
            try:
                replace_with_retry(now, was)
            except OSError:
                log.error("couldn't move %s back to %s", now, was, exc_info=True)
                stuck.append(now)
    return stuck
