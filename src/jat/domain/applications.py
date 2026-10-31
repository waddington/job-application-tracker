"""Application lifecycle: creation, stage moves, undo and activity, all as append-only events (FR7, FR8).

`application.stage` and `application.last_activity_at` are caches; the `events` table is the
history. Nothing here updates or deletes an event: undo appends a correcting event.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any, Literal, get_args

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Application, Event
from ..db.types import utcnow
from . import replies
from .workflow import Workflow, WorkflowError

STAGE_CHANGE = "stage_change"
ACTIVITY_KINDS = ("call", "email", "message", "note", "file", "interview", "manual")
# Marks the events of a first stage you skipped (see create_application); a second apart.
IMPLIED = "implied"
IMPLIED_GAP = timedelta(seconds=1)


class TransitionError(WorkflowError):
    pass


def _touch(app: Application, when: datetime) -> None:
    if app.last_activity_at is None or when > app.last_activity_at:
        app.last_activity_at = when


def is_implied(event: Event) -> bool:
    """A step the app filled in, not one you made: the first stage before one you started later at."""
    return bool((event.data or {}).get(IMPLIED))


def starts_after_initial(workflow: Workflow, stage: str) -> bool:
    """True when an application starting at `stage` skipped the first stage (Interested, by default)."""
    ids = [s.id for s in workflow.stages]
    if stage == workflow.initial or workflow.initial not in ids or stage not in ids:
        return False
    return workflow.stage(stage).kind != "active" or ids.index(stage) > ids.index(workflow.initial)


def create_application(
    session: Session, workflow: Workflow, *, role_id: str, stage: str | None = None, **fields: Any
) -> Application:
    """Create an application at `stage`. Every application starts at the workflow's first stage:
    one created at a later stage (Applied, say) is recorded as created at the first stage a
    second earlier, then moved on to `stage`."""
    stage = stage or workflow.initial
    workflow.stage(stage)
    now = utcnow()
    app = Application(role_id=role_id, stage=stage, last_activity_at=now, **fields)
    session.add(app)
    session.flush()
    if starts_after_initial(workflow, stage):
        session.add(
            Event(
                application_id=app.id,
                kind=STAGE_CHANGE,
                from_stage=None,
                to_stage=workflow.initial,
                occurred_at=now - IMPLIED_GAP,
                summary="Application created",
                data={IMPLIED: True},
            )
        )
        session.add(
            Event(
                application_id=app.id,
                kind=STAGE_CHANGE,
                from_stage=workflow.initial,
                to_stage=stage,
                occurred_at=now,
                data={IMPLIED: True},
            )
        )
    else:
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
        # It moved on, so you heard back (and read it). Remember the dates so an undo can put them back.
        data={
            **({"was_waiting_since": app.awaiting_reply_since.isoformat()} if app.awaiting_reply_since else {}),
            **({"was_to_read_since": app.reply_to_read_since.isoformat()} if app.reply_to_read_since else {}),
        },
    )
    session.add(event)
    session.flush()
    # It moving on while you were waiting means they got back to you (unless the move was yours).
    if app.awaiting_reply_since is not None and replies.is_reply_move(workflow, to_stage):
        replies.record(
            session,
            contact_id=app.recruiter_id,
            application_id=app.id,
            waited_since=app.awaiting_reply_since,
            replied_on=when.astimezone().date(),  # your local day, like the waiting date
            event_id=event.id,
        )
    from .insights import applied_rank, stage_rank  # insights imports this module

    rank = stage_rank(workflow)
    kind = next((st.kind for st in workflow.stages if st.id == to_stage), "active")
    if app.applied_on is None and kind != "closed" and rank.get(to_stage, -1) >= applied_rank(workflow, rank):
        app.applied_on = when.astimezone().date()  # it's applied now: from Interested, say
    app.stage = to_stage
    app.awaiting_reply_since = None
    app.reply_to_read_since = None
    _touch(app, when)
    session.flush()
    return event


def in_time_order(moves: list[Event]) -> list[Event]:
    """Moves by when they happened; a filled-in move (see create_application) always comes first,
    straight after the creation it follows, even if you backdate a later move before it."""
    return sorted(moves, key=lambda ev: (not is_implied(ev), ev.occurred_at, ev.seq))


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


def _undoable(session: Session, app: Application) -> list[Event]:
    """Moves you can undo: not undone, and not filled in by the app (see create_application)."""
    return [ev for ev in _effective_moves(_recorded(session, app.id)) if not is_implied(ev)]


def can_undo(session: Session, app: Application) -> bool:
    """True when there's a recorded move that hasn't been undone and matches the current stage."""
    moves = _undoable(session, app)
    return bool(moves) and moves[-1].to_stage == app.stage


def undo_last_move(session: Session, app: Application, *, note: str | None = None) -> Event:
    """Revert the most recently recorded stage move by appending a correcting event."""
    moves = _undoable(session, app)
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
    replies.take_back_move(session, last.id)
    # Put back where the conversation stood, both halves together (one may have been set since).
    moved = last.data or {}
    if "was_waiting_since" in moved or "was_to_read_since" in moved:
        waiting, to_read = moved.get("was_waiting_since"), moved.get("was_to_read_since")
        app.awaiting_reply_since = date.fromisoformat(waiting) if waiting else None
        app.reply_to_read_since = date.fromisoformat(to_read) if to_read else None
    session.flush()
    # An undone move isn't real activity: recompute so a stale application stays flagged.
    app.last_activity_at = _activity_time(_recorded(session, app.id), app.last_activity_at)
    session.flush()
    return event


def _activity_time(events: list[Event], fallback: datetime) -> datetime:
    """Latest occurred_at over events that count as activity (not undone moves, undo events, or
    bookkeeping notes like a recruiter change)."""
    undone = {(ev.data or {}).get("undo_of") for ev in events} - {None}
    times = [
        ev.occurred_at
        for ev in events
        if ev.id not in undone and not (ev.data or {}).get("undo_of") and not (ev.data or {}).get("bookkeeping")
    ]
    return max(times) if times else fallback


def note_change(session: Session, app: Application, summary: str, data: dict[str, Any] | None = None) -> Event:
    """Record a change to the application's details on its timeline ("Recruiter changed from …").

    Bookkeeping, not contact with anyone: it doesn't count as activity, so it doesn't reset how
    long the application has been quiet.
    """
    data = {**(data or {}), "bookkeeping": True}  # see _activity_time
    event = Event(application_id=app.id, kind="manual", occurred_at=utcnow(), summary=summary, data=data)
    session.add(event)
    session.flush()
    return event


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


# The same keys as `EventMsg` in api/schemas.py (tests/test_event_messages.py checks).
EventMsgKey = Literal[
    "event.linkAdded",
    "event.noteAdded",
    "event.fileAdded",
    "event.email",
    "event.emailNoSubject",
    "event.emailUnknownSender",
    "event.emailNoSubjectUnknownSender",
    "event.cvSent",
    "event.coverLetterSent",
    "event.documentSent",
]


def log_message(
    session: Session,
    app: Application,
    kind: str,
    *,
    key: EventMsgKey,
    params: dict[str, str],
    summary: str,
    occurred_at: datetime | None = None,
    data: dict[str, Any] | None = None,
) -> Event:
    """Record activity the app wrote itself: the English `summary`, and the same text as a message to translate.

    `summary` stays what's saved, exported and searched. `data.msg` sits beside whatever `data` holds, and
    `EventMsg` in api/schemas.py lists the keys. Text someone typed has no key: use `log_activity`.
    """
    if key not in get_args(EventMsgKey):  # saved for good, and a key the API doesn't know would show as null
        raise ValueError(f"unknown event message key {key!r}")
    data = {**(data or {}), "msg": {"key": key, "params": params}}
    return log_activity(session, app, kind, summary=summary, occurred_at=occurred_at, data=data)
