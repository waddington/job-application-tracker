from datetime import UTC, datetime, timedelta

from .factories import post


def _at(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).isoformat()


def _role(client, company_id, title, contact_id=None, **extra):
    body = {"company_id": company_id, "title": title, **extra}
    if contact_id:
        body["contact_id"] = contact_id
    return post(client, "/api/v1/roles", body)


def _apply(client, role_id, stage="applied"):
    return post(client, "/api/v1/applications", {"role_id": role_id, "stage": stage})


def test_conversations(client, seeded):
    company = seeded["company"]["id"]
    alex = seeded["recruiter"]["id"]  # at Northwind Talent
    riley = post(client, "/api/v1/contacts", {"name": "Riley Chen", "agency_id": seeded["agency"]["id"]})["id"]
    sam = post(client, "/api/v1/contacts", {"name": "Sam Patel", "company_id": company})["id"]  # in-house

    # Calls: two held, one booked, one cancelled (Alex), one held (Sam).
    for status, days in (("done", -10), ("done", -3), ("scheduled", 4), ("cancelled", -1)):
        post(client, "/api/v1/meetings", {"contact_id": alex, "status": status, "starts_at": _at(days)})
    post(client, "/api/v1/meetings", {"contact_id": sam, "status": "done", "starts_at": _at(-2)})

    # Alex pitched four roles: one went to an offer, one was ghosted, one passed, one undecided.
    offer = _role(client, company, "Platform Engineer", alex)
    a = _apply(client, offer["id"])
    post(client, f"/api/v1/applications/{a['id']}/interviews", {"starts_at": _at(-1), "status": "done"})
    post(client, f"/api/v1/applications/{a['id']}/offers", {"salary": 95000, "currency": "GBP"})
    ghost = _role(client, company, "Data Engineer", alex)
    g = _apply(client, ghost["id"])
    client.post(f"/api/v1/applications/{g['id']}/move", json={"to_stage": "ghosted"})
    _role(client, company, "Frontend Engineer", alex, decision="passed", decision_reason="Office five days a week")
    _role(client, company, "SRE", alex)
    # Riley pitched one, and you passed without a reason.
    _role(client, company, "Backend Engineer", riley, decision="passed")
    # Found yourself: not a pitch.
    _role(client, company, "Staff Engineer")

    out = client.get("/api/v1/insights/conversations").json()
    # The pitched-roles diagram: every node names itself, and its id isn't a stage's.
    assert out["flow"]["nodes"] and all(n["code"] == n["id"] for n in out["flow"]["nodes"])
    total = out["total"]
    assert (total["calls_held"], total["calls_booked"], total["calls_cancelled"]) == (3, 1, 1)
    assert (total["pitched"], total["applied"], total["passed"], total["deciding"]) == (5, 2, 2, 1)
    assert total["apply_rate"] == 0.5
    assert (total["interviewed"], total["offers"], total["ghosted"], total["in_progress"], total["closed"]) == (
        1,
        1,
        1,
        0,
        0,
    )
    assert total["median_decide_days"] == 0.0  # all decided straight away in this test
    assert out["people_talked_to"] == 3

    flow = out["flow"]
    assert flow["applications"] == 5
    # Where roles wait sits beside Applied (holding); passing on one isn't "Passed" (an interview?).
    names = {n["id"]: (n["name"], n["kind"]) for n in flow["nodes"]}
    assert names["deciding"] == ("Deciding whether to apply", "holding")
    assert names["passed"] == ("Decided not to apply", "outcome")
    assert [n["id"] for n in flow["nodes"]] == ["pitched", "deciding", "applied", "offer", "ghosted", "passed"]
    assert {n["id"]: n["reached"] for n in flow["nodes"]} == {
        "pitched": 5,
        "applied": 2,
        "passed": 2,
        "deciding": 1,
        "offer": 1,
        "ghosted": 1,
    }
    assert {(lk["source"], lk["target"]): lk["value"] for lk in flow["links"]} == {
        ("pitched", "applied"): 2,
        ("pitched", "passed"): 2,
        ("pitched", "deciding"): 1,
        ("applied", "offer"): 1,
        ("applied", "ghosted"): 1,
    }

    people = {p["name"]: p for p in out["people"]}
    assert [p["name"] for p in out["people"]] == ["Alex Recruiter", "Riley Chen", "Sam Patel"]  # most pitched first
    assert (people["Alex Recruiter"]["pitched"], people["Alex Recruiter"]["calls_held"]) == (4, 2)
    assert people["Alex Recruiter"]["apply_rate"] == round(2 / 3, 3)
    assert people["Riley Chen"]["apply_rate"] == 0.0
    assert people["Sam Patel"]["company_name"] == "Contoso" and people["Sam Patel"]["agency_name"] is None
    assert people["Sam Patel"]["apply_rate"] is None  # nothing pitched, nothing decided

    [agency] = out["agencies"]  # Sam is in-house: no agency
    assert (agency["name"], agency["people"], agency["pitched"], agency["calls_held"]) == ("Northwind Talent", 2, 5, 2)

    assert [(r["role_title"], r["person_name"], r["reason"]) for r in out["pass_reasons"]] == [
        ("Frontend Engineer", "Alex Recruiter", "Office five days a week")
    ]


