"""API routes for external links on any entity (PRD FR12): Google Docs, job ads, repos…"""

from __future__ import annotations

from urllib.parse import urlsplit

from fastapi import APIRouter, HTTPException, Query, Response
from sqlalchemy import select

from ..db.models import Agency, Application, Company, Contact, Interview, Link, Role
from ..domain import applications as svc
from . import schemas as S
from .crud import values
from .deps import SessionDep, get_or_404

router = APIRouter(prefix="/links", tags=["links"])

_MODELS = {
    "application": Application,
    "company": Company,
    "role": Role,
    "agency": Agency,
    "contact": Contact,
    "interview": Interview,
}
_GOOGLE = {"document": "google_doc", "spreadsheets": "google_sheet", "presentation": "google_slides"}
_KIND_NAMES = {
    "google_doc": "Google Doc",
    "google_sheet": "Google Sheet",
    "google_slides": "Google Slides",
    "google_drive": "Google Drive",
    "github": "GitHub",
    "linkedin": "LinkedIn",
}


def link_kind(url: str) -> str:
    parts = urlsplit(url)
    host = (parts.hostname or "").removeprefix("www.")
    first = parts.path.strip("/").split("/")[0] if parts.path.strip("/") else ""
    if host == "docs.google.com":
        return _GOOGLE.get(first, "google_drive")
    if host == "drive.google.com":
        return "google_drive"
    if host == "github.com" or host.endswith(".github.com"):
        return "github"
    if host == "linkedin.com" or host.endswith(".linkedin.com"):
        return "linkedin"
    return "web"


def default_title(url: str) -> str:
    """A readable stand-in when no title is given: "Google Doc", or the site's name."""
    kind = link_kind(url)
    if kind in _KIND_NAMES:
        return _KIND_NAMES[kind]
    return (urlsplit(url).hostname or url).removeprefix("www.")


def _out(link: Link) -> S.LinkOut:
    return S.LinkOut(
        id=link.id,
        entity_type=link.entity_type,
        entity_id=link.entity_id,
        url=link.url,
        title=link.title,
        kind=link_kind(link.url),
        created_at=link.created_at,
    )


@router.get("", response_model=list[S.LinkOut])
def list_links(
    session: SessionDep,
    entity_type: S.EntityRef = Query(),  # noqa: B008
    entity_id: str = Query(),  # noqa: B008
):
    stmt = (
        select(Link)
        .where(Link.entity_type == entity_type, Link.entity_id == entity_id)
        .order_by(Link.created_at, Link.id)
    )
    return [_out(link) for link in session.scalars(stmt)]


@router.post("", response_model=S.LinkOut, status_code=201)
def create_link(body: S.LinkIn, session: SessionDep):
    target = session.get(_MODELS[body.entity_type], body.entity_id)
    if target is None:
        raise HTTPException(422, f"entity_id: {body.entity_type} {body.entity_id} not found")
    data = values(body, partial=False)
    data["title"] = (data.get("title") or "").strip() or default_title(data["url"])
    link = Link(**data)
    session.add(link)
    session.flush()
    if body.entity_type == "application":
        svc.log_activity(session, target, "manual", summary=f"Link added: {link.title}", data={"url": link.url})
    return _out(link)


@router.patch("/{link_id}", response_model=S.LinkOut)
def update_link(link_id: str, body: S.LinkPatch, session: SessionDep):
    link = get_or_404(session, Link, link_id)
    data = values(body, partial=True)
    if "title" in data:
        data["title"] = (data["title"] or "").strip() or default_title(data.get("url") or link.url)
    for key, value in data.items():
        setattr(link, key, value)
    session.flush()
    return _out(link)


@router.delete("/{link_id}", status_code=204)
def delete_link(link_id: str, session: SessionDep):
    session.delete(get_or_404(session, Link, link_id))
    session.flush()
    return Response(status_code=204)
