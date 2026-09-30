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
