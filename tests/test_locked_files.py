import io
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from jat.cli import main
from jat.db import head_revision
from jat.platform import replace_with_retry, unlink_with_retry
from jat.snapshot.export import ExportError, RestoreError, _write_atomic, restore_data_dir


def test_replace_with_retry_succeeds(tmp_path: Path):
    src = tmp_path / "src.txt"
    dst = tmp_path / "dst.txt"
    src.write_text("hello", encoding="utf-8")
    replace_with_retry(src, dst)
    assert not src.exists()
    assert dst.read_text(encoding="utf-8") == "hello"


def test_replace_with_retry_retries_and_succeeds_after_transient_error(tmp_path: Path, monkeypatch):
    src = tmp_path / "src.txt"
    dst = tmp_path / "dst.txt"
    src.write_text("hello", encoding="utf-8")

    real_replace = os.replace
    calls = 0

    def fake_replace(s, d):
        nonlocal calls
        calls += 1
        if calls < 3:
            raise PermissionError(13, "Access is denied (locked by antivirus)")
        return real_replace(s, d)

    monkeypatch.setattr(os, "replace", fake_replace)
    replace_with_retry(src, dst, attempts=5, delay=0.001)
    assert calls == 3
    assert dst.read_text(encoding="utf-8") == "hello"


def test_replace_with_retry_exhausts_retries_and_raises(tmp_path: Path, monkeypatch):
    src = tmp_path / "src.txt"
    dst = tmp_path / "dst.txt"
    src.write_text("hello", encoding="utf-8")

    calls = 0

    def fake_replace(s, d):
        nonlocal calls
        calls += 1
        raise PermissionError(13, "Access is denied (locked by OneDrive)")

    monkeypatch.setattr(os, "replace", fake_replace)
    with pytest.raises(PermissionError, match="locked by OneDrive"):
        replace_with_retry(src, dst, attempts=3, delay=0.001)
    assert calls == 3


def test_unlink_with_retry(tmp_path: Path, monkeypatch):
    target = tmp_path / "target.txt"
    target.write_text("content", encoding="utf-8")

    calls = 0
    orig_unlink = Path.unlink

    def fake_unlink(self, missing_ok=False):
        nonlocal calls
        calls += 1
        if calls < 2:
            raise PermissionError(13, "File open in editor")
        return orig_unlink(self, missing_ok=missing_ok)

    monkeypatch.setattr(Path, "unlink", fake_unlink)
    unlink_with_retry(target, attempts=4, delay=0.001)
    assert not target.exists()
    assert calls == 2


def test_note_save_when_file_locked_returns_409_not_500(client: TestClient, monkeypatch):
    def fake_replace(*args, **kwargs):
        raise PermissionError(13, "File open in external editor")

    monkeypatch.setattr("jat.storage.notes.replace_with_retry", fake_replace)

    # Creating a note
    res = client.post("/api/v1/notes", json={"title": "Test Note", "body": "Body", "links": []})
    assert res.status_code == 409
    assert "file is open in another program" in res.json()["detail"]


def test_attachment_upload_when_file_locked_returns_409_not_500(client: TestClient, monkeypatch):
    def fake_replace(*args, **kwargs):
        raise PermissionError(13, "File open in antivirus scan")

    monkeypatch.setattr("jat.storage.files.replace_with_retry", fake_replace)

    res = client.post(
        "/api/v1/attachments",
        files={"file": ("resume.pdf", io.BytesIO(b"PDF content"), "application/pdf")},
    )
    assert res.status_code == 409
    assert "file is open in another program" in res.json()["detail"]


def test_export_atomic_write_when_file_locked_raises_export_error(tmp_path: Path, monkeypatch):
    def fake_replace(*args, **kwargs):
        raise PermissionError(13, "Locked by indexer")

    monkeypatch.setattr("jat.snapshot.export.replace_with_retry", fake_replace)

    with pytest.raises(ExportError, match="file is open in another program"):
        _write_atomic(tmp_path / "applications.jsonl", "{}")


def test_restore_force_when_db_locked_says_stop_jat_serve_first(tmp_path: Path, monkeypatch):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "export").mkdir()
    rev = head_revision()
    (data_dir / "export" / "_meta.json").write_text(
        f'{{"format": 1, "schema_revision": "{rev}", "tables": {{}}}}',
        encoding="utf-8",
    )
    db = data_dir / "tracker.sqlite3"
    db.write_text("sqlite", encoding="utf-8")

    # Mock replace_with_retry in export to fail with PermissionError mimicking locked DB
    def fake_replace(*args, **kwargs):
        raise PermissionError(32, "The process cannot access the file because it is being used by another process")

    monkeypatch.setattr("jat.snapshot.export.replace_with_retry", fake_replace)

    with pytest.raises(RestoreError, match="stop `jat serve` first"):
        restore_data_dir(data_dir, force=True)


def test_cli_restore_force_when_db_locked_prints_clear_error_and_no_traceback(tmp_path: Path, monkeypatch, capsys):
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    (data_dir / "export").mkdir()
    rev = head_revision()
    (data_dir / "export" / "_meta.json").write_text(
        f'{{"format": 1, "schema_revision": "{rev}", "tables": {{}}}}',
        encoding="utf-8",
    )
    db = data_dir / "tracker.sqlite3"
    db.write_text("sqlite", encoding="utf-8")

    def fake_replace(*args, **kwargs):
        raise PermissionError(32, "Sharing violation")

    monkeypatch.setattr("jat.snapshot.export.replace_with_retry", fake_replace)

    exit_code = main(["--data-dir", str(data_dir), "restore", "--force"])
    assert exit_code == 2
    err = capsys.readouterr().err
    assert "error: Couldn't replace database: stop `jat serve` first" in err
    assert "Traceback" not in err
