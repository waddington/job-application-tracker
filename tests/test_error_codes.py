"""Errors people see carry a code and values next to the same English (docs/rfc/i18n.md §4, §11)."""

from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import get_args

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from jat.api.deps import REQUIRED_NOT_FOUND, get_or_404
from jat.api.errors import ErrorCode, ErrorOut
from jat.app import create_app
from jat.datadir import CODE_ROOT, init_data_dir
from jat.db import db_path, migrate
from jat.openapi import build_schema
from jat.snapshot.git import SnapshotError
from jat.storage.files import FileError, FileStore
from jat.storage.notes import ENTITY_TYPES, NoteError, check_link

from .factories import post

SOURCE = Path(__file__).parent.parent / "src" / "jat"
CODES = set(get_args(ErrorCode))
# Every exception that carries a code, with where its code argument is; its params come next.
CODED_EXCEPTIONS = {
    "CodedError": 2,
    "FileError": 1,
    "NoteError": 1,
    "SnapshotError": 1,
    "TooLarge": 1,
    "TransitionError": 1,
    "WorkflowError": 1,
}
# `count` isn't here: it picks the plural form, as it should.
I18NEXT_OPTIONS = {
    "context",
    "defaultValue",
    "fallbackLng",
    "interpolation",
    "joinArrays",
    "keySeparator",
    "lng",
    "lngs",
    "ns",
    "nsSeparator",
    "ordinal",
    "postProcess",
    "replace",
    "returnDetails",
    "returnObjects",
}


def english_keys() -> set[str]:
    """The keys of `codes` in locales/en/errors.ts, plural forms as one."""
    text = (CODE_ROOT / "frontend" / "src" / "locales" / "en" / "errors.ts").read_text()
    block = text.split("const codes = {", 1)[1].split("} as const", 1)[0]
    return {re.sub(r"_(one|other)$", "", key) for key in re.findall(r"^\s*(\w+):", block, re.M)}


def test_every_code_has_english_text():
    assert english_keys() == CODES


def coded_argument(node: ast.AST, offset: int, keyword: str) -> ast.expr | None:
    """In a call to an exception with a code, its code (offset 0) or params (offset 1), if given.
    `errors.CodedError(...)` counts as much as `CodedError(...)`."""
    if not isinstance(node, ast.Call):
        return None
    name = node.func.attr if isinstance(node.func, ast.Attribute) else getattr(node.func, "id", None)
    if name not in CODED_EXCEPTIONS:
        return None
    index = CODED_EXCEPTIONS[name] + offset
    if len(node.args) > index:
        return node.args[index]
    return next((k.value for k in node.keywords if k.arg == keyword), None)


def test_every_code_raised_is_declared_and_every_declared_code_is_raised():
    # Python doesn't check a Literal when it runs, so a misspelt code would reach the API.
    raised = set()
    quoted = set()
    for path in SOURCE.rglob("*.py"):
        if path.name == "errors.py":
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                quoted.add(node.value)
            code = coded_argument(node, 0, "code")
            if isinstance(code, ast.Constant):
                raised.add(code.value)
    assert raised, "the scan found the raises"
    assert {"stage_unknown", "undo_nothing", "backup_shut_down", "call_ends_before_start"} <= raised
    assert raised - CODES == set()
    assert CODES - quoted == set()


def test_no_code_ends_like_a_plural_form():
    assert not [c for c in CODES if re.search(r"_(zero|one|two|few|many|other)$", c)]


def test_the_schema_declares_the_codes():
    schema = build_schema()
    error = schema["components"]["schemas"]["ErrorOut"]["properties"]["code"]
    assert set(error["anyOf"][0]["enum"]) == CODES


def test_every_route_declares_its_errors():
    operations = [op for path in build_schema()["paths"].values() for op in path.values() if isinstance(op, dict)]
    assert len(operations) > 50
    for op in operations:
        body = op["responses"]["default"]["content"]["application/json"]["schema"]
        assert body == {"$ref": "#/components/schemas/ErrorOut"}


def test_the_backup_zip_is_still_a_zip_in_the_schema():
    archive = build_schema()["paths"]["/api/v1/backup/archive"]["get"]["responses"]["200"]
    assert "application/zip" in archive["content"]


def test_a_validation_error_fits_the_declared_body(client, seeded):
    response = client.post("/api/v1/todos", json={})
    assert response.status_code == 422
    assert isinstance(ErrorOut.model_validate(response.json()).detail, list)


