from datetime import UTC, datetime, timedelta

from jat.domain.insights import closed_stages, fold_forward, stage_rank
from jat.domain.workflow import DEFAULT_WORKFLOW

from .factories import post


def test_fold_forward_keeps_the_flow_acyclic():
    rank = stage_rank(DEFAULT_WORKFLOW)
    closed = closed_stages(DEFAULT_WORKFLOW)
    # Back from Interviewing to Screen, then on: counted as staying at Interviewing.
    assert fold_forward(["applied", "interviewing", "screen", "final"], rank) == ["applied", "interviewing", "final"]
    # Ghosted, then they came back: drawn along where it really went.
    assert fold_forward(["applied", "ghosted", "screen"], rank, closed) == ["applied", "screen"]
    assert fold_forward(["applied", "ghosted"], rank, closed) == ["applied", "ghosted"]
    # Unknown (removed) stages sort last.
    assert fold_forward(["applied", "old_stage"], rank) == ["applied", "old_stage"]


def _move(client, app_id, stage):
    r = client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": stage})
    assert r.status_code == 200, r.text


def test_flow(client, seeded):
    role = seeded["role"]["id"]
    agency = seeded["agency"]["id"]
    a = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    for stage in ("screen", "interviewing", "offer"):
        _move(client, a["id"], stage)
    b = post(
        client, "/api/v1/applications", {"role_id": role, "stage": "applied", "route": "agency", "agency_id": agency}
    )
    _move(client, b["id"], "screen")
    _move(client, b["id"], "rejected")
    c = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    _move(client, c["id"], "ghosted")
    client.post(f"/api/v1/applications/{c['id']}/undo")  # undone: never happened

    flow = client.get("/api/v1/insights/flow").json()
    assert flow["applications"] == 3
    nodes = {n["id"]: n for n in flow["nodes"]}
    # Added at Applied: each starts at Interested, filled in by the app.
    # Then a spur from each stage to where what's still there is waiting.
    assert [n["id"] for n in flow["nodes"]] == [
        "interested",
        "applied",
        "screen",
        "interviewing",
        "offer",
        "holding:applied",
        "holding:offer",
        "rejected",
    ]
    assert (nodes["holding:applied"]["name"], nodes["holding:applied"]["reached"]) == ("Waiting to hear back", 1)
    assert (nodes["holding:offer"]["name"], nodes["holding:offer"]["kind"]) == ("Deciding on the offer", "holding")
    assert (nodes["interested"]["reached"], nodes["interested"]["current"]) == (3, 0)
    assert (nodes["applied"]["reached"], nodes["applied"]["current"]) == (3, 1)
    assert (nodes["screen"]["reached"], nodes["offer"]["current"], nodes["rejected"]["current"]) == (2, 1, 1)
    assert nodes["offer"]["name"] == "Offer" and nodes["rejected"]["kind"] == "closed"
    links = {(link["source"], link["target"]): link["value"] for link in flow["links"]}
    assert links == {
        ("interested", "applied"): 3,
        ("applied", "screen"): 2,
        ("screen", "interviewing"): 1,
        ("interviewing", "offer"): 1,
        ("screen", "rejected"): 1,
        ("applied", "holding:applied"): 1,
        ("offer", "holding:offer"): 1,
    }

    by_agency = client.get("/api/v1/insights/flow", params={"route": "agency"}).json()
    assert by_agency["applications"] == 1 and {n["id"] for n in by_agency["nodes"]} == {
        "interested",
        "applied",
        "screen",
        "rejected",
    }
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert client.get("/api/v1/insights/flow", params={"since": future}).json() == {
        "applications": 0,
        "nodes": [],
        "links": [],
    }


def test_flow_folds_backward_moves_and_filters_by_date(client, seeded):
    role = seeded["role"]["id"]
    a = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})
    for stage in ("interviewing", "screen", "final"):  # back to Screen, then on to Final
        _move(client, a["id"], stage)

    flow = client.get("/api/v1/insights/flow").json()
    links = {(link["source"], link["target"]): link["value"] for link in flow["links"]}
    assert links == {
        ("interested", "applied"): 1,
        ("applied", "interviewing"): 1,
        ("interviewing", "final"): 1,
        ("final", "holding:final"): 1,
    }
    assert "screen" not in {n["id"] for n in flow["nodes"]}

    created = client.get(f"/api/v1/applications/{a['id']}").json()["created_at"]
    # [since, until): an application added exactly at `since` counts, one added at `until` doesn't.
    assert client.get("/api/v1/insights/flow", params={"since": created}).json()["applications"] == 1
    assert client.get("/api/v1/insights/flow", params={"until": created}).json()["applications"] == 0


