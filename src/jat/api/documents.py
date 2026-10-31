"""API routes for CVs and cover letters as versioned documents (PRD FR14).

A document ("Backend CV") has versions ("v3 (fintech)"), each usually with its file stored as an
attachment on the document. Applications record which versions were sent, and each document
shows where it was used.
"""

from __future__ import annotations

import contextlib
import mimetypes
import re
import unicodedata

from fastapi import APIRouter, File, Form, Request, Response, UploadFile
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db.models import (
    Application,
    ApplicationContact,
    ApplicationDocument,
    Attachment,
    Company,
    Contact,
    Document,
    DocumentVersion,
    Role,
)
from ..db.types import utcnow
from ..domain import applications as svc
from ..domain.workflow import Workflow
from ..storage.files import FileError, FileStore, TooLarge
from . import schemas as S
from .attachments import _out as attachment_out
from .crud import values
from .deps import SessionDep, WorkflowDep, get_or_404
from .errors import CodedError, ErrorCode

router = APIRouter(tags=["documents"])


def _versions(session: Session, document_ids: list[str]) -> dict[str, list[S.VersionOut]]:
    if not document_ids:
        return {}
    versions = session.scalars(
        select(DocumentVersion)
        .where(DocumentVersion.document_id.in_(document_ids))
        .order_by(DocumentVersion.created_at.desc(), DocumentVersion.id.desc())
    ).all()
    ids = [v.id for v in versions]
    counts = dict(
        session.execute(
            select(ApplicationDocument.document_version_id, func.count())
            .where(ApplicationDocument.document_version_id.in_(ids))
            .group_by(ApplicationDocument.document_version_id)
        ).all()
    )
    files = {
        a.id: a
        for a in session.scalars(
            select(Attachment).where(Attachment.id.in_([v.attachment_id for v in versions if v.attachment_id]))
        )
    }
    out: dict[str, list[S.VersionOut]] = {}
    for v in versions:
        att = files.get(v.attachment_id) if v.attachment_id else None
        out.setdefault(v.document_id, []).append(
            S.VersionOut(
                id=v.id,
                document_id=v.document_id,
                label=v.label,
                notes=v.notes,
                created_at=v.created_at,
                file=attachment_out(att) if att else None,
                used_in=counts.get(v.id, 0),
            )
        )
    return out


def _log_sent(session: Session, app: Application, doc: Document, version: DocumentVersion) -> None:
    """Put a sent version on the application's timeline."""
    kind, key = {
        "cv": ("CV", "event.cvSent"),
        "cover_letter": ("Cover letter", "event.coverLetterSent"),
    }.get(doc.kind, ("Document", "event.documentSent"))
    svc.log_message(
        session,
        app,
        "file",
        key=key,
        params={"name": doc.name, "label": version.label},
        summary=f"{kind} sent: {doc.name} {version.label}",
        data={"document_version_id": version.id},
    )


def _doc_out(doc: Document, versions: list[S.VersionOut]) -> S.DocumentOut:
    return S.DocumentOut(
        id=doc.id,
        kind=doc.kind,
        name=doc.name,
        created_at=doc.created_at,
        updated_at=doc.updated_at,
        versions=versions,
    )


def _usages(session: Session, workflow: Workflow, document_id: str) -> list[S.DocumentUsage]:
    rows = session.execute(
        select(ApplicationDocument, DocumentVersion, Application, Role, Company)
        .join(DocumentVersion, ApplicationDocument.document_version_id == DocumentVersion.id)
        .join(Application, ApplicationDocument.application_id == Application.id)
        .join(Role, Application.role_id == Role.id)
        .join(Company, Role.company_id == Company.id)
        .where(DocumentVersion.document_id == document_id)
        .order_by(ApplicationDocument.sent_on.desc().nulls_last(), Company.name)
    ).all()
    return [
        S.DocumentUsage(
            link_id=link.id,
            application_id=app.id,
            company_name=company.name,
            role_title=role.title,
            stage_name=workflow.stage(app.stage).name if workflow.has(app.stage) else app.stage,
            version_id=version.id,
            version_label=version.label,
            sent_on=link.sent_on,
        )
        for link, version, app, role, company in rows
    ]


