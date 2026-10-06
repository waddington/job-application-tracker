from datetime import UTC, date, datetime, timedelta

from .factories import post


def _iso(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def _summaries(client, **params) -> list[dict]:
    res = client.get("/api/v1/role-summaries", params=params)
    assert res.status_code == 200, res.text
    return res.json()


def test_roles_from_a_recruiter_call(client, seeded):
    alex = seeded["recruiter"]["id"]
    call = post(
        client,
        "/api/v1/meetings",
        {"contact_id": alex, "title": "Market catch-up", "starts_at": _iso(-1), "status": "done"},
    )
    fabrikam = post(client, "/api/v1/companies", {"name": "Fabrikam"})
    platform = post(
        client,
        "/api/v1/roles",
        {
            "company_id": fabrikam["id"],
            "title": "Platform Engineer",
            "contact_id": alex,
            "meeting_id": call["id"],
            "day_rate": 600,
        },
    )
    data = post(
        client,
        "/api/v1/roles",
        {"company_id": fabrikam["id"], "title": "Data Engineer", "contact_id": alex, "meeting_id": call["id"]},
    )

    from_call = _summaries(client, meeting_id=call["id"])
    assert [(r["title"], r["status"]) for r in from_call] == [
        ("Platform Engineer", "to_decide"),
        ("Data Engineer", "to_decide"),
    ]
    first = from_call[0]
    assert first["company_name"] == "Fabrikam" and first["contact_name"] == "Alex Recruiter"
    assert first["agency_name"] == "Northwind Talent"
    assert first["meeting_label"] == "Call with Alex Recruiter: Market catch-up"
    nxt = client.get("/api/v1/next-actions").json()
    assert {r["title"] for r in nxt["roles_to_decide"]} >= {"Platform Engineer", "Data Engineer"}

    # Pass on one, with a reason; apply for the other.
    passed = client.patch(f"/api/v1/roles/{data['id']}", json={"decision": "passed", "decision_reason": "Too junior"})
    assert passed.status_code == 200
    assert passed.json()["decided_on"] == str(date.today()) and passed.json()["decision_reason"] == "Too junior"
    app = post(
        client,
        "/api/v1/applications",
        {
            "role_id": platform["id"],
            "stage": "applied",
            "route": "agency",
            "agency_id": seeded["agency"]["id"],
            "recruiter_id": alex,
        },
    )
    by_status = {r["title"]: r["status"] for r in _summaries(client, contact_id=alex)}
    assert by_status == {"Platform Engineer": "applied", "Data Engineer": "passed"}
    assert _summaries(client, status="applied", contact_id=alex)[0]["application_ids"] == [app["id"]]
    titles = {r["title"] for r in client.get("/api/v1/next-actions").json()["roles_to_decide"]}
    assert "Platform Engineer" not in titles and "Data Engineer" not in titles

    # Changing your mind clears the decision and its reason.
    back = client.patch(f"/api/v1/roles/{data['id']}", json={"decision": None}).json()
    assert back["decision"] is None and back["decision_reason"] is None and back["decided_on"] is None

    # On the timeline: who mentioned what.
    items = client.get("/api/v1/timeline", params={"contact_id": alex}).json()["items"]
    titles = [i["title"] for i in items]
    assert "Alex Recruiter mentioned Platform Engineer at Fabrikam" in titles


def test_passed_on_the_timeline_and_validation(client, seeded):
    role = post(client, "/api/v1/roles", {"company_id": seeded["company"]["id"], "title": "Staff Engineer"})
    client.patch(f"/api/v1/roles/{role['id']}", json={"decision": "passed", "decision_reason": "Office five days"})
    items = client.get("/api/v1/timeline").json()["items"]
    passed = next(i for i in items if i["id"] == f"role-passed:{role['id']}")
    assert passed["title"] == "Passed on Staff Engineer at Contoso" and passed["detail"] == "Office five days"

    bad = client.post("/api/v1/roles", json={"company_id": seeded["company"]["id"], "title": "X", "contact_id": "nope"})
    assert bad.status_code == 422
    bad = client.post("/api/v1/roles", json={"company_id": seeded["company"]["id"], "title": "X", "meeting_id": "nope"})
    assert bad.status_code == 422
    bad = client.patch(f"/api/v1/roles/{role['id']}", json={"decision": "maybe"})
    assert bad.status_code == 422
    # The call has to be with the person who told you about it.
    riley = post(client, "/api/v1/contacts", {"name": "Riley Chen", "company_id": seeded["company"]["id"]})
    alexs = post(client, "/api/v1/meetings", {"contact_id": seeded["recruiter"]["id"], "starts_at": _iso(-1)})
    bad = client.patch(f"/api/v1/roles/{role['id']}", json={"contact_id": riley["id"], "meeting_id": alexs["id"]})
    assert bad.status_code == 422


def test_deleting_the_call_or_person_keeps_the_role(client, seeded):
    alex = seeded["recruiter"]["id"]
    call = post(client, "/api/v1/meetings", {"contact_id": alex, "starts_at": _iso(-1), "status": "done"})
    role = post(
        client,
        "/api/v1/roles",
        {"company_id": seeded["company"]["id"], "title": "SRE", "contact_id": alex, "meeting_id": call["id"]},
    )
    assert client.delete(f"/api/v1/meetings/{call['id']}").status_code == 204
    assert client.get(f"/api/v1/roles/{role['id']}").json()["meeting_id"] is None

    call = post(client, "/api/v1/meetings", {"contact_id": alex, "starts_at": _iso(-1), "status": "done"})
    client.patch(f"/api/v1/roles/{role['id']}", json={"meeting_id": call["id"]})
    assert client.delete(f"/api/v1/contacts/{alex}").status_code == 204
    after = client.get(f"/api/v1/roles/{role['id']}").json()
    assert after["contact_id"] is None and after["meeting_id"] is None


def test_a_roles_page(client, seeded):
    role = seeded["role"]
    one = client.get(f"/api/v1/role-summaries/{role['id']}")
    assert one.status_code == 200
    assert one.json()["company_name"] == "Contoso" and one.json()["status"] == "to_decide"
    assert client.get("/api/v1/role-summaries/missing").status_code == 404
    # Search finds roles by title (not by company name) and opens their page.
    hits = [h for h in client.get("/api/v1/search", params={"q": "senior backend"}).json() if h["kind"] == "role"]
    assert [(h["link"], h["subtitle"]) for h in hits] == [(f"/roles/{role['id']}", "Contoso")]
    assert not [h for h in client.get("/api/v1/search", params={"q": "contoso"}).json() if h["kind"] == "role"]
