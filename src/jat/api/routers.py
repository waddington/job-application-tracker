"""API routes for companies, agencies, contacts, roles, applications and the workflow."""

from __future__ import annotations

from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, aliased

from ..db.models import (
    Agency,
    Application,
    ApplicationContact,
    Company,
    Contact,
    ContactDetail,
    Interview,
    InterviewContact,
    Meeting,
    Role,
)
from ..domain import applications as svc
from ..domain import duplicates as dup
from ..domain import interviews as interviews_svc
from ..domain.workflow import Workflow, WorkflowError
from . import schemas as S
from .crud import crud_router, values
from .deps import SessionDep, WorkflowDep, get_or_404, require
from .documents import sent_documents

router = APIRouter(prefix="/api/v1")


# --- simple entities -------------------------------------------------------------------------


def _validate_role(session: Session, data: dict) -> None:
    require(session, Company, data.get("company_id"), "company_id")
    require(session, Contact, data.get("contact_id"), "contact_id")
    require(session, Meeting, data.get("meeting_id"), "meeting_id")
    if "decision" in data:  # passing on it, or changing your mind
        data["decided_on"] = date.today() if data["decision"] else None
        if not data["decision"]:
            data["decision_reason"] = None


def _count_applications(session: Session, *where) -> int:
    return session.scalar(select(func.count()).select_from(Application).join(Role).where(*where)) or 0


def _still_used(name: str, n: int) -> str:
    if n == 1:
        return f"{name} has an application. Delete it first, or archive it instead."
    return f"{name} has {n} applications. Delete them first, or archive them instead."


def _before_company_delete(session: Session, company: Company) -> None:
    """A company with applications can't go (delete or move those first); its roles go with it."""
    n = _count_applications(session, Role.company_id == company.id)
    if n:
        raise HTTPException(409, _still_used(company.name, n))
    for role in session.scalars(select(Role).where(Role.company_id == company.id)):
        session.delete(role)
    session.flush()  # roles first: the ORM doesn't know companies own roles, so it can't order them


def _before_role_delete(session: Session, role: Role) -> None:
    n = _count_applications(session, Application.role_id == role.id)
    if n:
        raise HTTPException(409, _still_used(role.title, n))


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
        before_delete=_before_company_delete,
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
        before_delete=_before_role_delete,
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
        stmt = stmt.where(func.lower(Contact.name).contains(q.lower(), autoescape=True))
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
    if "awaiting_reply_since" in data:
        data["awaiting_reply_since"] = body.awaiting_reply_since  # a date, not its JSON string
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
    # A follow-up planned for later counts as a snooze: you've decided when to chase it.
    snoozed = snoozed or (app.follow_up_on is not None and app.follow_up_on > today)
    # Waiting to hear back is listed on its own in Next actions, not as gone quiet.
    stale = (
        kind == "active"
        and stale_after is not None
        and days >= stale_after
        and not snoozed
        and not app.archived
        and app.awaiting_reply_since is None
    )
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


def _round_summary(interview: Interview) -> S.RoundSummary:
    return S.RoundSummary(
        id=interview.id,
        round=interview.round,
        title=interview.title,
        kind=interview.kind,
        status=interview.status,
        label=interviews_svc.label(interview),
        starts_at=interview.starts_at,
        deadline_at=interview.deadline_at,
    )


def _with_rounds(session: Session, rows: list[S.ApplicationRow]) -> list[S.ApplicationRow]:
    """Fill in each row's current interview round (one query for all rows).

    An application with a round booked in the future isn't stale: you're waiting on a date,
    not on them. (One with an undated round still counts, so it doesn't hide forever.)
    """
    current = interviews_svc.current_rounds(session, (r.id for r in rows))
    booked = interviews_svc.booked_ahead(session, (r.id for r in rows), datetime.now(UTC))
    for r in rows:
        if (interview := current.get(r.id)) is not None:
            r.current_round = _round_summary(interview)
        if r.id in booked:  # any round still to come, even if an earlier one is awaiting an outcome
            r.stale = False
    return rows


def _load_row(session: Session, workflow: Workflow, app_id: str) -> S.ApplicationRow:
    found = session.execute(_rows_query().where(Application.id == app_id)).first()
    if found is None:
        raise HTTPException(status_code=404, detail=f"Application {app_id} not found")
    return _with_rounds(session, [_row(workflow, *found, today=date.today())])[0]


def _duplicates(
    session: Session, workflow: Workflow, company_ids: list[str], role_title: str, exclude: str | None = None
) -> list[S.DuplicateOut]:
    """Applications (archived too) at these companies whose role looks like `role_title`."""
    if not company_ids:
        return []
    stmt = _rows_query().where(Company.id.in_(company_ids))
    if exclude:
        stmt = stmt.where(Application.id != exclude)
    today = date.today()
    out = []
    for found in session.execute(stmt.order_by(Application.created_at, Application.id)):
        match = dup.title_match(role_title, found[1].title)  # (Application, Role, …)
        if match:
            out.append(S.DuplicateOut(**_row(workflow, *found, today=today).model_dump(), match=match))
    return out


