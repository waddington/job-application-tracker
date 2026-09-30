"""API routes for interview rounds and coding tasks (PRD FR9, FR9a, FR10)."""

from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from ..db.models import Application, Company, Contact, Interview, InterviewContact, Role
from ..domain import interviews as svc
from . import schemas as S
from .crud import values
from .deps import SessionDep, get_or_404

router = APIRouter(tags=["interviews"])

_WHEN = func.coalesce(Interview.starts_at, Interview.deadline_at, Interview.created_at)


def _query():
    return (
        select(Interview, Role.title, Company.name)
        .join(Application, Interview.application_id == Application.id)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
    )


def _outs(session: Session, found) -> list[S.InterviewOut]:
    found = list(found)
    ids = [interview.id for interview, _, _ in found]
    people: dict[str, list[str]] = {}
    if ids:
        links = session.execute(
            select(InterviewContact.interview_id, InterviewContact.contact_id)
            .where(InterviewContact.interview_id.in_(ids))
            .order_by(InterviewContact.id)
        )
        for interview_id, contact_id in links:
            people.setdefault(interview_id, []).append(contact_id)
    return [
        S.InterviewOut(
            **{f: getattr(interview, f) for f in S.InterviewOut.model_fields if hasattr(Interview, f)},
            label=svc.label(interview),
            interviewer_ids=people.get(interview.id, []),
            role_title=role_title,
            company_name=company_name,
        )
        for interview, role_title, company_name in found
    ]


def _out(session: Session, interview_id: str) -> S.InterviewOut:
    found = session.execute(_query().where(Interview.id == interview_id)).all()
    if not found:
        raise HTTPException(status_code=404, detail=f"Interview {interview_id} not found")
    return _outs(session, found)[0]


def _set_interviewers(session: Session, interview: Interview, contact_ids: list[str]) -> None:
    unique = list(dict.fromkeys(contact_ids))
    known = set(session.scalars(select(Contact.id).where(Contact.id.in_(unique)))) if unique else set()
    missing = [c for c in unique if c not in known]
    if missing:
        raise HTTPException(status_code=422, detail=f"interviewer_ids: Contact {missing[0]} not found")
    session.execute(delete(InterviewContact).where(InterviewContact.interview_id == interview.id))
    session.add_all(InterviewContact(interview_id=interview.id, contact_id=c) for c in unique)


@router.get("/interviews", response_model=list[S.InterviewOut])
def list_interviews(
    session: SessionDep,
    application_id: str | None = None,
    status: S.InterviewStatus | None = None,
    upcoming: bool = False,
):
    """Interviews, soonest first. `upcoming` keeps scheduled ones from today on (or with no date yet)."""
    stmt = _query()
    if application_id:
        stmt = stmt.where(Interview.application_id == application_id)
    if status:
        stmt = stmt.where(Interview.status == status)
    if upcoming:
        start_of_today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        stmt = stmt.where(
            Interview.status == "scheduled",
            (Interview.starts_at.is_(None) & Interview.deadline_at.is_(None))
            | (func.coalesce(Interview.starts_at, Interview.deadline_at) >= start_of_today),
        )
    return _outs(session, session.execute(stmt.order_by(_WHEN, Interview.round, Interview.id)))


@router.get("/interviews/titles", response_model=list[str])
def interview_titles(session: SessionDep):
    """Round descriptions used before, most used first: suggestions for the next one."""
    stmt = (
        select(Interview.title)
        .where(Interview.title.is_not(None), Interview.title != "")
        .group_by(Interview.title)
        .order_by(func.count().desc(), func.max(Interview.created_at).desc())
        .limit(50)
    )
    return list(session.scalars(stmt))


@router.post("/applications/{app_id}/interviews", response_model=S.InterviewOut, status_code=201)
def create_interview(app_id: str, body: S.InterviewIn, session: SessionDep):
    app = get_or_404(session, Application, app_id)
    data = values(body, partial=False)
    interviewer_ids = data.pop("interviewer_ids")
    if data["round"] is None:
        data["round"] = svc.next_round(session, app_id)
    interview = Interview(application_id=app_id, **data)
    session.add(interview)
    session.flush()
    _set_interviewers(session, interview, interviewer_ids)
    svc.record(
        session, app, interview, {"scheduled": "scheduled", "done": "added", "cancelled": "cancelled"}[interview.status]
    )
    return _out(session, interview.id)


@router.get("/interviews/{interview_id}", response_model=S.InterviewOut)
def get_interview(interview_id: str, session: SessionDep):
    return _out(session, interview_id)


@router.patch("/interviews/{interview_id}", response_model=S.InterviewOut)
def update_interview(interview_id: str, body: S.InterviewPatch, session: SessionDep):
    interview = get_or_404(session, Interview, interview_id)
    data = values(body, partial=True)
    interviewer_ids = data.pop("interviewer_ids", None)
    before = (interview.status, interview.starts_at)
    for key, value in data.items():
        setattr(interview, key, value)
    session.flush()
    if interviewer_ids is not None:
        _set_interviewers(session, interview, interviewer_ids)
    app = session.get(Application, interview.application_id)
    if interview.status != before[0]:
        svc.record(
            session,
            app,
            interview,
            {"scheduled": "back on", "done": "done", "cancelled": "cancelled"}[interview.status],
        )
    elif interview.status == "scheduled" and interview.starts_at != before[1] and before[1] is not None:
        svc.record(session, app, interview, "rescheduled")
    return _out(session, interview.id)


@router.delete("/interviews/{interview_id}", status_code=204)
def delete_interview(interview_id: str, session: SessionDep):
    session.delete(get_or_404(session, Interview, interview_id))
    session.flush()
    return Response(status_code=204)