def test_whole_flow_from_where_roles_came_from(client, seeded):
    company, recruiter = seeded["company"]["id"], seeded["recruiter"]["id"]

    def role(title, contact=None):
        body = {"company_id": company, "title": title}
        if contact:
            body["contact_id"] = contact
        return post(client, "/api/v1/roles", body)["id"]

    # Pitched by a recruiter: one passed, one not decided yet, one applied for.
    client.patch(f"/api/v1/roles/{role('Passed on', recruiter)}", json={"decision": "passed"})
    role("Not decided", recruiter)
    post(client, "/api/v1/applications", {"role_id": role("Pitched", recruiter), "stage": "applied"})
    # You found one (marked Interested), and a friend referred you to another, now interviewing.
    post(client, "/api/v1/applications", {"role_id": role("Found"), "stage": "interested"})
    ref = post(client, "/api/v1/applications", {"role_id": role("Referred"), "stage": "applied", "route": "referral"})
    _move(client, ref["id"], "interviewing")

    flow = client.get("/api/v1/insights/whole-flow").json()
    # The seeded role has no application or decision: also still to decide, and found by you.
    assert flow["applications"] == 6
    nodes = {n["id"]: n for n in flow["nodes"]}
    assert [n["id"] for n in flow["nodes"]] == [
        "source:recruiter",
        "source:referral",
        "source:found",
        "interested",
        "applied",
        "interviewing",
        "deciding",
        "holding:applied",
        "holding:interviewing",
        "passed",
    ]
    assert (nodes["source:recruiter"]["name"], nodes["source:recruiter"]["reached"]) == ("Through a recruiter", 3)
    assert nodes["deciding"]["name"] == "Deciding whether to apply"
    links = {(link["source"], link["target"]): link["value"] for link in flow["links"]}
    assert links == {
        ("source:recruiter", "passed"): 1,
        ("source:recruiter", "deciding"): 1,
        ("source:recruiter", "interested"): 1,
        ("source:referral", "interested"): 1,
        ("source:found", "deciding"): 1,
        ("source:found", "interested"): 1,
        ("interested", "applied"): 2,
        ("interested", "deciding"): 1,  # the one you found, still at Interested
        ("applied", "interviewing"): 1,
        ("applied", "holding:applied"): 1,
        ("interviewing", "holding:interviewing"): 1,
    }
    future = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    assert client.get("/api/v1/insights/whole-flow", params={"since": future}).json()["applications"] == 0


def test_whole_flow_with_your_own_stages_and_sources(app, client, seeded):
    # A workflow that starts at Applied: nothing waits at "Deciding" but roles not applied for.
    (app.state.jat.data_dir / "config.toml").write_text(
        '[workflow]\ninitial = "applied"\n'
        '[[workflow.stages]]\nid = "applied"\nname = "Applied"\n'
        '[[workflow.stages]]\nid = "phone"\nname = "Phone call"\n'
        '[[workflow.stages]]\nid = "gone"\nkind = "closed"\n'
    )
    company, recruiter, agency = seeded["company"]["id"], seeded["recruiter"]["id"], seeded["agency"]["id"]

    def role(title, contact=None):
        body = {"company_id": company, "title": title} | ({"contact_id": contact} if contact else {})
        return post(client, "/api/v1/roles", body)["id"]

    # Someone pitched it, but a friend referred you: the referral counts.
    post(client, "/api/v1/applications", {"role_id": role("A", recruiter), "route": "referral"})
    # Nobody on the role, but the application went through an agency: a recruiter.
    b = post(client, "/api/v1/applications", {"role_id": role("B"), "route": "agency", "agency_id": agency})
    _move(client, b["id"], "phone")

    flow = client.get("/api/v1/insights/whole-flow").json()
    nodes = {n["id"]: n for n in flow["nodes"]}
    links = {(link["source"], link["target"]): link["value"] for link in flow["links"]}
    assert links == {
        ("source:referral", "applied"): 1,
        ("source:recruiter", "applied"): 1,
        ("source:found", "deciding"): 1,  # the seeded role, no application
        ("applied", "phone"): 1,
        ("applied", "holding:applied"): 1,
        ("phone", "holding:phone"): 1,
    }
    assert nodes["holding:applied"]["name"] == "Waiting to hear back"
    assert nodes["holding:phone"]["name"] == "Still at Phone call"
    # What the frontend names them from: stages have no code, their names are yours.
    assert nodes["holding:applied"]["code"] == "holding_applied"
    assert (nodes["holding:phone"]["code"], nodes["holding:phone"]["stage_name"]) == ("holding_other", "Phone call")
    assert nodes["applied"]["code"] is None
    # The same spurs on the applications-only flow.
    plain = {n["id"] for n in client.get("/api/v1/insights/flow").json()["nodes"]}
    assert plain == {"applied", "phone", "holding:applied", "holding:phone"}
