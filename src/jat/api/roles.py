"""Roles before you apply: ones a recruiter pitched or you spotted, still to decide, applied for
or passed on. (The role CRUD itself is in routers.py.)"""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db.models import Agency, Application, Company, Contact, Meeting, Role
from . import schemas as S
from .deps import SessionDep
from .meetings import label as meeting_label

router = APIRouter(tags=["roles"])


def summaries(session: Session, *where) -> list[S.RoleSummary]:
    rows = session.execute(
        select(Role, Company.name, Contact, Agency)
        .join(Company, Role.company_id == Company.id)
        .outerjoin(Contact, Role.contact_id == Contact.id)
        .outerjoin(Agency, Contact.agency_id == Agency.id)
        .where(*where)
    ).all()
    role_ids = [r.id for r, *_ in rows]
    apps: dict[str, list[str]] = defaultdict(list)
    if role_ids:
        for app_id, role_id in session.execute(
            select(Application.id, Application.role_id)
            .where(Application.role_id.in_(role_ids))
            .order_by(Application.created_at)
        ):
            apps[role_id].append(app_id)
    meeting_ids = {r.meeting_id for r, *_ in rows if r.meeting_id}
    meetings = {}
    if meeting_ids:
        for m, name in session.execute(
            select(Meeting, Contact.name)
            .join(Contact, Meeting.contact_id == Contact.id)
            .where(Meeting.id.in_(meeting_ids))
        ):
            meetings[m.id] = meeting_label(m, name)
    out = []
    for role, company_name, contact, agency in rows:
        status = "applied" if apps[role.id] else ("passed" if role.decision == "passed" else "to_decide")
        out.append(
            S.RoleSummary(
                **S.RoleOut.model_validate(role).model_dump(),
                company_name=company_name,
                status=status,
                application_ids=apps[role.id],
                contact_name=contact.name if contact else None,
                agency_id=agency.id if agency else None,
                agency_name=agency.name if agency else None,
                meeting_label=meetings.get(role.meeting_id or ""),
            )
        )
    return out


@router.get("/role-summaries", response_model=list[S.RoleSummary])
def role_summaries(
    session: SessionDep,
    status: S.RoleStatus | None = None,
    company_id: str | None = None,
    contact_id: str | None = None,
    meeting_id: str | None = None,
):
    """Roles with where they came from and where they stand, oldest first.

    `status`: `to_decide` (no application and not passed), `applied` (has an application) or
    `passed`. Filter by company, by who told you about it, or by the call it came up in.
    """
    where = []
    if company_id:
        where.append(Role.company_id == company_id)
    if contact_id:
        where.append(Role.contact_id == contact_id)
    if meeting_id:
        where.append(Role.meeting_id == meeting_id)
    found = summaries(session, *where)
    found.sort(key=lambda r: (r.created_at, r.id))  # ids are time-ordered (UUIDv7): creation order
    return [r for r in found if status is None or r.status == status]


@router.get("/role-summaries/{role_id}", response_model=S.RoleSummary)
def role_summary(role_id: str, session: SessionDep):
    """One role with where it came from and where it stands, for its page."""
    found = summaries(session, Role.id == role_id)
    if not found:
        raise HTTPException(404, f"Role {role_id} not found")
    return found[0]


def to_decide(session: Session) -> list[S.RoleSummary]:
    """For Next actions: roles with no application that you haven't passed on, oldest first."""
    has_app = select(func.count()).select_from(Application).where(Application.role_id == Role.id).scalar_subquery()
    found = summaries(session, Role.decision.is_(None), has_app == 0)
    found.sort(key=lambda r: (r.created_at, r.id))
    return found
