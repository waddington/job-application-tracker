from jat.storage.eml import is_eml, parse_eml, sent_at

from .factories import post

PLAIN = b"""From: Alex Morgan <alex.morgan@northwind.example.com>
To: Candidate <candidate@example.com>
Cc: Sam Patel <sam@example.com>
Subject: Contoso - next steps
Date: Tue, 29 Sep 2026 14:05:07 +0100
Message-ID: <demo-1@northwind.example.com>
Content-Type: text/plain; charset=utf-8

Hi,

Contoso would like to book a system design round on Friday.

Alex
"""

HTML_ONLY = b"""From: recruiting@contoso.example.com
Subject: =?utf-8?q?Interview_invitation_=E2=80=93_Contoso?=
Date: not a date
Content-Type: text/html; charset=utf-8

<html><body><p>Hello &amp; welcome</p><script>alert(1)</script></body></html>
"""


def test_is_eml():
    assert is_eml("Next steps.EML", None)
    assert is_eml("x", "message/rfc822")
    assert not is_eml("cv.pdf", "application/pdf")


def test_parse_plain_email(tmp_path):
    path = tmp_path / "a.eml"
    path.write_bytes(PLAIN)
    meta = parse_eml(path)
    assert meta["subject"] == "Contoso - next steps"
    assert meta["from"] == ["Alex Morgan <alex.morgan@northwind.example.com>"]
    assert meta["to"] == ["Candidate <candidate@example.com>"]
    assert meta["cc"] == ["Sam Patel <sam@example.com>"]
    assert meta["date"] == "2026-09-29T13:05:07Z"
    assert meta["snippet"].startswith("Hi, Contoso would like to book a system design round")
    assert sent_at(meta).isoformat() == "2026-09-29T13:05:07+00:00"


def test_parse_html_only_email_without_a_date(tmp_path):
    path = tmp_path / "b.eml"
    path.write_bytes(HTML_ONLY)
    meta = parse_eml(path)
    assert meta["subject"] == "Interview invitation – Contoso"
    assert meta["from"] == ["recruiting@contoso.example.com"]
    assert "date" not in meta and sent_at(meta) is None
    assert meta["snippet"].startswith("Hello & welcome")
    assert "<" not in meta["snippet"]


def test_future_dates_are_not_trusted():
    assert sent_at({"date": "2999-01-01T00:00:00Z"}) is None


def test_uploading_an_email_puts_it_on_the_timeline(client, seeded):
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    r = client.post(
        "/api/v1/attachments",
        files={"file": ("next steps.eml", PLAIN, "application/octet-stream")},
        data={"entity_type": "application", "entity_id": app["id"]},
    )
    assert r.status_code == 201, r.text
    att = r.json()
    assert att["content_type"] == "message/rfc822" and att["inline"] is False
    assert att["meta"]["subject"] == "Contoso - next steps"

    events = client.get(f"/api/v1/applications/{app['id']}").json()["events"]
    email = next(e for e in events if e["kind"] == "email")
    assert email["summary"] == "Contoso - next steps (from Alex Morgan <alex.morgan@northwind.example.com>)"
    assert email["occurred_at"].startswith("2026-09-29T13:05:07")
    assert email["data"]["attachment_id"] == att["id"]


def test_a_broken_email_is_still_kept(client, seeded):
    r = client.post(
        "/api/v1/attachments",
        files={"file": ("broken.eml", b"\xff\xfe not really an email", "message/rfc822")},
        data={"entity_type": "company", "entity_id": seeded["company"]["id"]},
    )
    assert r.status_code == 201
    assert r.json()["content_type"] == "message/rfc822"
