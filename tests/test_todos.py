from .factories import post


def test_todos_about_a_person_and_on_their_own(client, seeded):
    alex = seeded["recruiter"]["id"]
    reply = post(
        client,
        "/api/v1/todos",
        {"text": "  They messaged me: reply  ", "entity_type": "contact", "entity_id": alex, "due_on": "2026-10-03"},
    )
    assert reply["text"] == "They messaged me: reply" and reply["about"] == "Alex Recruiter"
    assert reply["done_at"] is None
    loose = post(client, "/api/v1/todos", {"text": "Update my CV"})
    assert loose["entity_type"] is None and loose["about"] is None

    # On the person's page, and all of them (dated first) in Next actions.
    mine = client.get("/api/v1/todos", params={"entity_type": "contact", "entity_id": alex}).json()
    assert [t["id"] for t in mine] == [reply["id"]]
    nxt = client.get("/api/v1/next-actions").json()
    assert [t["id"] for t in nxt["todos"]] == [reply["id"], loose["id"]]

    # Ticking it off takes it out of Next actions; unticking brings it back.
    done = client.patch(f"/api/v1/todos/{reply['id']}", json={"done": True}).json()
    assert done["done_at"] is not None
    assert [t["id"] for t in client.get("/api/v1/next-actions").json()["todos"]] == [loose["id"]]
    assert [t["id"] for t in client.get("/api/v1/todos", params={"status": "done"}).json()] == [reply["id"]]
    again = client.patch(f"/api/v1/todos/{reply['id']}", json={"done": True}).json()
    assert again["done_at"] == done["done_at"]  # ticking twice keeps when it was done
    back = client.patch(f"/api/v1/todos/{reply['id']}", json={"done": False, "text": "Reply to Alex"}).json()
    assert back["done_at"] is None and back["text"] == "Reply to Alex"

    assert client.delete(f"/api/v1/todos/{loose['id']}").status_code == 204
    assert [t["id"] for t in client.get("/api/v1/todos").json()] == [reply["id"]]


def test_todos_about_roles_and_applications_are_named(client, seeded):
    role = seeded["role"]
    about_role = post(
        client, "/api/v1/todos", {"text": "See if I like what they do", "entity_type": "role", "entity_id": role["id"]}
    )
    assert about_role["about"] == "Contoso · Senior Backend Engineer"
    assert about_role["company_id"] == seeded["company"]["id"]
    app = post(client, "/api/v1/applications", {"role_id": role["id"], "stage": "applied"})
    about_app = post(
        client, "/api/v1/todos", {"text": "Send portfolio", "entity_type": "application", "entity_id": app["id"]}
    )
    assert about_app["about"] == "Contoso · Senior Backend Engineer"
    company = post(
        client,
        "/api/v1/todos",
        {"text": "Read their blog", "entity_type": "company", "entity_id": seeded["company"]["id"]},
    )
    assert company["about"] == "Contoso"


def test_next_actions_lists_todos_in_the_order_to_do_them(client):
    later = post(client, "/api/v1/todos", {"text": "Renew my domain", "due_on": "2026-12-01"})
    undated = post(client, "/api/v1/todos", {"text": "Reply to Alex"})
    soon = post(client, "/api/v1/todos", {"text": "Send CV", "due_on": "2026-10-05"})
    overdue = post(client, "/api/v1/todos", {"text": "Chase Contoso", "due_on": "2026-09-30"})
    todos = client.get("/api/v1/next-actions", params={"today": "2026-10-02"}).json()["todos"]
    assert [t["id"] for t in todos] == [overdue["id"], soon["id"], undated["id"], later["id"]]
    # The same order everywhere, with ticked-off ones last.
    client.patch(f"/api/v1/todos/{soon['id']}", json={"done": True})
    listed = client.get("/api/v1/todos", params={"status": "all", "today": "2026-10-02"}).json()
    assert [t["id"] for t in listed] == [overdue["id"], undated["id"], later["id"], soon["id"]]


def test_deleting_the_thing_keeps_the_todo(client, seeded):
    person = post(client, "/api/v1/contacts", {"name": "Riley Chen"})
    todo = post(
        client,
        "/api/v1/todos",
        {"text": "Ask Riley for a referral", "entity_type": "contact", "entity_id": person["id"]},
    )
    assert client.delete(f"/api/v1/contacts/{person['id']}").status_code == 204
    kept = client.get("/api/v1/todos").json()
    assert [(t["id"], t["entity_type"], t["entity_id"], t["about"]) for t in kept] == [(todo["id"], None, None, None)]


def test_deleting_a_company_keeps_its_roles_todos(client):
    company = post(client, "/api/v1/companies", {"name": "Fabrikam"})
    role = post(client, "/api/v1/roles", {"company_id": company["id"], "title": "Platform Engineer"})
    on_role = post(
        client, "/api/v1/todos", {"text": "Ask about the team", "entity_type": "role", "entity_id": role["id"]}
    )
    on_company = post(
        client, "/api/v1/todos", {"text": "Read their blog", "entity_type": "company", "entity_id": company["id"]}
    )
    # The company's unused role goes with it; both to-dos stay, about nothing now.
    assert client.delete(f"/api/v1/companies/{company['id']}").status_code == 204
    kept = {t["id"]: t["entity_type"] for t in client.get("/api/v1/todos").json()}
    assert kept == {on_role["id"]: None, on_company["id"]: None}


def test_todo_validation(client, seeded):
    assert client.post("/api/v1/todos", json={"text": "   "}).status_code == 422
    assert client.post("/api/v1/todos", json={"text": "x", "entity_type": "contact"}).status_code == 422
    missing = {"text": "x", "entity_type": "company", "entity_id": "nope"}
    assert client.post("/api/v1/todos", json=missing).status_code == 422
    todo = post(client, "/api/v1/todos", {"text": "x"})
    assert client.patch(f"/api/v1/todos/{todo['id']}", json={"text": None}).status_code == 422
    assert client.patch(f"/api/v1/todos/{todo['id']}", json={"text": " "}).status_code == 422
    assert client.patch("/api/v1/todos/nope", json={"done": True}).status_code == 404
    assert client.get("/api/v1/todos", params={"entity_id": todo["id"]}).status_code == 422


def test_search_finds_todos(client, seeded):
    alex = seeded["recruiter"]["id"]
    post(client, "/api/v1/todos", {"text": "Reply about the rates", "entity_type": "contact", "entity_id": alex})
    post(client, "/api/v1/todos", {"text": "Rates spreadsheet"})
    hits = [h for h in client.get("/api/v1/search", params={"q": "rates"}).json() if h["kind"] == "todo"]
    assert {(h["title"], h["link"]) for h in hits} == {
        ("Reply about the rates", f"/people/{alex}"),
        ("Rates spreadsheet", "/next-actions"),
    }
