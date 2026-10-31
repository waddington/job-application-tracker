"""What the Overview shows, worked out from the roadmap and live data. Pure: no git, no HTML."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta

from .live import Snapshot
from .roadmap import Phase, Roadmap, Task


def parse_time(value: str) -> datetime | None:
    """An ISO time in local time, or None when it's missing or malformed."""
    try:
        return datetime.fromisoformat(value).astimezone() if value else None
    except ValueError:
        return None


def is_merge(subject: str) -> bool:
    return subject.startswith("Merge ")


@dataclass
class Event:
    when: datetime
    kind: str  # commit | opened | merged
    title: str
    detail: str
    url: str = ""


def feed(snapshot: Snapshot, limit: int = 30) -> list[Event]:
    """Commits and PRs as they landed, newest first. A merge commit is left out: its PR says it."""
    events = [
        Event(when, "commit", c.subject, c.sha)
        for c in snapshot.commits
        if not is_merge(c.subject) and (when := parse_time(c.date))
    ]
    for pr in snapshot.live.prs:
        if opened := parse_time(pr.created_at):
            events.append(Event(opened, "opened", f"PR #{pr.number} opened", pr.title, pr.url))
        if merged := parse_time(pr.merged_at):
            events.append(Event(merged, "merged", f"PR #{pr.number} merged", pr.title, pr.url))
    return sorted(events, key=lambda e: e.when, reverse=True)[:limit]


def work_tasks(roadmap: Roadmap) -> list[Task]:
    return [t for t in roadmap.tasks if t.type != "bug"]


def phase_is_bugs(phase: Phase) -> bool:
    return bool(phase.tasks) and all(t.type == "bug" for t in phase.tasks)


def current_phase(roadmap: Roadmap) -> Phase | None:
    """The first phase with work in flight, else the first with work left. Bugs aren't a phase of work."""
    phases = [p for p in roadmap.phases if not phase_is_bugs(p)]
    for phase in phases:
        if any(t.status in ("building", "review") for t in phase.tasks):
            return phase
    return next((p for p in phases if any(t.status != "done" for t in p.tasks)), None)


def phase_dates(phase: Phase) -> tuple[datetime, datetime] | None:
    """From the first PR opened for a phase to the last one merged or opened. The roadmap holds no dates."""
    times = [
        when for t in phase.tasks if t.pr for when in (parse_time(t.pr.created_at), parse_time(t.pr.merged_at)) if when
    ]
    return (min(times), max(times)) if times else None


def pipeline(roadmap: Roadmap, merged: int = 8) -> list[Task]:
    """Tasks in flight, then the ones merged most recently."""
    active = [t for t in roadmap.tasks if t.status in ("building", "review")]
    landed = [t for t in roadmap.tasks if t.status == "done" and t.pr and parse_time(t.pr.merged_at)]
    landed.sort(key=lambda t: parse_time(t.pr.merged_at), reverse=True)
    return active + landed[:merged]


def commits_today(snapshot: Snapshot, now: datetime) -> tuple[int, int, list[int]]:
    """Today's commits on main, merges left out: the total, the last hour's, and a count per hour."""
    by_hour = [0] * 24
    last_hour = 0
    for commit in snapshot.commits:
        when = parse_time(commit.date)
        if not when or is_merge(commit.subject):
            continue
        if when.date() == now.date():
            by_hour[when.hour] += 1
        if timedelta(0) <= now - when <= timedelta(hours=1):
            last_hour += 1
    return sum(by_hour), last_hour, by_hour


@dataclass
class Burnup:
    start: datetime
    now: datetime
    merged: list[tuple[datetime, int]]
    scope: list[tuple[datetime, int]]
    done: int
    total: int
    undated: int  # done with no merged PR to date them: counted from the start
    forecast: datetime | None
    recent: int  # merged within the pace window


PACE_DAYS = 14


def project_start(roadmap: Roadmap, times: list[datetime], now: datetime) -> datetime:
    known = [t for t in (parse_time(roadmap.start), *times) if t]
    return min(known) if known else now


def burnup(roadmap: Roadmap, snapshot: Snapshot, now: datetime) -> Burnup:
    """Tasks merged over time against the roadmap's size over time. The roadmap holds no planned dates,
    so the only thing to compare with is the pace so far, which gives a forecast rather than a plan."""
    tasks = work_tasks(roadmap)
    done = [t for t in tasks if t.status == "done"]
    dated = sorted(when for t in done if t.pr and (when := parse_time(t.pr.merged_at)))
    undated = len(done) - len(dated)
    history = [(when, n) for raw, n in snapshot.scope if (when := parse_time(raw))]
    start = project_start(roadmap, [*dated, *(when for when, _ in history)], now)

    merged = [(start, undated)]
    merged += [(when, undated + i) for i, when in enumerate(dated, 1)]
    merged.append((now, len(done)))
    scope = [(start, history[0][1] if history else len(tasks)), *history, (now, len(tasks))]

    recent = sum(timedelta(0) <= now - when <= timedelta(days=PACE_DAYS) for when in dated)
    left = len(tasks) - len(done)
    forecast = now + timedelta(days=left * PACE_DAYS / recent) if left > 0 and recent else None
    return Burnup(start, now, merged, scope, len(done), len(tasks), undated, forecast, recent)


@dataclass
class TimelineRow:
    phase: Phase
    start: datetime | None
    end: datetime | None
    done: int
    merges: list[tuple[datetime, str]]  # when each task landed, and its name


@dataclass
class Timeline:
    start: datetime
    end: datetime
    now: datetime
    rows: list[TimelineRow]


def timeline(roadmap: Roadmap, now: datetime) -> Timeline:
    """Each phase across time, from its PRs. The end leaves a little room past today."""
    rows = []
    for phase in roadmap.phases:
        dates = phase_dates(phase)
        merges = [(when, t.name) for t in phase.tasks if t.pr and (when := parse_time(t.pr.merged_at))]
        rows.append(
            TimelineRow(
                phase,
                dates[0] if dates else None,
                dates[1] if dates else None,
                sum(t.status == "done" for t in phase.tasks),
                sorted(merges, key=lambda m: m[0]),
            )
        )
    start = project_start(roadmap, [r.start for r in rows if r.start], now)
    room = max((now - start) * 0.04, timedelta(days=1))
    return Timeline(start, now + room, now, rows)
