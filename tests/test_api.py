from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient

from jat.app import create_app
from jat.datadir import init_data_dir
from jat.db import db_path, migrate
from jat.db.models import Application


@pytest.fixture
def app(tmp_path):
    path = tmp_path / "data"
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    return create_app(path, dist=tmp_path / "no-dist")


@pytest.fixture
def client(app):
    return TestClient(app)


def post(client, url, json, status=201):
    r = client.post(url, json=json)
    assert r.status_code == status, r.text
    return r.json()


@pytest.fixture
def seeded(client):
    company = post(client, "/api/v1/companies", {"name": "Contoso", "website": "https://contoso.example.com"})
    agency = post(client, "/api/v1/agencies", {"name": "Northwind Talent"})
    recruiter = post(
        client,
        "/api/v1/contacts",
        {
            "name": "Alex Recruiter",
            "agency_id": agency["id"],
            "details": [
                {"kind": "email", "value": "alex@northwind.example.com", "label": "work"},
                {"kind": "phone", "value": "+44 7700 900000", "label": "mobile"},
            ],
        },
    )
    role = post(
        client,
        "/api/v1/roles",
        {
            "company_id": company["id"],
            "title": "Senior Backend Engineer",
            "work_mode": "hybrid",
            "day_rate": 650,
            "employment_type": "contract",
            "ir35": "outside",
            "currency": "GBP",
        },
    )
    return {"company": company, "agency": agency, "recruiter": recruiter, "role": role}


def test_contacts_have_multiple_details(client, seeded):
    recruiter = seeded["recruiter"]
    assert [d["kind"] for d in recruiter["details"]] == ["email", "phone"]
    r = client.patch(
        f"/api/v1/contacts/{recruiter['id']}",
        json={"details": [{"kind": "linkedin", "value": "https://linkedin.example.com/in/alex"}]},
    )
    assert [d["kind"] for d in r.json()["details"]] == ["linkedin"]
    assert client.get(f"/api/v1/contacts?agency_id={seeded['agency']['id']}").json()[0]["name"] == "Alex Recruiter"


def test_application_lifecycle(client, app, seeded):
    created = post(
        client,
        "/api/v1/applications",
        {
            "role_id": seeded["role"]["id"],
            "route": "agency",
            "recruiter_id": seeded["recruiter"]["id"],
            "tags": ["python"],
        },
    )
    app_id = created["id"]
    assert created["agency_id"] == seeded["agency"]["id"]  # inferred from the recruiter
    assert created["stage"] == "interested" and created["stage_name"] == "Interested"
    assert created["company_name"] == "Contoso" and created["recruiter_name"] == "Alex Recruiter"
    assert "applied" in created["allowed_next"]
    writes_before = app.state.writes.writes

    moved = post(client, f"/api/v1/applications/{app_id}/move", {"to_stage": "applied", "note": "Sent CV"}, 200)
    assert moved["stage"] == "applied"
    assert moved["events"][-1]["summary"] == "Sent CV"
    assert app.state.writes.writes > writes_before

    bad = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": "interested"})
    assert bad.status_code == 422 and "allowed" in bad.json()["detail"]

    undone = post(client, f"/api/v1/applications/{app_id}/undo", {}, 200)
    assert undone["stage"] == "interested"

    event = post(client, f"/api/v1/applications/{app_id}/activities", {"kind": "call", "summary": "Intro call"})
    assert event["kind"] == "call"
    assert len(client.get(f"/api/v1/applications/{app_id}/events").json()) == 4

    link = post(
        client,
        f"/api/v1/applications/{app_id}/contacts",
        {"contact_id": seeded["recruiter"]["id"], "relation": "recruiter"},
    )
    assert client.get(f"/api/v1/applications/{app_id}").json()["contacts"][0]["id"] == link["id"]
    assert client.delete(f"/api/v1/applications/{app_id}/contacts/{link['id']}").status_code == 204

    patched = client.patch(f"/api/v1/applications/{app_id}", json={"archived": True, "tags": ["python", "fintech"]})
    assert patched.json()["archived"] is True
    assert client.get("/api/v1/applications").json() == []
    assert len(client.get("/api/v1/applications?archived=true").json()) == 1


