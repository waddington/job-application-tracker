"""The configurable application workflow: stages and the moves allowed between them (FR6).

Defaults live here. A data directory can override them in config.toml:

    [workflow]
    initial = "interested"
    transitions = "any"            # any: move between any stages | configured: only the moves below
    skip_forward = true            # allow jumping ahead to any later active stage

    [[workflow.stages]]
    id = "applied"
    name = "Applied"
    kind = "active"                # active | success | closed
    stale_after_days = 7           # Next actions flags it after this long with no activity
    next = ["screen", "interviewing"]

With `transitions = "any"` (the default) an application can move from any stage to any
other: processes skip steps and loop back, and every move is still timestamped. The rules
below then only suggest the usual next stages. With `transitions = "configured"` they're
enforced, Jira-style.

Rules (suggestions, or enforced when configured):
- An active stage may move to any stage listed in its `next`.
- With skip_forward, an active stage may also move to any later active stage.
- Any active stage may move to a closed stage (rejected, withdrawn, ghosted, declined) or a
  success stage reachable in its `next`.
- `reopen_from` stages (ghosted, by default) may move back to any active stage, because
  sometimes they do get back to you.
"""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from pathlib import Path

KINDS = ("active", "success", "closed")
TRANSITIONS = ("any", "configured")


class WorkflowError(ValueError):
    pass


@dataclass(frozen=True)
class Stage:
    id: str
    name: str
    kind: str = "active"
    stale_after_days: int | None = None
    next: tuple[str, ...] = ()
    color: str = "gray"

    @property
    def is_active(self) -> bool:
        return self.kind == "active"


@dataclass(frozen=True)
class Workflow:
    stages: tuple[Stage, ...]
    initial: str
    skip_forward: bool = True
    reopen_from: tuple[str, ...] = ("ghosted",)
    transitions: str = "any"
    _index: dict[str, int] = field(default_factory=dict, compare=False, repr=False)

    def __post_init__(self):
        ids = [s.id for s in self.stages]
        if len(set(ids)) != len(ids):
            raise WorkflowError("stage ids must be unique")
        object.__setattr__(self, "_index", {s.id: i for i, s in enumerate(self.stages)})
        for s in self.stages:
            if s.kind not in KINDS:
                raise WorkflowError(f"stage {s.id!r}: kind must be one of {KINDS}")
            for n in s.next:
                if n not in self._index:
                    raise WorkflowError(f"stage {s.id!r}: next stage {n!r} doesn't exist")
        if self.transitions not in TRANSITIONS:
            raise WorkflowError(f"transitions must be one of {TRANSITIONS}")
        if self.initial not in self._index:
            raise WorkflowError(f"initial stage {self.initial!r} doesn't exist")
        for r in self.reopen_from:
            if r not in self._index:
                raise WorkflowError(f"reopen_from stage {r!r} doesn't exist")

    def stage(self, stage_id: str) -> Stage:
        try:
            return self.stages[self._index[stage_id]]
        except KeyError:
            raise WorkflowError(f"unknown stage {stage_id!r}") from None

    def has(self, stage_id: str) -> bool:
        return stage_id in self._index

    def allowed_next(self, from_id: str) -> list[str]:
        """Every stage `from_id` may move to, in workflow order."""
        if self.transitions == "any":
            self.stage(from_id)
            return [s.id for s in self.stages if s.id != from_id]
        return self.suggested_next(from_id)

    def suggested_next(self, from_id: str) -> list[str]:
        """The usual next stages from `from_id` (the configured rules), in workflow order."""
        src = self.stage(from_id)
        allowed: set[str] = set(src.next)
        if src.is_active:
            allowed |= {s.id for s in self.stages if s.kind == "closed"}
            if self.skip_forward:
                later = [s for s in self.stages if s.is_active and self._index[s.id] > self._index[from_id]]
                allowed |= {s.id for s in later}
        if from_id in self.reopen_from:
            allowed |= {s.id for s in self.stages if s.is_active}
        allowed.discard(from_id)
        return [s.id for s in self.stages if s.id in allowed]

    def can_move(self, from_id: str, to_id: str) -> bool:
        self.stage(to_id)
        return to_id in self.allowed_next(from_id)

    def as_dict(self) -> dict:
        return {
            "initial": self.initial,
            "transitions": self.transitions,
            "skip_forward": self.skip_forward,
            "reopen_from": list(self.reopen_from),
            "stages": [
                {
                    "id": s.id,
                    "name": s.name,
                    "kind": s.kind,
                    "stale_after_days": s.stale_after_days,
                    "color": s.color,
                    "next": list(s.next),
                    "allowed_next": self.allowed_next(s.id),
                    "suggested_next": self.suggested_next(s.id),
                }
                for s in self.stages
            ],
        }


