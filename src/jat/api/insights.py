"""Insights (PRD FR19, FR20): how the search is going."""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import AwareDatetime, BaseModel

from ..domain import insights as svc
from . import schemas as S
from .deps import SessionDep, WorkflowDep

router = APIRouter(prefix="/insights", tags=["insights"])


class FlowNode(BaseModel):
    id: str
    name: str
    kind: str
    color: str
    reached: int  # applications that got to this stage
    current: int  # of those, how many are still there


class FlowLink(BaseModel):
    source: str
    target: str
    value: int


class FlowOut(BaseModel):
    applications: int
    nodes: list[FlowNode]  # left-to-right order
    links: list[FlowLink]


@router.get("/flow", response_model=FlowOut)
def stage_flow(
    session: SessionDep,
    workflow: WorkflowDep,
    since: AwareDatetime | None = None,
    until: AwareDatetime | None = None,
    route: S.Route | None = None,
):
    """Stage-to-stage flows for a Sankey diagram, for applications added in [since, until)."""
    result = svc.flow(session, workflow, since=since, until=until, route=route)
    rank = svc._rank(workflow)
    stages = {s.id: s for s in workflow.stages}
    order = sorted(result.reached, key=lambda sid: (rank.get(sid, len(rank)), sid))
    nodes = [
        FlowNode(
            id=sid,
            name=stages[sid].name if sid in stages else sid,
            kind=stages[sid].kind if sid in stages else "unknown",
            color=stages[sid].color if sid in stages else "gray",
            reached=result.reached[sid],
            current=result.current[sid],
        )
        for sid in order
    ]
    links = [
        FlowLink(source=a, target=b, value=n)
        for (a, b), n in sorted(result.links.items(), key=lambda kv: (rank.get(kv[0][0], 99), rank.get(kv[0][1], 99)))
    ]
    return FlowOut(applications=result.applications, nodes=nodes, links=links)
