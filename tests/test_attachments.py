import hashlib
import io

import pytest

from jat.storage.files import FileError, FileStore, TooLarge, safe_name

from .factories import post

PDF = b"%PDF-1.4\n% made-up demo CV\n"


@pytest.mark.parametrize(
    ("name", "safe"),
    [
        ("CV – Senior Backend (v3).PDF", "CV-Senior-Backend-v3.pdf"),
        ("../../etc/passwd", "passwd"),
        ("C:\\Users\\x\\brief.docx", "brief.docx"),
        ("...", "file"),
        ("no_extension", "no_extension"),
    ],
)
def test_safe_name(name, safe):
    assert safe_name(name) == safe


def test_store_hashes_and_refuses_escapes(tmp_path):
    store = FileStore(tmp_path)
    stored = store.save(io.BytesIO(PDF), "cv.pdf")
    assert stored.path.endswith("-cv.pdf") and stored.size == len(PDF)
    assert stored.sha256 == hashlib.sha256(PDF).hexdigest()
    assert store.resolve(stored.path).read_bytes() == PDF
    with pytest.raises(FileError):
        store.resolve("../secret.txt")
    small = FileStore(tmp_path, max_bytes=10)
    with pytest.raises(TooLarge):
        small.save(io.BytesIO(b"x" * 11), "big.bin")
    leftovers = [p for p in (tmp_path / "files").rglob("*") if p.is_file() and p.name.startswith(".tmp-")]
    assert leftovers == []


def upload(client, name, data, content_type="application/octet-stream", **entity):
    r = client.post("/api/v1/attachments", files={"file": (name, data, content_type)}, data=entity)
    return r


def test_upload_view_rename_and_delete(client, seeded, app):
    application = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    ref = {"entity_type": "application", "entity_id": application["id"]}
    r = upload(client, "CV v3.pdf", PDF, "application/pdf", **ref)
    assert r.status_code == 201, r.text
    cv = r.json()
    assert (cv["original_name"], cv["content_type"], cv["size"], cv["inline"]) == (
        "CV v3.pdf",
        "application/pdf",
        len(PDF),
        True,
    )
    on_disk = app.state.jat.data_dir / "files" / cv["path"]
    assert on_disk.read_bytes() == PDF

    listed = client.get("/api/v1/attachments", params=ref).json()
    assert [a["id"] for a in listed] == [cv["id"]]
    events = client.get(f"/api/v1/applications/{application['id']}").json()["events"]
    assert events[-1]["kind"] == "file" and events[-1]["summary"] == "File added: CV v3.pdf"

    viewed = client.get(cv["url"])
    assert viewed.status_code == 200 and viewed.content == PDF
    assert viewed.headers["content-type"] == "application/pdf"
    assert viewed.headers["content-disposition"].startswith("inline")
    assert viewed.headers["x-content-type-options"] == "nosniff"

    renamed = client.patch(f"/api/v1/attachments/{cv['id']}", json={"original_name": "CV (sent).pdf"}).json()
    assert renamed["original_name"] == "CV (sent).pdf" and renamed["path"] == cv["path"]

    assert client.delete(f"/api/v1/attachments/{cv['id']}").status_code == 204
    assert not on_disk.exists()
    assert client.get(cv["url"]).status_code == 404


def test_risky_types_always_download(client, seeded):
    company = {"entity_type": "company", "entity_id": seeded["company"]["id"]}
    for name, data in [("page.html", b"<script>alert(1)</script>"), ("logo.svg", b"<svg onload=alert(1)/>")]:
        att = upload(client, name, data, "text/html", **company).json()
        assert att["inline"] is False
        r = client.get(att["url"])
        assert r.headers["content-type"] == "application/octet-stream"
        assert r.headers["content-disposition"].startswith("attachment")


def test_files_outlive_what_they_were_attached_to(client, seeded):
    application = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    att = upload(client, "brief.pdf", PDF, entity_type="application", entity_id=application["id"]).json()
    assert client.delete(f"/api/v1/applications/{application['id']}").status_code == 204
    kept = client.get(f"/api/v1/attachments/{att['id']}").json()
    assert kept["entity_type"] is None and kept["entity_id"] is None
    assert [a["id"] for a in client.get("/api/v1/attachments", params={"unattached": True}).json()] == [att["id"]]
    assert client.get(att["url"]).status_code == 200

    # And can be attached to something else.
    moved = client.patch(
        f"/api/v1/attachments/{att['id']}",
        json={"entity_type": "company", "entity_id": seeded["company"]["id"]},
    )
    assert moved.status_code == 200 and moved.json()["entity_type"] == "company"


def test_attachment_validation(client, seeded):
    assert upload(client, "x.pdf", PDF, entity_type="company").status_code == 422  # id missing
    assert upload(client, "x.pdf", PDF, entity_type="planet", entity_id="x").status_code == 422
    assert upload(client, "x.pdf", PDF, entity_type="company", entity_id="missing").status_code == 422
    general = upload(client, "loose.txt", b"hello", "text/plain")
    assert general.status_code == 201 and general.json()["entity_type"] is None
    att = general.json()
    bad = client.patch(f"/api/v1/attachments/{att['id']}", json={"entity_type": "company", "entity_id": "nope"})
    assert bad.status_code == 422
    assert client.patch(f"/api/v1/attachments/{att['id']}", json={"original_name": "  "}).status_code == 422
