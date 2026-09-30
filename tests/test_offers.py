from datetime import date, timedelta

from jat.db.models import Offer
from jat.domain.offers import WORKING_DAYS, annual_value, headline

from .factories import post


def test_annual_value():
    perm = Offer(salary=80_000, bonus=8_000, equity_value=5_000, pension_percent=5, currency="GBP")
    assert annual_value(perm) == (80_000 + 8_000 + 5_000 + 4_000, "salary")
    assert headline(perm) == "£80,000 a year"
    contract = Offer(employment_type="contract", day_rate=650, currency="GBP")
    assert annual_value(contract) == (650 * WORKING_DAYS, "day rate")
    assert headline(contract) == "£650 a day"
    assert annual_value(Offer()) == (None, None)
    assert headline(Offer(salary=90_000, currency="CHF")) == "90,000 CHF a year"


def _app(client, seeded, stage="offer"):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "stage": stage})


def test_offer_crud_and_timeline(client, seeded):
    app = _app(client, seeded)
    offer = post(
        client,
        f"/api/v1/applications/{app['id']}/offers",
        {"salary": 85_000, "currency": "gbp", "pension_percent": 6, "holiday_days": 27},
    )
    assert (offer["status"], offer["currency"], offer["annual_value"], offer["value_basis"]) == (
        "pending",
        "GBP",
        85_000 + 5_100,
        "salary",
    )
    assert (offer["company_name"], offer["role_title"], offer["stage"]) == (
        "Contoso",
        "Senior Backend Engineer",
        "offer",
    )

    r = client.patch(f"/api/v1/offers/{offer['id']}", json={"status": "accepted", "bonus": 5_000})
    assert r.status_code == 200, r.text
    assert (r.json()["status"], r.json()["annual_value"]) == ("accepted", 85_000 + 5_000 + 5_100)
    assert client.patch(f"/api/v1/offers/{offer['id']}", json={"status": None}).status_code == 422
    assert client.post(f"/api/v1/applications/{app['id']}/offers", json={"salary": -1}).status_code == 422

    events = client.get(f"/api/v1/applications/{app['id']}").json()["events"]
    summaries = [e["summary"] for e in events if e["kind"] == "manual"]
    assert summaries == ["Offer received: £85,000 a year", "Offer accepted: £85,000 a year"]

    assert client.delete(f"/api/v1/offers/{offer['id']}").status_code == 204
    assert client.get(f"/api/v1/offers/{offer['id']}").status_code == 404
    assert client.post("/api/v1/applications/nope/offers", json={}).status_code == 404


def test_list_offers_newest_per_application(client, seeded):
    a, b = _app(client, seeded), _app(client, seeded)
    post(client, f"/api/v1/applications/{a['id']}/offers", {"salary": 80_000, "currency": "GBP"})
    revised = post(client, f"/api/v1/applications/{a['id']}/offers", {"salary": 88_000, "currency": "GBP"})
    other = post(
        client,
        f"/api/v1/applications/{b['id']}/offers",
        {"employment_type": "contract", "day_rate": 600, "currency": "GBP", "status": "declined"},
    )
    offers = client.get("/api/v1/offers").json()
    assert [o["id"] for o in offers] == [other["id"], revised["id"]]
    assert len(client.get("/api/v1/offers", params={"latest": False}).json()) == 3
    assert [o["id"] for o in client.get("/api/v1/offers", params={"status": "pending"}).json()] == [revised["id"]]
    assert [o["id"] for o in client.get("/api/v1/offers", params={"application_id": b["id"]}).json()] == [other["id"]]


def test_offer_deadlines_in_next_actions(client, seeded):
    today = date(2026, 10, 1)
    soon, later, done = _app(client, seeded), _app(client, seeded), _app(client, seeded)
    post(client, f"/api/v1/applications/{soon['id']}/offers", {"respond_by": str(today + timedelta(days=3))})
    post(client, f"/api/v1/applications/{later['id']}/offers", {"respond_by": str(today + timedelta(days=30))})
    post(
        client,
        f"/api/v1/applications/{done['id']}/offers",
        {"respond_by": str(today), "status": "declined"},
    )
    out = client.get("/api/v1/next-actions", params={"today": str(today)}).json()
    assert [o["application_id"] for o in out["offer_deadlines"]] == [soon["id"]]
