"""API routes for offers (PRD FR4, P6): record them, compare them side by side."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Application, Company, Offer, Role
from ..domain import offers as svc
from . import schemas as S
from .crud import values
from .deps import SessionDep, get_or_404

router = APIRouter(tags=["offers"])


def _query():
    return (
        select(Offer, Role.title, Company.name, Application.stage)
        .join(Application, Offer.application_id == Application.id)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
    )


def _outs(found) -> list[S.OfferOut]:
    outs = []
    for offer, role_title, company_name, stage in found:
        value, basis = svc.annual_value(offer)
        outs.append(
            S.OfferOut(
                **{f: getattr(offer, f) for f in S.OfferOut.model_fields if hasattr(Offer, f)},
                annual_value=value,
                value_basis=basis,
                company_name=company_name,
                role_title=role_title,
                stage=stage,
            )
        )
    return outs


def _out(session: Session, offer_id: str) -> S.OfferOut:
    found = session.execute(_query().where(Offer.id == offer_id)).all()
    if not found:
        raise HTTPException(status_code=404, detail=f"Offer {offer_id} not found")
    return _outs(found)[0]


@router.get("/offers", response_model=list[S.OfferOut])
def list_offers(
    session: SessionDep,
    application_id: str | None = None,
    status: S.OfferStatus | None = None,
    latest: bool = True,
):
    """Offers, newest first. With `latest` (the default), only each application's newest offer:
    a revised offer replaces the one before it for comparing.
    """
    stmt = _query()
    if application_id:
        stmt = stmt.where(Offer.application_id == application_id)
    found = session.execute(stmt.order_by(Offer.created_at.desc(), Offer.id.desc())).all()
    if latest:
        seen: set[str] = set()
        newest = []
        for row in found:
            if row[0].application_id not in seen:
                seen.add(row[0].application_id)
                newest.append(row)
        found = newest
    if status:
        found = [row for row in found if row[0].status == status]
    return _outs(found)


@router.post("/applications/{app_id}/offers", response_model=S.OfferOut, status_code=201)
def create_offer(app_id: str, body: S.OfferIn, session: SessionDep):
    app = get_or_404(session, Application, app_id)
    offer = Offer(application_id=app_id, **values(body, partial=False))
    if offer.currency:
        offer.currency = offer.currency.upper()
    session.add(offer)
    session.flush()
    svc.record(session, app, offer, "received" if offer.status == "pending" else offer.status)
    return _out(session, offer.id)


@router.get("/offers/{offer_id}", response_model=S.OfferOut)
def get_offer(offer_id: str, session: SessionDep):
    return _out(session, offer_id)


@router.patch("/offers/{offer_id}", response_model=S.OfferOut)
def update_offer(offer_id: str, body: S.OfferPatch, session: SessionDep):
    offer = get_or_404(session, Offer, offer_id)
    before = offer.status
    for key, value in values(body, partial=True).items():
        setattr(offer, key, value.upper() if key == "currency" and value else value)
    session.flush()
    if offer.status != before:
        what = {"pending": "back under consideration"}.get(offer.status, offer.status)
        svc.record(session, session.get(Application, offer.application_id), offer, what)
    return _out(session, offer.id)


@router.delete("/offers/{offer_id}", status_code=204)
def delete_offer(offer_id: str, session: SessionDep):
    offer = get_or_404(session, Offer, offer_id)
    svc.record(session, session.get(Application, offer.application_id), offer, "removed")
    session.delete(offer)
    session.flush()
    return Response(status_code=204)
