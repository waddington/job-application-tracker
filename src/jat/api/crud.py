"""A small generic CRUD router for simple entities."""

from collections.abc import Callable

from fastapi import APIRouter, HTTPException, Response
from pydantic import AnyUrl, BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .deps import SessionDep, get_or_404


def values(model: BaseModel, *, partial: bool) -> dict:
    """Python-mode dump (dates stay dates) with URL objects turned into plain strings."""
    data = model.model_dump(exclude_unset=partial)
    return {k: str(v) if isinstance(v, AnyUrl) else v for k, v in data.items()}


def crud_router(
    *,
    model,
    schema_in: type[BaseModel],
    schema_patch: type[BaseModel],
    schema_out: type[BaseModel],
    prefix: str,
    tag: str,
    order_by,
    search_column=None,
    validate: Callable[[Session, dict], None] | None = None,
    before_delete: Callable[[Session, object], None] | None = None,
) -> APIRouter:
    router = APIRouter(prefix=prefix, tags=[tag])

    @router.get("", response_model=list[schema_out])
    def list_items(session: SessionDep, q: str | None = None, limit: int = 500, offset: int = 0):
        stmt = select(model)
        if q and search_column is not None:
            stmt = stmt.where(func.lower(search_column).contains(q.lower(), autoescape=True))
        return session.scalars(stmt.order_by(order_by).limit(min(limit, 1000)).offset(offset)).all()

    @router.get("/{item_id}", response_model=schema_out)
    def get_item(item_id: str, session: SessionDep):
        return get_or_404(session, model, item_id)

    @router.post("", response_model=schema_out, status_code=201)
    def create_item(body: schema_in, session: SessionDep):  # type: ignore[valid-type]
        data = values(body, partial=False)
        if validate:
            validate(session, data)
        obj = model(**data)
        session.add(obj)
        session.flush()
        return obj

    @router.patch("/{item_id}", response_model=schema_out)
    def update_item(item_id: str, body: schema_patch, session: SessionDep):  # type: ignore[valid-type]
        obj = get_or_404(session, model, item_id)
        data = values(body, partial=True)
        if validate:
            validate(session, data)
        for key, value in data.items():
            setattr(obj, key, value)
        session.flush()
        return obj

    @router.delete("/{item_id}", status_code=204)
    def delete_item(item_id: str, session: SessionDep):
        obj = get_or_404(session, model, item_id)
        try:
            if before_delete:
                before_delete(session, obj)  # may refuse (409) or tidy up what goes with it
            session.delete(obj)
            session.flush()
        except IntegrityError as exc:
            raise HTTPException(status_code=409, detail=f"{tag} {item_id} is still in use") from exc
        return Response(status_code=204)

    return router