def test_no_param_is_named_like_an_i18next_option():
    # The frontend passes params to t() as its options, so `lng` would change the language shown.
    seen = 0
    for path in SOURCE.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            params = coded_argument(node, 1, "params")
            none = params is None or (isinstance(params, ast.Constant) and params.value is None)
            if none or isinstance(params, ast.Attribute):  # none, or passing on exc.params
                continue
            assert isinstance(params, ast.Dict), (
                f"{path}:{node.lineno}: write params as a dict here, so they're checked"
            )
            names = {key.value for key in params.keys if isinstance(key, ast.Constant)}
            assert len(names) == len(params.keys), f"{path}:{node.lineno}: name each param"
            assert not names & I18NEXT_OPTIONS, f"{path}:{node.lineno}"
            seen += 1
    assert seen, "the scan found the params"


def test_a_coded_error_keeps_its_english_detail(client, seeded):
    expected = {"detail": "text: say what needs doing", "code": "todo_text_required", "params": {}}
    created = client.post("/api/v1/todos", json={"text": "   "})
    assert (created.status_code, created.json()) == (422, expected)
    todo = post(client, "/api/v1/todos", {"text": "Update my CV"})
    patched = client.patch(f"/api/v1/todos/{todo['id']}", json={"text": " "})
    assert (patched.status_code, patched.json()) == (422, expected)


def test_a_plain_error_keeps_its_body(client, seeded):
    response = client.get("/api/v1/backup/archive", headers={"sec-fetch-site": "cross-site"})
    assert response.status_code == 403
    assert response.json() == {"detail": "Backups can only be downloaded from the tracker itself."}


def test_a_model_with_no_code_stays_plain():
    class Unmapped:
        pass

    class Empty:
        def get(self, _model, _id):
            return None

    with pytest.raises(HTTPException) as error:
        get_or_404(Empty(), Unmapped, "nope")
    assert type(error.value) is HTTPException
    assert (error.value.status_code, error.value.detail) == (404, "Unmapped nope not found")


def test_every_require_call_has_a_code():
    # `require` looks its code up by model and field, so a pair not listed would be a 500.
    pairs = set()
    for path in SOURCE.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "require":
                pairs.add((node.args[1].id, node.args[3].value))
    assert pairs == set(REQUIRED_NOT_FOUND)


def test_backup_errors_carry_codes(tmp_path):
    path = tmp_path / "plain"
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    client = TestClient(base_url="http://127.0.0.1", app=create_app(path, dist=path / "none", snapshot_debounce=0))
    snapshot = client.post("/api/v1/backup/snapshot")
    assert (snapshot.status_code, snapshot.json()) == (
        409,
        {
            "detail": "The data directory isn't a git repo, so snapshots are off.",
            "code": "backup_snapshots_off",
            "params": {},
        },
    )
    assert client.post("/api/v1/backup/push").json() == {
        "detail": "The data directory isn't a git repo.",
        "code": "backup_not_a_repo",
        "params": {},
    }


def test_snapshot_errors_keep_values_as_params():
    error = SnapshotError("git push failed: denied", "backup_push_failed", {"reason": "denied"})
    assert str(error) == "git push failed: denied"
    assert (error.code, error.params) == ("backup_push_failed", {"reason": "denied"})


def _coded(response, status: int, detail: str, code: str, params: dict) -> None:
    assert (response.status_code, response.json()) == (status, {"detail": detail, "code": code, "params": params})


def _version(client) -> tuple[dict, dict]:
    doc = post(client, "/api/v1/documents", {"kind": "cv", "name": "Coded CV"})
    version = client.post(
        f"/api/v1/documents/{doc['id']}/versions",
        data={"label": "it's v1"},
        files={"file": ("coded-v1.pdf", b"made up", "application/pdf")},
    ).json()
    return doc, version


