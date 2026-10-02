from datetime import date

from .factories import post


def test_waiting_to_hear_back_on_an_application(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    r = client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": "2026-09-20"})
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["awaiting_reply_since"] == "2026-09-20"
    assert detail["events"][-1]["summary"] == "Replied; waiting to hear back"

    out = client.get("/api/v1/next-actions", params={"today": "2026-10-02"}).json()
    assert [a["id"] for a in out["waiting"]] == [app["id"]]
    # Waiting is its own list, never also "gone quiet".
    assert app["id"] not in {a["id"] for a in out["stale"]}

    r = client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": None})
    assert r.json()["awaiting_reply_since"] is None
    assert r.json()["events"][-1]["summary"] == "Heard back"
    assert client.get("/api/v1/next-actions").json()["waiting"] == []


def test_moving_on_means_you_heard_back(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": date.today().isoformat()})
    r = client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "screen"})
    assert r.status_code == 200 and r.json()["awaiting_reply_since"] is None
    # Undoing an accidental move puts the waiting back.
    r = client.post(f"/api/v1/applications/{app['id']}/undo")
    assert r.json()["awaiting_reply_since"] == date.today().isoformat()


def test_a_due_follow_up_is_listed_once(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    body = {"awaiting_reply_since": "2026-09-20", "follow_up_on": "2026-09-30"}
    assert client.patch(f"/api/v1/applications/{app['id']}", json=body).status_code == 200
    out = client.get("/api/v1/next-actions", params={"today": "2026-10-02"}).json()
    assert [a["id"] for a in out["follow_ups"]] == [app["id"]] and out["waiting"] == []


def test_waiting_on_a_person(client, seeded):
    recruiter = seeded["recruiter"]["id"]
    r = client.patch(f"/api/v1/contacts/{recruiter}", json={"awaiting_reply_since": "2026-09-28"})
    assert r.status_code == 200, r.text
    assert r.json()["awaiting_reply_since"] == "2026-09-28"
    out = client.get("/api/v1/next-actions").json()
    assert [(p["id"], p["awaiting_reply_since"]) for p in out["waiting_people"]] == [(recruiter, "2026-09-28")]
    client.patch(f"/api/v1/contacts/{recruiter}", json={"awaiting_reply_since": None})
    assert client.get("/api/v1/next-actions").json()["waiting_people"] == []
