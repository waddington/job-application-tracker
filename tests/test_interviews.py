from datetime import UTC, datetime, timedelta, timezone

from jat.db.models import Event

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
    assert (r.json()["rescheduled_count"], r.json()["rescheduled_from"]) == (0, None)

    r = client.patch(url, json={"starts_at": _iso(4), "interviewer_ids": [other["id"]], "title": None})
    assert r.json()["interviewer_ids"] == [other["id"]]
    assert r.json()["title"] is None and r.json()["label"] == "Round 1 · Technical"
    assert "Round 1 · Technical rescheduled" in _interview_events(client, app["id"])
    # It remembers how often, and where it moved from.
    assert (r.json()["rescheduled_count"], r.json()["rescheduled_from"]) == (1, made["starts_at"])

    # Again, with why: the reason goes on the timeline; it isn't kept on the round.
    moved = r.json()["starts_at"]
    r = client.patch(url, json={"starts_at": _iso(6), "reschedule_reason": " They had a clash "})
    assert (r.json()["rescheduled_count"], r.json()["rescheduled_from"]) == (2, moved)
    assert "Round 1 · Technical rescheduled: They had a clash" in _interview_events(client, app["id"])
    assert "reschedule_reason" not in r.json()

    # Clearing the time isn't a reschedule; nor is a reason on its own.
    client.patch(url, json={"starts_at": None, "reschedule_reason": "ignored"})
    events = _interview_events(client, app["id"])
    assert sum("Technical rescheduled" in e for e in events) == 2
    assert client.get(url).json()["rescheduled_count"] == 2


def test_rescheduling_keeps_the_length_and_one_line_reasons(client, seeded):
    app = _app(client, seeded)
    start, end = datetime.fromisoformat(_iso(3)), datetime.fromisoformat(_iso(3)) + timedelta(hours=1)
    made = post(
        client,
        f"/api/v1/applications/{app['id']}/interviews",
        {"title": "Pairing", "starts_at": start.isoformat(), "ends_at": end.isoformat()},
    )
    url = f"/api/v1/interviews/{made['id']}"
    # Only the start sent (as the round's form does): the end moves with it.
    later = start + timedelta(days=2)
    r = client.patch(url, json={"starts_at": later.isoformat(), "reschedule_reason": "They had\n a clash  "})
    out = r.json()
    assert datetime.fromisoformat(out["ends_at"]) - datetime.fromisoformat(out["starts_at"]) == timedelta(hours=1)
    assert "Round 1 · Pairing rescheduled: They had a clash" in _interview_events(client, app["id"])
    # An end sent with it wins.
    r = client.patch(url, json={"starts_at": _iso(9), "ends_at": None})
    assert r.json()["ends_at"] is None and r.json()["rescheduled_count"] == 2
    # A reason has a sensible length.
    assert client.patch(url, json={"starts_at": _iso(10), "reschedule_reason": "x" * 501}).status_code == 422


def test_changing_status_and_time_together_isnt_a_reschedule(client, seeded):
    app = _app(client, seeded)
    made = post(client, f"/api/v1/applications/{app['id']}/interviews", {"title": "Pairing", "starts_at": _iso(3)})
    url = f"/api/v1/interviews/{made['id']}"
    client.patch(url, json={"status": "cancelled"})
    # Back on at a new time: logged as back on, not counted as moved.
    r = client.patch(url, json={"status": "scheduled", "starts_at": _iso(5), "reschedule_reason": "dropped"})
    assert (r.json()["rescheduled_count"], r.json()["rescheduled_from"]) == (0, None)
    events = _interview_events(client, app["id"])
    assert "Round 1 · Pairing back on" in events
    assert not any("rescheduled" in e for e in events)


def _moves(client, app_id):
    """Each reschedule on the timeline: the data it saved, oldest first."""
    detail = client.get(f"/api/v1/applications/{app_id}").json()
    moved = [e for e in detail["events"] if e["kind"] == "interview" and "rescheduled" in (e["summary"] or "")]
    return [e["data"].get("reschedule") for e in sorted(moved, key=lambda e: e["occurred_at"])]


