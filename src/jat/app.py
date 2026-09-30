"""FastAPI application: the JSON API under /api/v1 and the built React app for everything else."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles

from . import __version__
from .api.deps import WorkflowCache, WriteNotifier
from .api.routers import router as api_v1
from .config import Settings, resolve_data_dir
from .datadir import CODE_ROOT, check_outside_code_repo, is_git_repo
from .db import current_revision, db_path, head_revision, make_engine, session_factory

DEFAULT_DIST = CODE_ROOT / "frontend" / "dist"
DEV_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173"]

NOT_BUILT = """<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Job Application Tracker</title>
<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40rem;margin:4rem auto;padding:0 1rem}
code{background:#8882;padding:.1em .3em;border-radius:4px}</style></head><body>
<h1>The frontend isn't built yet</h1>
<p>The API is running at <a href="/api/v1/health"><code>/api/v1/health</code></a>.
Build the UI with <code>pnpm --dir frontend install &amp;&amp; pnpm --dir frontend build</code> and reload,
or run <code>pnpm --dir frontend dev</code> for development.</p></body></html>"""


@dataclass
class AppState:
    data_dir: Path
    git_repo: bool


def _api_router() -> APIRouter:
    api = APIRouter(prefix="/api/v1")

    @api.get("/health", tags=["meta"])
    def health(request: Request) -> dict:
        state: AppState = request.app.state.jat
        engine = request.app.state.engine
        return {
            "status": "ok",
            "version": __version__,
            "schema": current_revision(engine),
            "schema_head": head_revision(),
            "data_dir": str(state.data_dir),
            "git_repo": state.git_repo,
        }

    return api


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if not index.exists():
            return HTMLResponse(NOT_BUILT)
        if path:
            candidate = (dist / path).resolve()
            if candidate.is_file() and dist.resolve() in candidate.parents:
                return FileResponse(candidate)
        return FileResponse(index)  # client-side routes


def create_app(data_dir: Path, *, dist: Path = DEFAULT_DIST, dev: bool = False) -> FastAPI:
    """Build the app for a data directory whose database already exists and is migrated."""
    check_outside_code_repo(data_dir)
    if not db_path(data_dir).exists():
        raise RuntimeError(f"No database at {db_path(data_dir)}. Run `jat init` first.")
    app = FastAPI(
        title="Job Application Tracker",
        version=__version__,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    engine = make_engine(db_path(data_dir))
    app.state.engine = engine
    app.state.sessions = session_factory(engine)
    app.state.jat = AppState(data_dir=data_dir, git_repo=is_git_repo(data_dir))
    app.state.workflow = WorkflowCache(data_dir)
    app.state.writes = WriteNotifier()
    if dev:
        app.add_middleware(CORSMiddleware, allow_origins=DEV_ORIGINS, allow_methods=["*"], allow_headers=["*"])
    app.include_router(_api_router())
    app.include_router(api_v1)
    _mount_frontend(app, dist)
    return app


def app_from_env() -> FastAPI:
    """Factory for uvicorn (`jat serve`): reads JAT_DATA_DIR and JAT_DEV from the environment."""
    data_dir = resolve_data_dir(Settings())
    return create_app(data_dir, dev=os.environ.get("JAT_DEV") == "1")
