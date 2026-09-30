"""Search statistics (PRD FR20): conversion and time per stage, outcomes by route, weekly activity.

Conversion and route outcomes use the same folded paths as the Sankey diagram (see
`insights`), so the numbers agree with the picture. Time in stage uses the real history,
back-and-forth included: every completed stay counts.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from statistics import median

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import Application, Event, Interview

from .applications import STAGE_CHANGE, _effective_moves
from .insights import fold_forward, stage_path, stage_rank
from .workflow import Workflow

ROUTES = ("direct", "agency", "referral")


def stays(events: list[Event]) -> list[tuple[str, datetime, datetime | None]]:
    """(stage, entered, left) for each stay, in order; the current stay has left=None."""
    first = next((ev for ev in events if ev.kind == STAGE_CHANGE and ev.from_stage is None), None)
    if first is None or first.to_stage is None:
        return []
    moves = sorted(_effective_moves(events), key=lambda ev: (ev.occurred_at, ev.seq))
    result: list[tuple[str, datetime, datetime | None]] = []
    stage, entered = first.to_stage, first.occurred_at
    for ev in moves:
        if not ev.to_stage:
            continue
        result.append((stage, entered, ev.occurred_at))
        stage, entered = ev.to_stage, ev.occurred_at
    result.append((stage, entered, None))
    return result


@dataclass
class StageStats:
    reached: int = 0
    moved_on: int = 0  # went on to a later stage that isn't a closed one
    days: list[float] = field(default_factory=list)  # completed stays, in days


@dataclass
class Stats:
    applications: int = 0
    stages: dict[str, StageStats] = field(default_factory=lambda: defaultdict(StageStats))
    route_applications: Counter[str] = field(default_factory=Counter)
    route_reached: dict[str, Counter[str]] = field(default_factory=lambda: defaultdict(Counter))

    def median_days(self, stage: str) -> float | None:
        days = self.stages[stage].days if stage in self.stages else []
        return round(median(days), 1) if days else None


def _events_by_application(session: Session, ids: list[str]) -> dict[str, list[Event]]:
    events: dict[str, list[Event]] = {i: [] for i in ids}
    if ids:
        for ev in session.scalars(select(Event).where(Event.application_id.in_(ids)).order_by(Event.seq)):
            events[ev.application_id].append(ev)
    return events


def stats(
    session: Session, workflow: Workflow, *, since: datetime | None = None, until: datetime | None = None
) -> Stats:
    """Stats for applications added in [since, until)."""
    stmt = select(Application.id, Application.route)
    if since is not None:
        stmt = stmt.where(Application.created_at >= since)
    if until is not None:
        stmt = stmt.where(Application.created_at < until)
    routes: dict[str, str] = {app_id: route for app_id, route in session.execute(stmt)}
    events = _events_by_application(session, list(routes))

    rank = stage_rank(workflow)
    kinds = {s.id: s.kind for s in workflow.stages}
    result = Stats()
    for app_id, route in routes.items():
        history = events[app_id]
        path = fold_forward(stage_path(history), rank)
        if not path:
            continue
        result.applications += 1
        result.route_applications[route] += 1
        for i, stage in enumerate(path):
            s = result.stages[stage]
            s.reached += 1
            if any(kinds.get(later) != "closed" for later in path[i + 1 :]):
                s.moved_on += 1
            result.route_reached[route][stage] += 1
        for stage, entered, left in stays(history):
            if left is not None:
                result.stages[stage].days.append(max(0.0, (left - entered).total_seconds() / 86_400))
    return result


@dataclass
class Week:
    start: date
    added: int = 0  # applications created
    applied: int = 0  # applied_on in the week
    moves: int = 0  # stage moves (not undone)
    interviews: int = 0  # rounds starting in the week (not cancelled)


def weekly_activity(session: Session, start: datetime, weeks: int) -> list[Week]:
    """`weeks` weeks of activity, the first starting at `start` (your local Monday, with its offset)."""
    end = start + timedelta(weeks=weeks)
    result = [Week(start=(start + timedelta(weeks=i)).date()) for i in range(weeks)]

    def bucket(when: datetime) -> Week | None:
        i = int((when - start) // timedelta(weeks=1))
        return result[i] if 0 <= i < weeks else None

    for created in session.scalars(
        select(Application.created_at).where(Application.created_at >= start, Application.created_at < end)
    ):
        if week := bucket(created):
            week.added += 1

    first_day, last_day = result[0].start, result[0].start + timedelta(weeks=weeks)
    for applied in session.scalars(
        select(Application.applied_on).where(Application.applied_on >= first_day, Application.applied_on < last_day)
    ):
        if applied is not None:
            result[(applied - first_day).days // 7].applied += 1

    # An undo is recorded after the move it reverts, so every undo of a move in the window
    # is itself in or after the window.
    changes = list(session.scalars(select(Event).where(Event.kind == STAGE_CHANGE, Event.occurred_at >= start)))
    for ev in _effective_moves(changes):
        if ev.occurred_at < end and (week := bucket(ev.occurred_at)):
            week.moves += 1

    for starts in session.scalars(
        select(Interview.starts_at).where(
            Interview.status != "cancelled", Interview.starts_at >= start, Interview.starts_at < end
        )
    ):
        if starts is not None and (week := bucket(starts)):
            week.interviews += 1
    return result
