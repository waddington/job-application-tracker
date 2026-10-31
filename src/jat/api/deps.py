"""Request dependencies: a transactional session per request, the workflow, write notifications."""

from __future__ import annotations

import logging
import threading
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Annotated

from fastapi import Depends, HTTPException, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..db.models import ENTITY_MODELS  # noqa: F401  (re-exported for the routers)
from ..domain.workflow import Workflow, WorkflowError, load_workflow
from .errors import CodedError, ErrorCode

log = logging.getLogger(__name__)

# What the app can ask for after someone deleted it in another tab, or with the CLI. Whole sentences,
# so a code per kind of thing. A model not in NOT_FOUND is one nobody sees, and stays English.
NOT_FOUND: dict[str, ErrorCode] = {
    "Agency": "agency_not_found",
    "Application": "application_not_found",
    "ApplicationContact": "application_contact_not_found",
    "Company": "company_not_found",
    "Contact": "contact_not_found",
    "Interview": "interview_not_found",
    "Link": "link_not_found",
    "Meeting": "meeting_not_found",
    "Offer": "offer_not_found",
    "Role": "role_not_found",
    "Todo": "todo_not_found",
}
# By model and field, as the sentence names both. A test checks every `require` call is here.
REQUIRED_NOT_FOUND: dict[tuple[str, str], ErrorCode] = {
    ("Agency", "agency_id"): "agency_id_not_found",
    ("Application", "application_id"): "application_id_not_found",
    ("Company", "company_id"): "company_id_not_found",
    ("Contact", "contact_id"): "contact_id_not_found",
    ("Meeting", "meeting_id"): "meeting_id_not_found",
    ("Contact", "recruiter_id"): "recruiter_id_not_found",
    ("Role", "role_id"): "role_id_not_found",
}
# For something a link or to-do is about.
ENTITY_NOT_FOUND: dict[str, ErrorCode] = {
    "agency": "entity_agency_not_found",
    "application": "entity_application_not_found",
    "company": "entity_company_not_found",
    "contact": "entity_contact_not_found",
    "document": "entity_document_not_found",
    "interview": "entity_interview_not_found",
    "role": "entity_role_not_found",
}


class WriteNotifier:
    """Calls listeners after a request commits changes (the snapshot service subscribes)."""

    def __init__(self) -> None:
        self._listeners: list[Callable[[], None]] = []
        self.writes = 0

    def subscribe(self, listener: Callable[[], None]) -> None:
        self._listeners.append(listener)

    def notify(self) -> None:
        self.writes += 1
        for listener in self._listeners:
            try:
                listener()
            except Exception:  # the write is already committed; never turn it into an error
                log.exception("write listener failed")


class WorkflowCache:
    """Reloads the workflow when config.toml changes."""

    def __init__(self, data_dir: Path) -> None:
        self.path = data_dir / "config.toml"
        self._lock = threading.Lock()
        self._mtime: float | None = -1
        self._workflow: Workflow | None = None

    def get(self) -> Workflow:
        mtime = self.path.stat().st_mtime if self.path.exists() else None
        with self._lock:
            if self._workflow is None or mtime != self._mtime:
                self._workflow = load_workflow(self.path.parent)
                self._mtime = mtime
            return self._workflow


def get_session(request: Request) -> Iterator[Session]:
    session: Session = request.app.state.sessions()
    try:
        yield session
        changed = bool(session.new or session.dirty or session.deleted)
        session.commit()
        if changed or request.method in ("POST", "PUT", "PATCH", "DELETE"):
            request.app.state.writes.notify()
    except IntegrityError as exc:
        session.rollback()
        reason = str(exc.orig)  # SQLite's own words
        raise CodedError(409, f"conflicts with existing data: {reason}", "data_conflict", {"reason": reason}) from exc
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_workflow(request: Request) -> Workflow:
    try:
        return request.app.state.workflow.get()
    except WorkflowError as exc:
        # The problem is the config check's English, about config.toml's own keys.
        detail = f"invalid workflow in config.toml: {exc}"
        raise CodedError(500, detail, "workflow_invalid", {"problem": str(exc)}) from exc


# scope="function": the commit runs before the response is sent (FastAPI >= 0.121), so a
# client never gets a 2xx for a write that then fails to commit.
SessionDep = Annotated[Session, Depends(get_session, scope="function")]
WorkflowDep = Annotated[Workflow, Depends(get_workflow)]


def get_or_404(session: Session, model, obj_id: str):
    obj = session.get(model, obj_id)
    if obj is None:
        detail = f"{model.__name__} {obj_id} not found"
        if code := NOT_FOUND.get(model.__name__):
            raise CodedError(404, detail, code, {"id": obj_id})
        raise HTTPException(status_code=404, detail=detail)
    return obj


def require(session: Session, model, obj_id: str | None, field: str) -> None:
    """422 if a referenced id doesn't exist (clearer than a foreign-key error)."""
    if obj_id is not None and session.get(model, obj_id) is None:
        detail = f"{field}: {model.__name__} {obj_id} not found"
        raise CodedError(422, detail, REQUIRED_NOT_FOUND[(model.__name__, field)], {"id": obj_id})
