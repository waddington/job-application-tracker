"""Errors from applications, people, calls and stage moves: the same English, with a code and values."""

from __future__ import annotations

import ast

import pytest

from jat.db import db_path, make_engine, migrate, session_factory
from jat.db.models import Company, Role
from jat.domain.applications import TransitionError, create_application, move, undo_last_move
from jat.domain.workflow import Stage, Workflow

from .factories import post
from .test_error_codes import coded_argument


def _application(client, seeded, **fields):
    return post(client, "/api/v1/applications", {"role_id": seeded["role"]["id"], "route": "direct", **fields})


def _coded(response, status, detail, code, params=None):
    expected = {"detail": detail, "code": code, "params": params or {}}
    assert (response.status_code, response.json()) == (status, expected)


def test_a_company_or_role_in_use_says_how_many(client, seeded):
    _application(client, seeded)
    _coded(
        client.delete(f"/api/v1/companies/{seeded['company']['id']}"),
        409,
        "Contoso has an application. Delete it first, or archive it instead.",
        "company_has_applications",
        {"name": "Contoso", "count": 1},
    )
    _application(client, seeded)
    _coded(
        client.delete(f"/api/v1/roles/{seeded['role']['id']}"),
        409,
        "Senior Backend Engineer has 2 applications. Delete them first, or archive them instead.",
        "role_has_applications",
        {"name": "Senior Backend Engineer", "count": 2},
    )


def test_an_unknown_stage_and_nothing_to_undo(client, seeded):
    url = f"/api/v1/applications/{_application(client, seeded)['id']}"
    unknown = ("unknown stage 'nope'", "stage_unknown", {"stage": "'nope'"})
    _coded(client.post(f"{url}/undo"), 422, "nothing to undo", "undo_nothing")
    _coded(client.post(f"{url}/move", json={"to_stage": "nope"}), 422, *unknown)
    new = {"role_id": seeded["role"]["id"], "route": "direct", "stage": "nope"}
    _coded(client.post("/api/v1/applications", json=new), 422, *unknown)


def test_a_move_not_allowed_has_a_code_for_each_case(tmp_path):
    migrate(db_path(tmp_path))
    engine = make_engine(db_path(tmp_path))
    workflow = Workflow(
        stages=(Stage("a", "A", next=("b",)), Stage("b", "B", kind="closed"), Stage("c", "C")),
        initial="a",
        skip_forward=False,
        reopen_from=(),
        transitions="configured",
    )
    with session_factory(engine)() as session:
        company = Company(name="Contoso")
        session.add(company)
        session.flush()
        role = Role(company_id=company.id, title="Engineer")
        session.add(role)
        session.flush()
        app = create_application(session, workflow, role_id=role.id)

        with pytest.raises(TransitionError) as some:
            move(session, workflow, app, "c")
        assert str(some.value) == "can't move from 'a' to 'c' (allowed: b)"
        assert some.value.code == "move_not_allowed"
        assert some.value.params == {"from_stage": "'a'", "to_stage": "'c'", "allowed": "b"}

        move(session, workflow, app, "b")
        with pytest.raises(TransitionError) as none:
            move(session, workflow, app, "a")
        assert str(none.value) == "can't move from 'b' to 'a' (allowed: none)"
        assert none.value.code == "move_not_allowed_none"
        assert none.value.params == {"from_stage": "'b'", "to_stage": "'a'"}

        app.stage = "a"
        with pytest.raises(TransitionError) as off:
            undo_last_move(session, app)
        assert str(off.value) == "history is inconsistent: last move went to 'b', stage is 'a'"
        assert (off.value.code, off.value.params) == ("undo_inconsistent", {"to_stage": "'b'", "stage": "'a'"})
    engine.dispose()