def sent_documents(session: Session, application_id: str) -> list[S.SentDocumentOut]:
    """The document versions sent with one application (for its detail)."""
    rows = session.execute(
        select(ApplicationDocument, DocumentVersion, Document)
        .join(DocumentVersion, ApplicationDocument.document_version_id == DocumentVersion.id)
        .join(Document, DocumentVersion.document_id == Document.id)
        .where(ApplicationDocument.application_id == application_id)
        .order_by(Document.kind, Document.name)
    ).all()
    return [
        S.SentDocumentOut(
            id=link.id,
            document_id=doc.id,
            document_name=doc.name,
            kind=doc.kind,
            version_id=version.id,
            version_label=version.label,
            sent_on=link.sent_on,
            file_url=f"/api/v1/attachments/{version.attachment_id}/file" if version.attachment_id else None,
        )
        for link, version, doc in rows
    ]


# --- documents ---------------------------------------------------------------------------


@router.get("/documents", response_model=list[S.DocumentOut])
def list_documents(session: SessionDep):
    docs = session.scalars(select(Document).order_by(Document.kind, func.lower(Document.name))).all()
    versions = _versions(session, [d.id for d in docs])
    return [_doc_out(d, versions.get(d.id, [])) for d in docs]


@router.post("/documents", response_model=S.DocumentOut, status_code=201)
def create_document(body: S.DocumentIn, session: SessionDep):
    doc = Document(kind=body.kind, name=body.name.strip())
    session.add(doc)
    session.flush()
    return _doc_out(doc, [])


@router.get("/documents/{document_id}", response_model=S.DocumentDetail)
def get_document(document_id: str, session: SessionDep, workflow: WorkflowDep):
    doc = get_or_404(session, Document, document_id)
    return S.DocumentDetail(
        **_doc_out(doc, _versions(session, [doc.id]).get(doc.id, [])).model_dump(),
        used_in=_usages(session, workflow, doc.id),
    )


@router.patch("/documents/{document_id}", response_model=S.DocumentOut)
def update_document(document_id: str, body: S.DocumentPatch, session: SessionDep):
    doc = get_or_404(session, Document, document_id)
    for key, value in values(body, partial=True).items():
        setattr(doc, key, value.strip() if isinstance(value, str) else value)
    session.flush()
    return _doc_out(doc, _versions(session, [doc.id]).get(doc.id, []))


def _refuse_if_sent(session: Session, where, what: str, code: ErrorCode) -> None:
    sent = session.scalar(
        select(func.count())
        .select_from(ApplicationDocument)
        .join(DocumentVersion, ApplicationDocument.document_version_id == DocumentVersion.id)
        .where(where)
    )
    if sent:
        detail = f"{what} was sent with {sent} application(s); remove it from them first."
        raise CodedError(409, detail, code, {"count": sent})


def _delete_version_files(session: Session, versions: list[DocumentVersion]) -> list[str]:
    """Delete the files that belong to these versions (not ones since moved to something else)."""
    paths = []
    for v in versions:
        att = session.get(Attachment, v.attachment_id) if v.attachment_id else None
        if att is not None and att.entity_type == "document" and att.entity_id == v.document_id:
            paths.append(att.path)
            session.delete(att)
    return paths


@router.delete("/documents/{document_id}", status_code=204)
def delete_document(document_id: str, request: Request, session: SessionDep):
    doc = get_or_404(session, Document, document_id)
    _refuse_if_sent(session, DocumentVersion.document_id == doc.id, "A version of this document", "document_sent")
    store = FileStore(request.app.state.jat.data_dir)
    versions = list(session.scalars(select(DocumentVersion).where(DocumentVersion.document_id == doc.id)))
    paths = _delete_version_files(session, versions)
    session.delete(doc)
    session.commit()
    for path in paths:
        with contextlib.suppress(FileError):
            store.delete(path)
    return Response(status_code=204)


# --- versions ----------------------------------------------------------------------------


