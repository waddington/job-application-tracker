"""API routes for Markdown notes (PRD FR11). The .md files under notes/ are the source of truth."""

from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Agency, Application, Company, Contact, Interview, NoteIndex, Role
from ..domain import applications as svc
from ..storage.notes import Note, NoteError, NoteStore
from . import schemas as S
from .deps import SessionDep

router = APIRouter(prefix="/notes", tags=["notes"])

_MODELS = {
    "application": Application,
    "company": Company,
    "role": Role,
    "agency": Agency,
    "contact": Contact,
    "interview": Interview,
}


def _store(request: Request) -> NoteStore:
    return NoteStore(request.app.state.jat.data_dir)


def _excerpt(body: str, limit: int = 180) -> str:
    # A plain-text taste of the Markdown: no table rules, checkboxes, pipes or markup characters.
    text = re.sub(r"^\s*\|?[\s:|-]+\|?\s*$", " ", body, flags=re.MULTILINE)
    text = re.sub(r"\[[ xX]\]", " ", text)
    text = re.sub(r"[*_`~]+", "", text)  # emphasis and code markers vanish
    text = re.sub(r"[#>\[\]()!|-]+", " ", text)
    text = " ".join(text.split())
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def _summary(note: Note) -> S.NoteSummary:
    return S.NoteSummary(
        id=note.id,
        title=note.title,
        links=note.links,
        path=note.path,
        excerpt=_excerpt(note.body),
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


def _out(note: Note) -> S.NoteOut:
    return S.NoteOut(**_summary(note).model_dump(), body=note.body)


def _check_links(session: Session, links: list[str]) -> list[str]:
    unique = list(dict.fromkeys(links))
    for link in unique:
        kind, _, target = link.partition(":")
        if session.get(_MODELS[kind], target) is None:
            raise HTTPException(422, f"links: {kind} {target} not found")
    return unique


def _load(session: Session, store: NoteStore, note_id: str) -> Note:
    store.sync_index(session)
    row = session.get(NoteIndex, note_id)
    if row is None:
        raise HTTPException(404, f"Note {note_id} not found")
    note = store.read(row.path)
    note.id = row.id  # the index decides ids for copied or hand-written files
    return note


def _log(session: Session, note: Note, links: list[str], what: str) -> None:
    """Put the note on the timeline of each application it's attached to."""
    for link in links:
        kind, _, target = link.partition(":")
        if kind == "application" and (app := session.get(Application, target)) is not None:
            svc.log_activity(session, app, "note", summary=f"{what}: {note.title}", data={"note_id": note.id})


@router.get("", response_model=list[S.NoteSummary])
def list_notes(request: Request, session: SessionDep, entity: str | None = None, q: str | None = None):
    """Notes, newest first. `entity=application:<id>` keeps those attached to it; `entity=none` general notes."""
    store = _store(request)
    store.sync_index(session)
    rows = session.scalars(select(NoteIndex).order_by(NoteIndex.updated_at.desc(), NoteIndex.id)).all()
    if entity == "none":
        rows = [r for r in rows if not r.links]
    elif entity:
        rows = [r for r in rows if entity in r.links]
    out = []
    needle = (q or "").strip().lower()
    for row in rows:
        note = store.read(row.path)
        note.id = row.id
        if needle and needle not in note.title.lower() and needle not in note.body.lower():
            continue
        out.append(_summary(note))
    return out


@router.post("", response_model=S.NoteOut, status_code=201)
def create_note(body: S.NoteIn, request: Request, session: SessionDep):
    store = _store(request)
    links = _check_links(session, body.links)
    try:
        note = store.create(body.title, body.body, links)
    except NoteError as exc:
        raise HTTPException(422, str(exc)) from exc
    store.index(session, note)
    _log(session, note, links, "Note added")
    return _out(note)


@router.get("/{note_id}", response_model=S.NoteOut)
def get_note(note_id: str, request: Request, session: SessionDep):
    return _out(_load(session, _store(request), note_id))


@router.patch("/{note_id}", response_model=S.NoteOut)
def update_note(note_id: str, body: S.NotePatch, request: Request, session: SessionDep):
    store = _store(request)
    note = _load(session, store, note_id)
    data = body.model_dump(exclude_unset=True)
    if "links" in data:
        data["links"] = _check_links(session, data["links"])
    before = set(note.links)
    for key, value in data.items():
        setattr(note, key, value)
    try:
        store.save(note)
    except NoteError as exc:
        raise HTTPException(422, str(exc)) from exc
    store.index(session, note)
    _log(session, note, [link for link in note.links if link not in before], "Note added")
    return _out(note)


@router.delete("/{note_id}", status_code=204)
def delete_note(note_id: str, request: Request, session: SessionDep):
    store = _store(request)
    note = _load(session, store, note_id)
    store.delete(note.path)
    row = session.get(NoteIndex, note.id)
    if row is not None:
        session.delete(row)
    return Response(status_code=204)
