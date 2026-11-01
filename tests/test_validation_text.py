"""Every error a person can meet can be translated: a code, or a 422's `type` and `ctx`. The cases are
shared with frontend/src/components/ValidationText.test.ts, which turns these same bodies back into
the same text (docs/rfc/i18n.md, `i18n-uncoded-errors`)."""

from __future__ import annotations

import ast
import inspect
import json
import re
from pathlib import Path

import pytest
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from jat.api import schemas as S
from jat.api.deps import NOT_FOUND
from jat.datadir import CODE_ROOT
from jat.openapi import build_schema

from .factories import post

API = Path(__file__).parent.parent / "src" / "jat" / "api"
FRONTEND = CODE_ROOT / "frontend" / "src"
CASES = json.loads((FRONTEND / "api" / "validationIssues.cases.json").read_text())
ERRORS_TEXT = (FRONTEND / "locales" / "en" / "errors.ts").read_text()

# Every HTTPException call that stays plain, exactly as written, and why nobody meets it in a toast.
PLAIN_ALLOWED = [
    # A cross-site request for a plain download link: nothing of ours reads the answer.
    (
        "backup.py",
        "HTTPException(status_code=403, detail='Backups can only be downloaded from the tracker itself.')",
    ),
    # Only for a model with no NOT_FOUND code: test_every_model_looked_up_has_a_code says none is used.
    ("deps.py", "HTTPException(status_code=404, detail=detail)"),
    # Only for a WorkflowError with no code, about config.toml: get_workflow turns those into
    # workflow_invalid before a route starts, and moves only raise coded ones.
    ("routers.py", "HTTPException(422, str(exc))"),
]


def _plain_exceptions() -> list[tuple[str, str]]:
    found = []
    for path in API.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Call):
                name = node.func.attr if isinstance(node.func, ast.Attribute) else getattr(node.func, "id", None)
                if name == "HTTPException":
                    found.append((path.name, ast.unparse(node)))
    return found


def test_no_new_error_without_a_code():
    assert sorted(_plain_exceptions()) == sorted(PLAIN_ALLOWED)


def test_every_model_looked_up_has_a_code():
    named, variables, crud_models = set(), set(), set()
    for path in API.rglob("*.py"):
        text = path.read_text()
        named |= set(re.findall(r"get_or_404\(session, ([A-Z]\w+)", text))
        variables |= {(path.name, v) for v in re.findall(r"get_or_404\(session, ([a-z]\w+)", text)}
        for node in ast.walk(ast.parse(text)):
            if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "crud_router":
                crud_models |= {k.value.id for k in node.keywords if k.arg == "model"}
    assert crud_models == {"Agency", "Company", "Role"}, "the scan found the crud routers"
    # A model passed as a variable is only checked here if it comes from crud_router.
    assert variables == {("crud.py", "model")}
    assert named | crud_models <= set(NOT_FOUND)


def _block(name: str) -> str:
    return ERRORS_TEXT.split(f"const {name} = {{", 1)[1].split("} as const", 1)[0]


def test_every_field_of_a_request_body_has_its_name():
    schema = build_schema()
    names = {f for _, m in inspect.getmembers(S, inspect.isclass) if issubclass(m, S.In) for f in m.model_fields}
    for path in schema["paths"].values():
        for op in path.values():
            content = op.get("requestBody", {}).get("content", {}) if isinstance(op, dict) else {}
            for body in content.values():
                ref = body["schema"].get("$ref", "").split("/")[-1]
                names |= set(schema["components"]["schemas"].get(ref, {}).get("properties", {}))
    fields = dict(re.findall(r'^\s*(\w+): "(.*)",$', _block("fields"), re.M))
    assert set(fields) == names
    assert all(key == value for key, value in fields.items()), "English shows the field as the API names it"


def test_this_apis_own_checks_have_text():
    checks = set()
    for node in ast.walk(ast.parse((API / "schemas.py").read_text())):
        if isinstance(node, ast.Call) and getattr(node.func, "id", None) == "check_failed":
            checks.add(f"check_{node.args[0].value}")
    assert checks == {"check_company_required", "check_entity_both_or_neither", "check_not_null", "check_salary_range"}
    assert checks <= set(re.findall(r"^\s*(\w+):", _block("validation"), re.M))
    assert "raise ValueError" not in (API / "schemas.py").read_text()


@pytest.mark.parametrize(
    ("method", "url", "body", "msg", "added"),
    [
        (
            "patch",
            "/api/v1/roles/x",
            {"title": None, "company_id": None},
            "Value error, company_id, title can't be null",
            {"check": "not_null", "fields": "company_id, title"},
        ),
        (
            "post",
            "/api/v1/roles",
            {"company_id": "x", "title": "Engineer", "salary_min": 5, "salary_max": 1},
            "Value error, salary_min can't be more than salary_max",
            {"check": "salary_range"},
        ),
        (
            "post",
            "/api/v1/todos",
            {"text": "Call", "entity_type": "role"},
            "Value error, give both entity_type and entity_id, or neither",
            {"check": "entity_both_or_neither"},
        ),
        (
            "post",
            "/api/v1/applications/quick",
            {"role_title": "Engineer"},
            "Value error, give company_id or company_name",
            {"check": "company_required"},
        ),
    ],
)
def test_our_checks_answer_as_a_plain_value_error_did(client, seeded, method, url, body, msg, added):
    # The body a plain `raise ValueError` gave, written out, plus only the added ctx keys.
    response = getattr(client, method)(url, json=body)
    assert response.status_code == 422
    assert response.json() == {
        "detail": [{"type": "value_error", "loc": ["body"], "msg": msg, "input": body, "ctx": {"error": {}, **added}}]
    }


