from datetime import date

from .factories import post


def test_a_reply_to_read_on_an_application(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    client.patch(f"/api/v1/applications/{app['id']}", json={"awaiting_reply_since": "2026-09-20"})

    # They've replied: it's to read now, and you're no longer waiting.
    r = client.patch(f"/api/v1/applications/{app['id']}", json={"reply_to_read_since": "2026-09-25"})
    assert r.status_code == 200, r.text
    detail = r.json()
    assert detail["reply_to_read_since"] == "2026-09-25" and detail["awaiting_reply_since"] is None
    assert detail["events"][-1]["summary"] == "They replied; to read"

    out = client.get("/api/v1/next-actions", params={"today": "2026-10-02"}).json()
    assert [a["id"] for a in out["to_read"]] == [app["id"]]
    assert out["waiting"] == []
    # A reply to read is never "gone quiet".
    assert app["id"] not in {a["id"] for a in out["stale"]}

    r = client.patch(f"/api/v1/applications/{app['id']}", json={"reply_to_read_since": None})
    assert r.json()["reply_to_read_since"] is None
    assert r.json()["events"][-1]["summary"] == "Read their reply"
    assert client.get("/api/v1/next-actions").json()["to_read"] == []


def test_moving_on_means_you_read_it(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    today = date.today().isoformat()
    client.patch(f"/api/v1/applications/{app['id']}", json={"reply_to_read_since": today})
    r = client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "screen"})
    assert r.status_code == 200 and r.json()["reply_to_read_since"] is None
    # Undoing an accidental move puts it back.
    r = client.post(f"/api/v1/applications/{app['id']}/undo")
    assert r.json()["reply_to_read_since"] == today


def test_a_reply_to_read_from_a_person(client, seeded):
    recruiter = seeded["recruiter"]["id"]
    client.patch(f"/api/v1/contacts/{recruiter}", json={"awaiting_reply_since": "2026-09-28"})
    r = client.patch(f"/api/v1/contacts/{recruiter}", json={"reply_to_read_since": "2026-09-30"})
    assert r.status_code == 200, r.text
    assert r.json()["reply_to_read_since"] == "2026-09-30" and r.json()["awaiting_reply_since"] is None
    out = client.get("/api/v1/next-actions").json()
    assert [(p["id"], p["reply_to_read_since"]) for p in out["to_read_people"]] == [(recruiter, "2026-09-30")]
    assert out["waiting_people"] == []
    timeline = client.get("/api/v1/timeline").json()["items"]
    assert any(i["title"] == "Alex Recruiter replied; to read" for i in timeline)

    client.patch(f"/api/v1/contacts/{recruiter}", json={"reply_to_read_since": None})
    assert client.get("/api/v1/next-actions").json()["to_read_people"] == []
