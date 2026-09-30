"""Insights (PRD FR19, FR20): how the search is going."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

from fastapi import APIRouter, Query
from pydantic import AwareDatetime, BaseModel

from ..domain import insights as svc
from ..domain import stats as stats_svc
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
    rank = svc.stage_rank(workflow)
    stages = {s.id: s for s in workflow.stages}

    def pos(sid: str) -> tuple[int, str]:
        return (rank.get(sid, len(rank)), sid)  # unknown (removed) stages last

    order = sorted(result.reached, key=pos)
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
        for (a, b), n in sorted(result.links.items(), key=lambda kv: (pos(kv[0][0]), pos(kv[0][1])))
    ]
    return FlowOut(applications=result.applications, nodes=nodes, links=links)


class StageStatsOut(BaseModel):
    id: str
    name: str
    kind: str
    color: str
    reached: int  # applications that got to this stage (as in the Sankey diagram)
    moved_on: int  # of those, how many went on to a later stage that isn't a closed one
    conversion: float | None  # moved_on / reached, for active stages
    median_days: float | None  # median completed stay, in days
    stays: int  # completed stays behind median_days


class RouteStatsOut(BaseModel):
    route: S.Route
    applications: int
    reached: dict[str, int]  # stage -> applications that got there


class StatsOut(BaseModel):
    applications: int
    stages: list[StageStatsOut]  # left-to-right order
    routes: list[RouteStatsOut]  # routes with at least one application


@router.get("/stats", response_model=StatsOut)
def search_stats(
    session: SessionDep,
    workflow: WorkflowDep,
    since: AwareDatetime | None = None,
    until: AwareDatetime | None = None,
):
    """Conversion and time per stage, and outcomes by route, for applications added in [since, until)."""
    result = stats_svc.stats(session, workflow, since=since, until=until)
    rank = svc.stage_rank(workflow)
    known = {s.id: s for s in workflow.stages}
    ids = sorted(result.stages, key=lambda sid: (rank.get(sid, len(rank)), sid))
    stages = []
    for sid in ids:
        st, s = result.stages[sid], known.get(sid)
        active = s is not None and s.is_active
        stages.append(
            StageStatsOut(
                id=sid,
                name=s.name if s else sid,
                kind=s.kind if s else "unknown",
                color=s.color if s else "gray",
                reached=st.reached,
                moved_on=st.moved_on,
                conversion=round(st.moved_on / st.reached, 3) if active and st.reached else None,
                median_days=result.median_days(sid),
                stays=len(st.days),
            )
        )
    routes = [
        RouteStatsOut(route=r, applications=result.route_applications[r], reached=dict(result.route_reached[r]))
        for r in stats_svc.ROUTES
        if result.route_applications[r]
    ]
    return StatsOut(applications=result.applications, stages=stages, routes=routes)


class WeekOut(BaseModel):
    start: date  # the week's first day
    added: int  # applications added
    applied: int  # applications with their applied date in the week
    moves: int  # stage moves
    interviews: int  # interview rounds (not cancelled) starting in the week


@router.get("/activity", response_model=list[WeekOut])
def weekly_activity(
    session: SessionDep,
    start: AwareDatetime | None = None,
    weeks: int = Query(12, ge=1, le=52),
):
    """Activity per week, oldest first. Pass `start`, the midnight your first week begins, with
    its offset, so weeks are your weeks. Defaults to UTC Mondays, ending with this week.
    """
    if start is None:
        today = datetime.now(UTC).replace(hour=0, minute=0, second=0, microsecond=0)
        start = today - timedelta(days=today.weekday(), weeks=weeks - 1)
    return [WeekOut(**vars(w)) for w in stats_svc.weekly_activity(session, start, weeks)]
