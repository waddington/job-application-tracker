import pytest

from jat.api.links import default_title, link_kind

from .factories import post


@pytest.mark.parametrize(
    ("url", "kind", "title"),
    [
        ("https://docs.google.com/document/d/abc/edit", "google_doc", "Google Doc"),
        ("https://docs.google.com/spreadsheets/d/abc", "google_sheet", "Google Sheet"),
        ("https://drive.google.com/file/d/abc", "google_drive", "Google Drive"),
        ("https://github.com/example/take-home", "github", "GitHub"),
        ("https://www.linkedin.com/in/someone", "linkedin", "LinkedIn"),
        ("https://jobs.example.com/123", "web", "jobs.example.com"),
    ],
)
def test_kinds_and_default_titles(url, kind, title):
    assert link_kind(url) == kind
    assert default_title(url) == title


def test_links_on_an_application(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    ref = {"entity_type": "application", "entity_id": app["id"]}
    ad = post(client, "/api/v1/links", {**ref, "url": "https://jobs.example.com/123", "title": "Job ad"})
    brief = post(client, "/api/v1/links", {**ref, "url": "https://docs.google.com/document/d/abc/edit"})
    assert brief["title"] == "Google Doc" and brief["kind"] == "google_doc"

    listed = client.get("/api/v1/links", params=ref).json()
    assert [link["title"] for link in listed] == ["Job ad", "Google Doc"]
    events = client.get(f"/api/v1/applications/{app['id']}").json()["events"]
    assert events[-1]["summary"] == "Link added: Google Doc"

    r = client.patch(f"/api/v1/links/{brief['id']}", json={"title": "Take-home brief"})
    assert r.json()["title"] == "Take-home brief"
    r = client.patch(f"/api/v1/links/{brief['id']}", json={"title": ""})
    assert r.json()["title"] == "Google Doc"  # cleared: back to the default
    assert client.delete(f"/api/v1/links/{ad['id']}").status_code == 204
    assert len(client.get("/api/v1/links", params=ref).json()) == 1

    # Links go with their application.
    assert client.delete(f"/api/v1/applications/{app['id']}").status_code == 204
    assert client.get("/api/v1/links", params=ref).json() == []


def test_link_validation(client, seeded):
    company = {"entity_type": "company", "entity_id": seeded["company"]["id"]}
    assert client.post("/api/v1/links", json={**company, "url": "javascript:alert(1)"}).status_code == 422
    assert client.post("/api/v1/links", json={**company, "url": "not a url"}).status_code == 422
    missing = {"entity_type": "company", "entity_id": "nope", "url": "https://example.com"}
    assert client.post("/api/v1/links", json=missing).status_code == 422
    planet = {"entity_type": "planet", "entity_id": "x", "url": "https://example.com"}
    assert client.post("/api/v1/links", json=planet).status_code == 422
    made = post(client, "/api/v1/links", {**company, "url": "https://contoso.example.com/careers"})
    assert made["title"] == "contoso.example.com"
    assert client.patch(f"/api/v1/links/{made['id']}", json={"url": None}).status_code == 422
