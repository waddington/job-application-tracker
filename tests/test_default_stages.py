"""The default stages shown in your language (docs/rfc/i18n.md §5): the frontend's list of default stages
matches this one, and the API sends the ids it needs beside the names. No data folder's config changes."""

import json
from pathlib import Path

from jat.domain.workflow import DEFAULT_WORKFLOW

from .factories import post

ROOT = Path(__file__).resolve().parent.parent
RENAMED = """
[workflow]
initial = "interested"
transitions = "any"

[[workflow.stages]]
id = "interested"
name = "Interested"

[[workflow.stages]]
id = "applied"
name = "Sent"

[[workflow.stages]]
id = "take_home"
name = "Take-home task"

[[workflow.stages]]
id = "withdrawn"
name = "Withdrawn"
kind = "closed"
"""


def test_the_frontends_default_stages_are_the_backends():
    frontend = json.loads((ROOT / "frontend/src/locales/defaultStages.json").read_text())
    assert frontend == {s.id: s.name for s in DEFAULT_WORKFLOW.stages}
    assert frontend["screen"] == "Screen"


def test_the_ids_come_beside_the_names_and_config_toml_never_changes(app, client):
    config = app.state.jat.data_dir / "config.toml"
    config.write_text(RENAMED)
    before = config.read_bytes()
    company = post(client, "/api/v1/companies", {"name": "Example Ltd"})["id"]
    role = post(client, "/api/v1/roles", {"company_id": company, "title": "Backend Engineer"})["id"]
    app_id = post(client, "/api/v1/applications", {"role_id": role, "stage": "applied"})["id"]
    assert client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": "take_home"}).status_code == 200
    assert client.post(f"/api/v1/applications/{app_id}/move", json={"to_stage": "withdrawn"}).status_code == 200

    moves = [i["stage_move"] for i in client.get("/api/v1/timeline").json()["items"] if i.get("stage_move")]
    assert {
        "from_name": "Sent",
        "to_name": "Take-home task",
        "from_stage": "applied",
        "to_stage": "take_home",
    } in moves

    # Closed before applying: the badge names the stage it ended at.
    closed = post(client, "/api/v1/roles", {"company_id": company, "title": "Data Engineer"})["id"]
    closed_app = post(client, "/api/v1/applications", {"role_id": closed, "stage": "interested"})["id"]
    assert client.post(f"/api/v1/applications/{closed_app}/move", json={"to_stage": "withdrawn"}).status_code == 200
    summary = client.get(f"/api/v1/role-summaries/{closed}").json()
    assert (summary["closed_as"], summary["closed_stage"]) == ("Withdrawn", "withdrawn")

    # A flow node's id is the stage's own, which is what the frontend translates by.
    nodes = {n["id"]: n["name"] for n in client.get("/api/v1/insights/flow").json()["nodes"]}
    assert nodes["applied"] == "Sent"
    assert nodes["take_home"] == "Take-home task"

    assert config.read_bytes() == before
