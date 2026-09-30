from datetime import UTC, datetime, timedelta

from jat.domain.insights import fold_forward, stage_rank
from jat.domain.workflow import DEFAULT_WORKFLOW

from .factories import post


def test_fold_forward_keeps_the_flow_acyclic():
    rank = stage_rank(DEFAULT_WORKFLOW)
    # Back from Interviewing to Screen, then on: counted as staying at Interviewing.
    assert fold_forward(["applied", "interviewing", "screen", "final"], rank) == ["applied", "interviewing", "final"]
    # Ghosted, then they came back: the reopening isn't drawn.
    assert fold_forward(["applied", "ghosted", "screen"], rank) == ["applied", "ghosted"]
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
    assert [n["id"] for n in flow["nodes"]] == ["applied", "screen", "interviewing", "offer", "rejected"]
    assert (nodes["applied"]["reached"], nodes["applied"]["current"]) == (3, 1)
    assert (nodes["screen"]["reached"], nodes["offer"]["current"], nodes["rejected"]["current"]) == (2, 1, 1)
    assert nodes["offer"]["name"] == "Offer" and nodes["rejected"]["kind"] == "closed"
    links = {(link["source"], link["target"]): link["value"] for link in flow["links"]}
    assert links == {
        ("applied", "screen"): 2,
        ("screen", "interviewing"): 1,
        ("interviewing", "offer"): 1,
        ("screen", "rejected"): 1,
    }

    by_agency = client.get("/api/v1/insights/flow", params={"route": "agency"}).json()
    assert by_agency["applications"] == 1 and {n["id"] for n in by_agency["nodes"]} == {"applied", "screen", "rejected"}
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
    assert links == {("applied", "interviewing"): 1, ("interviewing", "final"): 1}
    assert "screen" not in {n["id"] for n in flow["nodes"]}

    created = client.get(f"/api/v1/applications/{a['id']}").json()["created_at"]
    # [since, until): an application added exactly at `since` counts, one added at `until` doesn't.
    assert client.get("/api/v1/insights/flow", params={"since": created}).json()["applications"] == 1
    assert client.get("/api/v1/insights/flow", params={"until": created}).json()["applications"] == 0
