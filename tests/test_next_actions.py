from datetime import UTC, date, datetime, timedelta

from jat.db.models import Application

from .factories import post


def _iso(days: float) -> str:
    return (datetime.now(UTC) + timedelta(days=days)).replace(microsecond=0).isoformat()


def _age(app, app_id: str, days: int) -> None:
    """Pretend nothing has happened on an application for `days` days."""
    with app.state.sessions() as s:
        s.get(Application, app_id).last_activity_at = datetime.now(UTC) - timedelta(days=days)
        s.commit()


def test_next_actions(client, seeded, app):
    role = seeded["role"]["id"]
    quiet = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    quieter = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    booked = post(client, "/api/v1/applications", {"role_id": role, "stage": "interviewing"})
    chase = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    snoozed = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    fresh = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    for a, days in [(quiet, 9), (quieter, 20), (booked, 12), (chase, 10), (snoozed, 30)]:
        _age(app, a["id"], days)

    today = date.today()
    client.patch(f"/api/v1/applications/{chase['id']}", json={"follow_up_on": str(today)})
    client.patch(
        f"/api/v1/applications/{snoozed['id']}",
        json={"follow_up_on": str(today - timedelta(days=1)), "snoozed_until": str(today + timedelta(days=3))},
    )
    url = f"/api/v1/applications/{booked['id']}/interviews"
    soon = post(client, url, {"title": "System design test", "starts_at": _iso(2)})
    post(client, url, {"title": "Take-home", "kind": "coding_task", "deadline_at": _iso(5)})
    later = post(client, url, {"title": "Final", "starts_at": _iso(30)})  # beyond two weeks
    undated = post(client, url, {"title": "Chat with the CTO"})
    missed = post(client, url, {"title": "Recruiter screen", "starts_at": _iso(-1)})
    _age(app, booked["id"], 12)  # adding rounds counts as activity; make it old again

    na = client.get("/api/v1/next-actions").json()
    assert [r["id"] for r in na["follow_ups"]] == [chase["id"]]  # the snoozed one waits
    # Quietest first; the booked one isn't stale (it's waiting on a date), nor is the fresh one.
    # (A snoozed one is left alone until its snooze ends.)
    assert [r["id"] for r in na["stale"]] == [quieter["id"], quiet["id"]]
    assert fresh["id"] not in {r["id"] for r in na["stale"]}
    assert [i["title"] for i in na["upcoming"]] == ["System design test", "Take-home", "Chat with the CTO"]
    assert later["id"] not in {i["id"] for i in na["upcoming"]} and undated["id"] == na["upcoming"][-1]["id"]
    assert [i["id"] for i in na["awaiting_outcome"]] == [missed["id"]]
    assert soon["label"] == "Round 1 · System design test"

    # The list agrees about staleness.
    stale_ids = {r["id"] for r in client.get("/api/v1/applications", params={"stale": True}).json()}
    assert booked["id"] not in stale_ids and quiet["id"] in stale_ids


def test_since_sets_what_today_means(client):
    tomorrow = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
    na = client.get("/api/v1/next-actions", params={"since": tomorrow.isoformat()}).json()
    assert na["today"] == str(tomorrow.date())


def test_a_local_today_wins(client, seeded):
    # East of UTC just after midnight, local midnight is still "yesterday" in UTC: the local
    # date decides what's due.
    local_today = date.today() + timedelta(days=1)
    app = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    client.patch(f"/api/v1/applications/{app['id']}", json={"follow_up_on": str(local_today)})
    since = datetime.combine(local_today, datetime.min.time()).replace(tzinfo=UTC) - timedelta(hours=1)
    na = client.get("/api/v1/next-actions", params={"today": str(local_today), "since": since.isoformat()}).json()
    assert [r["id"] for r in na["follow_ups"]] == [app["id"]]
    assert client.get("/api/v1/next-actions").json()["follow_ups"] == []


def test_finished_applications_stay_out(client, seeded, app):
    role = seeded["role"]["id"]
    rejected = post(client, "/api/v1/applications", {"role_id": role, "stage": "rejected"})
    archived = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    for a in (rejected, archived):
        client.patch(f"/api/v1/applications/{a['id']}", json={"follow_up_on": str(date.today())})
        post(client, f"/api/v1/applications/{a['id']}/interviews", {"title": "Soon", "starts_at": _iso(1)})
        post(client, f"/api/v1/applications/{a['id']}/interviews", {"title": "Missed", "starts_at": _iso(-1)})
    client.patch(f"/api/v1/applications/{archived['id']}", json={"archived": True})
    na = client.get("/api/v1/next-actions").json()
    assert na["follow_ups"] == [] and na["upcoming"] == [] and na["awaiting_outcome"] == []


def test_a_booked_later_round_counts_even_after_a_missed_one(client, seeded, app):
    a = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "interviewing"})
    url = f"/api/v1/applications/{a['id']}/interviews"
    post(client, url, {"title": "Screen", "starts_at": _iso(-3)})  # never marked done
    post(client, url, {"title": "Onsite", "starts_at": _iso(4)})
    _age(app, a["id"], 20)
    assert a["id"] not in {r["id"] for r in client.get("/api/v1/next-actions").json()["stale"]}


def test_a_planned_follow_up_takes_it_off_gone_quiet_until_then(client, seeded, app):
    a = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": "applied"})
    _age(app, a["id"], 20)
    assert a["id"] in {r["id"] for r in client.get("/api/v1/next-actions").json()["stale"]}
    client.patch(f"/api/v1/applications/{a['id']}", json={"follow_up_on": str(date.today() + timedelta(days=3))})
    na = client.get("/api/v1/next-actions").json()
    assert a["id"] not in {r["id"] for r in na["stale"]} and na["follow_ups"] == []
    # On the day, it comes back as a follow-up.
    local = date.today() + timedelta(days=3)
    na = client.get("/api/v1/next-actions", params={"today": str(local)}).json()
    assert [r["id"] for r in na["follow_ups"]] == [a["id"]]
