from .factories import post


def test_company_with_applications_cant_be_deleted_but_its_roles_go_with_it(client, seeded):
    company, role = seeded["company"]["id"], seeded["role"]["id"]
    app = post(client, "/api/v1/applications", {"role_id": role})

    r = client.delete(f"/api/v1/companies/{company}")
    assert r.status_code == 409
    assert r.json()["detail"] == "Contoso has 1 application. Delete them first, or archive them instead."
    r = client.delete(f"/api/v1/roles/{role}")
    assert r.status_code == 409 and "Senior Backend Engineer has 1 application" in r.json()["detail"]

    assert client.delete(f"/api/v1/applications/{app['id']}").status_code == 204
    # A second role with nothing on it goes too.
    other = post(client, "/api/v1/roles", {"company_id": company, "title": "Staff Engineer"})
    assert client.delete(f"/api/v1/companies/{company}").status_code == 204
    assert client.get(f"/api/v1/companies/{company}").status_code == 404
    assert client.get(f"/api/v1/roles/{role}").status_code == 404
    assert client.get(f"/api/v1/roles/{other['id']}").status_code == 404


def test_deleting_an_agency_or_recruiter_keeps_their_applications(client, seeded):
    agency, recruiter, role = seeded["agency"]["id"], seeded["recruiter"]["id"], seeded["role"]["id"]
    app = post(
        client,
        "/api/v1/applications",
        {"role_id": role, "route": "agency", "agency_id": agency, "recruiter_id": recruiter},
    )
    assert client.delete(f"/api/v1/contacts/{recruiter}").status_code == 204
    assert client.get(f"/api/v1/applications/{app['id']}").json()["recruiter_id"] is None
    assert client.delete(f"/api/v1/agencies/{agency}").status_code == 204
    after = client.get(f"/api/v1/applications/{app['id']}").json()
    assert (after["agency_id"], after["route"]) == (None, "agency")


def test_deleting_an_application_takes_its_history_with_it(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    post(client, f"/api/v1/applications/{app['id']}/interviews", {"round": 1, "title": "Screen"})
    post(client, f"/api/v1/applications/{app['id']}/offers", {"salary": 70_000})
    note = post(client, "/api/v1/notes", {"title": "Prep", "body": "x", "links": [f"application:{app['id']}"]})
    assert client.delete(f"/api/v1/applications/{app['id']}").status_code == 204
    assert client.get("/api/v1/interviews", params={"application_id": app["id"]}).json() == []
    assert client.get("/api/v1/offers", params={"application_id": app["id"]}).json() == []
    # The note stays (it's your file) and can still be edited.
    r = client.patch(f"/api/v1/notes/{note['id']}", json={"body": "still here", "links": note["links"]})
    assert r.status_code == 200, r.text
