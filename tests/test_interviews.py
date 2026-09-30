from datetime import UTC, datetime, timedelta, timezone

from .factories import post


def _app(client, seeded, stage="interviewing"):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": stage})


def _iso(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def test_rounds_are_numbered_and_described(client, seeded):
    app = _app(client, seeded)
    url = f"/api/v1/applications/{app['id']}/interviews"
    first = post(client, url, {"title": "Recruiter screen", "kind": "screen", "status": "done", "starts_at": _iso(-7)})
    second = post(
        client,
        url,
        {
            "title": "Engineering manager chat",
            "kind": "hiring_manager",
            "starts_at": _iso(2),
            "format": "video",
            "meeting_url": "https://meet.example.com/abc",
            "interviewer_ids": [seeded["recruiter"]["id"]],
        },
    )
    third = post(client, url, {"title": "System design test", "kind": "system_design", "starts_at": _iso(9)})

    assert [first["round"], second["round"], third["round"]] == [1, 2, 3]
    assert second["label"] == "Round 2 · Engineering manager chat"
    assert second["interviewer_ids"] == [seeded["recruiter"]["id"]]
    assert second["company_name"] == "Contoso" and second["role_title"] == "Senior Backend Engineer"

    # The board and list show the next round still to happen.
    row = client.get("/api/v1/applications", params={"stage": "interviewing"}).json()[0]
    assert row["current_round"]["label"] == "Round 2 · Engineering manager chat"

    # Once it's done, the next one is current; once all are done, the latest.
    client.patch(f"/api/v1/interviews/{second['id']}", json={"status": "done", "debrief": "Went well"})
    detail = client.get(f"/api/v1/applications/{app['id']}").json()
    assert detail["current_round"]["label"] == "Round 3 · System design test"
    client.patch(f"/api/v1/interviews/{third['id']}", json={"status": "done"})
    assert client.get(f"/api/v1/applications/{app['id']}").json()["current_round"]["round"] == 3

    # Every change is on the timeline.
    summaries = [e["summary"] for e in detail["events"] if e["kind"] == "interview"]
    assert "Round 2 · Engineering manager chat scheduled" in summaries
    assert "Round 2 · Engineering manager chat done" in summaries


def test_round_can_be_set_and_description_is_optional(client, seeded):
    app = _app(client, seeded)
    made = post(client, f"/api/v1/applications/{app['id']}/interviews", {"round": 4, "kind": "coding_task"})
    assert made["label"] == "Round 4 · Coding task"
    nxt = post(client, f"/api/v1/applications/{app['id']}/interviews", {"kind": "final"})
    assert nxt["round"] == 5


def test_cancelled_rounds_are_not_current(client, seeded):
    app = _app(client, seeded)
    only = post(client, f"/api/v1/applications/{app['id']}/interviews", {"title": "Pairing", "starts_at": _iso(1)})
    client.patch(f"/api/v1/interviews/{only['id']}", json={"status": "cancelled"})
    assert client.get(f"/api/v1/applications/{app['id']}").json()["current_round"] is None


def test_upcoming_and_titles(client, seeded):
    app = _app(client, seeded)
    url = f"/api/v1/applications/{app['id']}/interviews"
    post(client, url, {"title": "System design test", "status": "done", "starts_at": _iso(-3)})
    soon = post(client, url, {"title": "System design test", "starts_at": _iso(1)})
    undated = post(client, url, {"title": "Take-home", "kind": "coding_task"})
    later = post(client, url, {"title": "Final with CTO", "starts_at": _iso(5)})

    upcoming = client.get("/api/v1/interviews", params={"upcoming": True}).json()
    # Past and done rounds drop out; undated ones stay (they sort by when they were added).
    assert {i["id"] for i in upcoming} == {soon["id"], undated["id"], later["id"]}
    assert upcoming[-1]["id"] == later["id"]

    titles = client.get("/api/v1/interviews/titles").json()
    assert titles[0] == "System design test"
    assert set(titles) == {"System design test", "Take-home", "Final with CTO"}


def test_validation(client, seeded):
    app = _app(client, seeded)
    url = f"/api/v1/applications/{app['id']}/interviews"
    assert client.post(url, json={"interviewer_ids": ["nope"]}).status_code == 422
    assert client.post(url, json={"kind": "tea"}).status_code == 422
    assert client.post(url, json={"starts_at": "2026-10-01T10:00:00"}).status_code == 422  # no timezone
    assert client.post("/api/v1/applications/missing/interviews", json={}).status_code == 404
    made = post(client, url, {})
    assert client.patch(f"/api/v1/interviews/{made['id']}", json={"round": None}).status_code == 422
    assert client.delete(f"/api/v1/interviews/{made['id']}").status_code == 204
    assert client.get(f"/api/v1/interviews/{made['id']}").status_code == 404


def test_interviews_go_with_their_application(client, seeded):
    app = _app(client, seeded)
    made = post(client, f"/api/v1/applications/{app['id']}/interviews", {"title": "Screen"})
    assert client.delete(f"/api/v1/applications/{app['id']}").status_code == 204
    assert client.get(f"/api/v1/interviews/{made['id']}").status_code == 404


def _interview_events(client, app_id):
    detail = client.get(f"/api/v1/applications/{app_id}").json()
    return [e["summary"] for e in detail["events"] if e["kind"] == "interview"]


def test_patch_clears_replaces_and_logs_only_real_reschedules(client, seeded):
    app = _app(client, seeded)
    other = post(client, "/api/v1/contacts", {"name": "Riley Chen"})
    made = post(
        client,
        f"/api/v1/applications/{app['id']}/interviews",
        {"title": "Pairing", "starts_at": _iso(3), "interviewer_ids": [seeded["recruiter"]["id"]]},
    )
    url = f"/api/v1/interviews/{made['id']}"

    # Same instant in another offset, with fractions: stored as the same time, so no event.
    same = datetime.fromisoformat(made["starts_at"]).astimezone(timezone(timedelta(hours=2)))
    r = client.patch(url, json={"starts_at": same.replace(microsecond=250000).isoformat()})
    assert r.json()["starts_at"] == made["starts_at"]
    assert "Round 1 · Pairing rescheduled" not in _interview_events(client, app["id"])

    r = client.patch(url, json={"starts_at": _iso(4), "interviewer_ids": [other["id"]], "title": None})
    assert r.json()["interviewer_ids"] == [other["id"]]
    assert r.json()["title"] is None and r.json()["label"] == "Round 1 · Technical"
    assert "Round 1 · Technical rescheduled" in _interview_events(client, app["id"])

    # Clearing the time isn't a reschedule.
    client.patch(url, json={"starts_at": None})
    assert _interview_events(client, app["id"]).count("Round 1 · Technical rescheduled") == 1


def test_upcoming_skips_cancelled_done_and_past(client, seeded):
    app = _app(client, seeded)
    url = f"/api/v1/applications/{app['id']}/interviews"
    keep = post(client, url, {"title": "Take-home", "kind": "coding_task", "deadline_at": _iso(2)})
    post(client, url, {"title": "Old", "starts_at": _iso(-2)})  # still "scheduled" but in the past
    post(client, url, {"title": "Off", "starts_at": _iso(2), "status": "cancelled"})
    post(client, url, {"title": "Held", "starts_at": _iso(1), "status": "done"})
    ids = [i["id"] for i in client.get("/api/v1/interviews", params={"upcoming": True}).json()]
    assert ids == [keep["id"]]
    # A caller's own "start of today" (e.g. local midnight) moves the cut-off.
    since = (datetime.now(UTC) - timedelta(days=3)).isoformat()
    ids = [i["id"] for i in client.get("/api/v1/interviews", params={"upcoming": True, "since": since}).json()]
    assert len(ids) == 2


def test_delete_is_logged_and_moves_the_current_round(client, seeded):
    app = _app(client, seeded)
    url = f"/api/v1/applications/{app['id']}/interviews"
    post(client, url, {"title": "Screen", "status": "done", "starts_at": _iso(-5)})
    second = post(client, url, {"title": "Onsite", "starts_at": _iso(5)})
    assert client.get(f"/api/v1/applications/{app['id']}").json()["current_round"]["round"] == 2
    assert client.delete(f"/api/v1/interviews/{second['id']}").status_code == 204
    detail = client.get(f"/api/v1/applications/{app['id']}").json()
    assert detail["current_round"]["label"] == "Round 1 · Screen"
    assert "Round 2 · Onsite removed" in _interview_events(client, app["id"])