def test_every_reschedule_keeps_its_own_times_who_and_why(client, seeded):
    app = _app(client, seeded)
    first, second, third = _iso(3), _iso(5), _iso(7)
    made = post(client, f"/api/v1/applications/{app['id']}/interviews", {"kind": "technical", "starts_at": first})
    url = f"/api/v1/interviews/{made['id']}"
    r = client.patch(url, json={"starts_at": second, "reschedule_by": "them", "reschedule_reason": " A  clash "})
    assert r.status_code == 200, r.text
    assert "reschedule_by" not in r.json()
    assert client.patch(url, json={"starts_at": third, "reschedule_by": "me"}).status_code == 200
    # Without a who, as an older client or the round's form sends: it's a move with nothing said.
    moved = client.patch(url, json={"starts_at": first})
    assert moved.json()["rescheduled_count"] == 3

    moves = _moves(client, app["id"])
    assert [(m["by"], m["reason"]) for m in moves] == [("them", "A clash"), ("me", None), (None, None)]
    at = datetime.fromisoformat
    assert [(at(m["from"]), at(m["to"])) for m in moves] == [
        (at(first), at(second)),
        (at(second), at(third)),
        (at(third), at(first)),
    ]
    events = _interview_events(client, app["id"])
    assert "Round 1 · Technical rescheduled (they needed the change): A clash" in events
    assert "Round 1 · Technical rescheduled (you needed the change)" in events
    assert "Round 1 · Technical rescheduled" in events


def _timeline_item(client, event_id):
    items = client.get("/api/v1/timeline").json()["items"]
    return next(i for i in items if i["id"] == f"event:{event_id}")


def _set_reschedule(client, app_id, value, kind="interview"):
    """The event a hand-edited export could hold: the API won't write these itself."""
    made = post(client, f"/api/v1/applications/{app_id}/activities", {"kind": kind, "summary": "Moved it"})
    with client.app.state.sessions.begin() as session:
        session.get(Event, made["id"]).data = {"reschedule": value}
    return made["id"]


def _read_both(client, app_id, event_id):
    """The field as the event and the Timeline item give it: the two always agree."""
    events = client.get(f"/api/v1/applications/{app_id}").json()["events"]
    on_event = next(e for e in events if e["id"] == event_id)["reschedule"]
    assert _timeline_item(client, event_id)["reschedule"] == on_event
    return on_event


def test_a_real_reschedule_gives_its_move_on_both_timelines(client, seeded):
    app = _app(client, seeded)
    before, after = _iso(3), _iso(5)
    made = post(client, f"/api/v1/applications/{app['id']}/interviews", {"kind": "technical", "starts_at": before})
    client.patch(
        f"/api/v1/interviews/{made['id']}",
        json={"starts_at": after, "reschedule_by": "them", "reschedule_reason": "A clash"},
    )
    event = next(e for e in client.get(f"/api/v1/applications/{app['id']}").json()["events"] if e["reschedule"])
    move = _read_both(client, app["id"], event["id"])
    assert (move["by"], move["reason"]) == ("them", "A clash")
    at = datetime.fromisoformat
    assert (at(move["from_at"]), at(move["to_at"])) == (at(before), at(after))
    # What was already there means what it did.
    assert event["data"]["reschedule"]["by"] == "them"
    assert event["summary"] == "Round 1 · Technical rescheduled (they needed the change): A clash"


def test_a_partial_move_keeps_what_it_has(client, seeded):
    app = _app(client, seeded)
    times = {"from": "2026-11-03T10:00:00+00:00", "to": "2026-11-05T14:00:00+00:00"}
    for extra in ({}, {"by": None, "reason": None}, {"reason": "   "}, {"reason": ""}, {"other": 1}):
        move = _read_both(client, app["id"], _set_reschedule(client, app["id"], times | extra))
        assert (move["by"], move["reason"]) == (None, None), extra
        assert datetime.fromisoformat(move["from_at"]) == datetime.fromisoformat(times["from"])
    assert _read_both(client, app["id"], _set_reschedule(client, app["id"], times | {"by": "me"}))["by"] == "me"
    moved = _read_both(client, app["id"], _set_reschedule(client, app["id"], times | {"reason": " Why "}))
    assert moved["reason"] == "Why"


