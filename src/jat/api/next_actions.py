"""The Next actions page (PRD FR18, US5): what needs doing, in one request."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter
from pydantic import AwareDatetime, BaseModel
from sqlalchemy import func

from ..db.models import Application, Interview
from . import schemas as S
from .deps import SessionDep, WorkflowDep
from .interviews import _outs, _query

router = APIRouter(tags=["next actions"])

UPCOMING_DAYS = 14


class NextActions(BaseModel):
    follow_ups: list[S.ApplicationRow]  # follow-up date today or earlier, not snoozed
    stale: list[S.ApplicationRow]  # past the stage's staleness threshold, quietest first
    upcoming: list[S.InterviewOut]  # booked in the next two weeks, then rounds with no date yet
    awaiting_outcome: list[S.InterviewOut]  # their time has passed but they're still "scheduled"
    today: date


@router.get("/next-actions", response_model=NextActions)
def next_actions(
    session: SessionDep,
    workflow: WorkflowDep,
    today: date | None = None,
    since: AwareDatetime | None = None,
):
    """Pass your local `today` (YYYY-MM-DD) and `since` (the start of your local day, with its
    offset) so "today" means your today. Both default to UTC's.

    Only open applications count: archived ones, and ones in a closed or success stage, are done.
    """
    from .routers import list_applications  # routers includes this module's router

    now = datetime.now(UTC)
    start = (since or now.replace(hour=0, minute=0, second=0, microsecond=0)).astimezone(UTC)
    today = today or (since.date() if since else now.date())
    active = [s.id for s in workflow.stages if s.is_active]

    rows = [r for r in list_applications(session, workflow) if r.stage_kind == "active"]
    follow_ups = [
        r
        for r in rows
        if r.follow_up_on is not None
        and r.follow_up_on <= today
        and not (r.snoozed_until is not None and r.snoozed_until > today)
    ]
    follow_ups.sort(key=lambda r: (r.follow_up_on, r.company_name.lower()))
    chasing = {r.id for r in follow_ups}
    stale = sorted(
        (r for r in rows if r.stale and r.id not in chasing),
        key=lambda r: (-r.days_since_activity, r.company_name.lower()),
    )

    when = func.coalesce(Interview.starts_at, Interview.deadline_at)
    scheduled = _query().where(
        Interview.status == "scheduled",
        Application.archived.is_(False),
        Application.stage.in_(active),
    )
    window = scheduled.where(when >= min(start, now), when < start + timedelta(days=UPCOMING_DAYS))
    booked = _outs(session, session.execute(window.order_by(when, Interview.id)))
    unbooked = _outs(session, session.execute(scheduled.where(when.is_(None)).order_by(Interview.created_at)))
    past = _outs(session, session.execute(scheduled.where(when < now).order_by(when.desc(), Interview.id)))
    # Earlier today counts as upcoming until its time has passed; then it's awaiting an outcome.
    upcoming = [i for i in booked if (i.starts_at or i.deadline_at) >= now]
    return NextActions(
        follow_ups=follow_ups,
        stale=stale,
        upcoming=upcoming + unbooked,
        awaiting_outcome=past,
        today=today,
    )
