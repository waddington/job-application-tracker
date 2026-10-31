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
    "agency_id_not_found",
    "agency_needs_agency_route",
    "agency_not_found",
    "agency_route_needs_agency",
    "application_contact_not_found",
    "application_id_not_found",
    "application_not_found",
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
    "call_ends_before_start",
    "company_has_applications",
    "company_id_not_found",
    "company_not_found",
    "contact_detail_taken",
    "contact_id_not_found",
    "contact_not_found",
    "data_conflict",
    "direct_has_agency",
    "direct_recruiter_has_agency",
    "interview_not_found",
    "interviewer_not_found",
    "link_agency_not_found",
    "link_application_not_found",
    "link_company_not_found",
    "link_contact_not_found",
    "link_document_not_found",
    "link_interview_not_found",
    "link_not_found",
    "link_role_not_found",
    "meeting_id_not_found",
    "meeting_not_found",
    "move_not_allowed",
    "move_not_allowed_none",
    "offer_not_found",
    "recruiter_id_not_found",
    "recruiter_other_agency",
    "referral_has_recruiter",
    "role_call_other_person",
    "role_has_applications",
    "role_id_not_found",
    "role_not_found",
    "stage_unknown",
    "todo_not_found",
    "todo_text_required",
    "undo_inconsistent",
    "undo_nothing",
    "workflow_invalid",
]

ErrorParams = dict[str, str | int]


class ValidationIssue(BaseModel):
    """One problem in the framework's own 422."""

    loc: list[str | int]
    msg: str
    type: str


class ErrorOut(BaseModel):
    """An error's body. Only `detail` is always there: `code` and `params` come with coded errors.
    `detail` is English text, or for the framework's own 422 a list of problems."""

    detail: str | list[ValidationIssue]
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


ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    "default": {"description": "An error, with a code when people can see it", "model": ErrorOut},
}
"""For the /api/v1 router, so every route declares its errors, wherever they're raised. FastAPI then
adds no 422 of its own, so ErrorOut also describes a validation error's list."""
