"""How applications flow through the stages (PRD FR19), from the event history.

Each application's path is its first stage and then every stage move that wasn't undone, in
the order they happened. A Sankey diagram can't draw loops, so paths are folded forwards in
workflow order (active stages, then success and closed ones): a move back to an earlier stage,
or a reopened Ghosted application, counts as staying at the furthest stage reached. The
history itself is untouched; this is only how the picture is drawn.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import Application, Event

from .applications import STAGE_CHANGE, _effective_moves
from .workflow import Workflow


@dataclass
class Flow:
    applications: int = 0
    reached: Counter[str] = field(default_factory=Counter)  # stage -> applications that got there
    links: Counter[tuple[str, str]] = field(default_factory=Counter)  # (from, to) -> applications
    current: Counter[str] = field(default_factory=Counter)  # where they are now (folded)


def _rank(workflow: Workflow) -> dict[str, int]:
    """Active stages in workflow order first, then success, then closed: a left-to-right order."""
    order = [s for s in workflow.stages if s.is_active]
    order += [s for s in workflow.stages if s.kind == "success"]
    order += [s for s in workflow.stages if s.kind == "closed"]
    return {s.id: i for i, s in enumerate(order)}


def stage_path(events: list[Event]) -> list[str]:
    """First stage, then the stages moved to (undone moves left out), in time order."""
    stage_events = [ev for ev in events if ev.kind == STAGE_CHANGE]
    first = next((ev for ev in stage_events if ev.from_stage is None), None)
    if first is None or first.to_stage is None:
        return []
    moves = sorted(_effective_moves(events), key=lambda ev: (ev.occurred_at, ev.seq))
    return [first.to_stage, *(ev.to_stage for ev in moves if ev.to_stage)]


def fold_forward(path: list[str], rank: dict[str, int]) -> list[str]:
    """Keep only moves to a later stage, so the flow has no loops (unknown stages go last)."""
    last = len(rank)
    folded: list[str] = []
    for stage in path:
        if not folded or rank.get(stage, last) > rank.get(folded[-1], last):
            folded.append(stage)
    return folded


def flow(
    session: Session,
    workflow: Workflow,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
    route: str | None = None,
) -> Flow:
    """Applications added in [since, until) (and by `route`), counted along their folded paths."""
    stmt = select(Application.id)
    if since is not None:
        stmt = stmt.where(Application.created_at >= since)
    if until is not None:
        stmt = stmt.where(Application.created_at < until)
    if route:
        stmt = stmt.where(Application.route == route)
    ids = list(session.scalars(stmt))
    events: dict[str, list[Event]] = {i: [] for i in ids}
    if ids:
        for ev in session.scalars(select(Event).where(Event.application_id.in_(ids)).order_by(Event.seq)):
            events[ev.application_id].append(ev)

    rank = _rank(workflow)
    result = Flow()
    for app_id in ids:
        path = fold_forward(stage_path(events[app_id]), rank)
        if not path:
            continue
        result.applications += 1
        result.current[path[-1]] += 1
        for stage in path:
            result.reached[stage] += 1
        for a, b in zip(path, path[1:], strict=False):
            result.links[(a, b)] += 1
    return result