def test_document_errors_carry_codes(client, seeded):
    doc, version = _version(client)
    app_id = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "route": "direct"})["id"]
    link = {"document_version_id": version["id"]}
    assert client.post(f"/api/v1/applications/{app_id}/documents", json=link).status_code == 201

    tail = "was sent with 1 application(s); remove it from them first."
    _coded(
        client.delete(f"/api/v1/documents/{doc['id']}"),
        409,
        f"A version of this document {tail}",
        "document_sent",
        {"count": 1},
    )
    _coded(
        client.delete(f"/api/v1/documents/versions/{version['id']}"),
        409,
        f"This version {tail}",
        "version_sent",
        {"count": 1},
    )
    _coded(
        client.post(f"/api/v1/applications/{app_id}/documents", json=link),
        409,
        "That version is already recorded for this application.",
        "version_already_sent",
        {},
    )
    _coded(
        client.post(f"/api/v1/applications/{app_id}/documents", json={"document_version_id": "nope"}),
        422,
        "document_version_id: nope not found",
        "document_version_id_not_found",
        {"id": "nope"},
    )
    _coded(
        client.post(f"/api/v1/documents/{doc['id']}/versions", data={"label": "  "}),
        422,
        "label: give the version a name, e.g. v3 (fintech)",
        "version_label_required",
        {},
    )
    _coded(
        client.post("/api/v1/cv-files/adopt", json={"sha256": "0" * 64}),
        404,
        "No CV file like that among your attachments (or it's all recorded already).",
        "cv_file_not_found",
        {},
    )


def test_attachment_errors_carry_codes(client, seeded, monkeypatch):
    _, version = _version(client)
    # Python's quoting of a label with an apostrophe stays in the English, and the raw label comes too.
    _coded(
        client.delete(f"/api/v1/attachments/{version['file']['id']}"),
        409,
        'This is the file of version "it\'s v1"; delete that version instead.',
        "attachment_is_version_file",
        {"label": "it's v1", "quoted_label": '"it\'s v1"'},
    )
    monkeypatch.setattr(FileStore.__init__, "__defaults__", (1024 * 1024,))
    big = b"x" * (1024 * 1024 + 1)
    _coded(
        client.post("/api/v1/attachments", files={"file": ("big.bin", big)}),
        413,
        "files can be up to 1 MB",
        "file_too_large",
        {"count": 1},
    )


def test_note_errors_carry_codes(client, seeded):
    _coded(client.get("/api/v1/notes/nope"), 404, "Note nope not found", "note_not_found", {"id": "nope"})
    note = post(client, "/api/v1/notes", {"title": "Coded note", "body": "made up"})
    _coded(
        client.patch(f"/api/v1/notes/{note['id']}", json={"body": "x", "base_updated_at": "2000-01-01T00:00:00Z"}),
        409,
        "This note changed since you opened it (maybe in another editor). Reload it first.",
        "note_changed",
        {},
    )


@pytest.mark.parametrize("kind", ENTITY_TYPES)
def test_a_link_to_nothing_has_a_code_for_its_kind(client, seeded, kind):
    _coded(
        client.post("/api/v1/notes", json={"title": "Linked", "body": "x", "links": [f"{kind}:nope"]}),
        422,
        f"links: {kind} nope not found",
        f"note_link_{kind}_not_found",
        {"id": "nope"},
    )


def test_stale_files_and_documents_have_codes(client, seeded):
    gone = [
        ("get", "/api/v1/documents/nope", "Document nope not found", "document_not_found"),
        ("delete", "/api/v1/documents/versions/nope", "DocumentVersion nope not found", "document_version_not_found"),
        ("get", "/api/v1/attachments/nope", "Attachment nope not found", "attachment_not_found"),
    ]
    for method, url, detail, code in gone:
        _coded(getattr(client, method)(url), 404, detail, code, {"id": "nope"})
    app_id = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "route": "direct"})["id"]
    _coded(
        client.delete(f"/api/v1/applications/{app_id}/documents/nope"),
        404,
        "ApplicationDocument nope not found",
        "application_document_not_found",
        {"id": "nope"},
    )
    _coded(
        client.post(
            "/api/v1/attachments",
            data={"entity_type": "role", "entity_id": "nope"},
            files={"file": ("a.txt", b"made up")},
        ),
        422,
        "entity_id: role nope not found",
        "entity_role_not_found",
        {"id": "nope"},
    )


def test_domain_errors_keep_values_as_params(tmp_path):
    with pytest.raises(FileError) as outside:
        FileStore(tmp_path).resolve("../x.pdf")
    assert str(outside.value) == "../x.pdf isn't under files/"
    assert (outside.value.code, outside.value.params) == ("file_outside_files", {"path": "../x.pdf"})
    with pytest.raises(NoteError) as link:
        check_link("nope")
    kinds = "application, company, role, agency, contact, interview, document"
    assert str(link.value) == f"links: 'nope' should look like 'application:<id>' ({kinds})"
    assert (link.value.code, link.value.params) == (
        "note_link_invalid",
        {"link": "nope", "quoted_link": "'nope'", "kinds": kinds},
    )
