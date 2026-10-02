"""API routes for to-dos: your own reminders, on their own or about one thing ("reply to Alex",
"look into what Contoso does"). Open ones show in Next actions until you tick them off."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import Agency, Application, Company, Contact, Role, Todo
from ..db.types import utcnow
from . import schemas as S
from .crud import values
from .deps import ENTITY_MODELS, SessionDep, get_or_404

router = APIRouter(prefix="/todos", tags=["to-dos"])


def _role_label(session: Session, role: Role) -> str:
    company = session.get(Company, role.company_id)
    return f"{company.name} · {role.title}" if company else role.title


def out(session: Session, todo: Todo) -> S.TodoOut:
    """The to-do, with a readable name for what it's about."""
    result = S.TodoOut.model_validate(todo)
    target = session.get(ENTITY_MODELS[todo.entity_type], todo.entity_id) if todo.entity_type else None
    if isinstance(target, Application):
        role = session.get(Role, target.role_id)
        result.about = _role_label(session, role) if role else None
    elif isinstance(target, Role):
        result.about = _role_label(session, target)
        result.company_id = target.company_id
    elif isinstance(target, Company | Agency | Contact):
        result.about = target.name
    return result


SOON_DAYS = 14  # Next actions' "next two weeks"


def in_order(todos, today: date) -> list[Todo]:
    """Open to-dos in the order to do them: due in the next two weeks (overdue first), then the
    undated ones oldest first, then the ones dated further ahead. Ticked-off ones follow, most
    recently done first. Expects `todos` oldest first."""
    soon = today + timedelta(days=SOON_DAYS)

    def order(todo: Todo):
        if todo.done_at is not None:
            return (3, -todo.done_at.timestamp())
        if todo.due_on is None:
            return (1, 0.0)
        return (0 if todo.due_on <= soon else 2, float(todo.due_on.toordinal()))

    return sorted(todos, key=order)


def open_todos(session: Session, today: date) -> list[Todo]:
    stmt = select(Todo).where(Todo.done_at.is_(None)).order_by(Todo.created_at, Todo.id)
    return in_order(session.scalars(stmt), today)


@router.get("", response_model=list[S.TodoOut])
def list_todos(
    session: SessionDep,
    entity_type: S.TodoAbout | None = None,
    entity_id: str | None = None,
    status: Literal["open", "done", "all"] = "open",
    today: date | None = None,
):
    """Open to-dos by default, in the order Next actions shows them (pass your local `today`;
    it defaults to UTC's): due in the next two weeks, then undated, then later. `status=done`
    lists ticked-off ones, most recently done first; `all` lists open ones, then done ones.
    Filter to one thing with `entity_type` and `entity_id` (both, or neither)."""
    if (entity_type is None) != (entity_id is None):
        raise HTTPException(422, "give both entity_type and entity_id, or neither")
    stmt = select(Todo)
    if entity_type is not None:
        stmt = stmt.where(Todo.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(Todo.entity_id == entity_id)
    if status == "open":
        stmt = stmt.where(Todo.done_at.is_(None))
    elif status == "done":
        stmt = stmt.where(Todo.done_at.is_not(None))
    todos = session.scalars(stmt.order_by(Todo.created_at, Todo.id))
    return [out(session, todo) for todo in in_order(todos, today or datetime.now(UTC).date())]


@router.post("", response_model=S.TodoOut, status_code=201)
def create_todo(body: S.TodoIn, session: SessionDep):
    if body.entity_type is not None and session.get(ENTITY_MODELS[body.entity_type], body.entity_id) is None:
        raise HTTPException(422, f"entity_id: {body.entity_type} {body.entity_id} not found")
    data = values(body, partial=False)
    data["text"] = data["text"].strip()
    if not data["text"]:
        raise HTTPException(422, "text: say what needs doing")
    todo = Todo(**data)
    session.add(todo)
    session.flush()
    return out(session, todo)


@router.patch("/{todo_id}", response_model=S.TodoOut)
def update_todo(todo_id: str, body: S.TodoPatch, session: SessionDep):
    todo = get_or_404(session, Todo, todo_id)
    data = values(body, partial=True)
    if "text" in data:
        data["text"] = data["text"].strip()
        if not data["text"]:
            raise HTTPException(422, "text: say what needs doing")
    if "done" in data:
        done = data.pop("done")
        if done and todo.done_at is None:
            todo.done_at = utcnow()
        elif not done:
            todo.done_at = None
    for key, value in data.items():
        setattr(todo, key, value)
    session.flush()
    return out(session, todo)


@router.delete("/{todo_id}", status_code=204)
def delete_todo(todo_id: str, session: SessionDep):
    session.delete(get_or_404(session, Todo, todo_id))
    session.flush()
    return Response(status_code=204)