def test_a_routes_rules_carry_codes(client, seeded):
    role, agency, recruiter = seeded["role"]["id"], seeded["agency"]["id"], seeded["recruiter"]["id"]
    other = post(client, "/api/v1/agencies", {"name": "Fabrikam Talent"})["id"]
    for fields, detail, code, params in [
        (
            {"route": "direct", "agency_id": agency},
            "A direct application can't have an agency; change the route first.",
            "direct_has_agency",
            {},
        ),
        (
            {"route": "direct", "recruiter_id": recruiter},
            "Alex Recruiter works for an agency, so this isn't a direct application; change the route.",
            "direct_recruiter_has_agency",
            {"name": "Alex Recruiter"},
        ),
        ({"route": "agency"}, "An agency application needs an agency or a recruiter.", "agency_route_needs_agency", {}),
        (
            {"route": "agency", "agency_id": other, "recruiter_id": recruiter},
            "The recruiter works for a different agency than the one given.",
            "recruiter_other_agency",
            {},
        ),
    ]:
        _coded(client.post("/api/v1/applications", json={"role_id": role, **fields}), 422, detail, code, params)

    quick = {"company_name": "Contoso", "role_title": "Engineer"}
    _coded(
        client.post("/api/v1/applications/quick", json={**quick, "route": "direct", "agency_name": "Fabrikam"}),
        422,
        "Only applications through a recruiter can have an agency.",
        "agency_needs_agency_route",
    )
    _coded(
        client.post("/api/v1/applications/quick", json={**quick, "route": "referral", "recruiter_name": "Sam Example"}),
        422,
        "A referral can't have a recruiter; link the referrer as a person instead.",
        "referral_has_recruiter",
    )


def test_a_taken_detail_names_who_has_it(client, seeded):
    body = {"name": "Sam Example", "details": [{"kind": "email", "value": "ALEX@northwind.example.com"}]}
    _coded(
        client.post("/api/v1/contacts", json=body),
        409,
        "Alex Recruiter already has ALEX@northwind.example.com. One person per email address and LinkedIn profile: "
        "open Alex Recruiter instead, or merge the two.",
        "contact_detail_taken",
        {"name": "Alex Recruiter", "value": "ALEX@northwind.example.com"},
    )


@pytest.mark.parametrize(
    ("path", "model", "code"),
    [
        ("applications", "Application", "application_not_found"),
        ("companies", "Company", "company_not_found"),
        ("agencies", "Agency", "agency_not_found"),
        ("contacts", "Contact", "contact_not_found"),
        ("roles", "Role", "role_not_found"),
        ("offers", "Offer", "offer_not_found"),
        ("interviews", "Interview", "interview_not_found"),
        ("meetings", "Meeting", "meeting_not_found"),
        ("links", "Link", "link_not_found"),
        ("todos", "Todo", "todo_not_found"),
    ],
)
def test_something_deleted_elsewhere(client, path, model, code):
    _coded(client.delete(f"/api/v1/{path}/nope"), 404, f"{model} nope not found", code, {"id": "nope"})


def test_the_application_page_and_a_link_to_a_person_deleted_elsewhere(client, seeded):
    gone = {"id": "nope"}
    _coded(client.get("/api/v1/applications/nope"), 404, "Application nope not found", "application_not_found", gone)
    url = f"/api/v1/applications/{_application(client, seeded)['id']}/contacts/nope"
    _coded(client.delete(url), 404, "ApplicationContact nope not found", "application_contact_not_found", gone)


def test_a_reference_deleted_elsewhere(client, seeded):
    role, gone = seeded["role"]["id"], {"id": "nope"}
    apps = "/api/v1/applications"
    agency = {"role_id": role, "route": "agency", "agency_id": "nope"}
    _coded(client.post(apps, json=agency), 422, "agency_id: Agency nope not found", "agency_id_not_found", gone)
    who = {"role_id": role, "route": "direct", "recruiter_id": "nope"}
    _coded(client.post(apps, json=who), 422, "recruiter_id: Contact nope not found", "recruiter_id_not_found", gone)
    bad_role = {"role_id": "nope", "route": "direct"}
    _coded(client.post(apps, json=bad_role), 422, "role_id: Role nope not found", "role_id_not_found", gone)
    link = {"entity_type": "company", "entity_id": "nope", "url": "https://example.com/a"}
    detail = "entity_id: company nope not found"
    _coded(client.post("/api/v1/links", json=link), 422, detail, "entity_company_not_found", gone)
    role_url = f"/api/v1/roles/{role}"
    company = {"company_id": "nope"}
    _coded(
        client.patch(role_url, json=company), 422, "company_id: Company nope not found", "company_id_not_found", gone
    )
    contact = {"contact_id": "nope"}
    _coded(
        client.patch(role_url, json=contact), 422, "contact_id: Contact nope not found", "contact_id_not_found", gone
    )
    call = {"meeting_id": "nope"}
    _coded(client.patch(role_url, json=call), 422, "meeting_id: Meeting nope not found", "meeting_id_not_found", gone)
    who = seeded["recruiter"]["id"]
    meeting = {"contact_id": who, "kind": "call", "starts_at": "2026-10-02T10:00:00Z", "application_id": "nope"}
    detail = "application_id: Application nope not found"
    _coded(client.post("/api/v1/meetings", json=meeting), 422, detail, "application_id_not_found", gone)
    interview = {"interviewer_ids": ["nope"]}
    url = f"/api/v1/applications/{_application(client, seeded)['id']}/interviews"
    detail = "interviewer_ids: Contact nope not found"
    _coded(client.post(url, json=interview), 422, detail, "interviewer_not_found", gone)


