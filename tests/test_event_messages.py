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
TIMELINE_EVENTS = json.loads(
    (Path(__file__).parent.parent / "frontend/src/components/timelineEvents.cases.json").read_text(encoding="utf-8")
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


def test_following_up_saves_what_it_always_did_and_its_message(client, seeded):
    app_id = _app(client, seeded)
    r = client.post(f"/api/v1/applications/{app_id}/activities", json={"kind": "manual", "app_text": "followed_up"})
    assert r.status_code == 201, r.text
    [case] = _case("event.followedUp")
    _assert_written(r.json(), case)
    assert r.json()["kind"] == "manual"


def test_app_text_keeps_the_key_and_its_words_together(client, seeded):
    """A client can't save a key beside text of its own, or a kind other than the app's."""
    app_id = _app(client, seeded)
    r = client.post(
        f"/api/v1/applications/{app_id}/activities",
        json={
            "kind": "call",
            "summary": "Not what was said",
            "app_text": "followed_up",
            "data": {"msg": {"key": "event.heardBack", "params": {}}, "topic": "pay"},
        },
    )
    assert r.status_code == 201, r.text
    event = r.json()
    assert (event["kind"], event["summary"], event["msg"]["key"]) == ("manual", "Followed up", "event.followedUp")
    assert event["data"]["topic"] == "pay"


@pytest.mark.parametrize(
    ("url", "body"),
    [
        ("activities", {"kind": "manual", "app_text": "linkAdded"}),
        ("activities", {"kind": "manual", "app_text": "event.followedUp"}),
        ("move", {"to_stage": "screen", "app_note": "anything"}),
    ],
    ids=["unknown activity", "a key", "unknown note"],
)
def test_only_the_allowed_app_text_is_accepted(client, seeded, url, body):
    app_id = _app(client, seeded)
    assert client.post(f"/api/v1/applications/{app_id}/{url}", json=body).status_code == 422


def test_no_reply_saves_its_note_and_message_and_keeps_undo_data(client, seeded):
    app_id = _app(client, seeded)
    client.patch(f"/api/v1/applications/{app_id}", json={"awaiting_reply_since": "2030-01-01"})
    r = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": "ghosted", "app_note": "no_reply"})
    assert r.status_code == 200, r.text
    event = _last(client, app_id)
    _assert_written(event, _case("event.noReply")[0])
    assert event["data"]["was_waiting_since"] == "2030-01-01"


def test_a_note_typed_on_a_move_has_no_message(client, seeded):
    app_id = _app(client, seeded)
    client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": "screen", "note": "No reply"})
    event = _last(client, app_id)
    assert event["summary"] == "No reply" and event["msg"] is None


def test_undo_writes_its_message_with_the_stage_id_its_summary_shows(client, seeded):
    app_id = _app(client, seeded)
    client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": "screen"})
    assert client.post(f"/api/v1/applications/{app_id}/undo").status_code == 200
    event = _last(client, app_id)
    _assert_written(event, _case("event.undoMove")[0])
    assert "undo_of" in event["data"]


def test_an_undo_with_a_note_is_someones_own_words():
    app = SimpleNamespace(id="a", stage="screen", last_activity_at=datetime.now(UTC))
    last = SimpleNamespace(id="m", to_stage="screen", from_stage="applied", data={})
    added = []
    session = SimpleNamespace(add=added.append, flush=lambda: None)
    with pytest.MonkeyPatch.context() as patch:
        patch.setattr(svc, "_undoable", lambda *_: [last])
        patch.setattr(svc, "_recorded", lambda *_: [])
        patch.setattr(svc.replies, "take_back_move", lambda *_: None)
        event = svc.undo_last_move(session, app, note="Clicked the wrong one")
    assert event.summary == "Clicked the wrong one" and "msg" not in event.data


@pytest.mark.parametrize(
    ("change", "key"),
    [
        ({"reply_to_read_since": THEN[:10]}, "event.replyToRead"),
        ({"awaiting_reply_since": THEN[:10]}, "event.repliedWaiting"),
    ],
    ids=["to read", "waiting"],
)
def test_reply_and_waiting_write_their_messages(client, seeded, change, key):
    app_id = _app(client, seeded)
    assert client.patch(f"/api/v1/applications/{app_id}", json=change).status_code == 200
    event = _last(client, app_id)
    _assert_written(event, _case(key)[0])
    assert {"reply_to_read", "awaiting_reply"} & set(event["data"])


@pytest.mark.parametrize(
    ("field", "key"),
    [("reply_to_read_since", "event.replyRead"), ("awaiting_reply_since", "event.heardBack")],
    ids=["read", "heard back"],
)
def test_clearing_a_reply_or_waiting_writes_its_message(client, seeded, field, key):
    app_id = _app(client, seeded)
    client.patch(f"/api/v1/applications/{app_id}", json={field: THEN[:10]})
    assert client.patch(f"/api/v1/applications/{app_id}", json={field: None}).status_code == 200
    _assert_written(_last(client, app_id), _case(key)[0])


def _people(client, case):
    """The case's agency, a second agency for its old person, and its people at the agency they need."""
    other = post(client, "/api/v1/agencies", {"name": "Contoso Staffing"})["id"]
    params = case["params"]
    agency = post(client, "/api/v1/agencies", {"name": params["agency"]})["id"] if "agency" in params else other
    old = (
        post(client, "/api/v1/contacts", {"name": params["old"], "agency_id": other})["id"] if "old" in params else None
    )
    new = (
        post(client, "/api/v1/contacts", {"name": params["new"], "agency_id": agency})["id"]
        if "new" in params
        else None
    )
    return other, agency, old, new


@pytest.mark.parametrize(
    "case",
    [c for c in CASES if c["key"].startswith("event.recruiter") and "OnRole" not in c["key"]],
    ids=lambda c: c["summary"],
)
def test_a_recruiter_change_writes_its_message(client, seeded, case):
    other, agency, old, new = _people(client, case)
    body = {"role_id": seeded["role"]["id"], "route": "agency", "agency_id": other, "recruiter_id": old}
    app_id = post(client, "/api/v1/applications", body)["id"]
    change = {"recruiter_id": new} | ({"agency_id": agency} if "agency" in case["params"] else {})
    r = client.patch(f"/api/v1/applications/{app_id}", json=change)
    assert r.status_code == 200, r.text
    event = _last(client, app_id)
    _assert_written(event, case)
    assert event["data"]["bookkeeping"] is True and "recruiter_change" in event["data"]


@pytest.mark.parametrize("case", [c for c in CASES if "OnRole" in c["key"]], ids=lambda c: c["summary"])
def test_a_role_change_that_reaches_the_application_writes_its_message(client, seeded, case):
    other, _, old, _ = _people(client, {"params": {"old": case["params"].get("old", "Taylor Reed")}})
    new = post(client, "/api/v1/contacts", {"name": case["params"]["new"], "agency_id": other})["id"]
    recruiter = old if "old" in case["params"] else None
    role = post(client, "/api/v1/roles", {"company_id": seeded["company"]["id"], "title": "Tester", "contact_id": old})[
        "id"
    ]
    body = {"role_id": role, "route": "agency", "agency_id": other, "recruiter_id": recruiter}
    app_id = post(client, "/api/v1/applications", body)["id"]
    assert client.patch(f"/api/v1/roles/{role}", json={"contact_id": new}).status_code == 200
    _assert_written(_last(client, app_id), case)


@pytest.mark.parametrize("case", [c for c in CASES if "PersonKept" in c["key"]], ids=lambda c: c["summary"])
def test_a_role_change_that_cant_reach_the_application_says_why(client, seeded, case):
    params = case["params"]
    agency = post(client, "/api/v1/agencies", {"name": params.get("agency", "Contoso Staffing")})["id"]
    elsewhere = post(client, "/api/v1/agencies", {"name": "Elsewhere Ltd"})["id"]
    company = seeded["company"]["id"]
    if case["key"].endswith("Direct"):
        old = post(client, "/api/v1/contacts", {"name": params["old"], "company_id": company})["id"]
        new = post(client, "/api/v1/contacts", {"name": params["new"], "agency_id": elsewhere})["id"]
        app = {"route": "direct", "recruiter_id": old}
    elif case["key"].endswith("KeptAgency"):
        old = post(client, "/api/v1/contacts", {"name": params["old"], "agency_id": agency})["id"]
        new = post(client, "/api/v1/contacts", {"name": params["new"], "agency_id": elsewhere})["id"]
        app = {"route": "agency", "agency_id": agency, "recruiter_id": old}
    else:
        old = post(client, "/api/v1/contacts", {"name": params["old"]})["id"]
        new = post(client, "/api/v1/contacts", {"name": params["new"]})["id"]
        app = {"route": "agency", "recruiter_id": old}
    role = post(client, "/api/v1/roles", {"company_id": company, "title": "Tester", "contact_id": old})["id"]
    app_id = post(client, "/api/v1/applications", {"role_id": role, **app})["id"]
    assert client.patch(f"/api/v1/roles/{role}", json={"contact_id": new}).status_code == 200
    _assert_written(_last(client, app_id), case)


def test_application_created_needs_no_message_because_nothing_shows_it(client, seeded):
    """Its stage move starts from nowhere: both timelines word that themselves, and search skips stage moves."""
    app_id = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"]})["id"]
    [event] = client.get(f"/api/v1/applications/{app_id}").json()["events"]
    assert (event["summary"], event["from_stage"], event["msg"]) == ("Application created", None, None)
    item = next(i for i in client.get("/api/v1/timeline").json()["items"] if i["application_id"] == app_id)
    assert item["kind"] == "stage-event" and item["detail"] is None
    assert not [h for h in client.get("/api/v1/search", params={"q": "created"}).json() if h["kind"] == "timeline"]


def _saved(app, app_id, summary, data, kind="manual", **fields):
    with app.state.sessions.begin() as session:
        event = Event(application_id=app_id, kind=kind, summary=summary, data=data, **fields)
        session.add(event)
        session.flush()
        return event.id


def _item(client, event_id):
    return next(i for i in client.get("/api/v1/timeline").json()["items"] if i["id"] == f"event:{event_id}")


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["summary"])
def test_the_timeline_sends_the_message_its_title_comes_from(client, seeded, app, case):
    msg = {"key": case["key"], "params": case["params"]}
    item = _item(client, _saved(app, _app(client, seeded), case["summary"], {"msg": msg}))
    assert item["kind"] == "other-event" and item["msg"] == msg
    assert item["title"] == case["summary"] and item["detail"] is None


