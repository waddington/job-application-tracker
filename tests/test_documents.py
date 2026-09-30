from .factories import post

PDF = b"%PDF-1.4\n% made-up demo CV\n"


def add_version(client, doc_id, label, data=PDF, name="cv.pdf", notes=None):
    form = {"label": label}
    if notes:
        form["notes"] = notes
    files = {"file": (name, data, "application/pdf")} if data is not None else None
    return client.post(f"/api/v1/documents/{doc_id}/versions", data=form, files=files)


def test_versions_sending_and_where_used(client, seeded, app):
    cv = post(client, "/api/v1/documents", {"kind": "cv", "name": "Backend CV"})
    v2 = add_version(client, cv["id"], "v2").json()
    r = add_version(client, cv["id"], "v3 (fintech)", notes="Leads with payments work")
    assert r.status_code == 201, r.text
    v3 = r.json()
    assert v3["file"]["original_name"] == "cv.pdf" and v3["file"]["inline"] is True
    assert (app.state.jat.data_dir / "files" / v3["file"]["path"]).read_bytes() == PDF

    listed = client.get("/api/v1/documents").json()
    assert [v["label"] for v in listed[0]["versions"]] == ["v3 (fintech)", "v2"]  # newest first

    application = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    sent = post(
        client,
        f"/api/v1/applications/{application['id']}/documents",
        {"document_version_id": v3["id"], "sent_on": "2026-09-28"},
    )
    assert (sent["document_name"], sent["version_label"], sent["kind"]) == ("Backend CV", "v3 (fintech)", "cv")
    assert sent["file_url"] == v3["file"]["url"]
    detail = client.get(f"/api/v1/applications/{application['id']}").json()
    assert [d["version_label"] for d in detail["documents"]] == ["v3 (fintech)"]
    assert detail["events"][-1]["summary"] == "CV sent: Backend CV v3 (fintech)"

    doc = client.get(f"/api/v1/documents/{cv['id']}").json()
    assert [(u["company_name"], u["version_label"], u["sent_on"]) for u in doc["used_in"]] == [
        ("Contoso", "v3 (fintech)", "2026-09-28")
    ]
    assert {v["label"]: v["used_in"] for v in doc["versions"]} == {"v3 (fintech)": 1, "v2": 0}

    # Can't record the same version twice, or delete what was sent.
    again = client.post(f"/api/v1/applications/{application['id']}/documents", json={"document_version_id": v3["id"]})
    assert again.status_code == 409
    assert client.delete(f"/api/v1/documents/versions/{v3['id']}").status_code == 409
    assert client.delete(f"/api/v1/documents/{cv['id']}").status_code == 409

    # Once it's no longer recorded as sent, it can go, file and all.
    assert client.delete(f"/api/v1/applications/{application['id']}/documents/{sent['id']}").status_code == 204
    assert client.delete(f"/api/v1/documents/versions/{v3['id']}").status_code == 204
    assert not (app.state.jat.data_dir / "files" / v3["file"]["path"]).exists()
    assert client.delete(f"/api/v1/documents/{cv['id']}").status_code == 204
    assert not (app.state.jat.data_dir / "files" / v2["file"]["path"]).exists()


def test_versions_without_files_and_edits(client):
    letter = post(client, "/api/v1/documents", {"kind": "cover_letter", "name": "Generic cover letter"})
    v1 = add_version(client, letter["id"], "v1", data=None).json()
    assert v1["file"] is None
    renamed = client.patch(f"/api/v1/documents/versions/{v1['id']}", json={"label": "v1 (short)", "notes": " "})
    assert renamed.json()["label"] == "v1 (short)" and renamed.json()["notes"] is None
    r = client.patch(f"/api/v1/documents/{letter['id']}", json={"name": "Cover letter"})
    assert r.json()["name"] == "Cover letter"


def test_document_validation(client, seeded):
    assert client.post("/api/v1/documents", json={"name": " "}).status_code == 422
    assert client.post("/api/v1/documents", json={"name": "x", "kind": "poem"}).status_code == 422
    cv = post(client, "/api/v1/documents", {"name": "CV"})
    assert add_version(client, cv["id"], " ").status_code == 422
    assert add_version(client, "missing", "v1").status_code == 404
    application = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    r = client.post(f"/api/v1/applications/{application['id']}/documents", json={"document_version_id": "nope"})
    assert r.status_code == 422


def test_a_documents_versions_go_when_an_application_is_deleted_but_not_the_other_way(client, seeded):
    cv = post(client, "/api/v1/documents", {"name": "CV"})
    v1 = add_version(client, cv["id"], "v1").json()
    application = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    post(client, f"/api/v1/applications/{application['id']}/documents", {"document_version_id": v1["id"]})
    assert client.delete(f"/api/v1/applications/{application['id']}").status_code == 204
    doc = client.get(f"/api/v1/documents/{cv['id']}").json()
    assert doc["used_in"] == [] and doc["versions"][0]["used_in"] == 0


def test_a_versions_file_is_guarded_and_only_its_own_is_deleted(client, seeded, app):
    cv = post(client, "/api/v1/documents", {"name": "CV"})
    v1 = add_version(client, cv["id"], "v1").json()
    v2 = add_version(client, cv["id"], "v2").json()
    # The generic Files delete won't take a version's file out from under it.
    assert client.delete(f"/api/v1/attachments/{v1['file']['id']}").status_code == 409
    # A file moved elsewhere isn't deleted with its old version.
    moved = client.patch(
        f"/api/v1/attachments/{v2['file']['id']}",
        json={"entity_type": "company", "entity_id": seeded["company"]["id"]},
    )
    assert moved.status_code == 200
    assert client.delete(f"/api/v1/documents/versions/{v2['id']}").status_code == 204
    assert (app.state.jat.data_dir / "files" / v2["file"]["path"]).exists()
    # Unsending checks the application.
    application = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    sent = post(client, f"/api/v1/applications/{application['id']}/documents", {"document_version_id": v1["id"]})
    other = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    assert client.delete(f"/api/v1/applications/{other['id']}/documents/{sent['id']}").status_code == 404
    # Labels are trimmed.
    assert client.patch(f"/api/v1/documents/versions/{v1['id']}", json={"label": " v1b "}).json()["label"] == "v1b"