def test_a_stage_id_with_an_apostrophe_keeps_pythons_quotes(client, seeded):
    url = f"/api/v1/applications/{_application(client, seeded)['id']}/move"
    response = client.post(url, json={"to_stage": "it's"})
    _coded(response, 422, 'unknown stage "it\'s"', "stage_unknown", {"stage": '"it\'s"'})


def test_merging_someone_with_themselves(client, seeded):
    who = seeded["recruiter"]["id"]
    _coded(
        client.post(f"/api/v1/contacts/{who}/merge", json={"from_id": who}),
        422,
        "Pick someone else to merge in: that's the same person.",
        "merge_same_person",
    )


def test_a_to_do_about_something_deleted_elsewhere(client, seeded):
    body = {"text": "x", "entity_type": "company", "entity_id": "nope"}
    detail = "entity_id: company nope not found"
    _coded(client.post("/api/v1/todos", json=body), 422, detail, "entity_company_not_found", {"id": "nope"})


def test_a_call_that_ends_before_it_starts(client, seeded):
    body = {
        "contact_id": seeded["recruiter"]["id"],
        "kind": "call",
        "starts_at": "2026-10-02T10:00:00Z",
        "ends_at": "2026-10-02T09:00:00Z",
    }
    detail = "ends_at: can't be before starts_at"
    _coded(client.post("/api/v1/meetings", json=body), 422, detail, "call_ends_before_start")


def test_a_role_cant_cite_someone_elses_call(client, seeded):
    other = post(client, "/api/v1/contacts", {"name": "Sam Example"})["id"]
    call = post(client, "/api/v1/meetings", {"contact_id": other, "kind": "call", "starts_at": "2026-10-02T10:00:00Z"})
    body = {"meeting_id": call["id"], "contact_id": seeded["recruiter"]["id"]}
    _coded(
        client.patch(f"/api/v1/roles/{seeded['role']['id']}", json=body),
        422,
        "meeting_id: that call was with someone else",
        "role_call_other_person",
    )


def test_a_data_conflict_keeps_sqlites_words(client, seeded):
    url = f"/api/v1/applications/{_application(client, seeded)['id']}/contacts"
    link = {"contact_id": seeded["recruiter"]["id"], "relation": "recruiter"}
    post(client, url, link)
    response = client.post(url, json=link)
    body = response.json()
    assert (response.status_code, body["code"]) == (409, "data_conflict")
    assert body["detail"] == f"conflicts with existing data: {body['params']['reason']}"
    assert "UNIQUE" in body["params"]["reason"]


def test_a_broken_config_toml_says_what_is_wrong(app, client):
    (app.state.jat.data_dir / "config.toml").write_text('[workflow]\ntransitions = "sometimes"\n')
    problem = '[workflow] transitions must be "any" or "configured", not \'sometimes\''
    _coded(
        client.get("/api/v1/applications/nope"),
        500,
        f"invalid workflow in config.toml: {problem}",
        "workflow_invalid",
        {"problem": problem},
    )


def test_the_scan_sees_every_way_of_writing_a_coded_error():
    source = 'errors.CodedError(400, "x", "a", {"b": 1}); CodedError(400, "x", "c", None); WorkflowError("x")'
    calls = [node for node in ast.walk(ast.parse(source)) if isinstance(node, ast.Call)]
    assert [getattr(coded_argument(call, 0, "code"), "value", None) for call in calls] == ["a", "c", None]
    assert isinstance(coded_argument(calls[0], 1, "params"), ast.Dict)
    assert coded_argument(calls[1], 1, "params").value is None