def test_conversations_by_period(client, seeded):
    alex = seeded["recruiter"]["id"]
    post(client, "/api/v1/meetings", {"contact_id": alex, "status": "done", "starts_at": _at(-40)})
    post(client, "/api/v1/meetings", {"contact_id": alex, "status": "done", "starts_at": _at(-5)})
    _role(client, seeded["company"]["id"], "Platform Engineer", alex)

    recent = client.get("/api/v1/insights/conversations", params={"since": _at(-30)}).json()
    assert (recent["total"]["calls_held"], recent["total"]["pitched"]) == (1, 1)
    later = client.get("/api/v1/insights/conversations", params={"since": _at(1)}).json()
    assert later["total"]["calls_held"] == later["total"]["pitched"] == later["people_talked_to"] == 0
    assert later["flow"] == {"applications": 0, "nodes": [], "links": []}
    assert later["people"] == [] and later["agencies"] == [] and later["pass_reasons"] == []


def test_weekly_activity_counts_calls_and_pitched_roles(client, seeded):
    alex = seeded["recruiter"]["id"]
    post(client, "/api/v1/meetings", {"contact_id": alex, "status": "done", "starts_at": _at(0)})
    post(client, "/api/v1/meetings", {"contact_id": alex, "status": "cancelled", "starts_at": _at(0)})
    _role(client, seeded["company"]["id"], "Platform Engineer", alex)
    _role(client, seeded["company"]["id"], "Staff Engineer")  # not pitched
    this_week = client.get("/api/v1/insights/activity", params={"weeks": 1}).json()[0]
    assert (this_week["calls"], this_week["pitched"]) == (1, 1)


def test_time_to_decide_counts_backdated_history(app, client, seeded):
    """An application entered after the fact dates from its first stage event, not its row."""
    import sqlite3

    role = _role(client, seeded["company"]["id"], "Platform Engineer", seeded["recruiter"]["id"])
    a = _apply(client, role["id"])
    db = sqlite3.connect(app.state.snapshots.data_dir / "tracker.sqlite3")

    def back(table: str, column: str, where: str, arg: str, days: int) -> None:
        for rowid, value in db.execute(f"SELECT rowid, {column} FROM {table} WHERE {where}", (arg,)).fetchall():
            moved = datetime.fromisoformat(value) - timedelta(days=days)
            db.execute(f"UPDATE {table} SET {column} = ? WHERE rowid = ?", (moved.isoformat(), rowid))

    with db:
        back("roles", "created_at", "id = ?", role["id"], 12)
        back("events", "occurred_at", "application_id = ? AND from_stage IS NULL", a["id"], 10)
    db.close()
    total = client.get("/api/v1/insights/conversations").json()["total"]
    assert 1.9 < total["median_decide_days"] < 2.1


def test_outcomes_best_application_until_and_unmarked_calls(client, seeded):
    company = seeded["company"]["id"]
    alex = seeded["recruiter"]["id"]
    # A scheduled call whose time has passed hasn't been marked: not held, not booked.
    post(client, "/api/v1/meetings", {"contact_id": alex, "status": "scheduled", "starts_at": _at(-2)})
    # Marked Happened counts as held even if its time is ahead (you know best).
    post(client, "/api/v1/meetings", {"contact_id": alex, "status": "done", "starts_at": _at(1)})

    # One role, two applications (directly and through Alex): the better outcome counts, once.
    both = _role(client, company, "Platform Engineer", alex)
    rejected = _apply(client, both["id"])
    client.post(f"/api/v1/applications/{rejected['id']}/move", json={"to_stage": "rejected"})
    _apply(client, both["id"], stage="screen")
    closed = _role(client, company, "Data Engineer", alex)
    c = _apply(client, closed["id"])
    client.post(f"/api/v1/applications/{c['id']}/move", json={"to_stage": "withdrawn"})
    # Two passed the same day: by title.
    _role(client, company, "Zeta Role", alex, decision="passed", decision_reason="No")
    _role(client, company, "Alpha Role", alex, decision="passed", decision_reason="Nope")

    out = client.get("/api/v1/insights/conversations").json()
    total = out["total"]
    assert (total["calls_held"], total["calls_booked"]) == (1, 0)
    assert (total["pitched"], total["applied"], total["in_progress"], total["closed"]) == (4, 2, 1, 1)
    assert [r["role_title"] for r in out["pass_reasons"]] == ["Alpha Role", "Zeta Role"]

    before = client.get("/api/v1/insights/conversations", params={"until": _at(-1)}).json()["total"]
    assert (before["pitched"], before["calls_held"]) == (0, 0)


def test_a_role_youre_only_interested_in_is_still_deciding(client, seeded):
    alex = seeded["recruiter"]["id"]
    role = _role(client, seeded["company"]["id"], "Product Engineer", alex)["id"]
    app = _apply(client, role, stage="interested")
    total = client.get("/api/v1/insights/conversations").json()["total"]
    assert (total["pitched"], total["applied"], total["deciding"]) == (1, 0, 1)
    client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "applied"})
    total = client.get("/api/v1/insights/conversations").json()["total"]
    assert (total["applied"], total["deciding"]) == (1, 0)


def test_a_role_withdrawn_while_only_interested_counts_as_passed(client, seeded):
    alex = seeded["recruiter"]["id"]
    role = _role(client, seeded["company"]["id"], "Product Engineer", alex)["id"]
    app = _apply(client, role, stage="interested")
    client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "withdrawn"})
    total = client.get("/api/v1/insights/conversations").json()["total"]
    assert (total["pitched"], total["applied"], total["passed"], total["deciding"]) == (1, 0, 1, 0)


def test_applied_then_withdrawn_is_still_applied(client, seeded):
    alex = seeded["recruiter"]["id"]
    role = _role(client, seeded["company"]["id"], "Product Engineer", alex)["id"]
    app = _apply(client, role, stage="interested")
    client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "applied"})
    client.post(f"/api/v1/applications/{app['id']}/move", json={"to_stage": "withdrawn"})
    total = client.get("/api/v1/insights/conversations").json()["total"]
    assert (total["applied"], total["passed"], total["closed"]) == (1, 0, 1)
