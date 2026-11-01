"""How often booked rounds moved, and who needed it (PRD FR9b), for applications added in a period.

A round counts its moves as the larger of `rescheduled_count` and its readable saved records, so
one saved before moves kept a record, or with a bad record, still counts. Any move without a who
is `not_recorded`: nothing here guesses who an older move was down to. A move has no date of its
own to filter on (older ones have none at all), so a period goes by when the application was added.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import Application, Company, Contact, Event, Interview, Role

# Below this, a few moves could look like a pattern when they aren't one.
MIN_ROUNDS_TO_LIST = 3


class SavedMove(Protocol):
    by: str | None


ReadMove = Callable[[str, Any], SavedMove | None]


@dataclass
class Named:
    id: str
    name: str
    moved_rounds: int = 0
    moves: int = 0


@dataclass
class Rescheduling:
    booked_rounds: int = 0  # had a time at some point; a take-home with only a deadline can't move
    moved_rounds: int = 0
    moves: int = 0  # one round can move more than once
    by: Counter[str] = field(default_factory=Counter)  # me | them | mutual | neither
    not_recorded: int = 0
    companies: list[Named] = field(default_factory=list)  # at least MIN_ROUNDS_TO_LIST moved rounds
    recruiters: list[Named] = field(default_factory=list)


def _listed(named: dict[str, Named]) -> list[Named]:
    found = (n for n in named.values() if n.moved_rounds >= MIN_ROUNDS_TO_LIST)
    return sorted(found, key=lambda n: (-n.moved_rounds, -n.moves, n.name.casefold(), n.id))


def rescheduling(
    session: Session,
    read_move: ReadMove,
    *,
    since: datetime | None = None,
    until: datetime | None = None,
) -> Rescheduling:
    """Rounds on applications added in [since, until). A removed round isn't counted, as its record
    can't be told from one that never was. `read_move` reads an event's saved record."""
    conds = []
    if since is not None:
        conds.append(Application.created_at >= since)
    if until is not None:
        conds.append(Application.created_at < until)
    rounds = session.execute(
        select(Interview, Company.id, Company.name, Contact.id, Contact.name)
        .join(Application, Interview.application_id == Application.id)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
        .outerjoin(Contact, Application.recruiter_id == Contact.id)
        .where(*conds)
    ).all()

    saved: dict[str, list[str | None]] = defaultdict(list)
    events = select(Event.kind, Event.data).where(
        Event.kind == "interview", Event.application_id.in_(select(Application.id).where(*conds))
    )
    for kind, data in session.execute(events):
        move = read_move(kind, data)
        round_id = data.get("interview_id") if move is not None else None
        if isinstance(round_id, str):  # a hand-edited export can hold anything
            saved[round_id].append(move.by)

    result = Rescheduling()
    companies: dict[str, Named] = {}
    recruiters: dict[str, Named] = {}
    for interview, company_id, company_name, recruiter_id, recruiter_name in rounds:
        said = saved.get(interview.id, [])
        moves = max(interview.rescheduled_count or 0, len(said))
        if interview.starts_at is None and not moves:
            continue
        result.booked_rounds += 1
        if not moves:
            continue
        result.moved_rounds += 1
        result.moves += moves
        known = [by for by in said if by]
        result.by.update(known)
        result.not_recorded += moves - len(known)
        for named, key, name in (
            (companies, company_id, company_name),
            (recruiters, recruiter_id, recruiter_name),
        ):
            if key is not None:
                entry = named.setdefault(key, Named(id=key, name=name))
                entry.moved_rounds += 1
                entry.moves += moves
    result.companies, result.recruiters = _listed(companies), _listed(recruiters)
    return result
