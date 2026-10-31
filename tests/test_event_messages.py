"""New events save their text as data (`data.msg`) beside the English `summary` (docs/rfc/i18n.md)."""

import json
import re
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import get_args

import pytest

from jat.api import schemas as S
from jat.db.models import Event, Interview, Offer
from jat.domain import applications as svc
from jat.domain import offers
from jat.snapshot import export_data_dir, restore_data_dir

from .factories import post

# The same cases are rendered by the frontend in EventsText.test.tsx: together they prove that the English
# the frontend builds is the English the API saves.
CASES = json.loads(
    (Path(__file__).parent.parent / "frontend/src/components/eventMessages.cases.json").read_text(encoding="utf-8")
)
KEYS = {get_args(m.model_fields["key"].annotation)[0] for m in get_args(get_args(S.EventMsg)[0])}
PDF = b"%PDF-1.4\n% made-up file\n"


def _case(key):
    return [c for c in CASES if c["key"] == key]


def _app(client, seeded):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})["id"]


def _last(client, app_id):
    return client.get(f"/api/v1/applications/{app_id}").json()["events"][-1]


def _assert_written(event, case):
    assert event["summary"] == case["summary"]
    assert event["data"]["msg"] == {"key": case["key"], "params": case["params"]}
    assert event["msg"] == {"key": case["key"], "params": case["params"]}


def _eml(subject, sender):
    headers = [f"Subject: {subject}"] if subject else []
    headers += [f"From: {sender}"] if sender else []
    return ("\r\n".join([*headers, "To: someone@example.com", "", "Hello"]) + "\r\n").encode()


def _event(data):
    now = datetime.now(UTC)
    return SimpleNamespace(
        id="e",
        application_id="a",
        kind="manual",
        occurred_at=now,
        from_stage=None,
        to_stage=None,
        summary="Saved English",
        data=data,
        created_at=now,
    )


def test_every_message_has_a_case():
    assert {c["key"] for c in CASES} == KEYS


def test_the_writer_accepts_exactly_the_keys_the_api_reads():
    assert set(get_args(svc.EventMsgKey)) == KEYS


def test_a_mistyped_key_is_refused_before_anything_is_saved():
    session = SimpleNamespace(add=lambda _: pytest.fail("saved"), flush=lambda: None)
    with pytest.raises(ValueError, match="event.linkAded"):
        svc.log_message(session, SimpleNamespace(id="a"), "manual", key="event.linkAded", params={}, summary="x")


def test_the_api_says_a_logged_msg_is_ignored():
    assert "msg" in S.ActivityIn.model_fields["data"].description


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["summary"])
def test_each_case_is_a_valid_message(case):
    out = S.EventOut.model_validate(_event({"msg": {"key": case["key"], "params": case["params"]}}))
    assert out.msg.model_dump() == {"key": case["key"], "params": case["params"]}


@pytest.mark.parametrize("case", _case("event.linkAdded"), ids=lambda c: c["summary"])
def test_a_link_writes_its_message(client, seeded, case):
    app_id = _app(client, seeded)
    body = {"entity_type": "application", "entity_id": app_id, "url": "https://example.com/a", **case["params"]}
    post(client, "/api/v1/links", body)
    event = _last(client, app_id)
    _assert_written(event, case)
    assert event["data"]["url"] == "https://example.com/a"


def test_a_note_writes_its_message_when_made_and_when_attached(client, seeded):
    [case] = _case("event.noteAdded")
    made_on, attached_to = _app(client, seeded), _app(client, seeded)
    note = post(client, "/api/v1/notes", {**case["params"], "body": "x", "links": [f"application:{made_on}"]})
    _assert_written(_last(client, made_on), case)
    r = client.patch(
        f"/api/v1/notes/{note['id']}", json={"links": [f"application:{made_on}", f"application:{attached_to}"]}
    )
    assert r.status_code == 200, r.text
    _assert_written(_last(client, attached_to), case)


def _upload(client, app_id, name, content):
    r = client.post(
        "/api/v1/attachments",
        files={"file": (name, content, "application/octet-stream")},
        data={"entity_type": "application", "entity_id": app_id},
    )
    assert r.status_code == 201, r.text
    return r.json()


def test_a_file_writes_its_message(client, seeded):
    [case] = _case("event.fileAdded")
    app_id = _app(client, seeded)
    att = _upload(client, app_id, case["params"]["name"], PDF)
    event = _last(client, app_id)
    _assert_written(event, case)
    assert event["data"]["attachment_id"] == att["id"]


