"""Roles before you apply: ones a recruiter pitched or you spotted, still to decide, applied for
or passed on. (The role CRUD itself is in routers.py.)"""

from __future__ import annotations

from collections import defaultdict

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db.models import Agency, Application, Company, Contact, Meeting, Role
from ..domain.insights import before_applied, role_progress, stage_paths
from ..domain.workflow import Workflow
from . import schemas as S
from .deps import SessionDep, WorkflowDep
from .meetings import label as meeting_label

router = APIRouter(tags=["roles"])


def summaries(session: Session, *where, workflow: Workflow | None = None) -> list[S.RoleSummary]:
    rows = session.execute(
        select(Role, Company.name, Contact, Agency)
        .join(Company, Role.company_id == Company.id)
        .outerjoin(Contact, Role.contact_id == Contact.id)
        .outerjoin(Agency, Contact.agency_id == Agency.id)
        .where(*where)
    ).all()
    role_ids = [r.id for r, *_ in rows]
    apps: dict[str, list[str]] = defaultdict(list)
    stages: dict[str, list[str]] = defaultdict(list)
    dated: set[str] = set()  # applications with an applied date
    if role_ids:
        for app_id, role_id, stage, applied_on in session.execute(
            select(Application.id, Application.role_id, Application.stage, Application.applied_on)
            .where(Application.role_id.in_(role_ids))
            .order_by(Application.created_at)
        ):
            apps[role_id].append(app_id)
            stages[role_id].append(stage)
            if applied_on is not None:
                dated.add(app_id)
    meeting_ids = {r.meeting_id for r, *_ in rows if r.meeting_id}
    meetings = {}
    if meeting_ids:
        for m, name in session.execute(
            select(Meeting, Contact.name)
            .join(Contact, Meeting.contact_id == Contact.id)
            .where(Meeting.id.in_(meeting_ids))
        ):
            meetings[m.id] = {
                "meeting_label": meeting_label(m, name),
                "meeting_kind": m.kind,
                "meeting_title": m.title,
                "meeting_contact_name": name,
            }

    names = {st.id: st.name for st in workflow.stages} if workflow is not None else {}
    kinds = {st.id: st.kind for st in workflow.stages} if workflow is not None else {}
    # Stage history only matters for roles that might not have been applied for: every
    # application closed or still before Applied.
    maybe = [
        i
        for rid, ids in apps.items()
        if workflow is not None and all(kinds.get(st) == "closed" or before_applied(workflow, st) for st in stages[rid])
        for i in ids
    ]
    paths = stage_paths(session, maybe) if maybe else {}

    out = []
    for role, company_name, contact, agency in rows:
        closed_as = closed_stage = None
        if apps[role.id]:
            status = (
                role_progress(
                    workflow,
                    [(st, paths.get(i, []), i in dated) for i, st in zip(apps[role.id], stages[role.id], strict=True)],
                )
                if workflow is not None
                else "applied"
            )
            if status == "closed":
                # The latest application's stage (the one the role links to).
                closed_stage = stages[role.id][-1]
                closed_as = names.get(closed_stage, closed_stage)
        else:
            status = "passed" if role.decision == "passed" else "to_decide"
        out.append(
            S.RoleSummary(
                **S.RoleOut.model_validate(role).model_dump(),
                company_name=company_name,
                status=status,
                closed_as=closed_as,
                closed_stage=closed_stage,
                application_ids=apps[role.id],
                contact_name=contact.name if contact else None,
                agency_id=agency.id if agency else None,
                agency_name=agency.name if agency else None,
                **meetings.get(role.meeting_id or "", {}),
            )
        )
    return out


@router.get("/role-summaries", response_model=list[S.RoleSummary])
def role_summaries(
    session: SessionDep,
    workflow: WorkflowDep,
    status: S.RoleStatus | None = None,
    company_id: str | None = None,
    contact_id: str | None = None,
    meeting_id: str | None = None,
):
    """Roles with where they came from and where they stand, oldest first.

    `status`: `to_decide` (no application and not passed), `interested` (it has applications,
    all still before Applied), `closed` (all closed before any got to Applied: withdrawn while
    only interested, say), `applied` (an application got to Applied or further) or `passed`.
    Filter by company, by who told you about it, or by the call it came up in.
    """
    where = []
    if company_id:
        where.append(Role.company_id == company_id)
    if contact_id:
        where.append(Role.contact_id == contact_id)
    if meeting_id:
        where.append(Role.meeting_id == meeting_id)
    found = summaries(session, *where, workflow=workflow)
    found.sort(key=lambda r: (r.created_at, r.id))  # ids are time-ordered (UUIDv7): creation order
    return [r for r in found if status is None or r.status == status]


@router.get("/role-summaries/{role_id}", response_model=S.RoleSummary)
def role_summary(role_id: str, session: SessionDep, workflow: WorkflowDep):
    """One role with where it came from and where it stands, for its page."""
    found = summaries(session, Role.id == role_id, workflow=workflow)
    if not found:
        raise HTTPException(404, f"Role {role_id} not found")
    return found[0]


def to_decide(session: Session) -> list[S.RoleSummary]:
    """For Next actions: roles with no application that you haven't passed on, oldest first."""
    has_app = select(func.count()).select_from(Application).where(Application.role_id == Role.id).scalar_subquery()
    found = summaries(session, Role.decision.is_(None), has_app == 0)
    found.sort(key=lambda r: (r.created_at, r.id))
    return found
