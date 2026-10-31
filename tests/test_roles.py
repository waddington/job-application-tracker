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
    assert first["meeting_kind"] == "call"
    assert first["meeting_title"] == "Market catch-up"
    assert first["meeting_contact_name"] == "Alex Recruiter"
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
    assert "Alex Recruiter pitched Platform Engineer at Fabrikam" in titles


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


def test_a_role_you_track_at_interested_is_interested_until_you_apply(client, seeded):
    role = post(client, "/api/v1/roles", {"company_id": seeded["company"]["id"], "title": "Product Engineer"})["id"]
    app = post(client, "/api/v1/applications", {"role_id": role, "stage": "interested"})["id"]
    assert client.get(f"/api/v1/role-summaries/{role}").json()["status"] == "interested"
    assert [r["id"] for r in _summaries(client, status="interested")] == [role]
    assert role not in [r["id"] for r in _summaries(client, status="to_decide")]
    r = client.post(f"/api/v1/applications/{app}/move", json={"to_stage": "applied"})
    assert r.status_code == 200, r.text
    assert client.get(f"/api/v1/role-summaries/{role}").json()["status"] == "applied"
    # Withdrawn while only interested: closed (not applied), saying how it ended.
    other = post(client, "/api/v1/roles", {"company_id": seeded["company"]["id"], "title": "SRE"})["id"]
    a2 = post(client, "/api/v1/applications", {"role_id": other, "stage": "interested"})["id"]
    client.post(f"/api/v1/applications/{a2}/move", json={"to_stage": "withdrawn"})
    closed = client.get(f"/api/v1/role-summaries/{other}").json()
    assert (closed["status"], closed["closed_as"]) == ("closed", "Withdrawn")
    assert [r["id"] for r in _summaries(client, status="closed")] == [other]
    # Applied and then withdrawn: that one was applied for.
    third = post(client, "/api/v1/roles", {"company_id": seeded["company"]["id"], "title": "Data Engineer"})["id"]
    a3 = post(client, "/api/v1/applications", {"role_id": third, "stage": "interested"})["id"]
    client.post(f"/api/v1/applications/{a3}/move", json={"to_stage": "applied"})
    client.post(f"/api/v1/applications/{a3}/move", json={"to_stage": "withdrawn"})
    after = client.get(f"/api/v1/role-summaries/{third}").json()
    assert (after["status"], after["closed_as"]) == ("applied", None)
    # Undoing the withdrawal makes it interested again.
    client.post(f"/api/v1/applications/{a2}/undo")
    assert client.get(f"/api/v1/role-summaries/{other}").json()["status"] == "interested"


def test_moving_on_from_interested_fills_in_the_applied_date(client, seeded):
    role = post(client, "/api/v1/roles", {"company_id": seeded["company"]["id"], "title": "Data Engineer"})["id"]
    app = post(client, "/api/v1/applications", {"role_id": role, "stage": "interested"})["id"]
    assert client.get(f"/api/v1/applications/{app}").json()["applied_on"] is None
    # Interested roles aren't "to decide" on Next actions.
    assert role not in [r["id"] for r in client.get("/api/v1/next-actions").json()["roles_to_decide"]]
    client.post(f"/api/v1/applications/{app}/move", json={"to_stage": "applied"})
    assert client.get(f"/api/v1/applications/{app}").json()["applied_on"] is not None
    # A date you already gave is kept.
    other = post(client, "/api/v1/applications", {"role_id": role, "stage": "interested", "applied_on": "2026-09-01"})[
        "id"
    ]
    client.post(f"/api/v1/applications/{other}/move", json={"to_stage": "screen"})
    assert client.get(f"/api/v1/applications/{other}").json()["applied_on"] == "2026-09-01"


