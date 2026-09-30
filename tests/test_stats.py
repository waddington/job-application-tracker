from datetime import UTC, date, datetime, timedelta

from jat.db.models import Event
from jat.domain.stats import stays

from .factories import post

T0 = datetime(2026, 9, 1, 9, tzinfo=UTC)


def _ev(i, from_stage, to_stage, days, **data):
    return Event(
        id=f"e{i}",
        seq=i,
        application_id="a1",
        kind="stage_change",
        from_stage=from_stage,
        to_stage=to_stage,
        occurred_at=T0 + timedelta(days=days),
        data=data,
    )


def test_stays_follow_the_real_history_without_undone_moves():
    events = [
        _ev(1, None, "applied", 0),
        _ev(2, "applied", "screen", 3),
        _ev(3, "screen", "rejected", 5),
        _ev(4, "rejected", "screen", 6, undo_of="e3"),  # the rejection was a mistake
        _ev(5, "screen", "interviewing", 10),
    ]
    assert [(s, (a - T0).days, b and (b - T0).days) for s, a, b in stays(events)] == [
        ("applied", 0, 3),
        ("screen", 3, 10),
        ("interviewing", 10, None),
    ]
    assert stays([]) == []


def _move(client, app_id, stage):
    r = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": stage})
    assert r.status_code == 200, r.text


def test_stats(client, seeded):
    role = seeded["role"]["id"]
    agency = seeded["agency"]["id"]
    a = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    for stage in ("screen", "interviewing"):
        _move(client, a["id"], stage)
    b = post(
        client, "/api/v1/applications", {"role_id": role, "stage": "applied", "route": "agency", "agency_id": agency}
    )
    _move(client, b["id"], "screen")
    _move(client, b["id"], "rejected")
    post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})

    out = client.get("/api/v1/insights/stats").json()
    assert out["applications"] == 3
    stages = {s["id"]: s for s in out["stages"]}
    assert [s["id"] for s in out["stages"]] == ["applied", "screen", "interviewing", "rejected"]
    # Applied: 3 reached, 2 got to Screen. Screen: 2 reached, 1 went on (the other was rejected).
    assert (stages["applied"]["reached"], stages["applied"]["moved_on"], stages["applied"]["conversion"]) == (
        3,
        2,
        0.667,
    )
    assert (stages["screen"]["moved_on"], stages["screen"]["conversion"]) == (1, 0.5)
    assert stages["rejected"]["conversion"] is None  # closed stages don't convert
    assert stages["applied"]["stays"] == 2 and stages["applied"]["median_days"] == 0.0
    assert stages["interviewing"]["stays"] == 0 and stages["interviewing"]["median_days"] is None
    assert out["routes"] == [
        {"route": "direct", "applications": 2, "reached": {"applied": 2, "screen": 1, "interviewing": 1}},
        {"route": "agency", "applications": 1, "reached": {"applied": 1, "screen": 1, "rejected": 1}},
    ]

    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert client.get("/api/v1/insights/stats", params={"since": future}).json() == {
        "applications": 0,
        "stages": [],
        "routes": [],
    }


def test_weekly_activity(client, seeded):
    role = seeded["role"]["id"]
    today = datetime.now(UTC).date()
    a = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied", "applied_on": today.isoformat()})
    _move(client, a["id"], "screen")
    _move(client, a["id"], "interviewing")
    client.post(f"/api/v1/applications/{a['id']}/undo")  # undone: not activity
    # An old application, applied five weeks ago.
    post(
        client,
        "/api/v1/applications",
        {"role_id": role, "stage": "applied", "applied_on": (today - timedelta(weeks=5)).isoformat()},
    )
    starts = datetime.now(UTC).isoformat()  # stays in this week
    post(client, f"/api/v1/applications/{a['id']}/interviews", {"round": 1, "title": "Screen", "starts_at": starts})
    post(
        client,
        f"/api/v1/applications/{a['id']}/interviews",
        {"round": 2, "title": "Cancelled", "starts_at": starts, "status": "cancelled"},
    )

    now = datetime.now(UTC)
    start = (now - timedelta(days=now.weekday(), weeks=7)).replace(hour=0, minute=0, second=0, microsecond=0)
    weeks = client.get("/api/v1/insights/activity", params={"start": start.isoformat(), "weeks": 8}).json()
    assert len(weeks) == 8 and weeks[0]["start"] == start.date().isoformat()
    this_week = weeks[-1]
    assert (this_week["added"], this_week["moves"], this_week["interviews"]) == (2, 1, 1)
    assert [w["applied"] for w in weeks] == [0, 0, 1, 0, 0, 0, 0, 1]  # this week and five weeks back

    default = client.get("/api/v1/insights/activity").json()
    assert len(default) == 12 and date.fromisoformat(default[-1]["start"]).weekday() == 0
    assert client.get("/api/v1/insights/activity", params={"weeks": 0}).status_code == 422
