"""The Timeline page: everything that happened (and is booked) across the whole search, in one list.

Most of it is already on application timelines (the events table): stage moves, calls, emails,
interviews, offers, notes, files and documents sent. This adds what isn't tied to one
application (people, companies and agencies being added, notes on them, people you're waiting
on) and dated things ahead (interview times, offer reply deadlines).
"""

from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime, time
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Request
from pydantic import AwareDatetime, BaseModel
from sqlalchemy import select

from ..db.models import (
    Agency,
    Application,
    ApplicationContact,
    Company,
    Contact,
    Event,
    Interview,
    InterviewContact,
    Meeting,
    NoteIndex,
    Offer,
    Role,
)
from ..domain import interviews as interviews_svc
from ..domain import offers as offers_svc
from ..domain.applications import STAGE_CHANGE
from .deps import SessionDep, WorkflowDep
from .meetings import label as meeting_label
from .notes import _sync

router = APIRouter(tags=["timeline"])

Category = Literal["stage", "message", "meeting", "interview", "offer", "note", "file", "document", "added", "other"]
CATEGORIES: tuple[str, ...] = Category.__args__


class TimelinePerson(BaseModel):
    id: str
    name: str


class TimelineItem(BaseModel):
    id: str  # "<source>:<id>", unique within the response
    seq: int = 0  # breaks ties between events logged at the same moment
    at: datetime
    all_day: bool  # `at` stands for a calendar date (shown without a time)
    category: Category
    title: str
    detail: str | None = None
    application_id: str | None = None
    role_title: str | None = None
    company_id: str | None = None
    company_name: str | None = None
    agency_id: str | None = None
    agency_name: str | None = None
    people: list[TimelinePerson] = []
    archived: bool = False  # on an archived application


class Timeline(BaseModel):
    items: list[TimelineItem]  # newest first; things booked ahead come first
    now: datetime


def _day(d: date) -> datetime:
    return datetime.combine(d, time(), tzinfo=UTC)


def _event_category(event: Event) -> Category:
    data = event.data or {}
    if event.kind == STAGE_CHANGE:
        return "stage"
    if event.kind in ("call", "email") or (event.kind == "file" and data.get("from")):
        return "message"  # an uploaded .eml counts as an email
    if event.kind == "interview":
        return "interview"
    if "offer_id" in data:
        return "offer"
    if event.kind == "note":
        return "note"
    if "document_version_id" in data:
        return "document"
    if event.kind == "file":
        return "file"
    return "other"


def _event_title(event: Event, stage_names: dict[str, str]) -> str:
    if event.kind == STAGE_CHANGE and event.from_stage and event.to_stage:
        name = stage_names.get
        return f"{name(event.from_stage, event.from_stage)} → {name(event.to_stage, event.to_stage)}"
    if event.kind == STAGE_CHANGE and event.to_stage and not event.from_stage:
        return f"Added at {stage_names.get(event.to_stage, event.to_stage)}"
    if event.summary:
        return event.summary.splitlines()[0]
    return {"call": "Call", "email": "Email"}.get(event.kind, event.kind.replace("_", " ").capitalize())


def _detail(event: Event) -> str | None:
    """A logged message's text beyond its first line (the title)."""
    if event.kind == STAGE_CHANGE or not event.summary or "\n" not in event.summary:
        return event.summary if event.kind == STAGE_CHANGE and event.from_stage else None
    return event.summary.split("\n", 1)[1].strip() or None


