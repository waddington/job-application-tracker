"""Timeline entries say what kind they are, and the frontend can rebuild their English title (docs/rfc/i18n.md)."""

import json
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import get_args

import pytest
from sqlalchemy import text

from jat.api.timeline import Kind
from jat.db import db_path
from jat.db.engine import make_engine

from .factories import post

# The same cases are rendered by the frontend in timelineTitle.test.ts: together they prove that the English
# it builds is the API's `title`, from the fields the API really sends.
CASES = json.loads(
    (Path(__file__).parent.parent / "frontend/src/components/timelineTitles.cases.json").read_text(encoding="utf-8")
)
# The only titles still from the API: a summary's first line, or the event's kind (i18n-events-activity).
FROM_THE_API = {"other-event"}
RAW_FIELDS = ("stage_move", "round", "offer", "call", "note_title", "closed_as")
TODAY = str(date.today())
SOON = (datetime.now(UTC) + timedelta(days=3)).replace(microsecond=0).isoformat()


def _sql(data_dir, statement, **values):
    """Reach a state the API won't make, but a title has words for."""
    engine = make_engine(db_path(data_dir), foreign_keys=False)
    with engine.begin() as conn:
        conn.execute(text(statement), values)
    engine.dispose()


def _drop_company(data_dir, company_id):
    """A role's company can't normally go (RESTRICT), but the title has a state for it, so force it."""
    _sql(data_dir, "DELETE FROM companies WHERE id = :id", id=company_id)


def _application(client, stage="applied"):
    company = post(client, "/api/v1/companies", {"name": "Fabrikam"})["id"]
    role = post(client, "/api/v1/roles", {"company_id": company, "title": "Tester"})["id"]
    return post(client, "/api/v1/applications", {"role_id": role, "stage": stage})["id"]


def _stage_event(data_dir, client, seed):
    app = _application(client, seed["start"])
    if "move" in seed:
        assert client.post(f"/api/v1/applications/{app}/move", json={"to_stage": seed["move"]}).status_code == 200
    for column in ("from_stage", "to_stage"):  # a stage that's gone shows its id, here with markup in it
        if column in seed:
            _sql(
                data_dir,
                f"UPDATE events SET {column} = :v WHERE application_id = :app AND kind = 'stage_change' "
                "AND seq = (SELECT MAX(seq) FROM events WHERE application_id = :app)",
                v=seed[column],
                app=app,
            )
    return app


def _round(data_dir, client, wanted):
    app = _application(client)
    when = "deadline_at" if wanted["status"] == "due" else "starts_at"
    target = post(client, f"/api/v1/applications/{app}/interviews", {"title": "Placeholder", when: SOON})["id"]
    _sql(
        data_dir,
        "UPDATE interviews SET round = :round, title = :title, kind = :kind, status = :status WHERE id = :id",
        round=wanted["round"],
        title=wanted["title"],
        kind=wanted["kind"],
        status="done" if wanted["status"] == "done" else "scheduled",
        id=target,
    )
    return target


def _call(data_dir, client, wanted):
    who = post(client, "/api/v1/contacts", {"name": wanted["contact_name"]})["id"]
    target = post(client, "/api/v1/meetings", {"contact_id": who, "starts_at": SOON})["id"]
    _sql(
        data_dir,
        "UPDATE meetings SET kind = :kind, title = :title, status = :status WHERE id = :id",
        kind=wanted["kind"],
        title=wanted["title"],
        status="done" if wanted["status"] == "done" else "scheduled",
        id=target,
    )
    return target


def _entry(data_dir, client, case):
    kind = case["kind"]
    if kind == "stage-event":
        return _stage_event(data_dir, client, case["seed"])
    if kind == "interview":
        return _round(data_dir, client, case["round"])
    if kind == "meeting":
        return _call(data_dir, client, case["call"])
    if kind == "offer-reply":
        body = case["seed"] | {"respond_by": str(date.today() + timedelta(days=5))}
        return post(client, f"/api/v1/applications/{_application(client)}/offers", body)["id"]
    if kind == "note":
        note = post(client, "/api/v1/notes", {"title": case["note_title"] or "Placeholder"})["id"]
        if not case["note_title"]:  # the API refuses an empty title, and a note's file falls back on its name
            _sql(data_dir, "UPDATE note_index SET title = '' WHERE id = :id", id=note)
        return note
    if kind == "contact-closed":
        cid = post(client, "/api/v1/contacts", {"name": case["person"]})["id"]
        assert client.patch(f"/api/v1/contacts/{cid}", json={"closed_as": case["closed_as"]}).status_code == 200
        return cid
    if kind == "company":
        return post(client, "/api/v1/companies", {"name": case["company"]})["id"]
    if kind == "agency":
        return post(client, "/api/v1/agencies", {"name": case["agency"]})["id"]
    if kind.startswith("contact"):
        cid = post(client, "/api/v1/contacts", {"name": case["person"]})["id"]
        field = {
            "contact-waiting": "awaiting_reply_since",
            "contact-chased": "chased_on",
            "contact-to-read": "reply_to_read_since",
        }.get(kind)
        if field:
            client.patch(f"/api/v1/contacts/{cid}", json={field: TODAY})
        return cid
    company = post(client, "/api/v1/companies", {"name": case["company"] or "Gone Ltd"})["id"]
    body = {"company_id": company, "title": case["role"]}
    if case["person"]:
        body["contact_id"] = post(client, "/api/v1/contacts", {"name": case["person"]})["id"]
    if kind == "role-passed":
        body |= {"decision": "passed", "decision_reason": "Too far"}
    role = post(client, "/api/v1/roles", body)["id"]
    if case["company"] is None:
        _drop_company(data_dir, company)
    return role


