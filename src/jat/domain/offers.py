"""Offers (PRD FR4, P6): what an offer is worth a year, and its place on the timeline."""

from __future__ import annotations

from sqlalchemy.orm import Session

from jat.db.models import Application, Offer

from . import applications as svc

# Working days a year used to compare a day rate with a salary (52 weeks x 5, less about
# 25 days' holiday and 8 bank holidays, rounded).
WORKING_DAYS = 220


def _by_day_rate(offer: Offer) -> bool:
    """A contract goes by its day rate and anything else by its salary, whatever figures are
    left over from before a change of kind; with no kind given, whichever figure there is.
    """
    if offer.employment_type == "contract":
        return True
    if offer.employment_type is None:
        return bool(offer.day_rate) and not offer.salary
    return False


def annual_value(offer: Offer) -> tuple[int | None, str | None]:
    """(value a year, basis): "salary" for salary + bonus + equity + employer pension, "day rate"
    for a day rate x WORKING_DAYS.
    """
    if _by_day_rate(offer):
        return (offer.day_rate * WORKING_DAYS, "day rate") if offer.day_rate else (None, None)
    if offer.salary:
        pension = round(offer.salary * (offer.pension_percent or 0) / 100)
        return offer.salary + (offer.bonus or 0) + (offer.equity_value or 0) + pension, "salary"
    return None, None


def _figure(offer: Offer) -> tuple[str, int | None]:
    """Which figure the headline shows: ("year", salary), ("day", day rate) or ("none", None)."""
    if _by_day_rate(offer):
        return ("day", offer.day_rate) if offer.day_rate else ("none", None)
    return ("year", offer.salary) if offer.salary else ("none", None)


def headline(offer: Offer) -> str:
    """The headline figure for the timeline: "£85,000 a year" or "£650 a day"."""
    per, amount = _figure(offer)
    if amount is None:
        return "no figures yet"
    symbol = {"GBP": "£", "USD": "$", "EUR": "€"}.get((offer.currency or "").upper())
    money = f"{symbol}{amount:,}" if symbol else f"{amount:,} {offer.currency or ''}".strip()
    return f"{money} a {per}"


_MESSAGES: dict[tuple[str, str], svc.EventMsgKey] = {
    ("received", "year"): "event.offerReceivedYear",
    ("received", "day"): "event.offerReceivedDay",
    ("received", "none"): "event.offerReceivedNoFigures",
    ("back under consideration", "year"): "event.offerBackYear",
    ("back under consideration", "day"): "event.offerBackDay",
    ("back under consideration", "none"): "event.offerBackNoFigures",
    ("accepted", "year"): "event.offerAcceptedYear",
    ("accepted", "day"): "event.offerAcceptedDay",
    ("accepted", "none"): "event.offerAcceptedNoFigures",
    ("declined", "year"): "event.offerDeclinedYear",
    ("declined", "day"): "event.offerDeclinedDay",
    ("declined", "none"): "event.offerDeclinedNoFigures",
    ("withdrawn", "year"): "event.offerWithdrawnYear",
    ("withdrawn", "day"): "event.offerWithdrawnDay",
    ("withdrawn", "none"): "event.offerWithdrawnNoFigures",
    ("removed", "year"): "event.offerRemovedYear",
    ("removed", "day"): "event.offerRemovedDay",
    ("removed", "none"): "event.offerRemovedNoFigures",
}

# The largest whole number a browser reads exactly (Number.MAX_SAFE_INTEGER).
_LARGEST_EXACT_IN_BROWSER = 2**53 - 1


def record(session: Session, app: Application, offer: Offer, what: str) -> None:
    """Put an offer change on the application's timeline ("Offer received: £85,000 a year").

    The message saves the amount and currency, and the frontend formats them with `formatMoney`. A
    browser can't read a bigger amount exactly, so its text would differ: that one saves only the English.
    """
    summary = f"Offer {what}: {headline(offer)}"
    data = {"offer_id": offer.id, "status": offer.status}
    per, amount = _figure(offer)
    if amount is not None and amount > _LARGEST_EXACT_IN_BROWSER:
        svc.log_activity(session, app, "manual", summary=summary, data=data)
        return
    params = {} if amount is None else {"amount": amount, "currency": offer.currency}
    svc.log_message(session, app, "manual", key=_MESSAGES[what, per], params=params, summary=summary, data=data)
