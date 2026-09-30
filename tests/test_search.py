from jat.domain.search import Candidate, fold, match, terms

from .factories import post


def test_matching_rules():
    c = Candidate("company", "c1", "Zürich Insurance", "/companies/c1", fields=["We build payments in Kotlin and Go."])
    assert fold("Zürich") == "zurich"
    assert match(c, terms("zurich")).title_match
    hit = match(c, terms("kotlin payments"))  # every word, in any order, anywhere
    assert hit and not hit.title_match and "payments in Kotlin" in hit.snippet
    assert match(c, terms("kotlin rust")) is None
    assert terms("   ") == []


def _search(client, q, **params):
    r = client.get("/api/v1/search", params={"q": q, **params})
    assert r.status_code == 200, r.text
    return r.json()


def test_search_across_everything(client, seeded):
    role, agency, recruiter = seeded["role"]["id"], seeded["agency"]["id"], seeded["recruiter"]["id"]
    app = post(
        client,
        "/api/v1/applications",
        {"role_id": role, "route": "agency", "agency_id": agency, "recruiter_id": recruiter, "tags": ["fintech"]},
    )
    post(
        client,
        f"/api/v1/applications/{app['id']}/interviews",
        {"round": 2, "title": "System design", "debrief": "They asked about idempotency keys in payments."},
    )
    r = client.post(
        f"/api/v1/applications/{app['id']}/activities", json={"kind": "call", "summary": "Alex says the budget moved"}
    )
    assert r.status_code == 201
    post(client, f"/api/v1/applications/{app['id']}/offers", {"salary": 90_000, "benefits": "Cycle-to-work scheme"})
    post(client, "/api/v1/notes", {"title": "Prep", "body": "Read up on **Kafka** consumer groups", "links": []})
    post(
        client,
        "/api/v1/links",
        {
            "entity_type": "application",
            "entity_id": app["id"],
            "url": "https://docs.example.com/d/brief",
            "title": "Take-home brief",
        },
    )

    def kinds(q):
        return {(h["kind"], h["link"]) for h in _search(client, q)}

    app_link = f"/applications/{app['id']}"
    assert ("application", app_link) in kinds("contoso senior backend")
    assert ("application", app_link) in kinds("fintech")  # tags
    assert ("agency", f"/agencies/{agency}") in kinds("northwind")
    # A recruiter found by their email opens their agency's page.
    assert ("contact", f"/agencies/{agency}") in kinds("alex@northwind.example.com")
    assert ("interview", app_link) in kinds("idempotency")
    assert ("timeline", app_link) in kinds("budget moved")
    assert ("offer", app_link) in kinds("cycle-to-work")
    assert ("link", app_link) in kinds("take-home brief")
    notes = _search(client, "kafka consumer")
    assert [(h["kind"], h["link"]) for h in notes] == [("note", "/notes")]
    assert "Kafka" in notes[0]["snippet"]

    # Title matches come first, and the application's interviews, offer and calls don't match
    # on its name alone (only on what they say).
    hits = _search(client, "contoso")
    assert hits[0]["kind"] in ("company", "application") and hits[0]["title"].startswith("Contoso")
    assert {h["kind"] for h in hits} == {"company", "application"}
    assert [h["kind"] for h in _search(client, "contoso idempotency")] == []  # the name isn't in the debrief

    # Archived applications are still found, after everything else.
    other = post(client, "/api/v1/applications", {"role_id": role})
    assert client.patch(f"/api/v1/applications/{app['id']}", json={"archived": True}).status_code == 200
    hits = [h for h in _search(client, "contoso senior") if h["kind"] == "application"]
    assert [(h["id"], h["archived"]) for h in hits] == [(other["id"], False), (app["id"], True)]
    assert _search(client, "nothing-matches-this") == []
    assert len(_search(client, "contoso", limit=1)) == 1
    assert client.get("/api/v1/search", params={"q": ""}).status_code == 422
