import io
import os
import time
import zipfile
from datetime import date

from fastapi.testclient import TestClient

from jat.app import create_app
from jat.cli import main
from jat.db import db_path
from jat.snapshot import archive

from .factories import post


def _names(blob: bytes) -> list[str]:
    return sorted(zipfile.ZipFile(io.BytesIO(blob)).namelist())


def test_archive_download_restores_to_the_same_data(app, client, tmp_path):
    post(client, "/api/v1/companies", {"name": "Contoso"})
    data_dir = app.state.snapshots.data_dir
    (data_dir / "notes" / "call.md").write_text("---\ntitle: Call\n---\nHello\n")
    (data_dir / "files" / "2026").mkdir(parents=True, exist_ok=True)
    (data_dir / "files" / "2026" / "cv.pdf").write_bytes(b"%PDF-1.4 fake")
    secret = tmp_path / "outside.txt"
    secret.write_text("not part of the data directory")
    (data_dir / "files" / "link.txt").symlink_to(secret)
    (data_dir / ".tmp").mkdir(exist_ok=True)
    (data_dir / ".tmp" / "upload.part").write_bytes(b"half an upload")

    r = client.get("/api/v1/backup/archive")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    root = f"jat-backup-{date.today().isoformat()}"
    assert f'filename="{root}.zip"' in r.headers["content-disposition"]
    names = _names(r.content)
    assert f"{root}/RESTORE.md" in names
    assert f"{root}/notes/call.md" in names and f"{root}/files/2026/cv.pdf" in names
    assert f"{root}/export/companies.jsonl" in names and f"{root}/export/_meta.json" in names
    # No database, no temp files, no git, nothing reached through a symlink.
    assert not [n for n in names if "sqlite" in n or "/.tmp/" in n or "/.git/" in n or n.endswith("link.txt")]
    # The staging copy is cleaned up once sent.
    assert not list((data_dir / ".tmp").glob("archive-*.zip"))

    # Unzip somewhere new, restore, and the data is back.
    target = tmp_path / "restored"
    zipfile.ZipFile(io.BytesIO(r.content)).extractall(target)
    restored = target / root
    assert main(["--data-dir", str(restored), "restore"]) == 0
    assert db_path(restored).exists()
    again = TestClient(base_url="http://127.0.0.1", app=create_app(restored, dist=tmp_path / "no-dist"))
    assert [c["name"] for c in again.get("/api/v1/companies").json()] == ["Contoso"]


def test_cli_archive(app, client, tmp_path, capsys):
    post(client, "/api/v1/companies", {"name": "Fabrikam"})
    data_dir = app.state.snapshots.data_dir
    out = tmp_path / "backup.zip"
    assert main(["--data-dir", str(data_dir), "archive", "-o", str(out)]) == 0
    assert "wrote" in capsys.readouterr().out
    assert any(n.endswith("export/companies.jsonl") for n in _names(out.read_bytes()))
    # It never overwrites.
    assert main(["--data-dir", str(data_dir), "archive", "-o", str(out)]) == 2
    assert "already exists" in capsys.readouterr().err


def test_archive_refuses_other_sites_and_clears_old_downloads(app, client):
    r = client.get("/api/v1/backup/archive", headers={"Sec-Fetch-Site": "cross-site"})
    assert r.status_code == 403
    staging = app.state.snapshots.data_dir / ".tmp"
    staging.mkdir(exist_ok=True)
    old, recent = staging / "archive-old.zip", staging / "archive-recent.zip"
    old.write_bytes(b"left over from a cut-off download")
    recent.write_bytes(b"someone else's download in progress")
    os.utime(old, (time.time() - 3600, time.time() - 3600))
    assert client.get("/api/v1/backup/archive", headers={"Sec-Fetch-Site": "same-origin"}).status_code == 200
    assert not old.exists() and recent.exists()


def test_files_deleted_mid_archive_are_skipped(app, tmp_path, monkeypatch):
    data_dir = app.state.snapshots.data_dir
    gone = data_dir / "notes" / "gone.md"
    gone.write_text("deleted while the zip is being written")
    real_members = archive._members

    def members_then_delete(path):
        found = real_members(path)
        gone.unlink()
        return found

    monkeypatch.setattr(archive, "_members", members_then_delete)
    info = archive.write_archive(app.state.snapshots, tmp_path / "b.zip")
    assert not any(n.endswith("gone.md") for n in _names((tmp_path / "b.zip").read_bytes()))
    assert info.files >= 1
