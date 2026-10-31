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