def test_list_filters_and_stale(client, app, seeded):
    role_id = seeded["role"]["id"]
    direct = post(client, "/api/v1/applications", {"role_id": role_id, "stage": "applied"})
    via_agency = post(
        client,
        "/api/v1/applications",
        {"role_id": role_id, "route": "agency", "agency_id": seeded["agency"]["id"], "tags": ["x"]},
    )
    with app.state.sessions.begin() as s:
        s.get(Application, direct["id"]).last_activity_at = datetime.now(UTC) - timedelta(days=9)

    def ids(query):
        return {r["id"] for r in client.get(f"/api/v1/applications{query}").json()}

    assert ids("") == {direct["id"], via_agency["id"]}
    assert ids("?route=direct") == {direct["id"]}
    assert ids(f"?agency_id={seeded['agency']['id']}") == {via_agency["id"]}
    assert ids("?stage=applied&stage=screen") == {direct["id"]}
    assert ids("?tag=x") == {via_agency["id"]}
    assert ids("?stale=true") == {direct["id"]}  # Applied goes stale after 7 days
    assert ids("?min_inactive_days=8") == {direct["id"]}
    assert ids("?q=northwind") == {via_agency["id"]}
    assert ids("?q=contoso") == {direct["id"], via_agency["id"]}
    rows = client.get("/api/v1/applications?sort=stage").json()
    assert [r["stage"] for r in rows] == ["interested", "applied"]

    # Snoozing hides staleness until the date passes.
    tomorrow = (datetime.now(UTC) + timedelta(days=1)).date().isoformat()
    client.patch(f"/api/v1/applications/{direct['id']}", json={"snoozed_until": tomorrow})
    assert ids("?stale=true") == set()


def test_validation_and_errors(client, seeded):
    assert client.post("/api/v1/roles", json={"company_id": "nope", "title": "x"}).status_code == 422
    assert client.post("/api/v1/applications", json={"role_id": "nope"}).status_code == 422
    assert (
        client.post("/api/v1/applications", json={"role_id": seeded["role"]["id"], "stage": "bogus"}).status_code == 422
    )
    assert (
        client.post(
            "/api/v1/roles", json={"company_id": seeded["company"]["id"], "title": "x", "ir35": "maybe"}
        ).status_code
        == 422
    )
    assert client.get("/api/v1/applications/nope").status_code == 404
    assert client.get("/api/v1/companies/nope").status_code == 404
    # A company with roles can't be deleted.
    assert client.delete(f"/api/v1/companies/{seeded['company']['id']}").status_code == 409
    assert client.post(f"/api/v1/applications/{'nope'}/undo").status_code == 404


def test_crud_and_search(client, seeded):
    post(client, "/api/v1/companies", {"name": "Fabrikam"})
    names = [c["name"] for c in client.get("/api/v1/companies").json()]
    assert names == ["Contoso", "Fabrikam"]
    assert [c["name"] for c in client.get("/api/v1/companies?q=fab").json()] == ["Fabrikam"]
    cid = seeded["company"]["id"]
    assert (
        client.patch(f"/api/v1/companies/{cid}", json={"description": "Payments"}).json()["description"] == "Payments"
    )
    agency_id = seeded["agency"]["id"]
    assert client.delete(f"/api/v1/agencies/{agency_id}").status_code == 204
    # Deleting an agency unlinks its recruiters rather than deleting them.
    assert client.get(f"/api/v1/contacts/{seeded['recruiter']['id']}").json()["agency_id"] is None


def test_workflow_endpoint(client):
    wf = client.get("/api/v1/workflow").json()
    assert wf["initial"] == "interested"
    assert any(s["id"] == "ghosted" and s["kind"] == "closed" for s in wf["stages"])


def test_openapi_lists_endpoints(client):
    paths = client.get("/api/openapi.json").json()["paths"]
    for p in ("/api/v1/applications", "/api/v1/applications/{app_id}/move", "/api/v1/contacts", "/api/v1/workflow"):
        assert p in paths


# --- review fixes (PR #12) ------------------------------------------------------------------------


def test_integrity_error_reaches_client_as_409_and_nothing_is_saved(client, seeded):
    app_id = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})["id"]
    link = {"contact_id": seeded["recruiter"]["id"], "relation": "recruiter"}
    post(client, f"/api/v1/applications/{app_id}/contacts", link)
    r = client.post(f"/api/v1/applications/{app_id}/contacts", json=link)
    assert r.status_code == 409
    assert len(client.get(f"/api/v1/applications/{app_id}").json()["contacts"]) == 1


