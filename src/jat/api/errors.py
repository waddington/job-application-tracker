"""Errors people can see: a code and values next to the English (docs/rfc/i18n.md §4).

The frontend shows the text it holds for `code` (locales/en/errors.ts), and otherwise `detail`.
`detail` stays English for curl, the CLI, logs and older frontends. Adding a code is in
CONTRIBUTING.md, "Adding an error code".
"""

from __future__ import annotations

from typing import Any, Literal

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Underscores, not dots: a dot would split the key in the frontend's text files.
ErrorCode = Literal[
    "backup_add_failed",
    "backup_commit_failed",
    "backup_detached_head",
    "backup_git_timeout",
    "backup_git_unavailable",
    "backup_lock_failed",
    "backup_mid_rebase",
    "backup_no_remote",
    "backup_not_a_repo",
    "backup_push_failed",
    "backup_shut_down",
    "backup_snapshot_failed",
    "backup_snapshots_off",
    "todo_text_required",
]

ErrorParams = dict[str, str | int]


class ErrorOut(BaseModel):
    """An error's body. Only `detail` is always there: `code` and `params` come with coded errors."""

    detail: str
    code: ErrorCode | None = None
    params: ErrorParams | None = None


class CodedError(HTTPException):
    """An HTTPException whose body also carries a code and values. `detail` is the same English
    as ever, and `params` holds the values that went into it."""

    def __init__(self, status_code: int, detail: str, code: ErrorCode, params: ErrorParams | None = None) -> None:
        super().__init__(status_code=status_code, detail=detail)
        self.code = code
        self.params = params or {}


async def coded_error_handler(_request: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, CodedError)
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code, "params": exc.params},
        headers=exc.headers,
    )


def coded(*statuses: int) -> dict[int | str, dict[str, Any]]:
    """`responses=` for a route that raises CodedError with these statuses, so the schema shows it.
    A 422 can still be the framework's own validation error, so it declares both."""
    described = "An error, with a code when people can see it"
    responses: dict[int | str, dict[str, Any]] = {}
    for status in statuses:
        if status == 422:
            schemas = [{"$ref": f"#/components/schemas/{name}"} for name in ("ErrorOut", "HTTPValidationError")]
            responses[status] = {
                "description": described,
                "content": {"application/json": {"schema": {"anyOf": schemas}}},
            }
        else:
            responses[status] = {"description": described, "model": ErrorOut}
    return responses