def test_interested_in_a_workflow_without_an_applied_stage(app, client, seeded):
    (app.state.jat.data_dir / "config.toml").write_text(
        '[workflow]\ninitial = "lead"\n'
        '[[workflow.stages]]\nid = "lead"\n'
        '[[workflow.stages]]\nid = "submitted"\n'
        '[[workflow.stages]]\nid = "gone"\nkind = "closed"\n'
    )
    role = post(client, "/api/v1/roles", {"company_id": seeded["company"]["id"], "title": "SRE"})["id"]
    a = post(client, "/api/v1/applications", {"role_id": role, "stage": "lead"})["id"]
    assert client.get(f"/api/v1/role-summaries/{role}").json()["status"] == "interested"
    client.post(f"/api/v1/applications/{a}/move", json={"to_stage": "submitted"})
    assert client.get(f"/api/v1/role-summaries/{role}").json()["status"] == "applied"


def _status(client, role_id):
    r = client.get(f"/api/v1/role-summaries/{role_id}").json()
    return r["status"], r["closed_as"]


def test_how_far_a_roles_applications_got(client, seeded):
    company = seeded["company"]["id"]

    def role(title):
        return post(client, "/api/v1/roles", {"company_id": company, "title": title})["id"]

    def app(role_id, stage, **extra):
        return post(client, "/api/v1/applications", {"role_id": role_id, "stage": stage, **extra})["id"]

    def move(app_id, stage):
        r = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": stage})
        assert r.status_code == 200, r.text

    # A past application logged straight at Rejected, with its applied date: applied.
    logged = role("Backend Engineer")
    app(logged, "rejected", applied_on="2026-09-01")
    assert _status(client, logged) == ("applied", None)

    # Applied, the move undone, then withdrawn: it was never applied for.
    undone = role("Platform Engineer")
    a = app(undone, "interested")
    move(a, "applied")
    assert client.post(f"/api/v1/applications/{a}/undo").status_code == 200
    move(a, "withdrawn")
    assert _status(client, undone) == ("closed", "Withdrawn")

    # Ghosted while interested says so; reopening makes it interested again.
    ghosted = role("SRE")
    g = app(ghosted, "interested")
    move(g, "ghosted")
    assert _status(client, ghosted) == ("closed", "Ghosted")
    move(g, "interested")
    assert _status(client, ghosted) == ("interested", None)

    # One withdrawn and one still interested: interested. Both closed: the latest one's stage.
    mixed = role("Data Engineer")
    first = app(mixed, "interested")
    move(first, "withdrawn")
    second = app(mixed, "interested")
    assert _status(client, mixed) == ("interested", None)
    move(second, "rejected")
    assert _status(client, mixed) == ("closed", "Rejected")


def _events(client, app_id) -> list[str]:
    detail = client.get(f"/api/v1/applications/{app_id}").json()
    return [e["summary"] for e in detail["events"] if e["kind"] == "manual"]


def _app(client, role, **body):
    return post(client, "/api/v1/applications", {"role_id": role, **body})["id"]


def _get(client, app_id) -> dict:
    return client.get(f"/api/v1/applications/{app_id}").json()


