"""Recruiter scorecard (PRD FR20): how each recruiter and agency's roles have gone.

For the applications a recruiter (or agency) put you forward for:
- **roles**: how many;
- **interviewed**: how many got at least one interview round that wasn't cancelled;
- **active** / **ghosted** / **closed**: where they are now (ghosted means a `reopen_from`
  stage, Ghosted by default; closed counts every other closed stage);
- **first update**: median days from adding the application (its first stage event, so
  backfilled history counts) to the first sign of life: a call, email or message logged, or a
  move to a stage that isn't closed. Closing moves (Ghosted, Withdrawn…) are usually yours, so
  they don't count, and nor do undone moves. Logged contact has no direction, so a chaser you
  sent counts too;
- **last contact**: the latest call, email or message logged.

Anything dated in the future (a call logged ahead of time) is left out until it happens.
An application with a recruiter but no agency counts towards the recruiter's agency.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import UTC, datetime
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import Agency, Application, Contact, Event, Interview

from .applications import STAGE_CHANGE, _effective_moves
from .workflow import Workflow

CONTACT_KINDS = ("call", "email", "message")


@dataclass
class Score:
    id: str
    name: str
    agency_id: str | None = None
    agency_name: str | None = None
    roles: int = 0
    interviewed: int = 0
    active: int = 0
    ghosted: int = 0
    closed: int = 0
    success: int = 0
    first_update_days: list[float] = field(default_factory=list)
    last_contact: datetime | None = None

    @property
    def median_first_update(self) -> float | None:
        return round(median(self.first_update_days), 1) if self.first_update_days else None


def _added_at(created: datetime, events: list[Event]) -> datetime:
    """When the application entered the history: its first stage event, which may be backdated."""
    first = next((ev for ev in events if ev.kind == STAGE_CHANGE and ev.from_stage is None), None)
    return first.occurred_at if first else created


def _first_update(added: datetime, events: list[Event], closed: set[str], now: datetime) -> datetime | None:
    moves = [ev.occurred_at for ev in _effective_moves(events) if ev.to_stage not in closed]
    contacts = [ev.occurred_at for ev in events if ev.kind in CONTACT_KINDS]
    times = [t for t in moves + contacts if added <= t <= now]
    return min(times) if times else None


def scorecard(
    session: Session, workflow: Workflow, *, since: datetime | None = None, until: datetime | None = None
) -> tuple[list[Score], list[Score]]:
    """(recruiters, agencies), each most roles first, for applications added in [since, until)."""
    stmt = select(Application).where((Application.recruiter_id.is_not(None)) | (Application.agency_id.is_not(None)))
    if since is not None:
        stmt = stmt.where(Application.created_at >= since)
    if until is not None:
        stmt = stmt.where(Application.created_at < until)
    apps = list(session.scalars(stmt))
    ids = [a.id for a in apps]

    events: dict[str, list[Event]] = defaultdict(list)
    interviewed: set[str] = set()
    if ids:
        for ev in session.scalars(
            select(Event)
            .where(Event.application_id.in_(ids), Event.kind.in_((STAGE_CHANGE, *CONTACT_KINDS)))
            .order_by(Event.seq)
        ):
            events[ev.application_id].append(ev)
        interviewed = set(
            session.scalars(
                select(Interview.application_id).where(
                    Interview.application_id.in_(ids), Interview.status != "cancelled"
                )
            )
        )

    agencies: dict[str, str] = {i: n for i, n in session.execute(select(Agency.id, Agency.name))} if apps else {}
    contacts = {c.id: c for c in session.scalars(select(Contact).where(Contact.id.in_({a.recruiter_id for a in apps})))}
    kinds = {s.id: s.kind for s in workflow.stages}
    ghost_stages = set(workflow.reopen_from)
    closed = {s.id for s in workflow.stages if s.kind == "closed"}
    now = datetime.now(UTC)

    by_recruiter: dict[str, Score] = {}
    by_agency: dict[str, Score] = {}
    for app in apps:
        scores: list[Score] = []
        if app.recruiter_id and app.recruiter_id in contacts:
            c = contacts[app.recruiter_id]
            scores.append(
                by_recruiter.setdefault(
                    c.id, Score(id=c.id, name=c.name, agency_id=c.agency_id, agency_name=agencies.get(c.agency_id))
                )
            )
        recruiter = contacts.get(app.recruiter_id) if app.recruiter_id else None
        agency_id = app.agency_id or (recruiter.agency_id if recruiter else None)
        if agency_id and agency_id in agencies:
            scores.append(by_agency.setdefault(agency_id, Score(id=agency_id, name=agencies[agency_id])))
        history = events[app.id]
        added = _added_at(app.created_at, history)
        first = _first_update(added, history, closed, now)
        contacted = [ev.occurred_at for ev in history if ev.kind in CONTACT_KINDS and ev.occurred_at <= now]
        for s in scores:
            s.roles += 1
            s.interviewed += app.id in interviewed
            kind = kinds.get(app.stage, "active")
            if app.stage in ghost_stages:
                s.ghosted += 1
            elif kind == "closed":
                s.closed += 1
            elif kind == "success":
                s.success += 1
            else:
                s.active += 1
            if first is not None:
                s.first_update_days.append((first - added).total_seconds() / 86_400)
            if contacted:
                latest = max(contacted)
                s.last_contact = max(s.last_contact, latest) if s.last_contact else latest

    def order(scores: dict[str, Score]) -> list[Score]:
        return sorted(scores.values(), key=lambda s: (-s.roles, s.name.lower()))

    return order(by_recruiter), order(by_agency)
