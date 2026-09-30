from .factories import post


def _app(client, seeded):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})


def test_notes_round_trip_through_files(client, seeded, app):
    application = _app(client, seeded)
    link = f"application:{application['id']}"
    made = post(
        client,
        "/api/v1/notes",
        {"title": "Call with Alex", "body": "## Salary\n\n- **£650/day**, outside IR35\n", "links": [link]},
    )
    assert made["path"].endswith("-call-with-alex.md")
    assert made["excerpt"] == "Salary £650/day, outside IR35"
    data_dir = app.state.jat.data_dir
    assert (data_dir / "notes" / made["path"]).read_text().endswith("- **£650/day**, outside IR35\n")

    # Listed on its application, and on its timeline.
    listed = client.get("/api/v1/notes", params={"entity": link}).json()
    assert [n["id"] for n in listed] == [made["id"]]
    events = client.get(f"/api/v1/applications/{application['id']}").json()["events"]
    assert events[-1]["kind"] == "note" and events[-1]["summary"] == "Note added: Call with Alex"

    r = client.patch(f"/api/v1/notes/{made['id']}", json={"body": "Updated", "title": "Call with Alex (2)"})
    assert r.status_code == 200 and r.json()["body"] == "Updated\n"
    assert client.get(f"/api/v1/notes/{made['id']}").json()["title"] == "Call with Alex (2)"

    assert client.delete(f"/api/v1/notes/{made['id']}").status_code == 204
    assert not (data_dir / "notes" / made["path"]).exists()
    assert client.get(f"/api/v1/notes/{made['id']}").status_code == 404


def test_general_notes_search_and_filters(client, seeded):
    general = post(client, "/api/v1/notes", {"title": "Job search plan", "body": "Focus on fintech"})
    on_company = post(
        client,
        "/api/v1/notes",
        {"title": "About Contoso", "body": "Uses Kafka", "links": [f"company:{seeded['company']['id']}"]},
    )
    assert [n["id"] for n in client.get("/api/v1/notes", params={"entity": "none"}).json()] == [general["id"]]
    assert [n["id"] for n in client.get("/api/v1/notes", params={"q": "kafka"}).json()] == [on_company["id"]]
    assert len(client.get("/api/v1/notes").json()) == 2


def test_note_validation(client, seeded):
    assert client.post("/api/v1/notes", json={"title": ""}).status_code == 422
    assert client.post("/api/v1/notes", json={"title": "x", "links": ["planet:earth"]}).status_code == 422
    r = client.post("/api/v1/notes", json={"title": "x", "links": ["company:missing"]})
    assert r.status_code == 422 and "not found" in r.json()["detail"]
    made = post(client, "/api/v1/notes", {"title": "x"})
    assert client.patch(f"/api/v1/notes/{made['id']}", json={"title": None}).status_code == 422


def test_notes_edited_outside_the_app_show_up(client, seeded, app):
    notes = app.state.jat.data_dir / "notes"
    (notes / "from-my-editor.md").write_text(
        f"---\ntitle: Written in vim\nlinks: [{{type: company, id: {seeded['company']['id']}}}]\n---\nHello\n"
    )
    listed = client.get("/api/v1/notes", params={"entity": f"company:{seeded['company']['id']}"}).json()
    assert [n["title"] for n in listed] == ["Written in vim"]
    full = client.get(f"/api/v1/notes/{listed[0]['id']}").json()
    assert full["body"] == "Hello\n"


def test_bad_files_are_skipped_not_fatal(client, app, tmp_path):
    notes = app.state.jat.data_dir / "notes"
    post(client, "/api/v1/notes", {"title": "Fine"})
    (notes / "latin1.md").write_bytes("caf\xe9".encode("latin-1"))  # not UTF-8
    secret = tmp_path / "secret.md"
    secret.write_text("---\ntitle: Outside\n---\nshh\n")
    (notes / "sneaky.md").symlink_to(secret)
    r = client.get("/api/v1/notes")
    assert r.status_code == 200
    assert [n["title"] for n in r.json()] == ["Fine"]


def test_saving_still_works_when_a_linked_thing_is_gone(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    company = f"company:{seeded['company']['id']}"
    note = post(client, "/api/v1/notes", {"title": "Prep", "links": [f"application:{app['id']}", company]})
    assert client.delete(f"/api/v1/applications/{app['id']}").status_code == 204
    r = client.patch(f"/api/v1/notes/{note['id']}", json={"body": "still here", "links": note["links"]})
    assert r.status_code == 200, r.text
    # New links are still checked.
    r = client.patch(f"/api/v1/notes/{note['id']}", json={"links": [*note["links"], "agency:missing"]})
    assert r.status_code == 422


def test_edits_made_elsewhere_are_not_overwritten(client, app):
    note = post(client, "/api/v1/notes", {"title": "Plan", "body": "v1"})
    path = app.state.jat.data_dir / "notes" / note["path"]
    path.write_text(path.read_text().replace(note["updated_at"].replace("+00:00", "Z"), "2030-01-01T00:00:00Z"))
    r = client.patch(f"/api/v1/notes/{note['id']}", json={"body": "v2", "base_updated_at": note["updated_at"]})
    assert r.status_code == 409
    fresh = client.get(f"/api/v1/notes/{note['id']}").json()
    r = client.patch(f"/api/v1/notes/{note['id']}", json={"body": "v2", "base_updated_at": fresh["updated_at"]})
    assert r.status_code == 200


def test_blank_titles_are_refused(client):
    assert client.post("/api/v1/notes", json={"title": "   "}).status_code == 422
    assert client.patch("/api/v1/notes/nope", json={"body": "x"}).status_code == 404
    assert client.delete("/api/v1/notes/nope").status_code == 404
