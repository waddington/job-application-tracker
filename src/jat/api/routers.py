"""API routes for companies, agencies, contacts, roles, applications and the workflow."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased

from ..db.models import Agency, Application, ApplicationContact, Company, Contact, ContactDetail, Role
from ..domain import applications as svc
from ..domain.workflow import Workflow, WorkflowError
from . import schemas as S
from .crud import crud_router, values
from .deps import SessionDep, WorkflowDep, get_or_404, require

router = APIRouter(prefix="/api/v1")


# --- simple entities -------------------------------------------------------------------------


def _validate_role(session: Session, data: dict) -> None:
    require(session, Company, data.get("company_id"), "company_id")


router.include_router(
    crud_router(
        model=Company,
        schema_in=S.CompanyIn,
        schema_patch=S.CompanyPatch,
        schema_out=S.CompanyOut,
        prefix="/companies",
        tag="companies",
        order_by=func.lower(Company.name),
        search_column=Company.name,
    )
)
router.include_router(
    crud_router(
        model=Agency,
        schema_in=S.AgencyIn,
        schema_patch=S.AgencyPatch,
        schema_out=S.AgencyOut,
        prefix="/agencies",
        tag="agencies",
        order_by=func.lower(Agency.name),
        search_column=Agency.name,
    )
)
router.include_router(
    crud_router(
        model=Role,
        schema_in=S.RoleIn,
        schema_patch=S.RolePatch,
        schema_out=S.RoleOut,
        prefix="/roles",
        tag="roles",
        order_by=func.lower(Role.title),
        search_column=Role.title,
        validate=_validate_role,
    )
)


# --- contacts (with several contact details each) -----------------------------------------------

contacts = APIRouter(prefix="/contacts", tags=["contacts"])


def _contact_out(session: Session, contact: Contact) -> S.ContactOut:
    details = session.scalars(
        select(ContactDetail).where(ContactDetail.contact_id == contact.id).order_by(ContactDetail.position)
    ).all()
    out = S.ContactOut.model_validate(contact)
    out.details = [S.ContactDetailOut.model_validate(d) for d in details]
    return out


def _set_details(session: Session, contact: Contact, details: list[S.ContactDetailIn]) -> None:
    for old in session.scalars(select(ContactDetail).where(ContactDetail.contact_id == contact.id)):
        session.delete(old)
    session.flush()
    for position, d in enumerate(details):
        session.add(ContactDetail(contact_id=contact.id, position=position, **d.model_dump()))


def _validate_contact(session: Session, data: dict) -> None:
    require(session, Agency, data.get("agency_id"), "agency_id")
    require(session, Company, data.get("company_id"), "company_id")


@contacts.get("", response_model=list[S.ContactOut])
def list_contacts(session: SessionDep, q: str | None = None, agency_id: str | None = None):
    stmt = select(Contact)
    if q:
        stmt = stmt.where(func.lower(Contact.name).contains(q.lower()))
    if agency_id:
        stmt = stmt.where(Contact.agency_id == agency_id)
    return [_contact_out(session, c) for c in session.scalars(stmt.order_by(func.lower(Contact.name)))]


@contacts.get("/{contact_id}", response_model=S.ContactOut)
def get_contact(contact_id: str, session: SessionDep):
    return _contact_out(session, get_or_404(session, Contact, contact_id))


@contacts.post("", response_model=S.ContactOut, status_code=201)
def create_contact(body: S.ContactIn, session: SessionDep):
    data = body.model_dump(mode="json", exclude={"details"})
    _validate_contact(session, data)
    contact = Contact(**data)
    session.add(contact)
    session.flush()
    _set_details(session, contact, body.details)
    session.flush()
    return _contact_out(session, contact)


@contacts.patch("/{contact_id}", response_model=S.ContactOut)
def update_contact(contact_id: str, body: S.ContactPatch, session: SessionDep):
    contact = get_or_404(session, Contact, contact_id)
    data = body.model_dump(mode="json", exclude_unset=True, exclude={"details"})
    _validate_contact(session, data)
    for key, value in data.items():
        setattr(contact, key, value)
    if body.details is not None:
        _set_details(session, contact, body.details)
    session.flush()
    return _contact_out(session, contact)


@contacts.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: str, session: SessionDep):
    session.delete(get_or_404(session, Contact, contact_id))
    session.flush()
    return Response(status_code=204)


router.include_router(contacts)


# --- workflow ------------------------------------------------------------------------------------

workflow_router = APIRouter(prefix="/workflow", tags=["workflow"])


@workflow_router.get("")
def get_workflow_config(workflow: WorkflowDep) -> dict:
    return workflow.as_dict()


router.include_router(workflow_router)


# --- applications --------------------------------------------------------------------------------

apps = APIRouter(prefix="/applications", tags=["applications"])
Recruiter = aliased(Contact)


def _stage_info(workflow: Workflow, stage_id: str) -> tuple[str, str, int | None]:
    if workflow.has(stage_id):
        st = workflow.stage(stage_id)
        return st.name, st.kind, st.stale_after_days
    return stage_id, "unknown", None


def _row(
    workflow: Workflow, app: Application, role: Role, company: Company, agency, recruiter, today: date
) -> S.ApplicationRow:
    name, kind, stale_after = _stage_info(workflow, app.stage)
    days = (datetime.now(UTC) - app.last_activity_at).days
    snoozed = app.snoozed_until is not None and app.snoozed_until > today
    stale = kind == "active" and stale_after is not None and days >= stale_after and not snoozed and not app.archived
    base = S.ApplicationOut.model_validate(app).model_dump()
    return S.ApplicationRow(
        **base,
        role_title=role.title,
        company_id=company.id,
        company_name=company.name,
        agency_name=agency.name if agency else None,
        recruiter_name=recruiter.name if recruiter else None,
        stage_name=name,
        stage_kind=kind,
        days_since_activity=max(days, 0),
        stale=stale,
    )


def _rows_query():
    return (
        select(Application, Role, Company, Agency, Recruiter)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
        .outerjoin(Agency, Application.agency_id == Agency.id)
        .outerjoin(Recruiter, Application.recruiter_id == Recruiter.id)
    )


def _load_row(session: Session, workflow: Workflow, app_id: str) -> S.ApplicationRow:
    found = session.execute(_rows_query().where(Application.id == app_id)).first()
    if found is None:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found")
    return _row(workflow, *found, today=date.today())


def _detail(session: Session, workflow: Workflow, app_id: str) -> S.ApplicationDetail:
    row = _load_row(session, workflow, app_id)
    events = [S.EventOut.model_validate(e) for e in svc.history(session, app_id)]
    links = session.scalars(select(ApplicationContact).where(ApplicationContact.application_id == app_id)).all()
    try:
        allowed = workflow.allowed_next(row.stage)
    except WorkflowError:
        allowed = []
    return S.ApplicationDetail(
        **row.model_dump(),
        events=events,
        contacts=[S.ApplicationContactOut.model_validate(link) for link in links],
        allowed_next=allowed,
    )


SortKey = Literal["last_activity", "-last_activity", "created", "-created", "company", "stage"]


@apps.get("", response_model=list[S.ApplicationRow])
def list_applications(
    session: SessionDep,
    workflow: WorkflowDep,
    stage: Annotated[list[str] | None, Query()] = None,
    route: S.Route | None = None,
    agency_id: str | None = None,
    recruiter_id: str | None = None,
    company_id: str | None = None,
    tag: str | None = None,
    archived: bool = False,
    stale: bool | None = None,
    min_inactive_days: int | None = None,
    q: str | None = None,
    sort: SortKey = "-last_activity",
):
    stmt = _rows_query().where(Application.archived == archived)
    if stage:
        stmt = stmt.where(Application.stage.in_(stage))
    if route:
        stmt = stmt.where(Application.route == route)
    if agency_id:
        stmt = stmt.where(Application.agency_id == agency_id)
    if recruiter_id:
        stmt = stmt.where(Application.recruiter_id == recruiter_id)
    if company_id:
        stmt = stmt.where(Company.id == company_id)
    if q:
        like = f"%{q.lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(Role.title).like(like),
                func.lower(Company.name).like(like),
                func.lower(Agency.name).like(like),
                func.lower(Recruiter.name).like(like),
            )
        )
    order = {
        "last_activity": Application.last_activity_at,
        "-last_activity": Application.last_activity_at.desc(),
        "created": Application.created_at,
        "-created": Application.created_at.desc(),
        "company": func.lower(Company.name),
        "stage": Application.stage,
    }[sort]
    today = date.today()
    rows = [_row(workflow, *found, today=today) for found in session.execute(stmt.order_by(order, Application.id))]
    if tag:
        rows = [r for r in rows if tag in r.tags]
    if stale is not None:
        rows = [r for r in rows if r.stale == stale]
    if min_inactive_days is not None:
        rows = [r for r in rows if r.days_since_activity >= min_inactive_days]
    if sort == "stage":
        order_ids = [s.id for s in workflow.stages]
        rows.sort(key=lambda r: order_ids.index(r.stage) if r.stage in order_ids else len(order_ids))
    return rows


def _check_refs(session: Session, data: dict) -> None:
    require(session, Role, data.get("role_id"), "role_id")
    require(session, Agency, data.get("agency_id"), "agency_id")
    require(session, Contact, data.get("recruiter_id"), "recruiter_id")


@apps.post("", response_model=S.ApplicationDetail, status_code=201)
def create_app_(body: S.ApplicationIn, session: SessionDep, workflow: WorkflowDep):
    data = values(body, partial=False)
    _check_refs(session, data)
    if data.get("recruiter_id") and not data.get("agency_id"):
        recruiter = session.get(Contact, data["recruiter_id"])
        data["agency_id"] = recruiter.agency_id if recruiter else None
    stage = data.pop("stage", None)
    try:
        app = svc.create_application(session, workflow, stage=stage, **data)
    except WorkflowError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _detail(session, workflow, app.id)


@apps.get("/{app_id}", response_model=S.ApplicationDetail)
def get_app(app_id: str, session: SessionDep, workflow: WorkflowDep):
    return _detail(session, workflow, app_id)


@apps.patch("/{app_id}", response_model=S.ApplicationDetail)
def update_app(app_id: str, body: S.ApplicationPatch, session: SessionDep, workflow: WorkflowDep):
    app = get_or_404(session, Application, app_id)
    data = values(body, partial=True)
    _check_refs(session, data)
    for key, value in data.items():
        setattr(app, key, value)
    session.flush()
    return _detail(session, workflow, app_id)


@apps.delete("/{app_id}", status_code=204)
def delete_app(app_id: str, session: SessionDep):
    session.delete(get_or_404(session, Application, app_id))
    session.flush()
    return Response(status_code=204)


@apps.post("/{app_id}/move", response_model=S.ApplicationDetail)
def move_app(app_id: str, body: S.MoveIn, session: SessionDep, workflow: WorkflowDep):
    app = get_or_404(session, Application, app_id)
    try:
        svc.move(session, workflow, app, body.to_stage, occurred_at=body.occurred_at, note=body.note)
    except svc.TransitionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _detail(session, workflow, app_id)


@apps.post("/{app_id}/undo", response_model=S.ApplicationDetail)
def undo_app(app_id: str, session: SessionDep, workflow: WorkflowDep):
    app = get_or_404(session, Application, app_id)
    try:
        svc.undo_last_move(session, app)
    except svc.TransitionError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _detail(session, workflow, app_id)


@apps.get("/{app_id}/events", response_model=list[S.EventOut])
def app_events(app_id: str, session: SessionDep):
    get_or_404(session, Application, app_id)
    return svc.history(session, app_id)


@apps.post("/{app_id}/activities", response_model=S.EventOut, status_code=201)
def add_activity(app_id: str, body: S.ActivityIn, session: SessionDep):
    app = get_or_404(session, Application, app_id)
    return svc.log_activity(session, app, body.kind, summary=body.summary, occurred_at=body.occurred_at, data=body.data)


@apps.post("/{app_id}/contacts", response_model=S.ApplicationContactOut, status_code=201)
def link_contact(app_id: str, body: S.ApplicationContactIn, session: SessionDep):
    get_or_404(session, Application, app_id)
    require(session, Contact, body.contact_id, "contact_id")
    link = ApplicationContact(application_id=app_id, contact_id=body.contact_id, relation=body.relation)
    session.add(link)
    session.flush()
    return link


@apps.delete("/{app_id}/contacts/{link_id}", status_code=204)
def unlink_contact(app_id: str, link_id: str, session: SessionDep):
    link = get_or_404(session, ApplicationContact, link_id)
    if link.application_id != app_id:
        raise HTTPException(status_code=404, detail="link not found on this application")
    session.delete(link)
    session.flush()
    return Response(status_code=204)


router.include_router(apps)
