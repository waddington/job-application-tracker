"""Every text filter in the API ignores accents and case, as the header search does (jat.textfold)."""

import pytest

from jat.textfold import fold

from .factories import post


def test_fold():
    assert fold("José Müller-Øster") == "jose muller-øster"  # ø isn't a letter plus an accent: it stays
    assert fold("ÉCOLE") == "ecole"
    assert fold("Straße") == "strasse"


@pytest.mark.parametrize(("typed", "found"), [("jose", True), ("JOSÉ", True), ("josé", True), ("jos%", False)])
def test_people_are_found_with_or_without_accents(client, typed, found):
    post(client, "/api/v1/contacts", {"name": "José Álvarez"})
    post(client, "/api/v1/contacts", {"name": "Joséphine 100%"})
    names = [c["name"] for c in client.get("/api/v1/contacts", params={"q": typed}).json()]
    assert ("José Álvarez" in names) is found
    assert ("Joséphine 100%" in names) is (typed != "jos%")  # LIKE's % in what you type is a plain %


def test_the_other_way_round(client):
    post(client, "/api/v1/contacts", {"name": "Jose Alvarez"})
    assert [c["name"] for c in client.get("/api/v1/contacts", params={"q": "José Álv"}).json()] == ["Jose Alvarez"]


def test_spaces_around_what_you_type_dont_count(client):
    post(client, "/api/v1/contacts", {"name": "María José"})
    assert [c["name"] for c in client.get("/api/v1/contacts", params={"q": " jose "}).json()] == ["María José"]


@pytest.mark.parametrize("path", ["/api/v1/companies", "/api/v1/agencies"])
def test_companies_and_agencies(client, path):
    post(client, path, {"name": "Café Ölrich"})
    assert [c["name"] for c in client.get(path, params={"q": "cafe olr"}).json()] == ["Café Ölrich"]
    assert client.get(path, params={"q": "CAFÉ"}).json()[0]["name"] == "Café Ölrich"


def test_the_applications_list(client):
    body = {"company_name": "Société Générale", "role_title": "Ingénieur", "route": "direct"}
    assert client.post("/api/v1/applications/quick", json=body).status_code < 300
    for typed in ("societe", "SOCIÉTÉ", "ingenieur"):
        found = client.get("/api/v1/applications", params={"q": typed}).json()
        assert [a["company_name"] for a in found] == ["Société Générale"], typed


def test_notes(client):
    post(client, "/api/v1/notes", {"title": "Call with Zoë", "body": "Talked about the Zürich office."})
    for typed in ("zoe", "zurich", "ZÜRICH"):
        assert [n["title"] for n in client.get("/api/v1/notes", params={"q": typed}).json()] == ["Call with Zoë"], typed
