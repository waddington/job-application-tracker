"""Errors people see carry a code and values next to the same English (docs/rfc/i18n.md §4, §11)."""

from __future__ import annotations

import ast
import re
from pathlib import Path
from typing import get_args

from fastapi.testclient import TestClient

from jat.api.errors import ErrorCode
from jat.app import create_app
from jat.datadir import CODE_ROOT, init_data_dir
from jat.db import db_path, migrate
from jat.openapi import build_schema
from jat.snapshot.git import SnapshotError

from .factories import post

SOURCE = Path(__file__).parent.parent / "src" / "jat"
CODES = set(get_args(ErrorCode))


def english_keys() -> set[str]:
    """The keys of `codes` in locales/en/errors.ts, plural forms as one."""
    text = (CODE_ROOT / "frontend" / "src" / "locales" / "en" / "errors.ts").read_text()
    block = text.split("const codes = {", 1)[1].split("} as const", 1)[0]
    return {re.sub(r"_(one|other)$", "", key) for key in re.findall(r"^\s*(\w+):", block, re.M)}


def test_every_code_has_english_text():
    assert english_keys() == CODES


def test_every_code_raised_is_declared_and_every_declared_code_is_raised():
    # Python doesn't check a Literal when it runs, so a misspelt code would reach the API.
    position = {"CodedError": 2, "SnapshotError": 1}
    raised = set()
    quoted = set()
    for path in SOURCE.rglob("*.py"):
        if path.name == "errors.py":
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Constant) and isinstance(node.value, str):
                quoted.add(node.value)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in position:
                code = node.args[position[node.func.id]]
                if isinstance(code, ast.Constant):
                    raised.add(code.value)
    assert raised, "the scan found the raises"
    assert raised - CODES == set()
    assert CODES - quoted == set()


def test_no_code_ends_like_a_plural_form():
    assert not [c for c in CODES if re.search(r"_(zero|one|two|few|many|other)$", c)]


def test_the_schema_declares_the_codes():
    schema = build_schema()
    error = schema["components"]["schemas"]["ErrorOut"]["properties"]["code"]
    assert set(error["anyOf"][0]["enum"]) == CODES
    create = schema["paths"]["/api/v1/todos"]["post"]["responses"]["422"]
    refs = {s["$ref"] for s in create["content"]["application/json"]["schema"]["anyOf"]}
    assert refs == {"#/components/schemas/ErrorOut", "#/components/schemas/HTTPValidationError"}


def test_a_coded_error_keeps_its_english_detail(client, seeded):
    expected = {"detail": "text: say what needs doing", "code": "todo_text_required", "params": {}}
    created = client.post("/api/v1/todos", json={"text": "   "})
    assert (created.status_code, created.json()) == (422, expected)
    todo = post(client, "/api/v1/todos", {"text": "Update my CV"})
    patched = client.patch(f"/api/v1/todos/{todo['id']}", json={"text": " "})
    assert (patched.status_code, patched.json()) == (422, expected)


def test_a_plain_error_keeps_its_body(client, seeded):
    response = client.patch("/api/v1/todos/nope", json={"done": True})
    assert response.status_code == 404
    assert response.json() == {"detail": "Todo nope not found"}
    missing = {"text": "x", "entity_type": "company", "entity_id": "nope"}
    assert client.post("/api/v1/todos", json=missing).json() == {"detail": "entity_id: company nope not found"}


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
