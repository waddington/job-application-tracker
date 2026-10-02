from datetime import UTC, datetime, timedelta

from .factories import post


def _iso(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def test_book_a_call_with_a_recruiter(client, seeded):
    alex = seeded["recruiter"]["id"]
    call = post(
        client,
        "/api/v1/meetings",
        {"contact_id": alex, "title": "Market catch-up", "starts_at": _iso(2), "agenda": "Ask about contract rates"},
    )
    assert call["status"] == "scheduled" and call["kind"] == "call"
    assert call["label"] == "Call with Alex Recruiter: Market catch-up"
    assert call["agency_name"] == "Northwind Talent" and call["application_id"] is None

    # It's on the person's list and in Next actions' two weeks ahead.
    mine = client.get("/api/v1/meetings", params={"contact_id": alex}).json()
    assert [m["id"] for m in mine] == [call["id"]]
    by_agency = client.get("/api/v1/meetings", params={"agency_id": seeded["agency"]["id"]}).json()
    assert [m["id"] for m in by_agency] == [call["id"]]
    nxt = client.get("/api/v1/next-actions").json()
    assert [m["id"] for m in nxt["meetings"]] == [call["id"]]
    assert nxt["meetings_to_close"] == []

    # Afterwards: how it went.
    done = client.patch(f"/api/v1/meetings/{call['id']}", json={"status": "done", "notes": "Three roles to follow up"})
    assert done.status_code == 200 and done.json()["notes"] == "Three roles to follow up"
    assert client.get("/api/v1/next-actions").json()["meetings"] == []


def test_past_calls_still_booked_need_an_outcome(client, seeded):
    past = post(client, "/api/v1/meetings", {"contact_id": seeded["recruiter"]["id"], "starts_at": _iso(-1)})
    logged = post(
        client,
        "/api/v1/meetings",
        {"contact_id": seeded["recruiter"]["id"], "starts_at": _iso(-3), "status": "done", "kind": "video"},
    )
    nxt = client.get("/api/v1/next-actions").json()
    assert [m["id"] for m in nxt["meetings_to_close"]] == [past["id"]]
    assert logged["label"] == "Video call with Alex Recruiter"


def test_validation_and_delete(client, seeded):
    alex = seeded["recruiter"]["id"]
    bad = client.post("/api/v1/meetings", json={"contact_id": "nope", "starts_at": _iso(1)})
    assert bad.status_code == 422
    backwards = client.post("/api/v1/meetings", json={"contact_id": alex, "starts_at": _iso(1), "ends_at": _iso(0)})
    assert backwards.status_code == 422
    call = post(client, "/api/v1/meetings", {"contact_id": alex, "starts_at": _iso(1)})
    assert client.patch(f"/api/v1/meetings/{call['id']}", json={"starts_at": None}).status_code == 422
    assert client.patch(f"/api/v1/meetings/{call['id']}", json={"ends_at": _iso(-5)}).status_code == 422
    assert client.delete(f"/api/v1/meetings/{call['id']}").status_code == 204
    assert client.get(f"/api/v1/meetings/{call['id']}").status_code == 404

    # Deleting the person deletes their calls.
    again = post(client, "/api/v1/meetings", {"contact_id": alex, "starts_at": _iso(1)})
    assert client.delete(f"/api/v1/contacts/{alex}").status_code == 204
    assert client.get(f"/api/v1/meetings/{again['id']}").status_code == 404


def test_timeline_and_search(client, seeded):
    alex = seeded["recruiter"]["id"]
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    post(
        client,
        "/api/v1/meetings",
        {
            "contact_id": alex,
            "title": "Market catch-up",
            "starts_at": _iso(-2),
            "status": "done",
            "notes": "Fintech is hiring",
        },
    )
    post(
        client,
        "/api/v1/meetings",
        {"contact_id": alex, "title": "About Contoso", "starts_at": _iso(3), "application_id": app["id"]},
    )
    post(
        client,
        "/api/v1/meetings",
        {"contact_id": alex, "title": "Called off", "starts_at": _iso(1), "status": "cancelled"},
    )

    items = client.get("/api/v1/timeline", params={"category": ["meeting"]}).json()["items"]
    assert [i["title"] for i in items] == [
        "Call with Alex Recruiter: About Contoso (booked)",
        "Call with Alex Recruiter: Market catch-up (done)",
    ]
    linked, catch_up = items
    assert linked["application_id"] == app["id"] and linked["people"][0]["name"] == "Alex Recruiter"
    assert catch_up["agency_name"] == "Northwind Talent" and catch_up["detail"] == "Fintech is hiring"
    by_person = client.get("/api/v1/timeline", params={"contact_id": alex, "category": ["meeting"]}).json()["items"]
    assert len(by_person) == 2

    hits = client.get("/api/v1/search", params={"q": "fintech"}).json()
    assert [(h["kind"], h["title"], h["link"]) for h in hits] == [
        ("meeting", "Call: Market catch-up", f"/people/{alex}")
    ]
