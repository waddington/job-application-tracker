from .factories import post


def test_in_house_recruiter_on_a_direct_application(client, seeded):
    company, role, agency_recruiter = seeded["company"]["id"], seeded["role"]["id"], seeded["recruiter"]["id"]
    talent = post(client, "/api/v1/contacts", {"name": "Riley Chen", "title": "Head of Talent", "company_id": company})

    app = post(client, "/api/v1/applications", {"role_id": role, "route": "direct", "recruiter_id": talent["id"]})
    assert (app["route"], app["recruiter_id"], app["agency_id"]) == ("direct", talent["id"], None)

    r = client.post("/api/v1/applications", json={"role_id": role, "route": "direct", "recruiter_id": agency_recruiter})
    assert r.status_code == 422 and "works for an agency" in r.json()["detail"]
    r = client.post(
        "/api/v1/applications", json={"role_id": role, "route": "direct", "agency_id": seeded["agency"]["id"]}
    )
    assert r.status_code == 422


def test_person_summary(client, seeded):
    company, role = seeded["company"]["id"], seeded["role"]["id"]
    talent = post(client, "/api/v1/contacts", {"name": "Riley Chen", "title": "Head of Talent", "company_id": company})
    manager = post(client, "/api/v1/contacts", {"name": "Sam Lee", "company_id": company})
    app = post(client, "/api/v1/applications", {"role_id": role, "route": "direct", "recruiter_id": talent["id"]})
    other = post(client, "/api/v1/applications", {"role_id": role})
    for app_id, relation in ((app["id"], "internal_recruiter"), (other["id"], "hiring_manager")):
        link = {"contact_id": talent["id"], "relation": relation}
        post(client, f"/api/v1/applications/{app_id}/contacts", link)
    post(
        client,
        f"/api/v1/applications/{app['id']}/interviews",
        {"round": 1, "title": "Intro call", "interviewer_ids": [talent["id"], manager["id"]]},
    )

    out = client.get(f"/api/v1/contacts/{talent['id']}/summary").json()
    assert (out["contact"]["title"], out["company_name"], out["agency_name"]) == ("Head of Talent", "Contoso", None)
    relations = {a["id"]: a["relations"] for a in out["applications"]}
    assert relations == {app["id"]: ["source", "internal_recruiter"], other["id"]: ["hiring_manager"]}
    assert [i["label"] for i in out["interviews"]] == ["Round 1 · Intro call"]

    lonely = client.get(f"/api/v1/contacts/{manager['id']}/summary").json()
    assert (lonely["applications"], len(lonely["interviews"])) == ([], 1)
    assert client.get("/api/v1/contacts/nope/summary").status_code == 404


def test_quick_create_direct_with_an_in_house_recruiter(client, seeded):
    body = {"company_name": "Fabrikam", "role_title": "Platform Engineer", "route": "direct"}
    body["recruiter_name"] = "Jo Park"
    app = post(client, "/api/v1/applications/quick", body)
    jo = client.get(f"/api/v1/contacts/{app['recruiter_id']}").json()
    assert (jo["name"], jo["agency_id"], jo["company_id"] is not None) == ("Jo Park", None, True)
    # The same name at the same company is the same person.
    again = post(client, "/api/v1/applications/quick", {**body, "role_title": "SRE"})
    assert again["recruiter_id"] == app["recruiter_id"]
    r = client.post("/api/v1/applications/quick", json={**body, "route": "referral"})
    assert r.status_code == 422
