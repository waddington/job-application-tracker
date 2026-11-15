"""A file another program has open on Windows (locked-file-retry, docs/rfc/windows.md).

Windows is faked (`jat.platform.IS_WINDOWS`), lock errors carry winerror 32 as Windows' would, and
`jat.platform.time` is swapped for a recorder, so no test really sleeps.
"""

from __future__ import annotations

import errno
import logging
import os
import zipfile
from pathlib import Path
from types import SimpleNamespace

import pytest
from sqlalchemy import select

from jat import platform
from jat.cli import main
from jat.datadir import init_data_dir
from jat.db import db_path, make_engine, migrate, session_factory
from jat.db.models import Attachment, DocumentVersion, NoteIndex
from jat.platform import LOCK_RETRY_DELAYS, FileLocked, replace_with_retry, unlink_with_retry
from jat.snapshot import RestoreError, export_data_dir, restore_data_dir
from jat.snapshot import export as export_module

from .factories import populate, post

LOCKED_TEXT = "A file is open in another program (an editor, antivirus or OneDrive). Close it there and try again."


def lock_error(winerror: int = 32) -> PermissionError:
    exc = PermissionError(errno.EACCES, "The process cannot access the file because it is being used")
    exc.winerror = winerror  # set by Windows only; POSIX's OSError has no such argument
    return exc


@pytest.fixture
def sleeps(monkeypatch) -> list[float]:
    """Fake Windows, and record the waits instead of sleeping."""
    waited: list[float] = []
    monkeypatch.setattr(platform, "IS_WINDOWS", True)
    monkeypatch.setattr(platform, "time", SimpleNamespace(sleep=waited.append))
    return waited


@pytest.fixture
def lock(monkeypatch, sleeps):
    """os.replace and Path.unlink fail as locked for the paths `state.match(src, dst)` picks
    (for unlink, both are the path). `state.calls` counts the failures."""
    state = SimpleNamespace(match=lambda src, dst: False, calls=0, error=lock_error)
    real_replace, real_unlink = os.replace, Path.unlink

    def replace(src, dst):
        if state.match(Path(src), Path(dst)):
            state.calls += 1
            raise state.error()
        return real_replace(src, dst)

    def unlink(self, missing_ok=False):
        if state.match(self, self):
            state.calls += 1
            raise state.error()
        return real_unlink(self, missing_ok=missing_ok)

    monkeypatch.setattr(os, "replace", replace)
    monkeypatch.setattr(Path, "unlink", unlink)
    return state


# --- the helpers ---------------------------------------------------------------------------


@pytest.mark.parametrize("winerror", [5, 32, 33])
def test_a_lock_is_retried_until_it_clears(tmp_path, lock, sleeps, winerror):
    src, dst = tmp_path / "src", tmp_path / "dst"
    src.write_text("new", encoding="utf-8")
    lock.error = lambda: lock_error(winerror)
    lock.match = lambda s, d: lock.calls < 3
    replace_with_retry(src, dst)
    assert dst.read_text(encoding="utf-8") == "new"
    assert lock.calls == 3
    assert sleeps == [0.05, 0.1, 0.2]


def test_a_lock_that_stays_raises_file_locked_after_six_attempts(tmp_path, lock, sleeps, caplog):
    src, dst = tmp_path / "src", tmp_path / "dst"
    src.write_text("new", encoding="utf-8")
    dst.write_text("old", encoding="utf-8")
    lock.match = lambda s, d: True
    with caplog.at_level(logging.WARNING, logger="jat.platform"), pytest.raises(FileLocked) as raised:
        replace_with_retry(src, dst)
    assert raised.value.path == dst
    assert lock.calls == 6
    assert sleeps == list(LOCK_RETRY_DELAYS) == [0.05, 0.1, 0.2, 0.4, 0.8]
    assert dst.read_text(encoding="utf-8") == "old"
    levels = [r.levelname for r in caplog.records]
    assert levels == ["WARNING"] * 5 + ["ERROR"]
    assert all(str(dst) in r.getMessage() for r in caplog.records)
    assert "attempt 1" in caplog.records[0].getMessage()


@pytest.mark.parametrize(
    "error",
    [
        lambda: OSError(errno.ENOSPC, "No space left on device"),
        lambda: PermissionError(errno.EACCES, "Permission denied"),  # Linux: no winerror
        lambda: lock_error(winerror=3),  # Windows: path not found
    ],
)
def test_other_errors_raise_at_once_without_retrying(tmp_path, lock, sleeps, error):
    src = tmp_path / "src"
    src.write_text("new", encoding="utf-8")
    lock.error = error
    lock.match = lambda s, d: True
    with pytest.raises(OSError) as raised:
        replace_with_retry(src, tmp_path / "dst")
    assert not isinstance(raised.value, FileLocked)
    assert lock.calls == 1
    assert sleeps == []


