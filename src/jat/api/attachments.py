"""API routes for attachments (PRD FR13): files stored under files/ in the data directory."""

from __future__ import annotations

import contextlib
import mimetypes

from fastapi import APIRouter, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Application, Attachment
from ..domain import applications as svc
from ..storage.files import FileError, FileStore, TooLarge
from . import schemas as S
from .deps import ENTITY_MODELS, SessionDep, get_or_404

router = APIRouter(prefix="/attachments", tags=["attachments"])

# Only these open in the browser. Anything else (HTML, SVG, scripts…) is downloaded, so a file
# can never run as a page on the app's own origin.
INLINE_TYPES = {"application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"}


def _store(request: Request) -> FileStore:
    return FileStore(request.app.state.jat.data_dir)


def _out(att: Attachment) -> S.AttachmentOut:
    return S.AttachmentOut(
        id=att.id,
        entity_type=att.entity_type,
        entity_id=att.entity_id,
        original_name=att.original_name,
        content_type=att.content_type,
        size=att.size,
        sha256=att.sha256,
        path=att.path,
        created_at=att.created_at,
        url=f"/api/v1/attachments/{att.id}/file",
        inline=att.content_type in INLINE_TYPES,
    )


def _check_entity(session: Session, entity_type: str | None, entity_id: str | None):
    if (entity_type is None) != (entity_id is None):
        raise HTTPException(422, "Give both entity_type and entity_id, or neither")
    if entity_type is None:
        return None
    model = ENTITY_MODELS.get(entity_type)
    if model is None:
        raise HTTPException(422, f"entity_type must be one of {', '.join(ENTITY_MODELS)}")
    target = session.get(model, entity_id)
    if target is None:
        raise HTTPException(422, f"entity_id: {entity_type} {entity_id} not found")
    return target


@router.get("", response_model=list[S.AttachmentOut])
def list_attachments(
    session: SessionDep,
    entity_type: str | None = None,
    entity_id: str | None = None,
    unattached: bool = False,
):
    """Files on one thing (`entity_type` + `entity_id`), `unattached` ones, or all of them, newest first."""
    stmt = select(Attachment)
    if unattached:
        stmt = stmt.where(Attachment.entity_type.is_(None))
    elif entity_type or entity_id:
        stmt = stmt.where(Attachment.entity_type == entity_type, Attachment.entity_id == entity_id)
    return [_out(a) for a in session.scalars(stmt.order_by(Attachment.created_at.desc(), Attachment.id))]


@router.post("", response_model=S.AttachmentOut, status_code=201)
def upload_attachment(
    request: Request,
    session: SessionDep,
    file: UploadFile = File(...),  # noqa: B008
    entity_type: str | None = Form(None),  # noqa: B008
    entity_id: str | None = Form(None),  # noqa: B008
):
    target = _check_entity(session, entity_type, entity_id)
    name = (file.filename or "file").replace("\\", "/").rsplit("/", 1)[-1][:300] or "file"
    guessed = mimetypes.guess_type(name)[0]
    try:
        stored = _store(request).save(file.file, name)
    except TooLarge as exc:
        raise HTTPException(413, str(exc)) from exc
    except FileError as exc:
        raise HTTPException(422, str(exc)) from exc
    att = Attachment(
        id=stored.id,
        entity_type=entity_type,
        entity_id=entity_id,
        path=stored.path,
        original_name=name,
        content_type=guessed or file.content_type or "application/octet-stream",
        size=stored.size,
        sha256=stored.sha256,
    )
    session.add(att)
    session.flush()
    if isinstance(target, Application):
        svc.log_activity(session, target, "file", summary=f"File added: {name}", data={"attachment_id": att.id})
    return _out(att)


@router.get("/{attachment_id}", response_model=S.AttachmentOut)
def get_attachment(attachment_id: str, session: SessionDep):
    return _out(get_or_404(session, Attachment, attachment_id))


@router.get("/{attachment_id}/file", response_class=FileResponse)
def download_attachment(attachment_id: str, request: Request, session: SessionDep):
    att = get_or_404(session, Attachment, attachment_id)
    try:
        path = _store(request).resolve(att.path)
    except FileError as exc:
        raise HTTPException(404, str(exc)) from exc
    if not path.is_file():
        raise HTTPException(404, f"{att.original_name} is missing from files/")
    inline = att.content_type in INLINE_TYPES
    return FileResponse(
        path,
        media_type=att.content_type if inline else "application/octet-stream",
        filename=att.original_name,
        content_disposition_type="inline" if inline else "attachment",
        headers={"X-Content-Type-Options": "nosniff"},
    )


@router.patch("/{attachment_id}", response_model=S.AttachmentOut)
def update_attachment(attachment_id: str, body: S.AttachmentPatch, session: SessionDep):
    att = get_or_404(session, Attachment, attachment_id)
    data = body.model_dump(exclude_unset=True)
    if "entity_type" in data or "entity_id" in data:
        entity_type = data.get("entity_type", att.entity_type)
        entity_id = data.get("entity_id", att.entity_id)
        _check_entity(session, entity_type, entity_id)
    if "original_name" in data:
        data["original_name"] = data["original_name"].strip()
    for key, value in data.items():
        setattr(att, key, value)
    session.flush()
    return _out(att)


@router.delete("/{attachment_id}", status_code=204)
def delete_attachment(attachment_id: str, request: Request, session: SessionDep):
    att = get_or_404(session, Attachment, attachment_id)
    path = att.path
    session.delete(att)
    session.flush()
    with contextlib.suppress(FileError):  # a path the store refuses to touch: leave it be
        _store(request).delete(path)
    return Response(status_code=204)
