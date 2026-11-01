"""Insights (PRD FR19, FR20): how the search is going."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Query
from pydantic import AwareDatetime, BaseModel

from ..domain import conversations as conv_svc
from ..domain import document_performance as doc_svc
from ..domain import insights as svc
from ..domain import scorecard as score_svc
from ..domain import stats as stats_svc
from . import schemas as S
from .deps import SessionDep, WorkflowDep
from .errors import CodedError

router = APIRouter(prefix="/insights", tags=["insights"])


# Nodes the app names itself, for the frontend to say in your language. A stage has none: its name is
# yours. `id` won't do: the pitched-roles diagram has its own "applied" and "offer", which aren't stages.
NodeCode = Literal[
    "source_recruiter",
    "source_referral",
    "source_found",
    "deciding",
    "passed",
    "holding_applied",
    "holding_screen",
    "holding_interviewing",
    "holding_final",
    "holding_offer",
    "holding_other",
    "pitched",
    "applied",
    "in_progress",
    "offer",
    "closed",
    "ghosted",
]


class FlowNode(BaseModel):
    id: str
    name: str  # English, or a stage as you wrote it
    kind: str  # a stage's kind, "holding" (where things are waiting) or "outcome" (passed)
    color: str
    reached: int  # applications (or roles, in the whole picture) that got here
    current: int  # of those, how many got no further (0 on holding and source nodes)
    code: NodeCode | None = None
    stage_name: str | None = None  # with holding_other: the stage it's waiting at, as you wrote it


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
    return _flow_out(svc.flow(session, workflow, since=since, until=until, route=route), workflow)


# Roles you passed on, in the diagrams ("Passed" alone reads like passing an interview).
PASSED_NAME = "Decided not to apply"

# The whole picture's nodes that aren't stages: (name, kind, color). Sources come first, then
# the stages, then where things are waiting, then roles you passed on (the chart places each just
# after what leads to it).
EXTRA_NODES = {
    "source:recruiter": ("Through a recruiter", "active", "indigo"),
    "source:referral": ("Referred", "active", "grape"),
    "source:found": ("You found it", "active", "teal"),
    svc.DECIDING: ("Deciding whether to apply", "holding", "yellow"),
    svc.PASSED: (PASSED_NAME, "outcome", "gray"),
}

# Where something still at an active stage is waiting, by the default stage ids; other stages
# get "Still at <name>". The first stage's is DECIDING, shared with roles not yet applied for.
HOLDING_NAMES = {
    "applied": "Waiting to hear back",
    "screen": "Still screening",
    "interviewing": "Still interviewing",
    "final": "In final rounds",
    "offer": "Deciding on the offer",
}

EXTRA_CODES: dict[str, NodeCode] = {
    "source:recruiter": "source_recruiter",
    "source:referral": "source_referral",
    "source:found": "source_found",
    svc.DECIDING: "deciding",
    svc.PASSED: "passed",
}
HOLDING_CODES: dict[str, NodeCode] = {
    "applied": "holding_applied",
    "screen": "holding_screen",
    "interviewing": "holding_interviewing",
    "final": "holding_final",
    "offer": "holding_offer",
}


def _holding(workflow, sid: str) -> str:
    """The first stage, if it's before Applied, waits at DECIDING (with roles not yet applied
    for); any other stage at its own `holding:<id>`."""
    if sid == workflow.initial and svc.before_applied(workflow, sid):
        return svc.DECIDING
    return f"holding:{sid}"


def _with_holding(result: svc.Flow, workflow) -> svc.Flow:
    """A spur from each active stage to where its applications are waiting: those that got no
    further (an application moved back counts at the furthest stage it reached)."""
    out = svc.Flow(
        applications=result.applications,
        reached=result.reached.copy(),
        links=result.links.copy(),
        current=result.current.copy(),
    )
    for st in workflow.stages:
        n = result.current[st.id]
        if st.kind == "active" and n:
            hid = _holding(workflow, st.id)
            out.links[(st.id, hid)] += n
            out.reached[hid] += n
    return out


def _flow_out(result: svc.Flow, workflow) -> FlowOut:
    result = _with_holding(result, workflow)
    rank = svc.stage_rank(workflow)
    stages = {s.id: s for s in workflow.stages}
    sources = [f"source:{s}" for s in svc.SOURCES]

    def pos(sid: str) -> tuple[int, int, str]:
        """Sources, active stages, what's still waiting, outcomes, passed: the order nodes are listed
        in (the chart places and orders them itself)."""
        if sid in sources:
            return (0, sources.index(sid), sid)
        if sid == svc.DECIDING:
            return (2, -1, sid)
        if sid.startswith("holding:"):
            return (2, rank.get(sid.removeprefix("holding:"), len(rank)), sid)
        if sid in EXTRA_NODES:
            return (4, list(EXTRA_NODES).index(sid), sid)
        if sid in stages and stages[sid].kind == "active":
            return (1, rank[sid], sid)
        return (3, rank.get(sid, len(rank)), sid)  # outcomes; unknown (removed) stages last

    def describe(sid: str) -> tuple[str, str, str]:
        if sid in EXTRA_NODES:
            return EXTRA_NODES[sid]
        if sid.startswith("holding:"):
            st = stages[sid.removeprefix("holding:")]
            return HOLDING_NAMES.get(st.id, f"Still at {st.name}"), "holding", st.color
        if sid in stages:
            return stages[sid].name, stages[sid].kind, stages[sid].color
        return sid, "unknown", "gray"

    def code_of(sid: str) -> tuple[NodeCode | None, str | None]:
        if sid in EXTRA_CODES:
            return EXTRA_CODES[sid], None
        if sid.startswith("holding:"):
            st = stages[sid.removeprefix("holding:")]
            return (HOLDING_CODES[st.id], None) if st.id in HOLDING_CODES else ("holding_other", st.name)
        return None, None

    nodes = []
    for sid in sorted(result.reached, key=pos):
        name, kind, color = describe(sid)
        code, stage_name = code_of(sid)
        nodes.append(
            FlowNode(
                id=sid,
                name=name,
                kind=kind,
                color=color,
                reached=result.reached[sid],
                current=result.current[sid],
                code=code,
                stage_name=stage_name,
            )
        )
    links = [
        FlowLink(source=a, target=b, value=n)
        for (a, b), n in sorted(result.links.items(), key=lambda kv: (pos(kv[0][0]), pos(kv[0][1])))
    ]
    return FlowOut(applications=result.applications, nodes=nodes, links=links)


@router.get("/whole-flow", response_model=FlowOut)
def whole_flow(
    session: SessionDep,
    workflow: WorkflowDep,
    since: AwareDatetime | None = None,
    until: AwareDatetime | None = None,
):
    """The whole picture as one Sankey diagram: every application added in [since, until) from
    where it came from (a recruiter, a referral, or you found it) through its stages, and every
    role added then without an application, to passed or still deciding. `applications` counts
    both."""
    return _flow_out(svc.whole_flow(session, workflow, since=since, until=until), workflow)


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
    reached = [sid for sid, st in result.stages.items() if st.reached]  # not ones only visited going back
    ids = sorted(reached, key=lambda sid: (rank.get(sid, len(rank)), sid))
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
    calls: int  # calls and meetings with people in the week, marked Happened
    pitched: int  # roles someone told you about, added in the week


@router.get("/activity", response_model=list[WeekOut])
def weekly_activity(
    session: SessionDep,
    start: date | None = None,
    tz: str = "UTC",
    weeks: int = Query(12, ge=1, le=52),
):
    """Activity per week, oldest first. Pass `tz`, your IANA time zone (e.g. Europe/London),
    and `start`, the Monday your first week begins, so weeks are your weeks, clock changes
    included. `start` defaults to the Monday that makes the last week this one.
    """
    try:
        zone = ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError) as exc:
        detail = f"unknown time zone {tz!r}"
        raise CodedError(422, detail, "time_zone_unknown", {"tz": tz, "quoted_tz": repr(tz)}) from exc
    if start is None:
        today = datetime.now(zone).date()
        start = today - timedelta(days=today.weekday(), weeks=weeks - 1)
    return [WeekOut(**vars(w)) for w in stats_svc.weekly_activity(session, start, weeks, zone)]


class ScoreOut(BaseModel):
    id: str
    name: str
    agency_id: str | None = None  # for a recruiter: their agency
    agency_name: str | None = None
    roles: int  # applications they put you forward for
    interviewed: int  # of those, how many got an interview round (not cancelled)
    active: int
    success: int
    closed: int  # closed, other than ghosted
    ghosted: int
    median_first_update_days: float | None  # adding the application to the first call, email, message or move
    last_contact: datetime | None  # the latest call, email or message logged


class ScorecardOut(BaseModel):
    recruiters: list[ScoreOut]  # most roles first
    agencies: list[ScoreOut]


def _score_out(s: score_svc.Score) -> ScoreOut:
    return ScoreOut(
        id=s.id,
        name=s.name,
        agency_id=s.agency_id,
        agency_name=s.agency_name,
        roles=s.roles,
        interviewed=s.interviewed,
        active=s.active,
        success=s.success,
        closed=s.closed,
        ghosted=s.ghosted,
        median_first_update_days=s.median_first_update,
        last_contact=s.last_contact,
    )


@router.get("/scorecard", response_model=ScorecardOut)
def recruiter_scorecard(
    session: SessionDep,
    workflow: WorkflowDep,
    since: AwareDatetime | None = None,
    until: AwareDatetime | None = None,
):
    """How each recruiter's and agency's roles have gone, for applications added in [since, until)."""
    recruiters, agencies = score_svc.scorecard(session, workflow, since=since, until=until)
    return ScorecardOut(recruiters=[_score_out(s) for s in recruiters], agencies=[_score_out(s) for s in agencies])


class ConversationTally(BaseModel):
    calls_held: int  # marked Happened
    calls_booked: int  # still to come
    calls_cancelled: int
    last_call: datetime | None
    pitched: int  # roles they told you about
    applied: int  # of those, ones you applied for
    passed: int  # ones you passed on
    deciding: int  # neither yet
    apply_rate: float | None  # applied / (applied + passed): of the roles you've decided on
    interviewed: int  # applied roles that got an interview round (not cancelled)
    offers: int  # applied roles with an offer (or a success stage)
    in_progress: int  # applied roles still in an active stage
    closed: int  # applied roles closed, other than ghosted
    ghosted: int
    median_decide_days: float | None  # adding a role to applying or passing


class ConversationPerson(ConversationTally):
    id: str
    name: str
    agency_id: str | None
    agency_name: str | None
    company_name: str | None  # an in-house recruiter's company
    closed_as: str | None  # ghosted | not_interested


class ConversationAgency(ConversationTally):
    id: str
    name: str
    people: int


class PassReasonOut(BaseModel):
    role_id: str
    role_title: str
    company_name: str
    person_name: str | None
    reason: str
    decided_on: date | None


class ConversationsOut(BaseModel):
    total: ConversationTally
    people_talked_to: int  # people with a call held or a role pitched
    flow: FlowOut  # pitched roles: applied, passed or deciding, and where applied ones went
    people: list[ConversationPerson]  # most roles pitched first
    agencies: list[ConversationAgency]
    pass_reasons: list[PassReasonOut]  # newest first


def _tally(t: conv_svc.Tally) -> dict:
    decided = t.applied + t.passed
    return dict(
        calls_held=t.calls_held,
        calls_booked=t.calls_booked,
        calls_cancelled=t.calls_cancelled,
        last_call=t.last_call,
        pitched=t.pitched,
        applied=t.applied,
        passed=t.passed,
        deciding=t.deciding,
        apply_rate=round(t.applied / decided, 3) if decided else None,
        interviewed=t.interviewed,
        offers=t.outcomes["offer"],
        in_progress=t.outcomes["in_progress"],
        closed=t.outcomes["closed"],
        ghosted=t.outcomes["ghosted"],
        median_decide_days=t.median_decide_days,
    )


def _role_flow(t: conv_svc.Tally) -> FlowOut:
    """Pitched roles as a Sankey diagram: pitched, then applied / deciding / decided not to apply,
    then outcomes. Deciding and in progress are where things wait, and decided not to apply sits
    with deciding (the chart places them just after what leads to them, usually beside Applied)."""
    nodes = [
        ("pitched", "Pitched to you", "active", "indigo", t.pitched),
        ("deciding", "Deciding whether to apply", "holding", "yellow", t.deciding),
        ("applied", "Applied", "active", "blue", t.applied),
        ("in_progress", "In progress", "holding", "cyan", t.outcomes["in_progress"]),
        ("offer", "Offer", "outcome", "green", t.outcomes["offer"]),
        ("closed", "Closed", "outcome", "red", t.outcomes["closed"]),
        ("ghosted", "Ghosted", "outcome", "dark", t.outcomes["ghosted"]),
        ("passed", PASSED_NAME, "outcome", "gray", t.passed),
    ]
    links = [
        FlowLink(source="pitched", target=target, value=n)
        for target, n in (("applied", t.applied), ("passed", t.passed), ("deciding", t.deciding))
        if n
    ] + [FlowLink(source="applied", target=k, value=t.outcomes[k]) for k in conv_svc.OUTCOMES if t.outcomes[k]]
    return FlowOut(
        applications=t.pitched,
        nodes=[
            # Every one of these has a code of the same name.
            FlowNode(id=i, name=name, kind=kind, color=color, reached=n, current=0, code=i)
            for i, name, kind, color, n in nodes
            if n
        ],
        links=links,
    )


@router.get("/conversations", response_model=ConversationsOut)
def recruiter_conversations(
    session: SessionDep,
    workflow: WorkflowDep,
    since: AwareDatetime | None = None,
    until: AwareDatetime | None = None,
):
    """What happens before applications: calls with people, the roles they pitched, which you
    applied for or passed on, and how those went. Calls count by when they happen, roles by
    when they were added, in [since, until)."""
    c = conv_svc.conversations(session, workflow, since=since, until=until)
    return ConversationsOut(
        total=ConversationTally(**_tally(c.total)),
        people_talked_to=c.people_talked_to,
        flow=_role_flow(c.total),
        people=[
            ConversationPerson(
                **_tally(p),
                id=p.id,
                name=p.name,
                agency_id=p.agency_id,
                agency_name=p.agency_name,
                company_name=p.company_name,
                closed_as=p.closed_as,
            )
            for p in c.people
        ],
        agencies=[ConversationAgency(**_tally(a), id=a.id, name=a.name, people=a.people) for a in c.agencies],
        pass_reasons=[PassReasonOut(**vars(r)) for r in c.pass_reasons],
    )


class DocumentTally(BaseModel):
    sent: int  # applications sent with it
    heard_back: int  # any sign of life, a rejection included
    interviewed: int  # got past the CV: a screen or later, or an interview round
    offers: int
    open: int  # still in an active stage
    ghosted: int
    closed: int  # closed, other than ghosted
    reply_rate: float | None  # heard_back / sent
    interview_rate: float | None  # interviewed / sent
    interview_low: float | None  # 95% Wilson interval for interview_rate
    interview_high: float | None
    median_reply_days: float | None  # applying to hearing back


class DocumentVersionPerformance(DocumentTally):
    id: str
    label: str
    created_at: datetime


class DocumentPerformance(DocumentTally):
    id: str
    name: str
    versions: list[DocumentVersionPerformance]  # oldest first


class DocumentKindPerformance(BaseModel):
    kind: str  # cv | cover_letter | other
    documents: list[DocumentPerformance]  # most sent first
    none: DocumentTally  # applications sent without one recorded


class DocumentsOut(BaseModel):
    applications: int  # applications sent (got to Applied, or have a document recorded)
    kinds: list[DocumentKindPerformance]


def _doc_tally(t: doc_svc.Tally) -> dict:
    interval = doc_svc.wilson(t.interviewed, t.sent)
    return dict(
        sent=t.sent,
        heard_back=t.heard_back,
        interviewed=t.interviewed,
        offers=t.offers,
        open=t.open,
        ghosted=t.ghosted,
        closed=t.closed,
        reply_rate=round(t.heard_back / t.sent, 3) if t.sent else None,
        interview_rate=round(t.interviewed / t.sent, 3) if t.sent else None,
        interview_low=round(interval[0], 3) if interval else None,
        interview_high=round(interval[1], 3) if interval else None,
        median_reply_days=t.median_reply_days,
    )


@router.get("/documents", response_model=DocumentsOut)
def document_performance(
    session: SessionDep,
    workflow: WorkflowDep,
    since: AwareDatetime | None = None,
    until: AwareDatetime | None = None,
    route: S.Route | None = None,
):
    """Your CVs and cover letters compared, version by version (an A/B test), on the
    applications added in [since, until) and by route: how many heard back, got a screen or
    interview, or an offer. Applications with none recorded are a row of their own."""
    r = doc_svc.performance(session, workflow, since=since, until=until, route=route)
    return DocumentsOut(
        applications=r.applications,
        kinds=[
            DocumentKindPerformance(
                kind=k.kind,
                documents=[
                    DocumentPerformance(
                        **_doc_tally(d.tally),
                        id=d.id,
                        name=d.name,
                        versions=[
                            DocumentVersionPerformance(
                                **_doc_tally(v.tally), id=v.id, label=v.label, created_at=v.created_at
                            )
                            for v in d.versions
                        ],
                    )
                    for d in k.documents
                ],
                none=DocumentTally(**_doc_tally(k.none)),
            )
            for k in r.kinds
        ],
    )