def test_off_windows_a_lock_error_is_not_retried(tmp_path, lock, sleeps, monkeypatch):
    monkeypatch.setattr(platform, "IS_WINDOWS", False)
    target = tmp_path / "f"
    target.write_text("x", encoding="utf-8")
    lock.match = lambda s, d: True
    with pytest.raises(PermissionError) as raised:
        unlink_with_retry(target)
    assert not isinstance(raised.value, FileLocked)
    assert lock.calls == 1
    assert sleeps == []


def test_unlink_takes_its_own_delays(tmp_path, lock, sleeps):
    target = tmp_path / "f"
    target.write_text("x", encoding="utf-8")
    lock.match = lambda s, d: True
    with pytest.raises(FileLocked):
        unlink_with_retry(target, delays=(0, 0))
    assert lock.calls == 3
    assert sleeps == [0, 0]
    assert target.exists()


# --- the API: a 409 with a code, and nothing changed ----------------------------------------


def assert_locked(r, tmp_path):
    assert r.status_code == 409, r.text
    assert r.json() == {"detail": LOCKED_TEXT, "code": "file_locked", "params": {}}
    assert str(tmp_path) not in r.text


def index_rows(app) -> list[dict]:
    with app.state.sessions() as s:
        rows = s.scalars(select(NoteIndex).order_by(NoteIndex.id)).all()
        return [{c.name: getattr(row, c.name) for c in NoteIndex.__table__.columns} for row in rows]


def leftovers(data_dir: Path) -> list[Path]:
    """Temporary files a failed save might leave."""
    names = (".tmp-", "upload-", "archive-")
    return [p for p in data_dir.rglob("*") if p.is_file() and (p.name.startswith(names) or p.suffix == ".tmp")]


def test_creating_a_note_when_locked(app, client, lock, tmp_path):
    lock.match = lambda s, d: s != d and d.suffix == ".md"  # the save, not its temp file's clean-up
    r = client.post("/api/v1/notes", json={"title": "Call notes", "body": "Hello", "links": []})
    assert_locked(r, tmp_path)
    data_dir = app.state.jat.data_dir
    assert not list((data_dir / "notes").rglob("*.md"))
    assert index_rows(app) == []
    assert leftovers(data_dir) == []


def test_saving_a_note_when_locked(app, client, lock, tmp_path):
    note = post(client, "/api/v1/notes", {"title": "Call notes", "body": "Before", "links": []})
    file = app.state.jat.data_dir / "notes" / note["path"]
    before, rows = file.read_bytes(), index_rows(app)
    lock.match = lambda s, d: d == file
    assert_locked(client.patch(f"/api/v1/notes/{note['id']}", json={"title": "New", "body": "After"}), tmp_path)
    assert file.read_bytes() == before
    assert index_rows(app) == rows
    assert leftovers(app.state.jat.data_dir) == []
    assert client.get(f"/api/v1/notes/{note['id']}").json()["body"].strip() == "Before"


def test_deleting_a_note_when_locked(app, client, lock, tmp_path):
    note = post(client, "/api/v1/notes", {"title": "Call notes", "body": "Keep me", "links": []})
    file = app.state.jat.data_dir / "notes" / note["path"]
    before, rows = file.read_bytes(), index_rows(app)
    lock.match = lambda s, d: d == file
    assert_locked(client.delete(f"/api/v1/notes/{note['id']}"), tmp_path)
    assert file.read_bytes() == before
    assert index_rows(app) == rows
    assert client.get(f"/api/v1/notes/{note['id']}").status_code == 200


def stored_files(data_dir: Path) -> list[Path]:
    return [p for p in (data_dir / "files").rglob("*") if p.is_file() and p.name != ".gitkeep"]


def test_uploading_a_file_when_locked(app, client, lock, tmp_path):
    files_dir = app.state.jat.data_dir / "files"
    lock.match = lambda s, d: d.is_relative_to(files_dir)
    r = client.post("/api/v1/attachments", files={"file": ("cv.pdf", b"%PDF-1.4 made up", "application/pdf")})
    assert_locked(r, tmp_path)
    with app.state.sessions() as s:
        assert s.scalars(select(Attachment)).all() == []
    assert stored_files(app.state.jat.data_dir) == []
    assert leftovers(app.state.jat.data_dir) == []