@router.post("/documents/{document_id}/versions", response_model=S.VersionOut, status_code=201)
def add_version(
    document_id: str,
    request: Request,
    session: SessionDep,
    label: str = Form(..., min_length=1, max_length=100),  # noqa: B008
    notes: str | None = Form(None, max_length=2000),  # noqa: B008
    file: UploadFile | None = File(None),  # noqa: B008
):
    """A new version, usually with its file (the PDF you send). Sending it is recorded separately."""
    doc = get_or_404(session, Document, document_id)
    if not label.strip():
        raise CodedError(422, "label: give the version a name, e.g. v3 (fintech)", "version_label_required")
    store = FileStore(request.app.state.jat.data_dir)
    stored = None
    if file is not None and file.filename:
        name = file.filename.replace("\\", "/").rsplit("/", 1)[-1][:300] or "file"
        try:
            stored = store.save(file.file, name)
        except TooLarge as exc:
            raise CodedError(413, str(exc), exc.code, exc.params) from exc
        except FileError as exc:
            raise CodedError(422, str(exc), exc.code, exc.params) from exc
    try:
        att = None
        if stored is not None:
            att = Attachment(
                id=stored.id,
                entity_type="document",
                entity_id=doc.id,
                path=stored.path,
                original_name=name,
                content_type=mimetypes.guess_type(name)[0] or "application/octet-stream",
                size=stored.size,
                sha256=stored.sha256,
            )
            session.add(att)
        version = DocumentVersion(
            document_id=doc.id, label=label.strip(), notes=(notes or "").strip() or None, attachment_id=att and att.id
        )
        session.add(version)
        doc.updated_at = version.created_at = utcnow()
        session.flush()
        session.commit()  # now, so a failed save can take its file with it
    except BaseException:
        session.rollback()
        if stored is not None:
            store.delete(stored.path)
        raise
    return _versions(session, [doc.id])[doc.id][0]


@router.patch("/documents/versions/{version_id}", response_model=S.VersionOut)
def update_version(version_id: str, body: S.VersionPatch, session: SessionDep):
    version = get_or_404(session, DocumentVersion, version_id)
    for key, value in values(body, partial=True).items():
        if isinstance(value, str):
            value = value.strip() or None if key == "notes" else value.strip()
        setattr(version, key, value)
    session.flush()
    return next(v for v in _versions(session, [version.document_id])[version.document_id] if v.id == version.id)


@router.delete("/documents/versions/{version_id}", status_code=204)
def delete_version(version_id: str, request: Request, session: SessionDep):
    version = get_or_404(session, DocumentVersion, version_id)
    _refuse_if_sent(session, DocumentVersion.id == version.id, "This version", "version_sent")
    store = FileStore(request.app.state.jat.data_dir)
    paths = _delete_version_files(session, [version])
    session.delete(version)
    session.commit()
    for path in paths:
        with contextlib.suppress(FileError):
            store.delete(path)
    return Response(status_code=204)


# --- sent with an application -------------------------------------------------------------


@router.post("/applications/{app_id}/documents", response_model=S.SentDocumentOut, status_code=201)
def send_document(app_id: str, body: S.SentDocumentIn, session: SessionDep):
    app = get_or_404(session, Application, app_id)
    version = session.get(DocumentVersion, body.document_version_id)
    if version is None:
        version_id = body.document_version_id
        raise CodedError(
            422, f"document_version_id: {version_id} not found", "document_version_id_not_found", {"id": version_id}
        )
    exists = session.scalar(
        select(ApplicationDocument).where(
            ApplicationDocument.application_id == app.id, ApplicationDocument.document_version_id == version.id
        )
    )
    if exists is not None:
        raise CodedError(409, "That version is already recorded for this application.", "version_already_sent")
    doc = session.get(Document, version.document_id)
    session.add(ApplicationDocument(application_id=app.id, document_version_id=version.id, sent_on=body.sent_on))
    session.flush()
    _log_sent(session, app, doc, version)
    return next(d for d in sent_documents(session, app.id) if d.version_id == version.id)


@router.delete("/applications/{app_id}/documents/{link_id}", status_code=204)
def unsend_document(app_id: str, link_id: str, session: SessionDep):
    link = get_or_404(session, ApplicationDocument, link_id)
    if link.application_id != app_id:
        raise CodedError(
            404, f"ApplicationDocument {link_id} not found", "application_document_not_found", {"id": link_id}
        )
    session.delete(link)
    session.flush()
    return Response(status_code=204)


# Files that look like a CV: by name, or the same file in two or more places.
CV_NAME = re.compile(r"(?<![a-z])(cv|resume|résumé|curriculum)(?![a-z])", re.IGNORECASE)
CV_TYPES = frozenset(
    {
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }
)


def _is_cv_type(att: Attachment) -> bool:
    """PDF or Word, by its stored type or (when there isn't one) its name."""
    kind = att.content_type or mimetypes.guess_type(att.original_name)[0]
    return kind in CV_TYPES


def _looks_like_cv(name: str) -> bool:
    return bool(CV_NAME.search(unicodedata.normalize("NFC", name)))


