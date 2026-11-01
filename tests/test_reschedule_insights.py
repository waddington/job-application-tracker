"""The Rescheduling block on Insights, and each round's saved moves."""

from datetime import UTC, datetime, timedelta

from jat.db.models import Application, Event, Interview

from .factories import post

URL = "/api/v1/insights/rescheduling"


def _iso(days: int) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def _app(client, seeded, **extra):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "interviewing", **extra})


def _round(client, app, days=3, **extra):
    return post(client, f"/api/v1/applications/{app['id']}/interviews", {"starts_at": _iso(days), **extra})


def _move(client, made, days, by=None):
    body = {"starts_at": _iso(days)} | ({"reschedule_by": by} if by else {})
    r = client.patch(f"/api/v1/interviews/{made['id']}", json=body)
    assert r.status_code == 200, r.text


def _old_style(client, made, count):
    """A round moved before moves kept a record: only the column says so."""
    with client.app.state.sessions.begin() as session:
        session.get(Interview, made["id"]).rescheduled_count = count


def _split(stats):
    return [stats[k] for k in ("by_me", "by_them", "by_mutual", "by_neither", "not_recorded")]


def test_nothing_at_all(client):
    assert client.get(URL).json() == {
        "booked_rounds": 0,
        "moved_rounds": 0,
        "moves": 0,
        "by_me": 0,
        "by_them": 0,
        "by_mutual": 0,
        "by_neither": 0,
        "not_recorded": 0,
        "min_rounds_listed": 3,
        "companies": [],
        "recruiters": [],
    }


def test_booked_rounds_that_never_moved(client, seeded):
    app = _app(client, seeded)
    _round(client, app)
    _round(client, app, status="done")
    # A take-home with only a deadline, and a round with no time yet, aren't booked.
    post(client, f"/api/v1/applications/{app['id']}/interviews", {"deadline_at": _iso(4)})
    post(client, f"/api/v1/applications/{app['id']}/interviews", {"title": "Not booked"})
    stats = client.get(URL).json()
    assert (stats["booked_rounds"], stats["moved_rounds"], stats["moves"]) == (2, 0, 0)


def test_only_old_moves_count_as_not_recorded(client, seeded):
    made = _round(client, _app(client, seeded))
    _old_style(client, made, 2)
    stats = client.get(URL).json()
    assert (stats["booked_rounds"], stats["moved_rounds"], stats["moves"]) == (1, 1, 2)
    assert _split(stats) == [0, 0, 0, 0, 2]


def test_new_moves_split_by_who_and_rounds_differ_from_moves(client, seeded):
    app = _app(client, seeded)
    twice = _round(client, app, 3)
    _move(client, twice, 5, "me")
    _move(client, twice, 6, "them")
    once = _round(client, app, 4)
    _move(client, once, 5, "mutual")
    other = _round(client, app, 7)
    _move(client, other, 8, "neither")
    _round(client, app, 9)
    stats = client.get(URL).json()
    assert (stats["booked_rounds"], stats["moved_rounds"], stats["moves"]) == (4, 3, 4)
    assert _split(stats) == [1, 1, 1, 1, 0]


def test_mixed_moves_edit_form_and_old_ones_arent_misattributed(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app, 3)
    _move(client, made, 4, "them")  # who said
    _move(client, made, 5)  # the Edit form: times, no who
    stats = client.get(URL).json()
    assert stats["moves"] == 2 and _split(stats) == [0, 1, 0, 0, 1]
    # The count says there was one more move than the records show: an older one.
    _old_style(client, made, 3)
    stats = client.get(URL).json()
    assert stats["moves"] == 3 and _split(stats) == [0, 1, 0, 0, 2]
    assert stats["moved_rounds"] == 1


def test_malformed_records_count_as_not_recorded_and_never_fail(client, seeded):
    app = _app(client, seeded)
    good = {"from": "2026-11-03T10:00:00+00:00", "to": "2026-11-05T14:00:00+00:00", "by": "them"}
    for bad in (None, "moved", [], {}, good | {"from": "nope"}, good | {"by": "the cat"}, good | {"reason": 12}):
        made = _round(client, app)
        _move(client, made, 9, "me")
        with client.app.state.sessions.begin() as session:
            for event in session.query(Event).filter(Event.kind == "interview"):
                if event.data.get("interview_id") == made["id"] and event.data.get("reschedule"):
                    event.data = {**event.data, "reschedule": bad}
    stats = client.get(URL).json()
    assert (stats["moved_rounds"], stats["moves"]) == (7, 7)
    assert _split(stats) == [0, 0, 0, 0, 7]
    assert all(i["moves"] == [] for i in client.get("/api/v1/interviews").json())