def test_adding_a_document_version_when_locked(app, client, lock, tmp_path):
    doc = post(client, "/api/v1/documents", {"kind": "cv", "name": "Backend CV"})
    files_dir = app.state.jat.data_dir / "files"
    lock.match = lambda s, d: d.is_relative_to(files_dir)
    r = client.post(
        f"/api/v1/documents/{doc['id']}/versions",
        data={"label": "v1"},
        files={"file": ("cv.pdf", b"%PDF-1.4 made up", "application/pdf")},
    )
    assert_locked(r, tmp_path)
    with app.state.sessions() as s:
        assert s.scalars(select(DocumentVersion)).all() == []
        assert s.scalars(select(Attachment)).all() == []
    assert stored_files(app.state.jat.data_dir) == []
    assert leftovers(app.state.jat.data_dir) == []


def test_downloading_a_backup_when_an_export_file_is_locked(app, client, lock, tmp_path):
    data_dir = app.state.jat.data_dir
    assert client.get("/api/v1/backup/archive").status_code == 200  # writes export/ once
    export = {p.name: p.read_bytes() for p in (data_dir / "export").iterdir()}
    post(client, "/api/v1/companies", {"name": "Example Ltd"})  # so the next export differs
    lock.match = lambda s, d: d.name == "companies.jsonl"
    assert_locked(client.get("/api/v1/backup/archive"), tmp_path)
    assert {p.name: p.read_bytes() for p in (data_dir / "export").iterdir()} == export
    assert not list((data_dir / ".tmp").glob("archive-*.zip"))
    assert leftovers(data_dir) == []


# --- deletes after the record is gone: logged, not a 500 --------------------------------------


