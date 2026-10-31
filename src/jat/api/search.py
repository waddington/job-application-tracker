"""Full-text search (P6): one box that finds anything."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel
from sqlalchemy import select

from ..db.models import NoteIndex
from ..domain import search as svc
from .deps import SessionDep
from .notes import _UNREADABLE, _sync
from .schemas import EventMsg, read_event_msg

router = APIRouter(tags=["search"])


class SearchHit(BaseModel):
    # application | role | company | agency | contact | interview | meeting | todo | offer | timeline | note
    # | document | file | link
    kind: str
    id: str
    title: str
    subtitle: str | None
    link: str  # where to open it in the app (a path), or an external URL for a link
    snippet: str | None  # text around the first match, when it isn't in the title
    updated: datetime | None
    archived: bool  # an archived application (listed last)
    # What the frontend builds a title from, in your language; `title` stays in English.
    round: int | None = None  # an interview's round
    own_title: str | None = None  # what an interview or call is called, as you wrote it
    subkind: str | None = None  # an interview's or a call's kind
    done: bool = False  # a to-do that's done
    msg: EventMsg | None = None  # a timeline entry's saved message; it's found by its English `title`


@router.get("/search", response_model=list[SearchHit])
def search(
    request: Request,
    session: SessionDep,
    q: str = Query(min_length=1, max_length=200),
    limit: int = Query(50, ge=1, le=200),
):
    """Everything matching every word of `q`: applications, companies, agencies, people and
    their contact details, interview prep and debriefs, calls, to-dos, offers, timeline entries, notes,
    documents, files, emails and links. Title matches first, then the most recent.
    """
    # Each search reads every table and every note file (after syncing the note index): fine
    # for one person's job hunt, and it runs on submit, not on each keystroke.
    store = _sync(request)
    notes = []
    for row in session.scalars(select(NoteIndex)):
        try:
            notes.append((row, store.read(row.path).body))
        except _UNREADABLE:  # changed or vanished since the sync; skip it
            continue
    return [
        SearchHit(
            kind=h.kind,
            id=h.id,
            title=h.title,
            subtitle=h.subtitle,
            link=h.link,
            snippet=h.snippet,
            updated=h.updated,
            archived=h.archived,
            round=h.round,
            own_title=h.own_title,
            subkind=h.subkind,
            done=h.done,
            msg=read_event_msg(h.event_data),
        )
        for h in svc.search(session, q, notes=notes, limit=limit)
    ]
