from datetime import UTC, date, datetime, timedelta

from .factories import post


def _iso(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def _timeline(client, **params) -> list[dict]:
    res = client.get("/api/v1/timeline", params=params)
    assert res.status_code == 200, res.text
    return res.json()["items"]


def test_everything_in_one_list(client, seeded):
    app = post(
        client,
        "/api/v1/applications",
        {
            "role_id": seeded["role"]["id"],
            "stage": "applied",
            "route": "agency",
            "agency_id": seeded["agency"]["id"],
            "recruiter_id": seeded["recruiter"]["id"],
        },
    )
    client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "screen"})
    post(
        client, f"/api/v1/applications/{app['id']}/activities", {"kind": "call", "summary": "Call with Alex\nGood chat"}
    )
    post(client, f"/api/v1/applications/{app['id']}/interviews", {"title": "System design", "starts_at": _iso(3)})
    hm = post(client, "/api/v1/contacts", {"name": "Riley Chen", "company_id": seeded["company"]["id"]})
    client.patch(f"/api/v1/contacts/{hm['id']}", json={"awaiting_reply_since": str(date.today())})
    post(client, "/api/v1/notes", {"title": "About Riley", "links": [f"contact:{hm['id']}"]})

    items = _timeline(client)
    titles = [i["title"] for i in items]
    assert "Added at Applied" in titles
    assert "Applied → Screen" in titles
    assert "Added company Contoso" in titles and "Added agency Northwind Talent" in titles
    assert "Replied to Riley Chen; waiting to hear back" in titles
    assert "Note: About Riley" in titles
    call = next(i for i in items if i["title"] == "Call with Alex")
    assert call["category"] == "message" and call["detail"] == "Good chat"
    assert call["company_name"] == "Contoso" and call["agency_name"] == "Northwind Talent"
    assert call["role_title"] == "Senior Backend Engineer"
    assert [p["name"] for p in call["people"]] == ["Alex Recruiter"]
    # The interview at its own time, ahead of everything else (newest first).
    assert items[0]["category"] == "interview" and items[0]["title"].endswith("(booked)")
    assert [i["at"] for i in items] == sorted((i["at"] for i in items), reverse=True)


def test_filters(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    other_co = post(client, "/api/v1/companies", {"name": "Fabrikam"})
    riley = post(client, "/api/v1/contacts", {"name": "Riley Chen", "company_id": other_co["id"]})
    post(client, "/api/v1/notes", {"title": "Riley's team", "links": [f"contact:{riley['id']}"]})

    by_company = _timeline(client, company_id=other_co["id"])
    assert {i["title"] for i in by_company} == {"Added company Fabrikam", "Added Riley Chen", "Note: Riley's team"}
    by_person = _timeline(client, contact_id=riley["id"])
    assert {i["title"] for i in by_person} == {"Added Riley Chen", "Note: Riley's team"}
    by_app = _timeline(client, application_id=app["id"])
    assert [i["category"] for i in by_app] == ["stage"]
    notes = _timeline(client, category=["note", "added"])
    assert {i["category"] for i in notes} == {"note", "added"}
    assert _timeline(client, since=_iso(1)) == []
    assert _timeline(client, until=_iso(-1)) == []


def test_offer_reply_due_and_archived(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "offer"})
    due = date.today() + timedelta(days=5)
    post(client, f"/api/v1/applications/{app['id']}/offers", {"salary": 85000, "respond_by": str(due)})
    client.patch(f"/api/v1/applications/{app['id']}", json={"archived": True})

    items = _timeline(client, category=["offer"])
    reply = next(i for i in items if i["id"].startswith("offer-reply:"))
    assert reply["all_day"] is True and reply["at"].startswith(str(due))
    assert all(i["archived"] for i in items)


def test_revised_offer_and_panel(client, seeded):
    app = post(
        client,
        "/api/v1/applications",
        {
            "role_id": seeded["role"]["id"],
            "stage": "offer",
            "route": "agency",
            "agency_id": seeded["agency"]["id"],
            "recruiter_id": seeded["recruiter"]["id"],
        },
    )
    soon = date.today() + timedelta(days=3)
    later = date.today() + timedelta(days=9)
    post(client, f"/api/v1/applications/{app['id']}/offers", {"salary": 80000, "respond_by": str(soon)})
    post(client, f"/api/v1/applications/{app['id']}/offers", {"salary": 90000, "respond_by": str(later)})
    replies = [i for i in _timeline(client, category=["offer"]) if i["id"].startswith("offer-reply:")]
    assert [r["at"][:10] for r in replies] == [str(later)]

    hm = post(client, "/api/v1/contacts", {"name": "Riley Chen", "company_id": seeded["company"]["id"]})
    post(
        client,
        f"/api/v1/applications/{app['id']}/interviews",
        {"title": "Final", "starts_at": _iso(2), "interviewer_ids": [hm["id"]]},
    )
    by_recruiter = _timeline(client, contact_id=seeded["recruiter"]["id"], category=["interview"])
    final = next(i for i in by_recruiter if i["id"].startswith("interview:"))
    assert {p["name"] for p in final["people"]} == {"Riley Chen", "Alex Recruiter"}


def test_role_items_point_at_the_role(client, seeded):
    role = seeded["role"]
    client.patch(f"/api/v1/roles/{role['id']}", json={"decision": "passed", "decision_reason": "Too far"})
    items = client.get("/api/v1/timeline").json()["items"]
    passed = [i for i in items if i["id"] == f"role-passed:{role['id']}"]
    assert [(i["role_id"], i["role_title"]) for i in passed] == [(role["id"], "Senior Backend Engineer")]