DEFAULT_WORKFLOW = Workflow(
    initial="interested",
    stages=(
        Stage("interested", "Interested", stale_after_days=14, next=("applied",), color="gray"),
        Stage("applied", "Applied", stale_after_days=7, next=("screen", "interviewing"), color="blue"),
        Stage("screen", "Screen", stale_after_days=5, next=("interviewing",), color="cyan"),
        Stage("interviewing", "Interviewing", stale_after_days=5, next=("final", "offer"), color="indigo"),
        Stage("final", "Final", stale_after_days=5, next=("offer",), color="violet"),
        Stage("offer", "Offer", stale_after_days=3, next=("accepted", "declined"), color="teal"),
        Stage("accepted", "Accepted", kind="success", color="green"),
        Stage("declined", "Declined", kind="closed", color="orange"),
        Stage("rejected", "Rejected", kind="closed", color="red"),
        Stage("withdrawn", "Withdrawn", kind="closed", color="gray"),
        Stage("ghosted", "Ghosted", kind="closed", color="dark"),
    ),
)


def workflow_from_config(data: dict | None) -> Workflow:
    """Build a workflow from the parsed [workflow] table, falling back to the defaults."""
    if not data:
        return DEFAULT_WORKFLOW
    raw_stages = data.get("stages")
    if raw_stages is None:
        stages = DEFAULT_WORKFLOW.stages
    else:
        if not isinstance(raw_stages, list):
            raise WorkflowError("[workflow] stages must be a list of [[workflow.stages]] tables")
        stages = []
        for raw in raw_stages:
            if not isinstance(raw, dict) or not raw.get("id"):
                raise WorkflowError("every [[workflow.stages]] entry needs an id")
            sid = str(raw["id"])
            stale = raw.get("stale_after_days")
            if stale is not None and (isinstance(stale, bool) or not isinstance(stale, int) or stale < 0):
                raise WorkflowError(f"stage {sid!r}: stale_after_days must be a whole number of days")
            stages.append(
                Stage(
                    id=sid,
                    name=str(raw.get("name") or sid),
                    kind=str(raw.get("kind") or "active"),
                    stale_after_days=stale,
                    next=_str_list(raw.get("next", []), f"stage {sid!r}: next"),
                    color=str(raw.get("color") or "gray"),
                )
            )
        stages = tuple(stages)
    skip_forward = data.get("skip_forward", True)
    if not isinstance(skip_forward, bool):
        raise WorkflowError("[workflow] skip_forward must be true or false")
    if "reopen_from" in data:
        reopen_from = _str_list(data["reopen_from"], "[workflow] reopen_from")
    else:  # keep "ghosted can be reopened" whenever there's a ghosted stage
        reopen_from = tuple(s for s in DEFAULT_WORKFLOW.reopen_from if any(st.id == s for st in stages))
    transitions = data.get("transitions", "any")
    if transitions not in TRANSITIONS:
        raise WorkflowError(f'[workflow] transitions must be "any" or "configured", not {transitions!r}')
    return Workflow(
        stages=stages,
        initial=str(data.get("initial") or (stages[0].id if stages else "")),
        skip_forward=skip_forward,
        reopen_from=reopen_from,
        transitions=transitions,
    )


def _str_list(value, what: str) -> tuple[str, ...]:
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value):
        raise WorkflowError(f'{what} must be a list of stage ids, e.g. ["screen"]')
    return tuple(value)


def load_workflow(data_dir: Path) -> Workflow:
    path = data_dir / "config.toml"
    if not path.exists():
        return DEFAULT_WORKFLOW
    try:
        config = tomllib.loads(path.read_text())
    except tomllib.TOMLDecodeError as exc:
        raise WorkflowError(f"{path}: {exc}") from exc
    return workflow_from_config(config.get("workflow"))