@pytest.mark.parametrize("case", TIMELINE_EVENTS["split"], ids=lambda c: repr(c["summary"]))
def test_a_message_splits_into_title_and_detail_as_the_frontend_does(client, seeded, app, case):
    msg = {"key": "event.linkAdded", "params": case["params"]}
    item = _item(client, _saved(app, _app(client, seeded), case["summary"], {"msg": msg}))
    assert (item["title"], item["detail"]) == (case["title"], case["detail"])


def test_a_stage_move_sends_its_whole_note_as_the_detail(client, seeded):
    app_id = _app(client, seeded)
    client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": "ghosted", "app_note": "no_reply"})
    event_id = _last(client, app_id)["id"]
    item = _item(client, event_id)
    assert item["detail"] == "No reply" and item["msg"] == {"key": "event.noReply", "params": {}}


@pytest.mark.parametrize("case", TIMELINE_EVENTS["bare"], ids=lambda c: c["kind"])
def test_an_event_with_no_words_says_its_kind(client, seeded, case):
    app_id = _app(client, seeded)
    post(client, f"/api/v1/applications/{app_id}/activities", {"kind": case["kind"]})
    item = _item(client, _last(client, app_id)["id"])
    assert (item["title"], item["bare_kind"]) == (case["title"], case["kind"])