def test_deleting_an_attachment_whose_file_is_locked_logs_the_orphan(app, client, lock, caplog):
    att = client.post("/api/v1/attachments", files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")}).json()
    file = app.state.jat.data_dir / "files" / att["path"]
    lock.match = lambda s, d: d == file
    with caplog.at_level(logging.WARNING, logger="jat.api.attachments"):
        assert client.delete(f"/api/v1/attachments/{att['id']}").status_code == 204
    assert client.get(f"/api/v1/attachments/{att['id']}").status_code == 404
    assert file.exists()
    assert any("orphaned" in r.getMessage() and att["path"] in r.getMessage() for r in caplog.records)


@pytest.mark.parametrize("what", ["version", "document"])
def test_deleting_a_document_whose_file_is_locked_logs_the_orphan(app, client, lock, caplog, what):
    doc = post(client, "/api/v1/documents", {"kind": "cv", "name": "Backend CV"})
    version = client.post(
        f"/api/v1/documents/{doc['id']}/versions",
        data={"label": "v1"},
        files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")},
    ).json()
    [file] = stored_files(app.state.jat.data_dir)
    lock.match = lambda s, d: d == file
    url = f"/api/v1/documents/versions/{version['id']}" if what == "version" else f"/api/v1/documents/{doc['id']}"
    with caplog.at_level(logging.WARNING, logger="jat.api.attachments"):
        assert client.delete(url).status_code == 204
    assert file.exists()
    assert any("orphaned" in r.getMessage() for r in caplog.records)


def test_a_failed_cleanup_does_not_hide_the_original_error(app, client, lock, monkeypatch, caplog):
    """The upload fails after its file is saved; deleting that file then fails too. The upload's own
    error is the one that comes out, and the leftover file is logged."""
    files_dir = app.state.jat.data_dir / "files"

    def broken(**_):
        raise RuntimeError("the original error")

    monkeypatch.setattr("jat.api.attachments.Attachment", broken)
    lock.match = lambda s, d: s == d and d.is_relative_to(files_dir)  # deletes only
    with caplog.at_level(logging.WARNING, logger="jat.api.attachments"), pytest.raises(RuntimeError, match="original"):
        client.post("/api/v1/attachments", files={"file": ("cv.pdf", b"%PDF-1.4", "application/pdf")})
    assert any("failed save" in r.getMessage() for r in caplog.records)


# --- restore: everything swapped, or nothing ---------------------------------------------------


@pytest.fixture
def restorable(tmp_path):
    """A data folder with an export and a database (with made-up -wal and -shm beside it)."""
    path = tmp_path / "data"
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    engine = make_engine(db_path(path))
    with session_factory(engine).begin() as s:
        populate(s)
    engine.dispose()
    export_data_dir(path)
    db = db_path(path)
    Path(f"{db}-wal").write_bytes(b"old wal")
    Path(f"{db}-shm").write_bytes(b"old shm")
    return path


def db_files(data_dir: Path) -> dict[str, bytes]:
    return {p.name: p.read_bytes() for p in data_dir.iterdir() if p.name.startswith("tracker.sqlite3")}


@pytest.mark.parametrize(
    "fails",
    [
        pytest.param(lambda s, d: s.name.endswith("-wal") and ".bak-" in d.name, id="moving -wal aside"),
        pytest.param(lambda s, d: s != d and s.name.endswith(".restoring"), id="the final replace"),
    ],
)
def test_a_restore_that_fails_part_way_puts_everything_back(restorable, lock, fails):
    before = db_files(restorable)
    assert set(before) == {"tracker.sqlite3", "tracker.sqlite3-wal", "tracker.sqlite3-shm"}
    lock.match = fails
    with pytest.raises(RestoreError, match="nothing was changed") as raised:
        restore_data_dir(restorable, force=True)
    assert "open in another program" in str(raised.value)
    assert db_files(restorable) == before  # no .bak-*, no .restoring left either


def test_a_restore_that_cannot_put_things_back_says_where_they_are(restorable, lock):
    before = db_files(restorable)
    db = db_path(restorable)
    # The final replace fails, and so does moving the main file back from its .bak- name.
    lock.match = lambda s, d: s != d and s.name.endswith(".restoring") or (".bak-" in s.name and d == db)
    with pytest.raises(RestoreError, match="nor put the old one back") as raised:
        restore_data_dir(restorable, force=True)
    [backup] = [p for p in restorable.iterdir() if ".bak-" in p.name]
    message = str(raised.value)
    assert str(backup) in message
    assert str(restorable / "tracker.sqlite3.restoring") in message
    assert backup.read_bytes() == before["tracker.sqlite3"]
    assert (restorable / "tracker.sqlite3.restoring").exists()  # kept: nothing is deleted
    assert Path(f"{db}-wal").read_bytes() == b"old wal"  # these two went back
    assert Path(f"{db}-shm").read_bytes() == b"old shm"


def test_a_restore_whose_old_name_was_taken_meanwhile_says_where_the_old_files_are(restorable, lock):
    """`jat serve` starts during the retries and makes a new tracker.sqlite3: the old one can't go
    back over it, so the message must say where it is, not that nothing changed."""
    before = db_files(restorable)
    db = db_path(restorable)

    def match(s, d):
        if s != d and s.name.endswith(".restoring"):
            if not db.exists():
                db.write_bytes(b"a new, empty database")
            return True
        return False

    lock.match = match
    with pytest.raises(RestoreError, match="nor put the old one back") as raised:
        restore_data_dir(restorable, force=True)
    [backup] = [p for p in restorable.iterdir() if ".bak-" in p.name and not p.name.endswith(("-wal", "-shm"))]
    assert str(backup) in str(raised.value)
    assert "nothing was changed" not in str(raised.value)
    assert backup.read_bytes() == before["tracker.sqlite3"]


def test_ctrl_c_just_after_the_swap_leaves_the_restored_database_alone(restorable, monkeypatch):
    """Interrupted once the restored database is in place: the old -wal and -shm stay aside, so
    SQLite can't replay the old log into the restored database."""
    before = db_files(restorable)
    real = export_module.replace_with_retry

    def replace_then_interrupt(src, dst, **kwargs):
        real(src, dst, **kwargs)
        if Path(src).name.endswith(".restoring"):
            raise KeyboardInterrupt

    monkeypatch.setattr(export_module, "replace_with_retry", replace_then_interrupt)
    with pytest.raises(KeyboardInterrupt):
        restore_data_dir(restorable, force=True)
    db = db_path(restorable)
    assert db.read_bytes() != before["tracker.sqlite3"]  # the restored one
    assert not Path(f"{db}-wal").exists()
    assert not Path(f"{db}-shm").exists()
    aside = {
        p.name.rsplit("-", 1)[-1] if p.name.endswith(("-wal", "-shm")) else "db": p.read_bytes()
        for p in restorable.iterdir()
        if ".bak-" in p.name
    }
    assert aside == {"db": before["tracker.sqlite3"], "wal": b"old wal", "shm": b"old shm"}


def test_a_restore_that_fails_for_another_reason_also_puts_everything_back(restorable, lock):
    before = db_files(restorable)
    lock.error = lambda: OSError(errno.ENOSPC, "No space left on device")
    lock.match = lambda s, d: s != d and s.name.endswith(".restoring")
    with pytest.raises(RestoreError, match="No space left on device.*nothing was changed"):
        restore_data_dir(restorable, force=True)
    assert lock.calls == 1  # not retried
    assert db_files(restorable) == before


def test_jat_restore_force_says_what_happened(restorable, lock, capsys):
    before = db_files(restorable)
    lock.match = lambda s, d: s != d and s.name.endswith(".restoring")
    assert main(["--data-dir", str(restorable), "restore", "--force"]) == 2
    err = capsys.readouterr().err
    assert err.startswith("error: Couldn't swap in the restored database")
    assert "nothing was changed" in err
    assert "Stop `jat serve`" in err
    assert "Traceback" not in err
    assert db_files(restorable) == before


# --- clean-ups and interruptions never hide what happened --------------------------------------


@pytest.mark.parametrize("what", ["note", "upload", "archive"])
def test_a_locked_temp_file_does_not_hide_the_lock(app, client, lock, tmp_path, caplog, what):
    """Antivirus can hold the temp file too: its clean-up then fails, and the answer is still the 409."""
    data_dir = app.state.jat.data_dir
    if what == "note":
        lock.match = lambda s, d: d.suffix == ".md"  # the save and the temp file's clean-up

        def call():
            return client.post("/api/v1/notes", json={"title": "Call", "body": "x", "links": []})
    elif what == "upload":
        lock.match = lambda s, d: d.is_relative_to(data_dir / "files") or (s == d and d.name.startswith("upload-"))

        def call():
            return client.post("/api/v1/attachments", files={"file": ("cv.pdf", b"%PDF", "application/pdf")})
    else:
        lock.match = lambda s, d: d.name.startswith("companies.jsonl")  # the file and companies.jsonl.tmp

        def call():
            return client.get("/api/v1/backup/archive")

    with caplog.at_level(logging.WARNING, logger="jat.platform"):
        assert_locked(call(), tmp_path)
    assert any("temporary file" in r.getMessage() for r in caplog.records)


def test_downloading_a_backup_when_a_note_is_held_open(app, client, lock, tmp_path, monkeypatch):
    """Reading a note for the zip fails with a sharing violation: the same 409, and no zip left."""
    post(client, "/api/v1/notes", {"title": "Call notes", "body": "x", "links": []})
    real_write = zipfile.ZipFile.write

    def write(self, filename, *args, **kwargs):
        if Path(filename).suffix == ".md":
            raise lock_error()
        return real_write(self, filename, *args, **kwargs)

    monkeypatch.setattr(zipfile.ZipFile, "write", write)
    assert_locked(client.get("/api/v1/backup/archive"), tmp_path)
    assert not list((app.state.jat.data_dir / ".tmp").glob("archive-*.zip"))


def test_a_restore_whose_leftover_copy_cannot_be_deleted_still_says_nothing_changed(restorable, lock, capsys):
    before = db_files(restorable)
    # The final replace fails, and so does deleting the unused restored copy afterwards.
    swapping = SimpleNamespace(failed=False)

    def match(s, d):
        if s != d and s.name.endswith(".restoring"):
            swapping.failed = True
            return True
        return swapping.failed and s.name.startswith("tracker.sqlite3.restoring")  # the clean-up after

    lock.match = match
    assert main(["--data-dir", str(restorable), "restore", "--force"]) == 2
    assert "nothing was changed" in capsys.readouterr().err
    after = db_files(restorable)
    assert {k: v for k, v in after.items() if ".restoring" not in k} == before


@pytest.mark.parametrize(
    "fails",
    [
        pytest.param(lambda s, d: s.name.endswith("-wal") and ".bak-" in d.name, id="moving -wal aside"),
        pytest.param(lambda s, d: s != d and s.name.endswith(".restoring"), id="the final replace"),
    ],
)
def test_ctrl_c_during_a_restore_retry_puts_everything_back(restorable, lock, monkeypatch, fails):
    before = db_files(restorable)

    def interrupt(_seconds):
        raise KeyboardInterrupt

    monkeypatch.setattr(platform, "time", SimpleNamespace(sleep=interrupt))
    lock.match = fails
    with pytest.raises(KeyboardInterrupt):
        restore_data_dir(restorable, force=True)
    assert db_files(restorable) == before
