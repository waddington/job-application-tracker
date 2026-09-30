"""Backup endpoints: snapshot status, snapshot now, push the data repo."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from ..snapshot.git import SnapshotError, SnapshotService

router = APIRouter(prefix="/backup", tags=["backup"])


class BackupStatus(BaseModel):
    enabled: bool
    dirty: bool
    debounce_seconds: float
    last_snapshot_at: str | None
    last_commit: str | None
    last_error: str | None
    unpushed_commits: int | None
    has_remote: bool
    last_push_at: str | None


class SnapshotResult(BaseModel):
    commit: str | None
    status: BackupStatus


class PushResult(BaseModel):
    output: str
    status: BackupStatus


def _service(request: Request) -> SnapshotService:
    return request.app.state.snapshots


@router.get("", response_model=BackupStatus)
def backup_status(request: Request):
    return _service(request).status().as_dict()


@router.post("/snapshot", response_model=SnapshotResult)
def snapshot(request: Request):
    service = _service(request)
    try:
        commit = service.snapshot_now()
    except SnapshotError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"commit": commit, "status": service.status().as_dict()}


@router.post("/push", response_model=PushResult)
def push(request: Request):
    service = _service(request)
    try:
        output = service.push()
    except SnapshotError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    return {"output": output, "status": service.status().as_dict()}
