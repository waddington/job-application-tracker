"""Interview rounds (PRD FR9, FR9a, FR10).

Each interview for an application is a numbered round with Kai's own description of it:
"Round 2 · Engineering manager chat". The board and list show the application's current round:
the next one still to happen, or, once they have all happened, the latest one.
"""

from collections.abc import Iterable
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.orm import Session, load_only

from jat.db.models import Application, Interview

from . import applications as svc

KIND_NAMES = {
    "screen": "Screen",
    "hiring_manager": "Hiring manager",
    "technical": "Technical",
    "coding_task": "Coding task",
    "system_design": "System design",
    "pairing": "Pairing",
    "behavioural": "Behavioural",
    "onsite": "Onsite",
    "final": "Final",
    "other": "Interview",
}


def label(interview: Interview) -> str:
    """A label such as "Round 2 · System design test"; the kind stands in for a missing description."""
    what = interview.title or KIND_NAMES.get(interview.kind, interview.kind)
    return f"Round {interview.round} · {what}" if interview.round else what


def next_round(session: Session, application_id: str) -> int:
    highest = session.scalar(select(func.max(Interview.round)).where(Interview.application_id == application_id))
    return (highest or 0) + 1


def _when(interview: Interview) -> datetime:
    return interview.starts_at or interview.deadline_at or interview.created_at


def current_rounds(session: Session, application_ids: Iterable[str]) -> dict[str, Interview]:
    """For each application: the next scheduled round, else the latest round that happened."""
    ids = list(set(application_ids))
    if not ids:
        return {}
    by_app: dict[str, list[Interview]] = {}
    # Only what the summary needs: prep, debrief and questions can be long.
    columns = load_only(
        Interview.application_id,
        Interview.round,
        Interview.title,
        Interview.kind,
        Interview.status,
        Interview.starts_at,
        Interview.deadline_at,
        Interview.created_at,
    )
    for interview in session.scalars(select(Interview).options(columns).where(Interview.application_id.in_(ids))):
        by_app.setdefault(interview.application_id, []).append(interview)
    out: dict[str, Interview] = {}
    for app_id, interviews in by_app.items():
        upcoming = [i for i in interviews if i.status == "scheduled"]
        if upcoming:
            out[app_id] = min(upcoming, key=lambda i: (i.round or 0, _when(i), i.id))
            continue
        happened = [i for i in interviews if i.status == "done"]
        if happened:
            out[app_id] = max(happened, key=lambda i: (i.round or 0, _when(i), i.id))
    return out


def record(session: Session, app: Application, interview: Interview, what: str) -> None:
    """Put an interview change on the application's timeline ("Round 2 · System design test scheduled")."""
    svc.log_activity(
        session,
        app,
        "interview",
        summary=f"{label(interview)} {what}",
        data={"interview_id": interview.id, "round": interview.round, "status": interview.status},
    )
