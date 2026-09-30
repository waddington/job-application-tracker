from dataclasses import replace

import pytest

from jat.domain.workflow import DEFAULT_WORKFLOW, WorkflowError, load_workflow, workflow_from_config

# The default rules, enforced (transitions = "configured").
W = replace(DEFAULT_WORKFLOW, transitions="configured")


def test_any_to_any_by_default():
    assert DEFAULT_WORKFLOW.transitions == "any"
    everything_else = [s.id for s in DEFAULT_WORKFLOW.stages if s.id != "interviewing"]
    assert DEFAULT_WORKFLOW.allowed_next("interviewing") == everything_else
    assert DEFAULT_WORKFLOW.can_move("interviewing", "screen")  # back a step
    assert DEFAULT_WORKFLOW.can_move("rejected", "interviewing")  # they came back
    assert not DEFAULT_WORKFLOW.can_move("screen", "screen")
    # The rules still suggest the usual next stages.
    assert DEFAULT_WORKFLOW.suggested_next("rejected") == []
    assert DEFAULT_WORKFLOW.suggested_next("screen") == W.allowed_next("screen")
    stage = DEFAULT_WORKFLOW.as_dict()["stages"][2]
    assert stage["id"] == "screen" and "interviewing" in stage["suggested_next"]
    assert DEFAULT_WORKFLOW.as_dict()["transitions"] == "any"


def test_transitions_setting():
    assert workflow_from_config({"transitions": "configured"}).transitions == "configured"
    with pytest.raises(WorkflowError, match="transitions"):
        workflow_from_config({"transitions": "sometimes"})


def test_default_moves():
    assert W.initial == "interested"
    assert W.allowed_next("interested") == [
        "applied",
        "screen",
        "interviewing",
        "final",
        "offer",
        "declined",
        "rejected",
        "withdrawn",
        "ghosted",
    ]
    assert W.can_move("applied", "screen")
    assert W.can_move("applied", "final")  # skip forward
    assert not W.can_move("screen", "applied")  # no going back
    assert W.can_move("offer", "accepted")
    assert not W.can_move("applied", "accepted")  # success only via offer
    assert W.can_move("interviewing", "rejected")


def test_closed_stages():
    assert W.allowed_next("rejected") == []
    assert W.allowed_next("accepted") == []
    # Ghosted can be reopened when they come back.
    assert W.can_move("ghosted", "interviewing")
    assert not W.can_move("ghosted", "accepted")


def test_unknown_stage():
    with pytest.raises(WorkflowError):
        W.can_move("applied", "nope")
    with pytest.raises(WorkflowError):
        W.allowed_next("nope")


def test_custom_config():
    wf = workflow_from_config(
        {
            "initial": "lead",
            "transitions": "configured",
            "skip_forward": False,
            "stages": [
                {"id": "lead", "next": ["call"]},
                {"id": "call", "next": ["hired"], "stale_after_days": 3},
                {"id": "hired", "kind": "success"},
                {"id": "dead", "kind": "closed"},
            ],
        }
    )
    assert wf.allowed_next("lead") == ["call", "dead"]
    assert wf.stage("call").stale_after_days == 3
    assert wf.reopen_from == ()  # no ghosted stage in this workflow


def test_custom_stages_keep_enforcing_unless_told_otherwise():
    stages = [{"id": "a", "next": ["b"]}, {"id": "b"}]
    assert workflow_from_config({"stages": stages}).transitions == "configured"
    assert workflow_from_config({"stages": stages, "transitions": "any"}).transitions == "any"
    assert workflow_from_config({"skip_forward": False}).transitions == "any"


def test_any_mode_moves_out_of_removed_stages():
    assert DEFAULT_WORKFLOW.can_move("phone_screen", "applied")  # stage no longer in config
    with pytest.raises(WorkflowError, match="unknown stage"):
        DEFAULT_WORKFLOW.can_move("applied", "nope")
    with pytest.raises(WorkflowError):
        W.allowed_next("phone_screen")  # configured mode still refuses


def test_invalid_configs():
    with pytest.raises(WorkflowError, match="doesn't exist"):
        workflow_from_config({"stages": [{"id": "a", "next": ["b"]}]})
    with pytest.raises(WorkflowError, match="unique"):
        workflow_from_config({"stages": [{"id": "a"}, {"id": "a"}]})
    with pytest.raises(WorkflowError, match="kind"):
        workflow_from_config({"stages": [{"id": "a", "kind": "weird"}]})


def test_config_types_are_checked():
    stages = [{"id": "screen"}, {"id": "offer"}]
    with pytest.raises(WorkflowError, match="list of stage ids"):
        workflow_from_config({"stages": [{"id": "applied", "next": "screen"}, *stages]})
    for bad in ("7", True, -1, 1.5):
        with pytest.raises(WorkflowError, match="whole number"):
            workflow_from_config({"stages": [{"id": "a", "stale_after_days": bad}]})
    with pytest.raises(WorkflowError, match="true or false"):
        workflow_from_config({"skip_forward": "false"})
    with pytest.raises(WorkflowError, match="list of stage ids"):
        workflow_from_config({"reopen_from": "ghosted"})
    with pytest.raises(WorkflowError, match="must be a list"):
        workflow_from_config({"stages": {"id": "a"}})


def test_custom_stages_keep_ghosted_reopen_by_default():
    wf = workflow_from_config({"stages": [{"id": "applied"}, {"id": "ghosted", "kind": "closed"}]})
    assert wf.reopen_from == ("ghosted",)
    assert wf.can_move("ghosted", "applied")


def test_load_from_data_dir(tmp_path):
    assert load_workflow(tmp_path) is DEFAULT_WORKFLOW
    (tmp_path / "config.toml").write_text('[workflow]\ninitial = "applied"\n')
    assert load_workflow(tmp_path).initial == "applied"
    (tmp_path / "config.toml").write_text("[workflow\n")
    with pytest.raises(WorkflowError):
        load_workflow(tmp_path)


def test_as_dict_includes_allowed_next():
    stages = {s["id"]: s for s in W.as_dict()["stages"]}
    assert "screen" in stages["applied"]["allowed_next"]