def test_a_roles_new_person_takes_over_applications_they_fit(client, seeded):
    company, agency, alex = seeded["company"]["id"], seeded["agency"]["id"], seeded["recruiter"]["id"]
    other_agency = post(client, "/api/v1/agencies", {"name": "Blue Yonder Recruitment"})["id"]
    jordan = post(client, "/api/v1/contacts", {"name": "Jordan Lee", "agency_id": agency})["id"]
    sam = post(client, "/api/v1/contacts", {"name": "Sam Patel", "agency_id": other_agency})["id"]
    role = post(client, "/api/v1/roles", {"company_id": company, "title": "Platform Engineer", "contact_id": alex})[
        "id"
    ]
    with_alex = _app(client, role, route="agency", recruiter_id=alex)
    with_sam = _app(client, role, route="agency", recruiter_id=sam)  # you gave it someone else
    quiet = _get(client, with_alex)["last_activity_at"]

    # Alex hands it to Jordan, at the same agency: the application follows.
    r = client.patch(f"/api/v1/roles/{role}", json={"contact_id": jordan, "title": "Platform Engineer"})
    assert r.status_code == 200
    moved = _get(client, with_alex)
    assert (moved["recruiter_id"], moved["agency_id"], moved["route"]) == (jordan, agency, "agency")
    assert _events(client, with_alex) == ["Recruiter changed from Alex Recruiter to Jordan Lee, on the role"]
    assert moved["last_activity_at"] == quiet  # bookkeeping, not activity
    assert _get(client, with_sam)["recruiter_id"] == sam and _events(client, with_sam) == []

    # The same person sent again (the role form always sends it): nothing new.
    client.patch(f"/api/v1/roles/{role}", json={"contact_id": jordan})
    assert len(_events(client, with_alex)) == 1

    # Then to Sam, at another agency: you applied through Jordan's agency, so it keeps Jordan, and says why.
    client.patch(f"/api/v1/roles/{role}", json={"contact_id": sam})
    kept = _get(client, with_alex)
    assert (kept["recruiter_id"], kept["agency_id"]) == (jordan, agency)
    assert _events(client, with_alex)[-1] == (
        "The role's person changed from Jordan Lee to Sam Patel; this application still has Jordan Lee "
        "(through Northwind Talent)"
    )

    # Taking the role's person away changes no application.
    client.patch(f"/api/v1/roles/{role}", json={"contact_id": None})
    assert _get(client, with_alex)["recruiter_id"] == jordan and len(_events(client, with_alex)) == 2


def test_direct_referral_closed_and_archived_applications(client, seeded):
    company = seeded["company"]["id"]
    other_company = post(client, "/api/v1/companies", {"name": "Fabrikam"})["id"]
    riley = post(client, "/api/v1/contacts", {"name": "Riley Chen", "company_id": company})["id"]
    outsider = post(client, "/api/v1/contacts", {"name": "Jo Freelance", "company_id": other_company})["id"]
    agency_person = seeded["recruiter"]["id"]
    role = post(client, "/api/v1/roles", {"company_id": company, "title": "SRE"})["id"]
    direct = _app(client, role, route="direct")
    referral = _app(client, role, route="referral")
    closed = _app(client, role, route="direct", stage="rejected")
    archived = _app(client, role, route="direct")
    client.patch(f"/api/v1/applications/{archived}", json={"archived": True})

    # Someone pitched it from an agency: a direct application stays direct and gets nobody.
    client.patch(f"/api/v1/roles/{role}", json={"contact_id": agency_person})
    assert (_get(client, direct)["route"], _get(client, direct)["recruiter_id"]) == ("direct", None)
    # Someone at another company isn't in-house either.
    client.patch(f"/api/v1/roles/{role}", json={"contact_id": outsider})
    assert _get(client, direct)["recruiter_id"] is None
    # Someone at the role's company: the direct application takes them.
    client.patch(f"/api/v1/roles/{role}", json={"contact_id": riley})
    assert _get(client, direct)["recruiter_id"] == riley
    assert _events(client, direct) == ["Recruiter set to Riley Chen, on the role"]
    # Referrals, closed and archived applications are left alone.
    for untouched in (referral, closed, archived):
        assert _get(client, untouched)["recruiter_id"] is None and _events(client, untouched) == []


def test_changing_an_applications_recruiter_is_recorded_and_isnt_activity(client, seeded):
    alex = seeded["recruiter"]["id"]
    jordan = post(client, "/api/v1/contacts", {"name": "Jordan Lee", "agency_id": seeded["agency"]["id"]})["id"]
    app = _app(client, seeded["role"]["id"], route="agency", recruiter_id=alex, stage="interested")
    url = f"/api/v1/applications/{app}"
    client.post(f"{url}/move", json={"to_stage": "applied"})
    client.patch(url, json={"recruiter_id": jordan})
    client.patch(url, json={"recruiter_id": jordan})  # the same again: nothing new
    client.patch(url, json={"tags": ["remote"]})
    assert _events(client, app) == ["Recruiter changed from Alex Recruiter to Jordan Lee"]
    # Undoing the move recomputes the last activity: the note doesn't count.
    created = _get(client, app)["events"][0]["occurred_at"]
    client.post(f"{url}/undo")
    assert _get(client, app)["last_activity_at"] == created