def _detail(session: Session, workflow: Workflow, app_id: str) -> S.ApplicationDetail:
    row = _load_row(session, workflow, app_id)
    events = [S.EventOut.model_validate(e) for e in svc.history(session, app_id)]
    links = session.scalars(select(ApplicationContact).where(ApplicationContact.application_id == app_id)).all()
    try:
        allowed = workflow.allowed_next(row.stage)
        suggested = workflow.suggested_next(row.stage)
    except WorkflowError:  # a stage since removed from config.toml
        allowed = [s.id for s in workflow.stages] if workflow.transitions == "any" else []
        suggested = []
    return S.ApplicationDetail(
        **row.model_dump(),
        events=events,
        contacts=[S.ApplicationContactOut.model_validate(link) for link in links],
        allowed_next=allowed,
        suggested_next=suggested,
        can_undo=svc.can_undo(session, session.get(Application, app_id)),
        duplicates=_duplicates(session, workflow, [row.company_id], row.role_title, exclude=app_id),
        documents=sent_documents(session, app_id),
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
        like = f"%{_escape_like(q.lower())}%"
        stmt = stmt.where(
            or_(
                func.lower(Role.title).like(like, escape="\\"),
                func.lower(Company.name).like(like, escape="\\"),
                func.lower(Agency.name).like(like, escape="\\"),
                func.lower(Recruiter.name).like(like, escape="\\"),
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
    rows = _with_rounds(session, rows)  # before filtering: a booked interview means it isn't stale
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


def _check_route(session: Session, merged: dict) -> dict:
    """Validate route/agency/recruiter together (after merging a PATCH into the current values).

    - direct: no agency. A recruiter is allowed if they're in-house (not from an agency):
      someone at the company who reached out.
    - agency: an agency or a recruiter; a missing agency is taken from the recruiter.
    - a recruiter who belongs to an agency must match the application's agency.
    Returns the values to set (possibly with agency_id filled in).
    """
    route, agency_id, recruiter_id = merged.get("route"), merged.get("agency_id"), merged.get("recruiter_id")
    recruiter = session.get(Contact, recruiter_id) if recruiter_id else None
    updates: dict = {}
    if route == "direct" and agency_id:
        raise HTTPException(422, "A direct application can't have an agency; change the route first.")
    if route == "direct" and recruiter is not None and recruiter.agency_id:
        raise HTTPException(
            422, f"{recruiter.name} works for an agency, so this isn't a direct application; change the route."
        )
    if route == "agency":
        if not agency_id and recruiter is not None and recruiter.agency_id:
            agency_id = updates["agency_id"] = recruiter.agency_id
        if not agency_id and not recruiter_id:
            raise HTTPException(422, "An agency application needs an agency or a recruiter.")
    if recruiter is not None and recruiter.agency_id and agency_id and recruiter.agency_id != agency_id:
        raise HTTPException(422, "The recruiter works for a different agency than the one given.")
    return updates


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


@apps.post("", response_model=S.ApplicationDetail, status_code=201)
def create_app_(body: S.ApplicationIn, session: SessionDep, workflow: WorkflowDep):
    data = values(body, partial=False)
    _check_refs(session, data)
    data.update(_check_route(session, data))
    stage = data.pop("stage", None)
    try:
        app = svc.create_application(session, workflow, stage=stage, **data)
    except WorkflowError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _detail(session, workflow, app.id)


def _by_name(session: Session, model, name: str, **where):
    """Case-insensitive exact name match (optionally scoped); returns the match if exactly one."""
    stmt = select(model).where(func.lower(model.name) == name.strip().lower())
    for column, value in where.items():
        stmt = stmt.where(getattr(model, column) == value)
    found = session.scalars(stmt.limit(2)).all()
    return found[0] if len(found) == 1 else None


@apps.post("/quick", response_model=S.ApplicationDetail, status_code=201)
def quick_create(body: S.QuickApplicationIn, session: SessionDep, workflow: WorkflowDep):
    """One transaction: reuse or create the company, role, agency and recruiter, then the application.

    If anything fails, nothing is saved, so a retry never leaves duplicates behind.
    """
    if body.company_id:
        company = get_or_404(session, Company, body.company_id)
    else:
        company = _by_name(session, Company, body.company_name or "")
        if company is None:
            company = Company(name=(body.company_name or "").strip())
            session.add(company)
            session.flush()

    title = body.role_title.strip()
    role = session.scalars(
        select(Role).where(Role.company_id == company.id, func.lower(Role.title) == title.lower()).limit(1)
    ).first()
    if role is None:
        role = Role(company_id=company.id, title=title, url=str(body.role_url) if body.role_url else None)
        session.add(role)
        session.flush()

    agency_id = recruiter_id = None
    if body.route == "agency":
        agency = None
        if body.agency_id:
            agency = get_or_404(session, Agency, body.agency_id)
        elif (body.agency_name or "").strip():
            agency = _by_name(session, Agency, body.agency_name or "")
            if agency is None:
                agency = Agency(name=(body.agency_name or "").strip())
                session.add(agency)
                session.flush()
        recruiter = None
        if body.recruiter_id:
            recruiter = get_or_404(session, Contact, body.recruiter_id)
        elif (body.recruiter_name or "").strip():
            name = body.recruiter_name or ""
            # Within the agency when there is one; otherwise a unique match anywhere.
            recruiter = (
                _by_name(session, Contact, name, agency_id=agency.id) if agency else _by_name(session, Contact, name)
            )
            if recruiter is None:
                recruiter = Contact(name=name.strip(), agency_id=agency.id if agency else None)
                session.add(recruiter)
                session.flush()
        if agency is None and recruiter is not None and recruiter.agency_id:
            agency = session.get(Agency, recruiter.agency_id)
        agency_id = agency.id if agency else None
        recruiter_id = recruiter.id if recruiter else None
    elif body.agency_id or body.agency_name:
        raise HTTPException(422, "Only applications through a recruiter can have an agency.")
    elif body.recruiter_id or (body.recruiter_name or "").strip():
        if body.route != "direct":
            raise HTTPException(422, "A referral can't have a recruiter; link the referrer as a person instead.")
        # Someone at the company reached out (an in-house recruiter or head of talent).
        if body.recruiter_id:
            recruiter = get_or_404(session, Contact, body.recruiter_id)
        else:
            name = (body.recruiter_name or "").strip()
            recruiter = session.scalars(
                select(Contact)
                .where(
                    Contact.company_id == company.id,
                    Contact.agency_id.is_(None),
                    func.lower(Contact.name) == name.lower(),
                )
                .limit(1)
            ).first()
            if recruiter is None:
                recruiter = Contact(name=name, company_id=company.id)
                session.add(recruiter)
                session.flush()
        recruiter_id = recruiter.id

    data = {"route": body.route, "agency_id": agency_id, "recruiter_id": recruiter_id}
    data.update(_check_route(session, data))
    try:
        app = svc.create_application(
            session, workflow, role_id=role.id, stage=body.stage, applied_on=body.applied_on, tags=body.tags, **data
        )
    except WorkflowError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return _detail(session, workflow, app.id)


@apps.get("/duplicates", response_model=list[S.DuplicateOut])
def find_duplicates(
    session: SessionDep,
    workflow: WorkflowDep,
    role_title: Annotated[str, Query(min_length=1, max_length=300)],
    company_id: str | None = None,
    company_name: Annotated[str | None, Query(max_length=200)] = None,
):
    """Existing applications that look like the same job, to warn before applying twice.

    Give the company by id, or by name ("Contoso Ltd" matches "Contoso").
    """
    if company_id:
        ids = [company_id]
    elif company_name:
        ids = dup.company_ids_named(session, company_name)
    else:
        raise HTTPException(422, "Give company_id or company_name.")
    return _duplicates(session, workflow, ids, role_title)


@apps.get("/{app_id}", response_model=S.ApplicationDetail)
def get_app(app_id: str, session: SessionDep, workflow: WorkflowDep):
    return _detail(session, workflow, app_id)


@apps.patch("/{app_id}", response_model=S.ApplicationDetail)
def update_app(app_id: str, body: S.ApplicationPatch, session: SessionDep, workflow: WorkflowDep):
    app = get_or_404(session, Application, app_id)
    data = values(body, partial=True)
    _check_refs(session, data)
    current = {"route": app.route, "agency_id": app.agency_id, "recruiter_id": app.recruiter_id}
    data.update(_check_route(session, {**current, **data}))
    was_waiting = app.awaiting_reply_since
    for key, value in data.items():
        setattr(app, key, value)
    session.flush()
    if "awaiting_reply_since" in data and (was_waiting is None) != (app.awaiting_reply_since is None):
        summary = "Replied; waiting to hear back" if app.awaiting_reply_since else "Heard back"
        svc.log_activity(
            session, app, "manual", summary=summary, data={"awaiting_reply": bool(app.awaiting_reply_since)}
        )
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


# --- summaries for detail pages -----------------------------------------------------------------

summaries = APIRouter(tags=["summaries"])


def _app_rows(session: Session, workflow: Workflow, *where) -> list[S.ApplicationRow]:
    stmt = _rows_query().where(*where).order_by(Application.last_activity_at.desc(), Application.id)
    today = date.today()
    return _with_rounds(session, [_row(workflow, *found, today=today) for found in session.execute(stmt)])


@summaries.get("/companies/{company_id}/summary", response_model=S.CompanySummary)
def company_summary(company_id: str, session: SessionDep, workflow: WorkflowDep):
    company = get_or_404(session, Company, company_id)
    roles = session.scalars(select(Role).where(Role.company_id == company_id).order_by(func.lower(Role.title))).all()
    rows = _app_rows(session, workflow, Company.id == company_id)
    # People at the company, plus anyone linked to one of its applications (e.g. an interviewer).
    linked = select(ApplicationContact.contact_id).join(Application).join(Role).where(Role.company_id == company_id)
    people = session.scalars(
        select(Contact)
        .where(or_(Contact.company_id == company_id, Contact.id.in_(linked)))
        .order_by(func.lower(Contact.name))
    ).all()
    return S.CompanySummary(
        company=S.CompanyOut.model_validate(company),
        roles=[S.RoleOut.model_validate(r) for r in roles],
        applications=rows,
        contacts=[_contact_out(session, c) for c in people],
    )


@summaries.get("/agencies/{agency_id}/summary", response_model=S.AgencySummary)
def agency_summary(agency_id: str, session: SessionDep, workflow: WorkflowDep):
    agency = get_or_404(session, Agency, agency_id)
    recruiters = session.scalars(
        select(Contact).where(Contact.agency_id == agency_id).order_by(func.lower(Contact.name))
    ).all()
    return S.AgencySummary(
        agency=S.AgencyOut.model_validate(agency),
        recruiters=[_contact_out(session, c) for c in recruiters],
        applications=_app_rows(session, workflow, Application.agency_id == agency_id),
    )


@summaries.get("/contacts/{contact_id}/summary", response_model=S.ContactSummary)
def contact_summary(contact_id: str, session: SessionDep, workflow: WorkflowDep):
    """A person's page: their details, the applications they're part of and their interviews."""
    from .interviews import _outs as interview_outs
    from .interviews import _query as interview_query

    contact = get_or_404(session, Contact, contact_id)
    relations: dict[str, list[str]] = {}
    for app_id, relation in session.execute(
        select(ApplicationContact.application_id, ApplicationContact.relation)
        .where(ApplicationContact.contact_id == contact_id)
        .order_by(ApplicationContact.id)
    ):
        relations.setdefault(app_id, []).append(relation)
    for app_id in session.scalars(select(Application.id).where(Application.recruiter_id == contact_id)):
        relations.setdefault(app_id, []).insert(0, "source")  # they brought it to you
    rows = _app_rows(session, workflow, Application.id.in_(list(relations))) if relations else []
    sat_in = select(InterviewContact.interview_id).where(InterviewContact.contact_id == contact_id)
    interviews = interview_outs(
        session,
        session.execute(
            interview_query()
            .where(Interview.id.in_(sat_in))
            .order_by(func.coalesce(Interview.starts_at, Interview.deadline_at, Interview.created_at).desc())
        ),
    )
    agency = session.get(Agency, contact.agency_id) if contact.agency_id else None
    company = session.get(Company, contact.company_id) if contact.company_id else None
    return S.ContactSummary(
        contact=_contact_out(session, contact),
        agency_name=agency.name if agency else None,
        company_name=company.name if company else None,
        applications=[
            S.PersonApplication(**r.model_dump(), relations=list(dict.fromkeys(relations[r.id]))) for r in rows
        ],
        interviews=interviews,
    )


router.include_router(summaries, prefix="")


from .backup import router as backup_router  # noqa: E402

router.include_router(backup_router)

from .interviews import router as interviews_router  # noqa: E402

router.include_router(interviews_router)

from .links import router as links_router  # noqa: E402

router.include_router(links_router)
from .notes import router as notes_router  # noqa: E402

router.include_router(notes_router)

from .attachments import router as attachments_router  # noqa: E402

router.include_router(attachments_router)

from .next_actions import router as next_actions_router  # noqa: E402

router.include_router(next_actions_router)
from .documents import router as documents_router  # noqa: E402

router.include_router(documents_router)

from .insights import router as insights_router  # noqa: E402

router.include_router(insights_router)

from .offers import router as offers_router  # noqa: E402

router.include_router(offers_router)

from .search import router as search_router  # noqa: E402

router.include_router(search_router)
from .timeline import router as timeline_router  # noqa: E402

router.include_router(timeline_router)

from .meetings import router as meetings_router  # noqa: E402

router.include_router(meetings_router)

from .roles import router as roles_router  # noqa: E402

router.include_router(roles_router)