def _cv_files(session: Session) -> list[S.CvFile]:
    atts = [
        a
        for a in session.scalars(
            select(Attachment)
            .where(Attachment.entity_type.in_(("application", "role", "contact")))
            .order_by(Attachment.created_at)
        )
        if _is_cv_type(a)
    ]
    groups: dict[str, list[Attachment]] = {}
    for a in atts:
        groups.setdefault(a.sha256, []).append(a)
    apps = {
        a.id: (a, company, title)
        for a, company, title in session.execute(
            select(Application, Company.name, Role.title)
            .join(Role, Application.role_id == Role.id)
            .join(Company, Role.company_id == Company.id)
        )
    }
    roles = {r.id: (r, company) for r, company in session.execute(select(Role, Company.name).join(Company))}
    people = {c.id: c for c in session.scalars(select(Contact))}
    by_role: dict[str, list[str]] = {}
    by_person: dict[str, set[str]] = {}
    for app_id, (a, _, _) in apps.items():
        by_role.setdefault(a.role_id, []).append(app_id)
        if a.recruiter_id:
            by_person.setdefault(a.recruiter_id, set()).add(app_id)
    for link in session.scalars(select(ApplicationContact)):
        by_person.setdefault(link.contact_id, set()).add(link.application_id)
    # Every version with each file (the same file can be a version of two documents); the newest
    # is the one to record.
    versions: dict[str, list[tuple[DocumentVersion, Document]]] = {}
    for v, d, sha in session.execute(
        select(DocumentVersion, Document, Attachment.sha256)
        .join(Document, DocumentVersion.document_id == Document.id)
        .join(Attachment, DocumentVersion.attachment_id == Attachment.id)
        .order_by(DocumentVersion.created_at)
    ):
        versions.setdefault(sha, []).append((v, d))
    sent = set(session.execute(select(ApplicationDocument.application_id, ApplicationDocument.document_version_id)))
    # Applications that already have some CV recorded: a CV on a role or a person doesn't claim them.
    with_cv = set(
        session.scalars(
            select(ApplicationDocument.application_id)
            .join(DocumentVersion, ApplicationDocument.document_version_id == DocumentVersion.id)
            .join(Document, DocumentVersion.document_id == Document.id)
            .where(Document.kind == "cv")
        )
    )
    out = []
    for sha, items in groups.items():
        matches = versions.get(sha, [])
        mine = {v.id for v, _ in matches}
        sources: dict[tuple[str, str], str] = {}
        counts: dict[str, None] = {}  # application ids, in order
        for a in items:
            if a.entity_type == "application" and a.entity_id in apps:
                _, company, title = apps[a.entity_id]
                sources[("application", a.entity_id)] = f"{company} · {title}"
                counts[a.entity_id] = None
            elif a.entity_type == "role" and a.entity_id in roles:
                role, company = roles[a.entity_id]
                sources[("role", role.id)] = f"{role.title} at {company}"
                for app_id in by_role.get(role.id, []):
                    if app_id not in with_cv or any((app_id, v) in sent for v in mine):
                        counts[app_id] = None
            elif a.entity_type == "contact" and a.entity_id in people:
                sources[("contact", a.entity_id)] = people[a.entity_id].name
                for app_id in sorted(by_person.get(a.entity_id, ()), key=lambda i: apps[i][0].created_at):
                    if app_id not in with_cv or any((app_id, v) in sent for v in mine):
                        counts[app_id] = None
        if not sources:
            continue
        # "Several places": a role and its own application are one place (a job ad is often on both).
        app_roles = {apps[i][0].role_id for k, i in sources if k == "application"}
        places = {(k, i) for k, i in sources if not (k == "role" and i in app_roles)}
        if len(places) < 2 and not any(_looks_like_cv(a.original_name) for a in items):
            continue
        newest = matches[-1] if matches else None
        first = items[0]
        out.append(
            S.CvFile(
                sha256=sha,
                name=first.original_name,
                size=first.size,
                content_type=first.content_type,
                sources=[S.CvFileSource(kind=k, id=i, name=n) for (k, i), n in sources.items()],
                applications=[
                    S.CvFileApplication(
                        id=app_id,
                        company_name=apps[app_id][1],
                        role_title=apps[app_id][2],
                        has_it=any((app_id, v) in sent for v in mine),
                    )
                    for app_id in counts
                ],
                version=S.CvFileVersion(
                    id=newest[0].id, label=newest[0].label, document_id=newest[1].id, document_name=newest[1].name
                )
                if newest
                else None,
            )
        )
    # Most to do first: files not yet versions, then the most applications.
    out.sort(key=lambda f: (f.version is not None, -len(f.applications), f.name.lower()))
    return [f for f in out if f.version is None or not all(a.has_it for a in f.applications)]


