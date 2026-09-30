from datetime import UTC, datetime, timedelta

from .factories import post


def _move(client, app_id, stage):
    r = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": stage})
    assert r.status_code == 200, r.text


def test_scorecard(client, seeded):
    role = seeded["role"]["id"]
    agency = seeded["agency"]["id"]
    alex = seeded["recruiter"]["id"]
    sam = post(client, "/api/v1/contacts", {"name": "Sam Recruiter", "agency_id": agency})["id"]
    other_agency = post(client, "/api/v1/agencies", {"name": "Fabrikam Search"})["id"]

    def via(recruiter, agency_id=agency):
        body = {"role_id": role, "stage": "applied", "route": "agency", "agency_id": agency_id}
        if recruiter:
            body["recruiter_id"] = recruiter
        return post(client, "/api/v1/applications", body)["id"]

    a1, a2, a3 = via(alex), via(alex), via(alex)
    # a1: a call, then an interview round.
    r = client.post(f"/api/v1/applications/{a1}/activities", json={"kind": "call"})
    assert r.status_code == 201, r.text
    call_at = r.json()["occurred_at"]
    _move(client, a1, "interviewing")
    post(client, f"/api/v1/applications/{a1}/interviews", {"round": 1, "title": "Screen"})
    # a2: a call logged for next week hasn't happened, and marking it Ghosted isn't a response.
    tomorrow = (datetime.now(UTC) + timedelta(days=7)).isoformat()
    r = client.post(f"/api/v1/applications/{a2}/activities", json={"kind": "call", "occurred_at": tomorrow})
    assert r.status_code == 201, r.text
    _move(client, a2, "ghosted")
    # a3: rejected, and an interview that was cancelled doesn't count.
    _move(client, a3, "rejected")
    post(client, f"/api/v1/applications/{a3}/interviews", {"round": 1, "title": "Screen", "status": "cancelled"})
    via(sam)
    via(None, other_agency)
    # Sam's agency counts this one, though the application names no agency.
    post(
        client, "/api/v1/applications", {"role_id": role, "stage": "applied", "route": "referral", "recruiter_id": sam}
    )
    post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})  # direct: not scored

    out = client.get("/api/v1/insights/scorecard").json()
    recruiters = {s["name"]: s for s in out["recruiters"]}
    assert [s["name"] for s in out["recruiters"]] == ["Alex Recruiter", "Sam Recruiter"]
    a = recruiters["Alex Recruiter"]
    assert a["agency_name"] == "Northwind Talent"
    assert (a["roles"], a["interviewed"], a["active"], a["ghosted"], a["closed"], a["success"]) == (3, 1, 1, 1, 1, 0)
    # Only a1 had a sign of life (the call); closing moves and the future call don't count.
    assert a["median_first_update_days"] is not None and a["median_first_update_days"] < 0.1
    assert a["last_contact"] == call_at
    s = recruiters["Sam Recruiter"]
    assert (s["roles"], s["active"], s["median_first_update_days"], s["last_contact"]) == (2, 2, None, None)

    agencies = {s["name"]: s for s in out["agencies"]}
    assert [s["name"] for s in out["agencies"]] == ["Northwind Talent", "Fabrikam Search"]
    assert (agencies["Northwind Talent"]["roles"], agencies["Fabrikam Search"]["roles"]) == (5, 1)

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert client.get("/api/v1/insights/scorecard", params={"since": future}).json() == {
        "recruiters": [],
        "agencies": [],
    }
