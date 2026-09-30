"""Offers (PRD FR4, P6): what an offer is worth a year, and its place on the timeline."""

from __future__ import annotations

from sqlalchemy.orm import Session

from jat.db.models import Application, Offer

from . import applications as svc

# Working days a year used to compare a day rate with a salary (52 weeks x 5, less about
# 25 days' holiday and 8 bank holidays, rounded).
WORKING_DAYS = 220


def annual_value(offer: Offer) -> tuple[int | None, str | None]:
    """(value a year, basis): "salary" for salary + bonus + equity + employer pension, "day rate"
    for a day rate x WORKING_DAYS. A contract offer with a day rate goes by the day rate.
    """
    if offer.day_rate and (offer.employment_type == "contract" or not offer.salary):
        return offer.day_rate * WORKING_DAYS, "day rate"
    if offer.salary:
        pension = round(offer.salary * (offer.pension_percent or 0) / 100)
        return offer.salary + (offer.bonus or 0) + (offer.equity_value or 0) + pension, "salary"
    return None, None


def headline(offer: Offer) -> str:
    """The headline figure for the timeline: "£85,000 a year" or "£650 a day"."""
    symbol = {"GBP": "£", "USD": "$", "EUR": "€"}.get((offer.currency or "").upper())
    money = (lambda n: f"{symbol}{n:,}") if symbol else (lambda n: f"{n:,} {offer.currency or ''}".strip())
    if offer.day_rate and (offer.employment_type == "contract" or not offer.salary):
        return f"{money(offer.day_rate)} a day"
    if offer.salary:
        return f"{money(offer.salary)} a year"
    return "no figures yet"


def record(session: Session, app: Application, offer: Offer, what: str) -> None:
    """Put an offer change on the application's timeline ("Offer received: £85,000 a year")."""
    svc.log_activity(
        session,
        app,
        "manual",
        summary=f"Offer {what}: {headline(offer)}",
        data={"offer_id": offer.id, "status": offer.status},
    )