@pytest.mark.parametrize("case", [c for c in CASES if c["key"].startswith("event.email")], ids=lambda c: c["summary"])
def test_an_email_writes_the_message_for_what_it_has(client, seeded, case):
    app_id = _app(client, seeded)
    _upload(client, app_id, "mail.eml", _eml(case["params"].get("subject"), case["params"].get("sender")))
    event = _last(client, app_id)
    _assert_written(event, case)
    assert "from" in event["data"] and "attachment_id" in event["data"]


@pytest.mark.parametrize(
    ("kind", "case"),
    [
        *[("cv", c) for c in _case("event.cvSent")],
        *[("cover_letter", c) for c in _case("event.coverLetterSent")],
        *[("other", c) for c in _case("event.documentSent")],
    ],
    ids=lambda v: v["summary"] if isinstance(v, dict) else v,
)
def test_sending_a_document_writes_its_message(client, seeded, kind, case):
    app_id = _app(client, seeded)
    doc = post(client, "/api/v1/documents", {"kind": kind, "name": case["params"]["name"]})
    version = client.post(f"/api/v1/documents/{doc['id']}/versions", data={"label": case["params"]["label"]}).json()
    post(client, f"/api/v1/applications/{app_id}/documents", {"document_version_id": version["id"]})
    event = _last(client, app_id)
    _assert_written(event, case)
    assert event["data"]["document_version_id"] == version["id"]


def test_adopting_a_cv_file_writes_its_message(client, seeded):
    case = _case("event.cvSent")[0]
    app_id = _app(client, seeded)
    _upload(client, app_id, "Backend_CV.pdf", PDF)
    [found] = client.get("/api/v1/cv-files").json()
    r = client.post(
        "/api/v1/cv-files/adopt",
        json={"sha256": found["sha256"], "document_name": case["params"]["name"], "label": case["params"]["label"]},
    )
    assert r.status_code == 201, r.text
    _assert_written(_last(client, app_id), case)


def test_what_you_log_has_no_message_even_if_it_claims_one(client, seeded):
    app_id = _app(client, seeded)
    claimed = {"key": "event.linkAdded", "params": {"title": "Not what I typed"}}
    r = client.post(
        f"/api/v1/applications/{app_id}/activities",
        json={"kind": "call", "summary": "Spoke to Alex", "data": {"topic": "pay", "msg": claimed}},
    )
    assert r.status_code == 201, r.text
    assert r.json()["msg"] is None and r.json()["data"] == {"topic": "pay"} and r.json()["summary"] == "Spoke to Alex"


def test_a_message_merges_with_what_data_already_holds():
    session = SimpleNamespace(add=lambda _: None, flush=lambda: None)
    app = SimpleNamespace(id="a", last_activity_at=None)
    held = {"implied": True, "bookkeeping": True, "url": "https://example.com/a"}
    event = svc.log_message(
        session, app, "manual", key="event.linkAdded", params={"title": "T"}, summary="Link added: T", data=held
    )
    assert event.data == {**held, "msg": {"key": "event.linkAdded", "params": {"title": "T"}}}
    assert event.summary == "Link added: T"
    assert "msg" not in held


@pytest.mark.parametrize(
    "data",
    [
        {},
        {"implied": True},
        {"msg": None},
        {"msg": "Link added"},
        {"msg": []},
        {"msg": {}},
        {"msg": {"params": {"title": "T"}}},
        {"msg": {"key": "event.fromTheFuture", "params": {"title": "T"}}},
        {"msg": {"key": ["event.linkAdded"], "params": {"title": "T"}}},
        {"msg": {"key": {"a": 1}, "params": {"title": "T"}}},
        {"msg": {"key": "event.linkAdded"}},
        {"msg": {"key": "event.linkAdded", "params": None}},
        {"msg": {"key": "event.linkAdded", "params": {}}},
        {"msg": {"key": "event.linkAdded", "params": {"title": 5}}},
    ],
    ids=repr,
)
def test_old_or_bad_data_gives_no_message_and_keeps_the_rest(data):
    out = S.EventOut.model_validate(_event(data))
    assert out.msg is None and out.summary == "Saved English" and out.data == data