def test_every_title_built_by_the_frontend_has_a_case():
    assert {c["kind"] for c in CASES} == set(get_args(Kind)) - FROM_THE_API


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["title"])
def test_the_api_sends_each_case(tmp_path, client, case):
    target = _entry(tmp_path / "data", client, case)
    items = client.get("/api/v1/timeline").json()["items"]
    if case["kind"] == "stage-event":  # the newest stage move on that application
        item = next(i for i in items if i["application_id"] == target and i["kind"] == "stage-event")
    else:
        item = next(i for i in items if i["id"] == f"{case['kind']}:{target}")
    assert item["kind"] == case["kind"]
    assert item["title"] == case["title"]
    for field in RAW_FIELDS:
        assert item[field] == case.get(field)
    if "person" in case and case["kind"] != "role-added":
        names = [p["name"] for p in item["people"]]
        assert names == ([case["person"]] if case["person"] else [])
    if "role" in case:
        assert item["role_title"] == case["role"]
    if "company" in case:
        assert item["company_name"] == case["company"]
    if "agency" in case:
        assert item["agency_name"] == case["agency"]


def test_a_call_names_who_its_with_even_when_they_arent_first_on_the_application(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})["id"]
    first = post(client, "/api/v1/contacts", {"name": "Riley First"})["id"]
    second = post(client, "/api/v1/contacts", {"name": "Sam Second"})["id"]
    for contact in (first, second):
        post(client, f"/api/v1/applications/{app}/contacts", {"contact_id": contact, "relation": "recruiter"})
    call = post(client, "/api/v1/meetings", {"contact_id": second, "application_id": app, "starts_at": SOON})["id"]
    item = next(i for i in client.get("/api/v1/timeline").json()["items"] if i["id"] == f"meeting:{call}")
    assert item["people"][0]["name"] != "Sam Second"
    assert item["call"]["contact_name"] == "Sam Second"
    assert item["title"] == "Call with Sam Second (booked)"


def test_a_stage_event_without_a_stage_has_no_move_to_word(tmp_path, client):
    app = _stage_event(tmp_path / "data", client, {"start": "applied", "move": "screen"})
    _sql(
        tmp_path / "data",
        "UPDATE events SET to_stage = NULL, summary = 'Moved by hand' "
        "WHERE application_id = :app AND from_stage = 'applied'",
        app=app,
    )
    items = client.get("/api/v1/timeline", params={"application_id": app}).json()["items"]
    item = next(i for i in items if i["title"] == "Moved by hand")
    assert item["kind"] == "stage-event"
    assert item["stage_move"] is None


def test_a_status_the_app_has_no_words_for_still_comes_through(tmp_path, client):
    """The frontend shows `title` for it; the raw field mustn't fail the whole Timeline."""
    app = _application(client)
    target = post(client, f"/api/v1/applications/{app}/interviews", {"title": "Chat", "starts_at": SOON})["id"]
    _sql(tmp_path / "data", "UPDATE interviews SET status = 'on_hold' WHERE id = :id", id=target)
    item = next(i for i in client.get("/api/v1/timeline").json()["items"] if i["id"] == f"interview:{target}")
    assert item["round"]["status"] == "on_hold"
    assert item["title"] == "Round 1 · Chat (on_hold)"


def test_every_entry_says_what_kind_it_is(client, seeded):
    soon = (datetime.now(UTC) + timedelta(days=3)).replace(microsecond=0).isoformat()
    alex = seeded["recruiter"]["id"]
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})["id"]
    client.post(f"/api/v1/applications/{app}/move", json={"to_stage": "screen"})
    post(client, f"/api/v1/applications/{app}/activities", {"kind": "call", "summary": "Call with Sam"})
    post(client, f"/api/v1/applications/{app}/interviews", {"title": "System design", "starts_at": soon})
    respond_by = str(date.today() + timedelta(days=5))
    post(client, f"/api/v1/applications/{app}/offers", {"salary": 85000, "respond_by": respond_by})
    post(client, "/api/v1/meetings", {"contact_id": alex, "starts_at": soon})
    post(client, "/api/v1/notes", {"title": "About Alex", "links": [f"contact:{alex}"]})
    post(
        client,
        "/api/v1/roles",
        {
            "company_id": seeded["company"]["id"],
            "title": "Data Engineer",
            "contact_id": alex,
            "decision": "passed",
        },
    )
    for field, value in [
        ("awaiting_reply_since", TODAY),
        ("chased_on", TODAY),
        ("reply_to_read_since", TODAY),
        ("closed_as", "ghosted"),
    ]:
        person = post(client, "/api/v1/contacts", {"name": f"Person {field}"})["id"]
        assert client.patch(f"/api/v1/contacts/{person}", json={field: value}).status_code == 200

    items = client.get("/api/v1/timeline").json()["items"]
    assert {i["kind"] for i in items} == set(get_args(Kind))
    for item in items:
        source = item["id"].partition(":")[0]
        if source == "event":
            assert item["kind"] == ("stage-event" if item["category"] == "stage" else "other-event")
        else:
            assert item["kind"] == source
