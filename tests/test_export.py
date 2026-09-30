import json
import shutil

import pytest

from jat.datadir import init_data_dir
from jat.db import db_path, make_engine, migrate, session_factory
from jat.db.models import Company, exported_tables
from jat.snapshot import RestoreError, export_data_dir, restore_data_dir
from tests.factories import populate


@pytest.fixture
def data_dir(tmp_path):
    path = tmp_path / "data"
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    engine = make_engine(db_path(path))
    with session_factory(engine).begin() as s:
        populate(s)
    engine.dispose()
    return path


def read_export(path):
    return {p.name: p.read_bytes() for p in sorted((path / "export").glob("*.json*"))}


def test_export_writes_every_table(data_dir):
    export_data_dir(data_dir)
    files = read_export(data_dir)
    for table in exported_tables():
        assert f"{table.name}.jsonl" in files
        assert files[f"{table.name}.jsonl"].count(b"\n") >= 1, table.name
    assert "note_index.jsonl" not in files
    row = json.loads(files["applications.jsonl"].splitlines()[0])
    assert row["tags"] == ["python", "fintech"] and row["archived"] is False
    assert row["applied_on"] == "2026-09-28"
    assert row["last_activity_at"].endswith("Z")
    assert "Ünïcödé ✓" in files["interviews.jsonl"].decode()
    meta = json.loads(files["_meta.json"])
    assert meta["format"] == 1 and meta["schema_revision"]


def test_export_is_deterministic(data_dir):
    export_data_dir(data_dir)
    first = read_export(data_dir)
    export_data_dir(data_dir)
    assert read_export(data_dir) == first


def test_round_trip_restore(data_dir, tmp_path):
    export_data_dir(data_dir)
    original = read_export(data_dir)

    fresh = tmp_path / "fresh"
    init_data_dir(fresh, commit=False)
    shutil.copytree(data_dir / "export", fresh / "export", dirs_exist_ok=True)
    counts = restore_data_dir(fresh)
    assert counts["applications"] == 1 and counts["contact_details"] == 2

    export_data_dir(fresh)
    assert read_export(fresh) == original


def test_restore_refuses_existing_db_unless_forced(data_dir):
    export_data_dir(data_dir)
    with pytest.raises(RestoreError, match="already exists"):
        restore_data_dir(data_dir)
    restore_data_dir(data_dir, force=True)
    backups = list(data_dir.glob("tracker.sqlite3.bak-*"))
    assert backups, "the old database must be kept, not deleted"


def test_restore_without_export(tmp_path):
    with pytest.raises(RestoreError, match="No export"):
        restore_data_dir(tmp_path)


def _fresh_with_export(data_dir, tmp_path, name="fresh"):
    export_data_dir(data_dir)
    fresh = tmp_path / name
    init_data_dir(fresh, commit=False)
    shutil.copytree(data_dir / "export", fresh / "export", dirs_exist_ok=True)
    return fresh


def test_line_separator_characters_survive_round_trip(tmp_path):
    path = tmp_path / "data"
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    engine = make_engine(db_path(path))
    tricky = "pasted from a page\x85with \r odd breaks"
    with session_factory(engine).begin() as s:
        s.add(Company(name="Contoso", description=tricky))
    engine.dispose()
    fresh = _fresh_with_export(path, tmp_path)
    restore_data_dir(fresh)
    export_data_dir(fresh)
    assert read_export(fresh) == read_export(path)
    # U+2028 is written unescaped, which is exactly what used to break restore.
    assert " " in (fresh / "export" / "companies.jsonl").read_text(encoding="utf-8")


def test_failed_restore_changes_nothing(data_dir, tmp_path):
    fresh = _fresh_with_export(data_dir, tmp_path)
    events = fresh / "export" / "events.jsonl"
    events.write_text(events.read_text().replace('"stage_change"', '"stage_change', 1))
    with pytest.raises(RestoreError, match="not valid JSON"):
        restore_data_dir(fresh)
    assert not (fresh / "tracker.sqlite3").exists()
    assert not list(fresh.glob("tracker.sqlite3.restoring*"))

    # With --force, a failure must leave the existing database in place.
    before = (data_dir / "tracker.sqlite3").read_bytes()
    shutil.copy(events, data_dir / "export" / "events.jsonl")
    with pytest.raises(RestoreError):
        restore_data_dir(data_dir, force=True)
    assert (data_dir / "tracker.sqlite3").read_bytes() == before
    assert not list(data_dir.glob("tracker.sqlite3.bak-*"))


def test_integrity_error_is_a_clean_restore_error(data_dir, tmp_path):
    fresh = _fresh_with_export(data_dir, tmp_path)
    roles = fresh / "export" / "roles.jsonl"
    row = json.loads(roles.read_text())
    row["company_id"] = "no-such-company"
    roles.write_text(json.dumps(row) + "\n")
    with pytest.raises(RestoreError, match="nothing was changed"):
        restore_data_dir(fresh)
    assert not (fresh / "tracker.sqlite3").exists()


def test_restore_validates_export_completeness(data_dir, tmp_path):
    fresh = _fresh_with_export(data_dir, tmp_path)
    (fresh / "export" / "links.jsonl").unlink()
    with pytest.raises(RestoreError, match="links.jsonl is missing"):
        restore_data_dir(fresh)

    fresh = _fresh_with_export(data_dir, tmp_path, "fresh2")
    (fresh / "export" / "links.jsonl").write_text("")
    with pytest.raises(RestoreError, match="has 0 rows but _meta.json says 1"):
        restore_data_dir(fresh)

    fresh = _fresh_with_export(data_dir, tmp_path, "fresh3")
    (fresh / "export" / "mystery.jsonl").write_text("{}\n")
    with pytest.raises(RestoreError, match="Unexpected export files"):
        restore_data_dir(fresh)


def test_restore_rejects_unknown_revision(data_dir, tmp_path):
    fresh = _fresh_with_export(data_dir, tmp_path)
    meta_path = fresh / "export" / "_meta.json"
    meta = json.loads(meta_path.read_text())
    meta["schema_revision"] = "9999_future"
    meta_path.write_text(json.dumps(meta))
    with pytest.raises(RestoreError, match="newer or unknown schema"):
        restore_data_dir(fresh)


def test_repeated_forced_restores_keep_every_backup(data_dir):
    export_data_dir(data_dir)
    restore_data_dir(data_dir, force=True)
    restore_data_dir(data_dir, force=True)
    backups = [p for p in data_dir.glob("tracker.sqlite3.bak-*") if not p.name.endswith(("-wal", "-shm"))]
    assert len(backups) == 2
