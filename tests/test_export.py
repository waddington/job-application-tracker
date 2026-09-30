import json
import shutil

import pytest

from jat.datadir import init_data_dir
from jat.db import db_path, make_engine, migrate, session_factory
from jat.db.models import exported_tables
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
