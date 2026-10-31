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
# Worded by the frontend from i18n-timeline-records on: not here yet.
LATER = {"stage-event", "other-event", "interview", "offer-reply", "meeting", "contact-closed", "note"}
TODAY = str(date.today())


def _drop_company(data_dir, company_id):
    """A role's company can't normally go (RESTRICT), but the title has a state for it, so force it."""
    engine = make_engine(db_path(data_dir), foreign_keys=False)
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM companies WHERE id = :id"), {"id": company_id})
    engine.dispose()


def _entry(data_dir, client, case):
    kind = case["kind"]
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
    assert {c["kind"] for c in CASES} == set(get_args(Kind)) - LATER


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["title"])
def test_the_api_sends_each_case(tmp_path, client, case):
    target = _entry(tmp_path / "data", client, case)
    items = client.get("/api/v1/timeline").json()["items"]
    item = next(i for i in items if i["id"] == f"{case['kind']}:{target}")
    assert item["kind"] == case["kind"]
    assert item["title"] == case["title"]
    if "person" in case and case["kind"] != "role-added":
        names = [p["name"] for p in item["people"]]
        assert names == ([case["person"]] if case["person"] else [])
    if "role" in case:
        assert item["role_title"] == case["role"]
    if "company" in case:
        assert item["company_name"] == case["company"]
    if "agency" in case:
        assert item["agency_name"] == case["agency"]


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
