"""API routes for to-dos: your own reminders, on their own or about one thing ("reply to Alex",
"look into what Contoso does"). Open ones show in Next actions until you tick them off."""

from __future__ import annotations

from datetime import date, timedelta
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


def open_todos(session: Session, today: date, soon_days: int) -> list[Todo]:
    """Open to-dos in the order to do them: due within `soon_days` (overdue first), then the
    undated ones oldest first, then the ones dated further ahead."""
    stmt = select(Todo).where(Todo.done_at.is_(None)).order_by(Todo.created_at, Todo.id)
    soon = today + timedelta(days=soon_days)

    def order(todo: Todo):
        if todo.due_on is None:
            return (1, date.min)
        return (0 if todo.due_on <= soon else 2, todo.due_on)

    return sorted(session.scalars(stmt), key=order)


@router.get("", response_model=list[S.TodoOut])
def list_todos(
    session: SessionDep,
    entity_type: S.TodoAbout | None = None,
    entity_id: str | None = None,
    status: Literal["open", "done", "all"] = "open",
):
    """Open to-dos by default (dated first, soonest first); `status=done` lists ticked-off ones,
    most recent first. Filter to one thing with `entity_type` and `entity_id`."""
    stmt = select(Todo)
    if entity_type is not None:
        stmt = stmt.where(Todo.entity_type == entity_type)
    if entity_id is not None:
        stmt = stmt.where(Todo.entity_id == entity_id)
    if status == "open":
        stmt = stmt.where(Todo.done_at.is_(None))
    elif status == "done":
        stmt = stmt.where(Todo.done_at.is_not(None))
    stmt = stmt.order_by(
        Todo.done_at.is_not(None), Todo.done_at.desc(), Todo.due_on.is_(None), Todo.due_on, Todo.created_at, Todo.id
    )
    return [out(session, todo) for todo in session.scalars(stmt)]


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