def test_a_bad_message_on_disk_is_null_through_the_api(client, seeded, app):
    app_id = _app(client, seeded)
    with app.state.sessions.begin() as session:
        session.add(
            Event(
                application_id=app_id, kind="manual", summary="Old", data={"msg": {"key": "event.nope", "params": {}}}
            )
        )
    r = client.get(f"/api/v1/applications/{app_id}")
    assert r.status_code == 200
    assert next(e for e in r.json()["events"] if e["summary"] == "Old")["msg"] is None
    listed = client.get(f"/api/v1/applications/{app_id}/events")
    assert listed.status_code == 200
    assert next(e for e in listed.json() if e["summary"] == "Old")["msg"] is None


def test_export_and_restore_keep_the_message(client, seeded, app, tmp_path):
    [case] = _case("event.linkAdded")[1:]  # the awkward characters
    app_id = _app(client, seeded)
    post(
        client,
        "/api/v1/links",
        {"entity_type": "application", "entity_id": app_id, "url": "https://example.com/a", **case["params"]},
    )
    data_dir = app.state.jat.data_dir
    export_data_dir(data_dir)
    lines = (data_dir / "export" / "events.jsonl").read_text(encoding="utf-8").splitlines()
    before = [json.loads(line) for line in lines]
    [saved] = [row for row in before if (row["data"] or {}).get("msg")]
    assert saved["data"]["msg"] == {"key": case["key"], "params": case["params"]}
    assert saved["summary"] == case["summary"]

    fresh = tmp_path / "restored"
    (fresh / "export").mkdir(parents=True)
    for path in (data_dir / "export").iterdir():
        (fresh / "export" / path.name).write_bytes(path.read_bytes())
    restore_data_dir(fresh)
    export_data_dir(fresh)
    after = (fresh / "export" / "events.jsonl").read_text(encoding="utf-8").splitlines()
    assert after == lines


ROUND_CASES = [c for c in CASES if c["key"].startswith("event.round")]
OFFER_CASES = [c for c in CASES if c["key"].startswith("event.offer")]
THEN = "2030-01-07T10:00:00Z"
LATER = "2030-01-08T10:00:00Z"
# How a round reaches each message: its status when made, then what changes it (None: nothing, or removal).
ROUND_STEPS = {
    "event.roundScheduled": ("scheduled", None),
    "event.roundAdded": ("done", None),
    "event.roundCancelled": ("cancelled", None),
    "event.roundBackOn": ("cancelled", {"status": "scheduled"}),
    "event.roundDone": ("scheduled", {"status": "done"}),
    "event.roundRemoved": ("scheduled", None),
    "event.roundRescheduled": ("scheduled", {"starts_at": LATER}),
    "event.roundRescheduledReason": ("scheduled", {"starts_at": LATER}),
}
# The same for an offer: its status when made, then the status it changes to.
OFFER_STEPS = {
    "Received": ("pending", None),
    "Back": ("accepted", "pending"),
    "Accepted": ("pending", "accepted"),
    "Declined": ("pending", "declined"),
    "Withdrawn": ("pending", "withdrawn"),
    "Removed": ("pending", None),
}


def _stored(app, model, row_id, **values):
    """Values the API refuses but old or hand-edited data can hold."""
    with app.state.sessions.begin() as session:
        for name, value in values.items():
            setattr(session.get(model, row_id), name, value)


@pytest.mark.parametrize("case", ROUND_CASES, ids=lambda c: c["summary"])
def test_a_round_writes_its_message(client, seeded, app, case):
    app_id = _app(client, seeded)
    params = case["params"]
    status, change = ROUND_STEPS[case["key"]]
    body = {"title": params["title"], "kind": params["kind"], "status": status, "starts_at": THEN}
    made = post(client, f"/api/v1/applications/{app_id}/interviews", {**body, "round": params["round"] or 1})
    if params["round"] is None:
        _stored(app, Interview, made["id"], round=None)
    url = f"/api/v1/interviews/{made['id']}"
    if case["key"] == "event.roundRemoved":
        assert client.delete(url).status_code == 204
    elif change:
        # Spaces around and inside the reason collapse, in the summary and the message alike.
        reason = {"reschedule_reason": f"  {params['reason'].replace(' ', '  ')}\n"} if "reason" in params else {}
        r = client.patch(url, json={**change, **reason})
        assert r.status_code == 200, r.text
    _assert_written(_last(client, app_id), case)


