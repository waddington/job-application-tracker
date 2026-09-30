"""Backup endpoints: snapshot status, snapshot now, push the data repo, download an archive."""

from __future__ import annotations

import contextlib
import time
import uuid

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.background import BackgroundTask

from ..snapshot.archive import write_archive
from ..snapshot.git import SnapshotError, SnapshotService

router = APIRouter(prefix="/backup", tags=["backup"])

STALE_ARCHIVE_SECONDS = 15 * 60


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


@router.get(
    "/archive",
    response_class=FileResponse,
    responses={200: {"content": {"application/zip": {}}, "description": "The data directory as a zip"}},
)
def download_archive(request: Request):
    """The whole data directory as one zip (fresh export, notes, files, config), to keep anywhere.
    Unzip it and run `jat restore` to get the tracker back.

    A GET, so it works as a plain download link; but it does real work (an export and a zip),
    so another site can't set it off: cross-site requests are refused.
    """
    if request.headers.get("sec-fetch-site") == "cross-site":
        raise HTTPException(status_code=403, detail="Backups can only be downloaded from the tracker itself.")
    service = _service(request)
    staging = service.data_dir / ".tmp"
    staging.mkdir(exist_ok=True)
    # A download cut short never runs its clean-up, so clear out old ones first.
    cutoff = time.time() - STALE_ARCHIVE_SECONDS
    for old in staging.glob("archive-*.zip"):
        with contextlib.suppress(OSError):
            if old.stat().st_mtime < cutoff:
                old.unlink()
    dest = staging / f"archive-{uuid.uuid4().hex}.zip"
    try:
        info = write_archive(service, dest)
    except Exception:
        dest.unlink(missing_ok=True)
        raise
    return FileResponse(
        dest,
        media_type="application/zip",
        filename=info.name,
        background=BackgroundTask(dest.unlink, missing_ok=True),
    )