@pytest.mark.parametrize("case", CASES, ids=lambda c: c["shown"][:60])
def test_the_real_api_says_what_the_case_shows(client, seeded, case):
    response = getattr(client, case["method"])(case["url"], json=case["json"])
    assert response.status_code == 422
    # What the frontend has always shown (client.ts errorMessage).
    detail = response.json()["detail"]
    shown = "; ".join(f"{'.'.join(str(part) for part in issue['loc'][1:])}: {issue['msg']}" for issue in detail)
    assert shown == case["shown"]
    sent = [{key: issue[key] for key in ("loc", "msg", "type", "ctx") if key in issue} for issue in detail]
    assert sent == case["detail"]


def test_the_cases_cover_every_translated_type(client, seeded):
    seen = set()
    for case in CASES:
        for issue in getattr(client, case["method"])(case["url"], json=case["json"]).json()["detail"]:
            seen.add(f"check_{issue['ctx']['check']}" if issue["type"] == "value_error" else issue["type"])
    keys = set(re.findall(r"^\s*(\w+):", _block("validation"), re.M)) - {"issue", "separator", "fieldSeparator"}
    keys = {re.sub(r"_(one|other)$", "", key) for key in keys}
    keys = {"url_parsing" if key.startswith("url_parsing_") else key for key in keys}
    assert keys == seen


def _coded(response, status: int, detail: str, code: str, params: dict) -> None:
    assert (response.status_code, response.json()) == (status, {"detail": detail, "code": code, "params": params})


def test_not_found_and_shape_errors_carry_codes(client, seeded):
    app_id = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "route": "direct"})["id"]
    other = post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "route": "direct"})["id"]
    contact = post(client, "/api/v1/contacts", {"name": "Riley Chen"})
    link = post(
        client, f"/api/v1/applications/{other}/contacts", {"contact_id": contact["id"], "relation": "recruiter"}
    )
    _coded(
        client.delete(f"/api/v1/applications/{app_id}/contacts/{link['id']}"),
        404,
        "link not found on this application",
        "application_link_not_found",
        {},
    )
    _coded(
        client.get("/api/v1/applications/duplicates", params={"role_title": "Engineer"}),
        422,
        "Give company_id or company_name.",
        "duplicates_needs_company",
        {},
    )
    _coded(
        client.get("/api/v1/role-summaries/nope"),
        404,
        "Role nope not found",
        "role_not_found",
        {"id": "nope"},
    )
    _coded(
        client.get("/api/v1/insights/activity", params={"tz": "Mars/Base"}),
        422,
        "unknown time zone 'Mars/Base'",
        "time_zone_unknown",
        {"tz": "Mars/Base", "quoted_tz": "'Mars/Base'"},
    )
    _coded(
        client.get("/api/v1/todos", params={"entity_type": "role"}),
        422,
        "give both entity_type and entity_id, or neither",
        "todo_entity_incomplete",
        {},
    )
    upload = {"file": ("a.txt", b"made up")}
    _coded(
        client.post("/api/v1/attachments", data={"entity_type": "role"}, files=upload),
        422,
        "Give both entity_type and entity_id, or neither",
        "attachment_entity_incomplete",
        {},
    )
    kinds = "application, company, role, agency, contact, interview, document"
    _coded(
        client.post("/api/v1/attachments", data={"entity_type": "nope", "entity_id": "x"}, files=upload),
        422,
        f"entity_type must be one of {kinds}",
        "attachment_entity_type_invalid",
        {"kinds": kinds},
    )
    _coded(
        client.get("/api/v1/attachments", params={"entity_id": "x"}),
        422,
        "Give entity_type with entity_id",
        "attachment_entity_type_required",
        {},
    )


@pytest.mark.parametrize(
    ("prefix", "name", "code"),
    [
        ("companies", {"name": "Contoso Delete"}, "companies_in_use"),
        ("agencies", {"name": "Northwind Delete"}, "agencies_in_use"),
    ],
)
def test_a_delete_the_database_refuses_has_a_code(client, seeded, monkeypatch, prefix, name, code):
    item = post(client, f"/api/v1/{prefix}", name)

    def refuse(self, _obj):
        raise IntegrityError("DELETE", {}, Exception("made up"))

    monkeypatch.setattr(Session, "delete", refuse)
    _coded(
        client.delete(f"/api/v1/{prefix}/{item['id']}"),
        409,
        f"{prefix} {item['id']} is still in use",
        code,
        {"id": item["id"]},
    )


def test_a_role_delete_the_database_refuses_has_a_code(client, seeded, monkeypatch):
    def refuse(self, _obj):
        raise IntegrityError("DELETE", {}, Exception("made up"))

    role_id = seeded["role"]["id"]
    monkeypatch.setattr(Session, "delete", refuse)
    _coded(
        client.delete(f"/api/v1/roles/{role_id}"),
        409,
        f"roles {role_id} is still in use",
        "roles_in_use",
        {"id": role_id},
    )