@router.get("/timeline", response_model=Timeline)
def timeline(
    request: Request,
    session: SessionDep,
    workflow: WorkflowDep,
    since: AwareDatetime | None = None,
    until: AwareDatetime | None = None,
    category: Annotated[list[Category] | None, Query()] = None,
    company_id: str | None = None,
    agency_id: str | None = None,
    contact_id: str | None = None,
    application_id: str | None = None,
):
    """Everything in [since, until), newest first, archived applications included.

    Filter by `category` (any of them), or by one company, agency, person or application: an
    application's items count for its company, its agency and the people on it.
    """

    _sync(request)  # notes edited outside the app show up
    now = datetime.now(UTC)
    stage_names = {s.id: s.name for s in workflow.stages}

    # Who's who on each application, so items can say (and be filtered by) company, agency, people.
    apps: dict[str, tuple[Application, Role, Company, Agency | None]] = {
        a.id: (a, r, c, ag)
        for a, r, c, ag in session.execute(
            select(Application, Role, Company, Agency)
            .join(Role, Application.role_id == Role.id)
            .join(Company, Role.company_id == Company.id)
            .outerjoin(Agency, Application.agency_id == Agency.id)
        )
    }
    contacts = {c.id: c for c in session.scalars(select(Contact))}
    companies = {c.id: c for c in session.scalars(select(Company))}
    agencies = {a.id: a for a in session.scalars(select(Agency))}
    people: dict[str, list[str]] = defaultdict(list)
    for a, _r, _c, _ag in apps.values():
        if a.recruiter_id:
            people[a.id].append(a.recruiter_id)
    for link in session.scalars(select(ApplicationContact)):
        if link.contact_id not in people[link.application_id]:
            people[link.application_id].append(link.contact_id)

    def person(cid: str) -> TimelinePerson | None:
        c = contacts.get(cid)
        return TimelinePerson(id=c.id, name=c.name) if c else None

    def on_app(app_id: str, **fields) -> TimelineItem:
        a, r, c, ag = apps[app_id]
        who = fields.pop("people", None) or [p for cid in people[app_id] if (p := person(cid))]
        return TimelineItem(
            application_id=a.id,
            role_title=r.title,
            company_id=c.id,
            company_name=c.name,
            agency_id=ag.id if ag else None,
            agency_name=ag.name if ag else None,
            people=who,
            archived=a.archived,
            **fields,
        )

    def about_contact(c: Contact, **fields) -> TimelineItem:
        co, ag = companies.get(c.company_id or ""), agencies.get(c.agency_id or "")
        return TimelineItem(
            company_id=co.id if co else None,
            company_name=co.name if co else None,
            agency_id=ag.id if ag else None,
            agency_name=ag.name if ag else None,
            people=[TimelinePerson(id=c.id, name=c.name)],
            **fields,
        )

    items: list[TimelineItem] = []

    for e in session.scalars(select(Event).order_by(Event.occurred_at, Event.seq)):
        if e.application_id in apps:
            items.append(
                on_app(
                    e.application_id,
                    id=f"event:{e.id}",
                    seq=e.seq,
                    at=e.occurred_at,
                    all_day=False,
                    category=_event_category(e),
                    title=_event_title(e, stage_names),
                    detail=_detail(e),
                )
            )

    # Interviews at their own time (the "scheduled" entry above is when you booked it).
    on_panel: dict[str, list[str]] = defaultdict(list)
    for link in session.scalars(select(InterviewContact)):
        on_panel[link.interview_id].append(link.contact_id)
    for i in session.scalars(select(Interview).where(Interview.status != "cancelled")):
        when = i.starts_at or i.deadline_at
        if when is None or i.application_id not in apps:
            continue
        # A done round says so; a scheduled one is booked (a time) or due (a deadline).
        status = i.status if i.status != "scheduled" else ("due" if i.starts_at is None else "booked")
        # The panel plus the application's people, so filtering by the recruiter still finds it.
        ids = list(dict.fromkeys([*on_panel[i.id], *people[i.application_id]]))
        panel = [p for cid in ids if (p := person(cid))]
        items.append(
            on_app(
                i.application_id,
                id=f"interview:{i.id}",
                at=when,
                all_day=False,
                category="interview",
                title=f"{interviews_svc.label(i)} ({status})",
                people=panel,
            )
        )

    # A revised offer replaces the one before it (as on Next actions): only the newest counts.
    newest: dict[str, Offer] = {}
    for o in session.scalars(select(Offer).order_by(Offer.created_at.desc(), Offer.id.desc())):
        newest.setdefault(o.application_id, o)
    for o in newest.values():
        if o.status == "pending" and o.respond_by is not None and o.application_id in apps:
            items.append(
                on_app(
                    o.application_id,
                    id=f"offer-reply:{o.id}",
                    at=_day(o.respond_by),
                    all_day=True,
                    category="offer",
                    title=f"Reply due on the offer: {offers_svc.headline(o)}",
                )
            )

    # Calls and meetings with people, at their time (cancelled ones didn't happen).
    for m in session.scalars(select(Meeting).where(Meeting.status != "cancelled")):
        c = contacts.get(m.contact_id)
        if c is None:
            continue
        fields = dict(
            id=f"meeting:{m.id}",
            at=m.starts_at,
            all_day=False,
            category="meeting",
            title=f"{meeting_label(m, c.name)} ({'booked' if m.status == 'scheduled' else m.status})",
            detail=m.notes or m.agenda,
        )
        if m.application_id in apps:
            item = on_app(m.application_id, **fields)
            if all(p.id != c.id for p in item.people):
                item.people.insert(0, TimelinePerson(id=c.id, name=c.name))
            items.append(item)
        else:
            items.append(about_contact(c, **fields))

    for c in companies.values():
        items.append(
            TimelineItem(
                id=f"company:{c.id}",
                at=c.created_at,
                all_day=False,
                category="added",
                title=f"Added company {c.name}",
                company_id=c.id,
                company_name=c.name,
            )
        )
    for ag in agencies.values():
        items.append(
            TimelineItem(
                id=f"agency:{ag.id}",
                at=ag.created_at,
                all_day=False,
                category="added",
                title=f"Added agency {ag.name}",
                agency_id=ag.id,
                agency_name=ag.name,
            )
        )
    for c in contacts.values():
        items.append(
            about_contact(
                c, id=f"contact:{c.id}", at=c.created_at, all_day=False, category="added", title=f"Added {c.name}"
            )
        )
        if c.awaiting_reply_since:
            items.append(
                about_contact(
                    c,
                    id=f"contact-waiting:{c.id}",
                    at=_day(c.awaiting_reply_since),
                    all_day=True,
                    category="message",
                    title=f"Replied to {c.name}; waiting to hear back",
                )
            )

    # Notes on an application are already on its timeline; these are notes on anything else.
    for n in session.scalars(select(NoteIndex)):
        kinds = defaultdict(list)
        for link in n.links:
            kind, _, target = link.partition(":")
            kinds[kind].append(target)
        if kinds["application"]:
            continue
        who = [p for cid in kinds["contact"] if (p := person(cid))]
        co = next((companies[x] for x in kinds["company"] if x in companies), None)
        ag = next((agencies[x] for x in kinds["agency"] if x in agencies), None)
        if co is None and ag is None and who:  # a note on a person counts for their company or agency
            first = contacts[who[0].id]
            co, ag = companies.get(first.company_id or ""), agencies.get(first.agency_id or "")
        items.append(
            TimelineItem(
                id=f"note:{n.id}",
                at=n.created_at,
                all_day=False,
                category="note",
                title=f"Note: {n.title}",
                company_id=co.id if co else None,
                company_name=co.name if co else None,
                agency_id=ag.id if ag else None,
                agency_name=ag.name if ag else None,
                people=who,
            )
        )

    def keep(item: TimelineItem) -> bool:
        if since is not None and item.at < since:
            return False
        if until is not None and item.at >= until:
            return False
        if category and item.category not in category:
            return False
        if company_id and item.company_id != company_id:
            return False
        if agency_id and item.agency_id != agency_id:
            return False
        if contact_id and all(p.id != contact_id for p in item.people):
            return False
        return not (application_id and item.application_id != application_id)

    out = [i for i in items if keep(i)]
    out.sort(key=lambda i: (i.at, i.seq, i.id), reverse=True)
    return Timeline(items=out, now=now)
