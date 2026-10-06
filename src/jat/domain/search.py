"""Full-text search across everything (P6 `search`).

Every word of the query must appear somewhere in a record's searchable text (case- and
accent-insensitive). Local data is small, so this is a scan in Python rather than an index to
keep in sync; notes are read from their Markdown files, which are the source of truth.

Each hit says what it is, where to open it in the app, and a snippet around the first match.
Hits whose title matches come first, then the most recently changed.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Callable, Iterable, Iterator
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import (
    Agency,
    Application,
    Attachment,
    Company,
    Contact,
    ContactDetail,
    Document,
    DocumentVersion,
    Event,
    Interview,
    Link,
    Meeting,
    NoteIndex,
    Offer,
    Role,
    Todo,
)

SNIPPET = 70  # characters either side of the match


def fold(text: str) -> str:
    """Lower case without accents: "Zürich" matches "zurich"."""
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(c))


def terms(query: str) -> list[str]:
    return [fold(t) for t in query.split() if t.strip()]


@dataclass
class Candidate:
    kind: str  # application | company | agency | contact | interview | note | document | offer | timeline | file | link
    id: str
    title: str
    link: str  # where to open it in the app
    subtitle: str | None = None
    fields: list[str] = field(default_factory=list)  # searchable text besides the title
    updated: datetime | None = None
    # Is the subtitle searchable? Not when it only names the application something belongs to:
    # otherwise "contoso" would list every interview and call for every Contoso application.
    subtitle_searchable: bool = True
    archived: bool = False  # an archived application: shown, but after everything else


@dataclass
class Hit:
    kind: str
    id: str
    title: str
    subtitle: str | None
    link: str
    snippet: str | None  # text around the first match outside the title
    title_match: bool
    updated: datetime | None
    archived: bool = False


def _snippet(text: str, words: list[str]) -> str | None:
    flat = re.sub(r"\s+", " ", text).strip()
    folded = fold(flat)
    # fold() can change lengths (ß -> ss); fall back to the start if positions drift.
    positions = [folded.find(w) for w in words if w in folded]
    if not positions:
        return None
    at = min(positions) if len(folded) == len(flat) else 0
    start, end = max(0, at - SNIPPET), min(len(flat), at + SNIPPET)
    return ("…" if start else "") + flat[start:end].strip() + ("…" if end < len(flat) else "")


def match(candidate: Candidate, words: list[str]) -> Hit | None:
    title = fold(candidate.title)
    body = [f for f in candidate.fields if f]
    subtitle = fold(candidate.subtitle or "") if candidate.subtitle_searchable else ""
    everything = " ".join([title, subtitle, *(fold(f) for f in body)])
    if not all(w in everything for w in words):
        return None
    title_match = all(w in title for w in words)
    snippet = None
    if not title_match:
        for text in body:
            if any(w in fold(text) for w in words):
                snippet = _snippet(text, words)
                break
    return Hit(
        candidate.kind,
        candidate.id,
        candidate.title,
        candidate.subtitle,
        candidate.link,
        snippet,
        title_match,
        candidate.updated,
        candidate.archived,
    )


# --- where things open ---------------------------------------------------------------------


class Places:
    """In-app paths for entities, loaded once per search."""

    def __init__(self, session: Session):
        self.contacts = {c.id: c for c in session.scalars(select(Contact))}
        self.roles = {r.id: r for r in session.scalars(select(Role))}
        self.interviews = dict(session.execute(select(Interview.id, Interview.application_id)).all())

    def path(self, entity_type: str | None, entity_id: str | None) -> str | None:
        if not entity_type or not entity_id:
            return None
        if entity_type == "application":
            return f"/applications/{entity_id}"
        if entity_type == "company":
            return f"/companies/{entity_id}"
        if entity_type == "agency":
            return f"/agencies/{entity_id}"
        if entity_type == "role" and entity_id in self.roles:
            return f"/roles/{entity_id}"
        if entity_type == "interview" and (app_id := self.interviews.get(entity_id)):
            return f"/applications/{app_id}"
        if entity_type == "contact" and entity_id in self.contacts:
            return f"/people/{entity_id}"
        if entity_type == "document":
            return "/documents"
        return None


# --- sources -------------------------------------------------------------------------------


def _applications(session: Session, places: Places) -> Iterator[Candidate]:
    rows = session.execute(
        select(Application, Role.title, Role.location, Role.description, Company.name, Agency.name)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
        .outerjoin(Agency, Application.agency_id == Agency.id)
    )
    for app, role_title, location, description, company, agency in rows:
        recruiter = places.contacts.get(app.recruiter_id or "")
        yield Candidate(
            "application",
            app.id,
            f"{company} · {role_title}",
            f"/applications/{app.id}",
            subtitle=" · ".join(x for x in (agency, recruiter.name if recruiter else None) if x) or None,
            fields=[location or "", " ".join(app.tags or []), description or ""],
            updated=app.updated_at,
            archived=app.archived,
        )


def _companies(session: Session, places: Places) -> Iterator[Candidate]:
    names: dict[str, str] = {}
    for c in session.scalars(select(Company)):
        names[c.id] = c.name
        yield Candidate(
            "company",
            c.id,
            c.name,
            f"/companies/{c.id}",
            fields=[c.website or "", c.description or ""],
            updated=c.updated_at,
        )
    for a in session.scalars(select(Agency)):
        yield Candidate("agency", a.id, a.name, f"/agencies/{a.id}", fields=[a.website or ""], updated=a.updated_at)
    # Roles, by title and what you noted about them. Their company's name isn't searched here,
    # or "contoso" would list every Contoso role as well as every application.
    for r in places.roles.values():
        yield Candidate(
            "role",
            r.id,
            r.title,
            f"/roles/{r.id}",
            subtitle=names.get(r.company_id),
            subtitle_searchable=False,
            fields=[r.location or "", r.description or "", r.decision_reason or ""],
            updated=r.updated_at,
        )


def _contacts(session: Session, places: Places) -> Iterator[Candidate]:
    details: dict[str, list[str]] = {}
    for d in session.scalars(select(ContactDetail)):
        details.setdefault(d.contact_id, []).append(d.value)
    for c in places.contacts.values():
        yield Candidate(
            "contact",
            c.id,
            c.name,
            f"/people/{c.id}",
            subtitle=c.title,
            fields=details.get(c.id, []),
            updated=c.updated_at,
        )


def _app_titles(session: Session) -> dict[str, str]:
    rows = session.execute(
        select(Application.id, Company.name, Role.title)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
    )
    return {app_id: f"{company} · {title}" for app_id, company, title in rows}


def _activity(session: Session, places: Places) -> Iterator[Candidate]:
    apps = _app_titles(session)
    for i in session.scalars(select(Interview)):
        label = f"Round {i.round} · {i.title}" if i.round and i.title else (i.title or i.kind.replace("_", " ").title())
        yield Candidate(
            "interview",
            i.id,
            label,
            f"/applications/{i.application_id}",
            subtitle=apps.get(i.application_id),
            fields=[i.prep or "", i.debrief or "", i.questions or "", i.task_instructions or "", i.location or ""],
            subtitle_searchable=False,
            updated=i.updated_at,
        )
    # Calls and meetings with people: what they were about and how they went.
    for m in session.scalars(select(Meeting)):
        who = places.contacts.get(m.contact_id)
        kind = {"call": "Call", "video": "Video call", "in_person": "Meeting"}.get(m.kind, m.kind)
        yield Candidate(
            "meeting",
            m.id,
            f"{kind}: {m.title}" if m.title else kind,
            f"/people/{m.contact_id}",
            subtitle=who.name if who else None,
            fields=[m.agenda or "", m.notes or "", m.location or ""],
            subtitle_searchable=False,
            updated=m.updated_at,
        )
    # Your to-dos, open and done: they open where they belong.
    for t in session.scalars(select(Todo)):
        yield Candidate(
            "todo",
            t.id,
            t.text,
            places.path(t.entity_type, t.entity_id) or "/next-actions",
            subtitle="Done" if t.done_at else None,
            subtitle_searchable=False,
            updated=t.updated_at,
        )
    for o in session.scalars(select(Offer)):
        yield Candidate(
            "offer",
            o.id,
            "Offer",
            f"/applications/{o.application_id}",
            subtitle=apps.get(o.application_id),
            subtitle_searchable=False,
            fields=[o.equity or "", o.benefits or "", o.notes or ""],
            updated=o.updated_at,
        )
    # Timeline entries with words in them: calls, emails, notes about the application.
    for e in session.scalars(select(Event).where(Event.summary.is_not(None), Event.kind != "stage_change")):
        yield Candidate(
            "timeline",
            e.id,
            e.summary or "",
            f"/applications/{e.application_id}",
            subtitle=apps.get(e.application_id),
            subtitle_searchable=False,
            updated=e.occurred_at,
        )


def _files(session: Session, places: Places) -> Iterator[Candidate]:
    for a in session.scalars(select(Attachment)):
        meta = a.meta or {}
        yield Candidate(
            "file",
            a.id,
            meta.get("subject") or a.original_name,
            places.path(a.entity_type, a.entity_id) or f"/api/v1/attachments/{a.id}/file",
            subtitle=a.original_name if meta.get("subject") else None,
            fields=[" ".join(meta.get("from") or []), meta.get("snippet") or ""],
            updated=a.created_at,
        )
    for link in session.scalars(select(Link)):
        yield Candidate(
            "link",
            link.id,
            link.title or link.url,
            places.path(link.entity_type, link.entity_id) or link.url,
            subtitle=link.url if link.title else None,
            updated=link.created_at,
        )
    docs = {d.id: d for d in session.scalars(select(Document))}
    for d in docs.values():
        yield Candidate("document", d.id, d.name, "/documents", updated=d.updated_at)
    for v in session.scalars(select(DocumentVersion)):
        doc = docs.get(v.document_id)
        yield Candidate(
            "document",
            v.id,
            f"{doc.name if doc else 'Document'} · {v.label}",
            "/documents",
            fields=[v.notes or ""],
            updated=v.created_at,
        )


SOURCES: tuple[Callable[[Session, Places], Iterable[Candidate]], ...] = (
    _applications,
    _companies,
    _contacts,
    _activity,
    _files,
)


def notes_candidates(rows: Iterable[tuple[NoteIndex, str]], places: Places) -> Iterator[Candidate]:
    """Notes, given (index row, body) pairs; they open on the first thing they're attached to."""
    for row, body in rows:
        target = next((p for link in row.links if (p := places.path(*link.partition(":")[::2]))), None)
        yield Candidate("note", row.id, row.title, target or "/notes", fields=[body], updated=row.updated_at)


def search(session: Session, query: str, *, notes: Iterable[tuple[NoteIndex, str]] = (), limit: int = 50) -> list[Hit]:
    words = terms(query)
    if not words:
        return []
    places = Places(session)
    hits: list[Hit] = []
    for source in SOURCES:
        hits.extend(h for c in source(session, places) if (h := match(c, words)))
    hits.extend(h for c in notes_candidates(notes, places) if (h := match(c, words)))
    hits.sort(key=lambda h: (h.archived, not h.title_match, -(h.updated.timestamp() if h.updated else 0)))
    return hits[:limit]