@router.get("/cv-files", response_model=list[S.CvFile])
def cv_files(session: SessionDep):
    """CV files attached to applications, roles or people (a CV you sent a recruiter) that aren't
    recorded as document versions sent with their applications yet: one per distinct file, named
    like a CV or attached in two or more places. A file on a role counts for that role's
    applications, and one on a person for the applications they're on, but only ones with no CV
    recorded yet."""
    return _cv_files(session)


@router.post("/cv-files/adopt", response_model=S.CvFileAdopted, status_code=201)
def adopt_cv_file(body: S.CvFileAdopt, request: Request, session: SessionDep):
    """Make the file a version of a document (copying the file, so the version keeps it), unless
    it already is one, and record that version as sent with its applications (or just
    `application_ids`), on the day you applied (or, without one, the day you attached it). When
    the file already is a version, `document_id`, `document_name` and `label` are ignored."""
    found = next((f for f in _cv_files(session) if f.sha256 == body.sha256), None)
    if found is None:
        raise CodedError(
            404, "No CV file like that among your attachments (or it's all recorded already).", "cv_file_not_found"
        )
    if body.application_ids is not None:
        unknown = set(body.application_ids) - {a.id for a in found.applications}
        if unknown:
            raise CodedError(
                422, "application_ids: only applications this file counts for.", "cv_file_applications_invalid"
            )
    chosen = [a for a in found.applications if body.application_ids is None or a.id in body.application_ids]
    store = FileStore(request.app.state.jat.data_dir)
    stored = None
    try:
        if found.version is not None:
            version = session.get(DocumentVersion, found.version.id)
            doc = session.get(Document, version.document_id)
        else:
            if body.document_id:
                doc = get_or_404(session, Document, body.document_id)
            elif body.document_name and body.document_name.strip():
                doc = Document(kind=body.kind, name=body.document_name.strip())
                session.add(doc)
                session.flush()
            else:
                raise CodedError(422, "Pick a document to add it to, or name a new one.", "cv_file_document_required")
            src = session.scalar(
                select(Attachment)
                .where(
                    Attachment.sha256 == body.sha256,
                    Attachment.entity_type.in_(("application", "role", "contact")),
                    Attachment.entity_id.in_([x.id for x in found.sources]),
                )
                .order_by(Attachment.created_at)
            )
            try:
                with store.resolve(src.path).open("rb") as f:
                    stored = store.save(f, src.original_name)
            except (FileError, OSError) as exc:
                name = src.original_name
                raise CodedError(
                    409, f"{name} is missing from your data folder.", "cv_file_missing", {"name": name}
                ) from exc
            att = Attachment(
                id=stored.id,
                entity_type="document",
                entity_id=doc.id,
                path=stored.path,
                original_name=src.original_name,
                content_type=src.content_type,
                size=stored.size,
                sha256=stored.sha256,
            )
            session.add(att)
            label = (body.label or "").strip() or src.original_name.rsplit(".", 1)[0][:100]
            version = DocumentVersion(document_id=doc.id, label=label, attachment_id=att.id)
            session.add(version)
            doc.updated_at = utcnow()
            session.flush()
        recorded = 0
        for a in chosen:
            if a.has_it:
                continue
            application = session.get(Application, a.id)
            # When it went out: the earliest of this file on the application, its role, or its people.
            linked = {application.id, application.role_id, application.recruiter_id} | set(
                session.scalars(select(ApplicationContact.contact_id).where(ApplicationContact.application_id == a.id))
            )
            attached = session.scalar(
                select(func.min(Attachment.created_at)).where(
                    Attachment.sha256 == body.sha256,
                    Attachment.entity_type.in_(("application", "role", "contact")),
                    Attachment.entity_id.in_(linked - {None}),
                )
            )
            session.add(
                ApplicationDocument(
                    application_id=a.id,
                    document_version_id=version.id,
                    sent_on=application.applied_on or (attached.astimezone().date() if attached else None),
                )
            )
            _log_sent(session, application, doc, version)
            recorded += 1
        session.flush()
        session.commit()  # now, so a failed save can take its copied file with it
    except BaseException:
        session.rollback()
        if stored is not None:
            store.delete(stored.path)
        raise
    return S.CvFileAdopted(document_id=doc.id, version_id=version.id, recorded=recorded)