def test_a_bad_message_is_null_on_the_timeline_and_in_search(client, seeded, app):
    app_id = _app(client, seeded)
    event_id = _saved(app, app_id, "Handwritten budget note", {"msg": {"key": "event.nope", "params": {}}})
    assert _item(client, event_id)["msg"] is None
    [hit] = client.get("/api/v1/search", params={"q": "handwritten"}).json()
    assert hit["msg"] is None and hit["title"] == "Handwritten budget note"


def test_search_finds_the_saved_english_and_sends_the_message(client, seeded, app):
    case = _case("event.linkAdded")[0]
    msg = {"key": case["key"], "params": case["params"]}
    _saved(app, _app(client, seeded), case["summary"], {"msg": msg})
    hits = [h for h in client.get("/api/v1/search", params={"q": "contoso careers"}).json() if h["kind"] == "timeline"]
    assert [(h["title"], h["msg"]) for h in hits] == [(case["summary"], msg)]


@pytest.mark.parametrize("amount", [2**53, 2**53 + 1], ids=str)
def test_an_amount_a_browser_cant_read_exactly_stays_english(client, seeded, amount):
    app_id = _app(client, seeded)
    post(client, f"/api/v1/applications/{app_id}/offers", {"salary": amount, "currency": "GBP"})
    event = _last(client, app_id)
    assert event["summary"] == f"Offer received: £{amount:,} a year"
    assert event["msg"] is None and "msg" not in event["data"]
