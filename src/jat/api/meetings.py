"""Calls and meetings with people, booked or had, outside any one application."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response
from pydantic import AwareDatetime
from sqlalchemy import select
from sqlalchemy.orm import Session, aliased

from ..db.models import Agency, Application, Company, Contact, Meeting, Role
from . import schemas as S
from .crud import values
from .deps import SessionDep, get_or_404, require

router = APIRouter(tags=["meetings"])

KIND_NAMES = {"call": "Call", "video": "Video call", "in_person": "Meeting"}

AppCompany = aliased(Company)


def label(meeting: Meeting, contact_name: str) -> str:
    """ "Call with Alex Morgan: market catch-up"."""
    what = f"{KIND_NAMES.get(meeting.kind, meeting.kind)} with {contact_name}"
    return f"{what}: {meeting.title}" if meeting.title else what


def query():
    return (
        select(Meeting, Contact, Agency, Company, Role.title, AppCompany.name)
        .join(Contact, Meeting.contact_id == Contact.id)
        .outerjoin(Agency, Contact.agency_id == Agency.id)
        .outerjoin(Company, Contact.company_id == Company.id)
        .outerjoin(Application, Meeting.application_id == Application.id)
        .outerjoin(Role, Application.role_id == Role.id)
        .outerjoin(AppCompany, Role.company_id == AppCompany.id)
    )


def outs(found) -> list[S.MeetingOut]:
    return [
        S.MeetingOut(
            **{f: getattr(m, f) for f in S.MeetingOut.model_fields if hasattr(Meeting, f)},
            label=label(m, contact.name),
            contact_name=contact.name,
            agency_id=agency.id if agency else None,
            agency_name=agency.name if agency else None,
            company_id=company.id if company else None,
            company_name=company.name if company else None,
            role_title=role_title,
            application_company_name=app_company,
        )
        for m, contact, agency, company, role_title, app_company in found
    ]


def _out(session: Session, meeting_id: str) -> S.MeetingOut:
    found = session.execute(query().where(Meeting.id == meeting_id)).all()
    if not found:
        raise HTTPException(status_code=404, detail=f"Meeting {meeting_id} not found")
    return outs(found)[0]


def _check(session: Session, data: dict) -> None:
    if data.get("contact_id") is not None:
        require(session, Contact, data["contact_id"], "contact_id")
    if data.get("application_id") is not None:
        require(session, Application, data["application_id"], "application_id")
    starts, ends = data.get("starts_at"), data.get("ends_at")
    if starts and ends and ends < starts:
        raise HTTPException(status_code=422, detail="ends_at: can't be before starts_at")


@router.get("/meetings", response_model=list[S.MeetingOut])
def list_meetings(
    session: SessionDep,
    contact_id: str | None = None,
    agency_id: str | None = None,
    company_id: str | None = None,
    application_id: str | None = None,
    status: S.InterviewStatus | None = None,
    upcoming: bool = False,
    since: AwareDatetime | None = None,
):
    """Calls and meetings, soonest first. `upcoming` keeps scheduled ones from `since` on (the
    start of your local day; defaults to the start of today in UTC). `agency_id` and
    `company_id` match the person's agency or company."""
    stmt = query()
    if contact_id:
        stmt = stmt.where(Meeting.contact_id == contact_id)
    if agency_id:
        stmt = stmt.where(Contact.agency_id == agency_id)
    if company_id:
        stmt = stmt.where(Contact.company_id == company_id)
    if application_id:
        stmt = stmt.where(Meeting.application_id == application_id)
    if status:
        stmt = stmt.where(Meeting.status == status)
    if upcoming:
        start = since or datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = stmt.where(Meeting.status == "scheduled", Meeting.starts_at >= start.astimezone(UTC))
    return outs(session.execute(stmt.order_by(Meeting.starts_at, Meeting.id)))


@router.post("/meetings", response_model=S.MeetingOut, status_code=201)
def create_meeting(body: S.MeetingIn, session: SessionDep):
    data = values(body, partial=False)
    _check(session, data)
    meeting = Meeting(**data)
    session.add(meeting)
    session.flush()
    return _out(session, meeting.id)


@router.get("/meetings/{meeting_id}", response_model=S.MeetingOut)
def get_meeting(meeting_id: str, session: SessionDep):
    return _out(session, meeting_id)


@router.patch("/meetings/{meeting_id}", response_model=S.MeetingOut)
def update_meeting(meeting_id: str, body: S.MeetingPatch, session: SessionDep):
    meeting = get_or_404(session, Meeting, meeting_id)
    data = values(body, partial=True)
    merged = {"starts_at": meeting.starts_at, "ends_at": meeting.ends_at, **data}
    _check(session, merged)
    for field, value in data.items():
        setattr(meeting, field, value)
    session.flush()
    return _out(session, meeting.id)


@router.delete("/meetings/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: str, session: SessionDep):
    session.delete(get_or_404(session, Meeting, meeting_id))
    return Response(status_code=204)
