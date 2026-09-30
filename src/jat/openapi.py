"""Write the API's OpenAPI schema without a data directory: `uv run python -m jat.openapi [path]`.

The frontend generates its typed client from frontend/openapi.json (`pnpm gen:api`), and a test
fails if the committed file drifts from the code.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi import FastAPI

from . import __version__
from .api.routers import router
from .datadir import CODE_ROOT

DEFAULT_OUT = CODE_ROOT / "frontend" / "openapi.json"


def build_schema() -> dict:
    app = FastAPI(title="Job Application Tracker", version=__version__)
    app.include_router(router)
    return app.openapi()


def render() -> str:
    return json.dumps(build_schema(), indent=2, sort_keys=True) + "\n"


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    out = Path(args[0]) if args else DEFAULT_OUT
    out.write_text(render())
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
