"""Application lifecycle: creation, stage moves, undo and activity, all as append-only events (FR7, FR8).

`application.stage` and `application.last_activity_at` are caches; the `events` table is the
history. Nothing here updates or deletes an event: undo appends a correcting event.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Application, Event
from ..db.types import utcnow
from .workflow import Workflow, WorkflowError

STAGE_CHANGE = "stage_change"
ACTIVITY_KINDS = ("call", "email", "message", "note", "file", "interview", "manual")


class TransitionError(WorkflowError):
    pass


def _touch(app: Application, when: datetime) -> None:
    if app.last_activity_at is None or when > app.last_activity_at:
        app.last_activity_at = when


def create_application(
    session: Session, workflow: Workflow, *, role_id: str, stage: str | None = None, **fields: Any
) -> Application:
    stage = stage or workflow.initial
    workflow.stage(stage)
    now = utcnow()
    app = Application(role_id=role_id, stage=stage, last_activity_at=now, **fields)
    session.add(app)
    session.flush()
    session.add(
        Event(
            application_id=app.id,
            kind=STAGE_CHANGE,
            from_stage=None,
            to_stage=stage,
            occurred_at=now,
            summary="Application created",
        )
    )
    session.flush()
    return app


def history(session: Session, application_id: str) -> list[Event]:
    """The timeline: events in the order they happened (ties broken by insertion order)."""
    return list(
        session.scalars(
            select(Event).where(Event.application_id == application_id).order_by(Event.occurred_at, Event.seq)
        )
    )


def _recorded(session: Session, application_id: str) -> list[Event]:
    """Events in the order they were recorded, which is what undo reverses."""
    return list(session.scalars(select(Event).where(Event.application_id == application_id).order_by(Event.seq)))


def move(
    session: Session,
    workflow: Workflow,
    app: Application,
    to_stage: str,
    *,
    occurred_at: datetime | None = None,
    note: str | None = None,
) -> Event:
    """Move an application to `to_stage` if the workflow allows it."""
    try:
        allowed_move = workflow.can_move(app.stage, to_stage)
    except WorkflowError as exc:  # e.g. a stage removed from config.toml
        raise TransitionError(str(exc)) from exc
    if not allowed_move:
        allowed = ", ".join(workflow.allowed_next(app.stage)) or "none"
        raise TransitionError(f"can't move from {app.stage!r} to {to_stage!r} (allowed: {allowed})")
    when = occurred_at or utcnow()
    event = Event(
        application_id=app.id,
        kind=STAGE_CHANGE,
        from_stage=app.stage,
        to_stage=to_stage,
        occurred_at=when,
        summary=note,
    )
    session.add(event)
    app.stage = to_stage
    _touch(app, when)
    session.flush()
    return event


def _effective_moves(events: list[Event]) -> list[Event]:
    """Stage moves that haven't been undone, in the given order (undo works like a stack).

    Undone ids are collected first, so the result doesn't depend on where an undo event
    sorts relative to the move it reverts.
    """
    stage_events = [ev for ev in events if ev.kind == STAGE_CHANGE]
    undone = {(ev.data or {}).get("undo_of") for ev in stage_events} - {None}
    return [
        ev
        for ev in stage_events
        if ev.from_stage is not None and not (ev.data or {}).get("undo_of") and ev.id not in undone
    ]


def undo_last_move(session: Session, app: Application, *, note: str | None = None) -> Event:
    """Revert the most recently recorded stage move by appending a correcting event."""
    moves = _effective_moves(_recorded(session, app.id))
    if not moves:
        raise TransitionError("nothing to undo")
    last = moves[-1]
    if last.to_stage != app.stage:
        raise TransitionError(f"history is inconsistent: last move went to {last.to_stage!r}, stage is {app.stage!r}")
    assert last.from_stage is not None
    event = Event(
        application_id=app.id,
        kind=STAGE_CHANGE,
        from_stage=app.stage,
        to_stage=last.from_stage,
        occurred_at=utcnow(),
        summary=note or f"Undo: back to {last.from_stage}",
        data={"undo_of": last.id},
    )
    session.add(event)
    app.stage = last.from_stage
    session.flush()
    # An undone move isn't real activity: recompute so a stale application stays flagged.
    app.last_activity_at = _activity_time(_recorded(session, app.id), app.last_activity_at)
    session.flush()
    return event


def _activity_time(events: list[Event], fallback: datetime) -> datetime:
    """Latest occurred_at over events that count as activity (not undone moves or undo events)."""
    undone = {(ev.data or {}).get("undo_of") for ev in events} - {None}
    times = [ev.occurred_at for ev in events if ev.id not in undone and not (ev.data or {}).get("undo_of")]
    return max(times) if times else fallback


def log_activity(
    session: Session,
    app: Application,
    kind: str,
    *,
    summary: str | None = None,
    occurred_at: datetime | None = None,
    data: dict[str, Any] | None = None,
) -> Event:
    """Record a call, email, note or other activity on the timeline."""
    if kind not in ACTIVITY_KINDS:
        raise ValueError(f"unknown activity kind {kind!r}; expected one of {ACTIVITY_KINDS}")
    when = occurred_at or utcnow()
    event = Event(application_id=app.id, kind=kind, occurred_at=when, summary=summary, data=data or {})
    session.add(event)
    _touch(app, when)
    session.flush()
    return event
