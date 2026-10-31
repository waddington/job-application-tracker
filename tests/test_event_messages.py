"""New events save their text as data (`data.msg`) beside the English `summary` (docs/rfc/i18n.md)."""

import json
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from typing import get_args

import pytest

from jat.api import schemas as S
from jat.db.models import Event
from jat.domain import applications as svc
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


@pytest.mark.parametrize(
    "key",
    ["event.email", "event.emailNoSubject", "event.emailUnknownSender", "event.emailNoSubjectUnknownSender"],
)
def test_an_email_writes_the_message_for_what_it_has(client, seeded, key):
    [case] = _case(key)
    app_id = _app(client, seeded)
    _upload(client, app_id, "mail.eml", _eml(case["params"].get("subject"), case["params"].get("sender")))
    event = _last(client, app_id)
    _assert_written(event, case)
    assert "from" in event["data"] and "attachment_id" in event["data"]


@pytest.mark.parametrize(
    ("kind", "key"),
    [("cv", "event.cvSent"), ("cover_letter", "event.coverLetterSent"), ("other", "event.documentSent")],
)
def test_sending_a_document_writes_its_message(client, seeded, kind, key):
    [case] = _case(key)
    app_id = _app(client, seeded)
    doc = post(client, "/api/v1/documents", {"kind": kind, "name": case["params"]["name"]})
    version = client.post(f"/api/v1/documents/{doc['id']}/versions", data={"label": case["params"]["label"]}).json()
    post(client, f"/api/v1/applications/{app_id}/documents", {"document_version_id": version["id"]})
    event = _last(client, app_id)
    _assert_written(event, case)
    assert event["data"]["document_version_id"] == version["id"]


def test_adopting_a_cv_file_writes_its_message(client, seeded):
    [case] = _case("event.cvSent")
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