def test_a_bad_move_reads_as_absent_and_never_fails(client, seeded):
    app = _app(client, seeded)
    good = {"from": "2026-11-03T10:00:00+00:00", "to": "2026-11-05T14:00:00+00:00"}
    for bad in (
        None,
        "moved",
        7,
        [],
        {},
        {"from": good["from"]},
        {"to": good["to"]},
        good | {"from": "not a date"},
        good | {"from": None},
        good | {"to": 1700000000},
        good | {"to": "1700000000"},
        good | {"to": True},
        good | {"from": "2026-11-03T10:00:00"},  # no zone: it can't be shown at the right time
        good | {"from": "2026-11-03"},
        good | {"by": "the cat"},
        good | {"by": 3},
        good | {"by": ["me"]},
        good | {"by": {"me": 1}},
        good | {"reason": 12},
        good | {"reason": ["why"]},
    ):
        assert _read_both(client, app["id"], _set_reschedule(client, app["id"], bad)) is None, bad


def test_only_an_interview_event_has_a_move(client, seeded):
    app = _app(client, seeded)
    good = {"from": "2026-11-03T10:00:00+00:00", "to": "2026-11-05T14:00:00+00:00"}
    assert _read_both(client, app["id"], _set_reschedule(client, app["id"], good, kind="call")) is None
    # An older event, and one a client tried to fill in itself (the endpoint drops it).
    plain = post(client, f"/api/v1/applications/{app['id']}/activities", {"kind": "interview", "summary": "Old"})
    assert _read_both(client, app["id"], plain["id"]) is None
    sent = post(
        client,
        f"/api/v1/applications/{app['id']}/activities",
        {"kind": "interview", "summary": "Sent", "data": {"reschedule": good}},
    )
    assert _read_both(client, app["id"], sent["id"]) is None


def test_who_counts_only_for_a_real_reschedule(client, seeded):
    app = _app(client, seeded)
    made = post(client, f"/api/v1/applications/{app['id']}/interviews", {"kind": "pairing", "starts_at": _iso(3)})
    url = f"/api/v1/interviews/{made['id']}"
    # No move: same time, or a new title.
    assert client.patch(url, json={"title": "Pairing", "reschedule_by": "them"}).status_code == 200
    assert client.patch(url, json={"starts_at": made["starts_at"], "reschedule_by": "them"}).status_code == 200
    # A status change in the same save isn't one either; nor is giving a time back.
    client.patch(url, json={"status": "cancelled", "starts_at": _iso(4), "reschedule_by": "them"})
    client.patch(url, json={"status": "scheduled", "starts_at": _iso(5), "reschedule_by": "them"})
    client.patch(url, json={"starts_at": None, "reschedule_by": "them"})
    client.patch(url, json={"starts_at": _iso(6), "reschedule_by": "them"})
    assert client.get(url).json()["rescheduled_count"] == 0
    assert _moves(client, app["id"]) == []
    assert not any("needed the change" in e for e in _interview_events(client, app["id"]))


def test_a_who_it_doesnt_know_is_refused_and_saves_nothing(client, seeded):
    app = _app(client, seeded)
    made = post(client, f"/api/v1/applications/{app['id']}/interviews", {"kind": "pairing", "starts_at": _iso(3)})
    url = f"/api/v1/interviews/{made['id']}"
    assert client.patch(url, json={"starts_at": _iso(5), "reschedule_by": "the cat"}).status_code == 422
    kept = client.get(url).json()
    assert (kept["starts_at"], kept["rescheduled_count"]) == (made["starts_at"], 0)


def test_a_reschedule_from_before_who_keeps_showing_as_it_did(client, seeded, app):
    made_app = _app(client, seeded)
    with app.state.sessions.begin() as session:
        session.add(
            Event(
                application_id=made_app["id"],
                kind="interview",
                summary="Round 1 rescheduled: an old clash",
                data={
                    "interview_id": "i1",
                    "msg": {
                        "key": "event.roundRescheduledReason",
                        "params": {"round": 1, "title": None, "kind": "technical", "reason": "an old clash"},
                    },
                },
            )
        )
    [event] = [
        e for e in client.get(f"/api/v1/applications/{made_app['id']}").json()["events"] if e["kind"] == "interview"
    ]
    assert event["msg"]["key"] == "event.roundRescheduledReason"
    assert "reschedule" not in event["data"]


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