def test_null_on_required_fields_is_422(client, seeded):
    assert client.patch(f"/api/v1/companies/{seeded['company']['id']}", json={"name": None}).status_code == 422
    assert client.patch(f"/api/v1/roles/{seeded['role']['id']}", json={"company_id": None}).status_code == 422
    app_id = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})["id"]
    for field in ("role_id", "route", "tags", "archived"):
        assert client.patch(f"/api/v1/applications/{app_id}", json={field: None}).status_code == 422, field
    # Nullable fields can still be cleared.
    assert client.patch(f"/api/v1/companies/{seeded['company']['id']}", json={"website": None}).status_code == 200


def test_unknown_fields_are_rejected(client, seeded):
    app_id = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})["id"]
    r = client.patch(f"/api/v1/applications/{app_id}", json={"stage": "offer"})
    assert r.status_code == 422
    assert client.get(f"/api/v1/applications/{app_id}").json()["stage"] == "interested"


def test_route_rules(client, seeded):
    role_id, agency_id, recruiter_id = seeded["role"]["id"], seeded["agency"]["id"], seeded["recruiter"]["id"]
    other = post(client, "/api/v1/agencies", {"name": "Other Agency"})
    apps_url = "/api/v1/applications"
    assert client.post(apps_url, json={"role_id": role_id, "route": "agency"}).status_code == 422
    assert (
        client.post(apps_url, json={"role_id": role_id, "route": "direct", "agency_id": agency_id}).status_code == 422
    )
    mismatch = {"role_id": role_id, "route": "agency", "agency_id": other["id"], "recruiter_id": recruiter_id}
    assert client.post(apps_url, json=mismatch).status_code == 422
    # A recruiter on a direct application isn't allowed, so it isn't inferred into an agency either.
    assert client.post(apps_url, json={"role_id": role_id, "recruiter_id": recruiter_id}).status_code == 422

    app_id = post(client, apps_url, {"role_id": role_id, "route": "agency", "recruiter_id": recruiter_id})["id"]
    assert client.patch(f"{apps_url}/{app_id}", json={"route": "direct"}).status_code == 422
    ok = client.patch(f"{apps_url}/{app_id}", json={"route": "direct", "agency_id": None, "recruiter_id": None})
    assert ok.status_code == 200 and ok.json()["agency_id"] is None


def test_naive_datetimes_rejected(client, seeded):
    app_id = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})["id"]
    r = client.post(
        f"/api/v1/applications/{app_id}/move", json={"to_stage": "applied", "occurred_at": "2026-09-01T10:00:00"}
    )
    assert r.status_code == 422
    r = client.post(
        f"/api/v1/applications/{app_id}/move", json={"to_stage": "applied", "occurred_at": "2026-09-01T10:00:00+01:00"}
    )
    assert r.status_code == 200
    assert client.get("/api/v1/applications").status_code == 200


def test_deletes_cascade_safely(client, seeded):
    recruiter_id = seeded["recruiter"]["id"]
    app_id = post(
        client,
        "/api/v1/applications",
        {"role_id": seeded["role"]["id"], "route": "agency", "recruiter_id": recruiter_id},
    )["id"]
    post(client, f"/api/v1/applications/{app_id}/contacts", {"contact_id": recruiter_id, "relation": "recruiter"})
    assert client.delete(f"/api/v1/contacts/{recruiter_id}").status_code == 204
    detail = client.get(f"/api/v1/applications/{app_id}").json()
    assert detail["recruiter_id"] is None and detail["contacts"] == []
    assert client.delete(f"/api/v1/applications/{app_id}").status_code == 204
    assert client.get(f"/api/v1/applications/{app_id}/events").status_code == 404
    # The role and company are untouched.
    assert client.get(f"/api/v1/roles/{seeded['role']['id']}").status_code == 200


def test_search_wildcards_are_literal(client, seeded):
    post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})
    assert client.get("/api/v1/applications?q=%25").json() == []
    assert client.get("/api/v1/applications?q=_").json() == []
    assert client.get("/api/v1/companies?q=%25").json() == []


def test_salary_range(client, seeded):
    body = {"company_id": seeded["company"]["id"], "title": "x", "salary_min": 90000, "salary_max": 80000}
    assert client.post("/api/v1/roles", json=body).status_code == 422