def test_a_round_keeps_its_timeline_data_beside_the_message(client, seeded):
    app_id = _app(client, seeded)
    made = post(client, f"/api/v1/applications/{app_id}/interviews", {"title": "Pairing session", "kind": "pairing"})
    data = _last(client, app_id)["data"]
    assert (data["interview_id"], data["round"], data["status"]) == (made["id"], 1, "scheduled")


def test_a_cancelled_round_says_so_when_changed_too(client, seeded):
    app_id = _app(client, seeded)
    made = post(client, f"/api/v1/applications/{app_id}/interviews", {"kind": "technical"})
    assert client.patch(f"/api/v1/interviews/{made['id']}", json={"status": "cancelled"}).status_code == 200
    event = _last(client, app_id)
    assert event["summary"] == "Round 1 · Technical cancelled"
    assert event["msg"]["key"] == "event.roundCancelled"


@pytest.mark.parametrize("case", OFFER_CASES, ids=lambda c: c["summary"])
def test_an_offer_writes_its_message(client, seeded, app, case):
    app_id = _app(client, seeded)
    what, per = re.fullmatch(r"event\.offer(.+?)(Year|Day|NoFigures)", case["key"]).groups()
    params = case["params"]
    made_as, changes_to = OFFER_STEPS[what]
    body = {"status": made_as, "currency": (params.get("currency") or "").upper() or None}
    if per == "Year":
        body["salary"] = params["amount"]
    elif per == "Day":
        body |= {"employment_type": "contract", "day_rate": params["amount"]}
    made = post(client, f"/api/v1/applications/{app_id}/offers", body)
    url = f"/api/v1/offers/{made['id']}"
    if what == "Removed":
        if params.get("currency"):  # a lower-case currency from before they were made upper-case
            _stored(app, Offer, made["id"], currency=params["currency"])
        assert client.delete(url).status_code == 204
    elif changes_to:
        assert client.patch(url, json={"status": changes_to}).status_code == 200
    _assert_written(_last(client, app_id), case)
    assert _last(client, app_id)["data"]["status"] == (changes_to or made_as)


@pytest.mark.parametrize(
    ("body", "key", "params", "summary"),
    [
        (
            {"status": "accepted", "salary": 90_000},
            "event.offerAcceptedYear",
            {"amount": 90_000, "currency": None},
            "90,000",
        ),
        (
            {"day_rate": 700, "currency": "GBP"},
            "event.offerReceivedDay",
            {"amount": 700, "currency": "GBP"},
            "£700 a day",
        ),
        ({"salary": 1, "day_rate": 700}, "event.offerReceivedYear", {"amount": 1, "currency": None}, "1 a year"),
        ({"employment_type": "contract", "salary": 90_000}, "event.offerReceivedNoFigures", {}, "no figures yet"),
        ({"employment_type": "permanent", "day_rate": 700}, "event.offerReceivedNoFigures", {}, "no figures yet"),
        ({"salary": 0, "currency": "GBP"}, "event.offerReceivedNoFigures", {}, "no figures yet"),
    ],
    ids=[
        "made accepted",
        "day rate, no kind",
        "salary wins, no kind",
        "contract, no rate",
        "permanent, no pay",
        "zero",
    ],
)
def test_an_offer_saves_the_figure_its_summary_shows(client, seeded, body, key, params, summary):
    app_id = _app(client, seeded)
    post(client, f"/api/v1/applications/{app_id}/offers", body)
    event = _last(client, app_id)
    assert summary in event["summary"]
    assert event["msg"] == {"key": key, "params": params}


def test_every_offer_status_has_its_messages():
    whats = {"received", "back under consideration", "removed"} | set(get_args(S.OfferStatus)) - {"pending"}
    assert {what for what, _ in offers._MESSAGES} == whats
    assert set(offers._MESSAGES.values()) == {k for k in KEYS if k.startswith("event.offer")}


@pytest.mark.parametrize("amount", [2**53, 2**53 + 1], ids=str)
def test_an_amount_a_browser_cant_read_exactly_stays_english(client, seeded, amount):
    app_id = _app(client, seeded)
    post(client, f"/api/v1/applications/{app_id}/offers", {"salary": amount, "currency": "GBP"})
    event = _last(client, app_id)
    assert event["summary"] == f"Offer received: £{amount:,} a year"
    assert event["msg"] is None and "msg" not in event["data"]
