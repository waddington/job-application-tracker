"""FastAPI application: the JSON API under /api/v1 and the built React app for everything else."""

from __future__ import annotations

import contextlib
import os
from contextlib import asynccontextmanager
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.docs import get_swagger_ui_html
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

from . import __version__
from .api.deps import WorkflowCache, WriteNotifier
from .api.errors import CodedError, coded_error_handler
from .api.routers import router as api_v1
from .config import Settings, resolve_data_dir
from .datadir import CODE_ROOT, check_outside_code_repo, ensure_gitattributes, is_git_repo
from .db import db_path, make_engine, session_factory
from .security import LocalOnly
from .snapshot.git import SnapshotService
from .storage.files import MAX_BYTES

if TYPE_CHECKING:
    from starlette.types import Scope

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


def _api_docs(app: FastAPI) -> None:
    """Swagger UI at /api/docs, with its script and styles from the built frontend (dist/api-docs/)
    instead of FastAPI's default CDN, so the page fetches nothing from the web."""

    @app.get("/api/docs", include_in_schema=False)
    def docs():
        return get_swagger_ui_html(
            openapi_url=app.openapi_url or "/api/openapi.json",
            title=f"{app.title} API",
            swagger_js_url="/api-docs/swagger-ui-bundle.js",
            swagger_css_url="/api-docs/swagger-ui.css",
            swagger_favicon_url="/favicon.svg",
            swagger_ui_parameters={"validatorUrl": None},  # no badge from validator.swagger.io
        )


# The app's own files are served with these types, never the system's guess: Windows takes it from the registry,
# which often says text/plain for .js, and the browser then won't run the page (docs/rfc/windows.md).
STATIC_TYPES: dict[str, str] = {
    ".avif": "image/avif",
    ".css": "text/css",
    ".gif": "image/gif",
    ".html": "text/html",
    ".ico": "image/x-icon",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".js": "text/javascript",
    ".json": "application/json",
    ".map": "application/json",
    ".mjs": "text/javascript",
    ".otf": "font/otf",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".txt": "text/plain",
    ".wasm": "application/wasm",
    ".webmanifest": "application/manifest+json",
    ".webp": "image/webp",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".xml": "application/xml",
}


def static_type(path: os.PathLike[str] | str) -> str | None:
    """The fixed type for one of the app's own files, or None to leave it to the system."""
    return STATIC_TYPES.get(Path(path).suffix.lower())


class AppStaticFiles(StaticFiles):
    """StaticFiles, with the type from STATIC_TYPES instead of the system's guess."""

    def file_response(
        self,
        full_path: os.PathLike[str] | str,
        stat_result: os.stat_result,
        scope: Scope,
        status_code: int = 200,
    ) -> Response:
        response = super().file_response(full_path, stat_result, scope, status_code)
        media_type = static_type(full_path)
        # A 304 has no body and no type; a 206 keeps this type for its parts.
        if media_type and "content-type" in response.headers:
            response.headers["content-type"] = (
                f"{media_type}; charset=utf-8" if media_type.startswith("text/") else media_type
            )
        return response


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    index = dist / "index.html"
    if (dist / "assets").is_dir():
        app.mount("/assets", AppStaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if not index.exists():
            return HTMLResponse(NOT_BUILT)
        if path:
            candidate = (dist / path).resolve()
            if candidate.is_file() and dist.resolve() in candidate.parents:
                return FileResponse(candidate, media_type=static_type(candidate))
        return FileResponse(index, media_type=static_type(index))


def create_app(
    data_dir: Path,
    *,
    dist: Path = DEFAULT_DIST,
    dev: bool = False,
    snapshot_debounce: float | None = None,
    bind_host: str | None = None,
    windows_snapshots: bool = False,
) -> FastAPI:
    """Build the app for a data directory whose database already exists and is migrated."""
    check_outside_code_repo(data_dir)
    if not db_path(data_dir).exists():
        raise RuntimeError(f"No database at {db_path(data_dir)}. Run `jat init` first.")

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        yield
        app.state.snapshots.close()  # write any pending snapshot before exiting
        app.state.engine.dispose()

    app = FastAPI(
        lifespan=lifespan,
        title="Job Application Tracker",
        version=__version__,
        docs_url=None,  # served by _api_docs, without a CDN
        openapi_url="/api/openapi.json",
        redoc_url=None,
    )
    app.add_exception_handler(CodedError, coded_error_handler)
    engine = make_engine(db_path(data_dir))
    app.state.engine = engine
    app.state.sessions = session_factory(engine)
    git_repo = is_git_repo(data_dir)
    if git_repo:
        # A data folder from before .gitattributes gets it; the next snapshot commits it. A read-only folder or an
        # unreadable .gitattributes mustn't stop the app: each snapshot tries again and reports what went wrong.
        with contextlib.suppress(OSError, UnicodeError):
            ensure_gitattributes(data_dir)
    app.state.jat = AppState(data_dir=data_dir, git_repo=git_repo)
    app.state.workflow = WorkflowCache(data_dir)
    app.state.writes = WriteNotifier()
    app.state.snapshots = SnapshotService(
        data_dir,
        engine,
        debounce_seconds=snapshot_debounce,
        windows_snapshots=windows_snapshots,
    )
    app.state.writes.subscribe(app.state.snapshots.mark_dirty)
    if dev:
        app.add_middleware(CORSMiddleware, allow_origins=DEV_ORIGINS, allow_methods=["*"], allow_headers=["*"])
    # Outermost: refuse other hosts and cross-site writes before anything else runs.
    app.add_middleware(
        LocalOnly,
        bind_host=bind_host,
        extra_origins=DEV_ORIGINS if dev else (),
        max_upload_bytes=MAX_BYTES,
    )
    app.include_router(api_v1)
    _api_docs(app)
    _mount_frontend(app, dist)
    return app


def app_from_env() -> FastAPI:
    """Factory for uvicorn (`jat serve`): reads JAT_DATA_DIR and JAT_DEV from the environment."""
    settings = Settings()
    data_dir = resolve_data_dir(settings)
    return create_app(
        data_dir,
        dev=os.environ.get("JAT_DEV") == "1",
        bind_host=settings.host,
        windows_snapshots=settings.windows_snapshots,
    )