def test_a_record_with_an_odd_round_id_or_data_doesnt_fail(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app)
    _move(client, made, 5, "me")
    with client.app.state.sessions.begin() as session:
        for event in session.query(Event).filter(Event.kind == "interview"):
            if event.data.get("reschedule"):
                event.data = {**event.data, "interview_id": ["not", "an", "id"]}
    assert client.get(URL).status_code == 200
    assert client.get(URL).json()["not_recorded"] == 1
    assert client.get("/api/v1/interviews").status_code == 200


def test_a_moved_round_that_lost_its_time_still_counts_as_booked(client, seeded):
    made = _round(client, _app(client, seeded))
    _move(client, made, 5, "them")
    client.patch(f"/api/v1/interviews/{made['id']}", json={"starts_at": None})
    stats = client.get(URL).json()
    assert (stats["booked_rounds"], stats["moved_rounds"], stats["by_them"]) == (1, 1, 1)


def test_cancelled_and_done_rounds_keep_their_moves_and_removed_ones_dont_count(client, seeded):
    app = _app(client, seeded)
    kept = _round(client, app)
    _move(client, kept, 5, "them")
    client.patch(f"/api/v1/interviews/{kept['id']}", json={"status": "cancelled"})
    gone = _round(client, app)
    _move(client, gone, 5, "me")
    assert client.delete(f"/api/v1/interviews/{gone['id']}").status_code == 204
    stats = client.get(URL).json()
    assert (stats["booked_rounds"], stats["moved_rounds"], stats["moves"]) == (1, 1, 1)
    assert _split(stats) == [0, 1, 0, 0, 0]


def test_only_three_or_more_moved_rounds_are_listed(client, seeded):
    recruiter = seeded["recruiter"]["id"]
    app = _app(client, seeded, route="agency", agency_id=seeded["agency"]["id"], recruiter_id=recruiter)
    # Two moved rounds, however many moves: not listed.
    two = [_round(client, app, 3), _round(client, app, 4)]
    for made in two:
        _move(client, made, 8, "them")
        _move(client, made, 9, "them")
    stats = client.get(URL).json()
    assert stats["moves"] == 4 and stats["companies"] == [] and stats["recruiters"] == []
    # A third moved round lists both; a booked one that didn't move changes nothing.
    _round(client, app, 5)
    third = _round(client, app, 6)
    _old_style(client, third, 1)
    stats = client.get(URL).json()
    assert stats["companies"] == [
        {"id": seeded["company"]["id"], "name": "Contoso", "moved_rounds": 3, "moves": 5},
    ]
    assert stats["recruiters"] == [
        {"id": recruiter, "name": "Alex Recruiter", "moved_rounds": 3, "moves": 5},
    ]


def test_a_period_goes_by_when_the_application_was_added_old_moves_included(client, seeded):
    recent = _app(client, seeded)
    earlier = _app(client, seeded)
    moved_now = _round(client, recent)
    _move(client, moved_now, 5, "me")
    old = _round(client, earlier)
    _old_style(client, old, 1)
    moved_on_old = _round(client, earlier)
    _move(client, moved_on_old, 5, "them")  # moved just now, on an application added long ago
    with client.app.state.sessions.begin() as session:
        session.get(Application, earlier["id"]).created_at = datetime.now(UTC) - timedelta(days=60)

    assert client.get(URL).json()["moves"] == 3
    since = (datetime.now(UTC) - timedelta(days=30)).isoformat()
    stats = client.get(URL, params={"since": since}).json()
    assert (stats["booked_rounds"], stats["moved_rounds"]) == (1, 1)
    assert _split(stats) == [1, 0, 0, 0, 0]
    stats = client.get(URL, params={"until": since}).json()
    assert (stats["booked_rounds"], stats["moved_rounds"]) == (2, 2)
    assert _split(stats) == [0, 1, 0, 0, 1]


def test_a_round_gives_its_saved_moves_oldest_first(client, seeded):
    app = _app(client, seeded)
    made = _round(client, app, 3)
    other = _round(client, app, 20)
    assert made["moves"] == []
    _move(client, made, 5, "them")
    _move(client, made, 4)
    _move(client, other, 21, "me")
    found = client.get(f"/api/v1/interviews/{made['id']}").json()
    assert [m["by"] for m in found["moves"]] == ["them", None]
    assert found["moves"][0]["to_at"] == found["moves"][1]["from_at"]
    assert found["moves"][1]["to_at"] == found["starts_at"]
    # The application page lists its rounds like this.
    rounds = client.get("/api/v1/interviews", params={"application_id": app["id"]}).json()
    assert sorted(len(r["moves"]) for r in rounds) == [1, 2]
