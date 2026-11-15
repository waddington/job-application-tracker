"""Health check endpoint."""

from __future__ import annotations

from fastapi import APIRouter, Request

from .. import __version__
from ..db import current_revision, head_revision
from ..platform import is_windows
from .schemas import HealthOut

router = APIRouter(tags=["meta"])


@router.get("/health", response_model=HealthOut)
def health(request: Request) -> HealthOut:
    state = request.app.state.jat
    engine = request.app.state.engine
    snapshots = request.app.state.snapshots
    return HealthOut(
        status="ok",
        version=__version__,
        schema=current_revision(engine),
        schema_head=head_revision(),
        data_dir=str(state.data_dir),
        git_repo=state.git_repo,
        snapshots_enabled=snapshots.enabled,
        windows=is_windows(),
    )
