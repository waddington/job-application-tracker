"""The Agents page: who is working where, from worktrees and PRs. The numbers first (pure), then the HTML.

Hype-pie reads Claude's workflow journals for this. This project doesn't use them, so the evidence is
what every agent leaves behind: its worktree's edits and commits, and its PR's dates.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from html import escape
from pathlib import PurePosixPath
from urllib.parse import quote

from .charts import _at, day
from .derive import parse_time
from .live import DETACHED, Snapshot, Worktree
from .roadmap import BRANCH_PREFIX, PullRequest, Roadmap, Task

WORKING = timedelta(minutes=45)
IDLE = timedelta(hours=3)
LANES = 20
STATE_ORDER = {"working": 0, "idle": 1, "stale": 2}
STATE_PILL = {"working": "building", "idle": "review", "stale": "planned"}
STATE_WORD = {"working": "working", "idle": "idle", "stale": "stale"}


def last_active(tree: Worktree) -> datetime | None:
    """The latest edit or commit of its own."""
    times = [parse_time(tree.last_commit)]
    if tree.last_edit:
        times.append(datetime.fromtimestamp(tree.last_edit).astimezone())
    known = [t for t in times if t]
    return max(known) if known else None


def state_of(last: datetime | None, now: datetime) -> str:
    if last is None:
        return "stale"
    age = now - last
    return "working" if age < WORKING else "idle" if age < IDLE else "stale"


def ago(when: datetime | None, now: datetime) -> str:
    if when is None:
        return "—"
    minutes = int((now - when).total_seconds() // 60)
    if minutes < 1:
        return "just now"
    if minutes < 60:
        return f"{minutes} min ago"
    if minutes < 48 * 60:
        return f"{minutes // 60} h ago"
    return f"{minutes // (24 * 60)} days ago"


@dataclass
class AgentRow:
    tree: Worktree
    name: str
    task: Task | None
    state: str
    last: datetime | None
    pr: PullRequest | None = None


def agent_rows(roadmap: Roadmap, snapshot: Snapshot, now: datetime) -> list[AgentRow]:
    """One row per worktree other than main, the busiest first."""
    rows = []
    for tree in snapshot.worktrees:
        if tree.branch == "main":
            continue
        last = last_active(tree)
        name = PurePosixPath(tree.path).name
        # Mid-rebase it has no branch, but its folder is still named after its task.
        task_id = name if tree.branch == DETACHED else tree.branch.removeprefix(BRANCH_PREFIX)
        pr = snapshot.live.pr_for(BRANCH_PREFIX + task_id)
        rows.append(AgentRow(tree, name, roadmap.task(task_id), state_of(last, now), last, pr))
    earliest = datetime.min.replace(tzinfo=now.tzinfo)
    return sorted(rows, key=lambda r: (STATE_ORDER[r.state], -(r.last or earliest).timestamp()))


@dataclass
class Lane:
    pr: PullRequest
    start: datetime
    end: datetime


def lanes(prs: list[PullRequest], now: datetime, limit: int = LANES) -> list[Lane]:
    """The latest PRs, newest first, each from opened to merged. One still open runs to now. One closed
    unmerged has no end date of its own to trust, beyond when it was last touched."""
    out = []
    for pr in prs:
        start = parse_time(pr.created_at)
        if not start:
            continue
        end = parse_time(pr.merged_at) or (now if pr.state == "OPEN" else parse_time(pr.updated_at)) or start
        out.append(Lane(pr, start, max(end, start)))
    return sorted(out, key=lambda lane: lane.start, reverse=True)[:limit]


def most_at_once(all_lanes: list[Lane]) -> int:
    """The most lanes running at the same moment."""
    edges = sorted(
        [(lane.start, 1) for lane in all_lanes] + [(lane.end, -1) for lane in all_lanes], key=lambda e: (e[0], e[1])
    )
    running = most = 0
    for _, change in edges:
        running += change
        most = max(most, running)
    return most


def peak_in_window(prs: list[PullRequest], shown: list[Lane], now: datetime) -> int:
    """The most at once over the period shown, counting older PRs still running in it, which have no bar."""
    if not shown:
        return 0
    start = min(lane.start for lane in shown)
    return most_at_once([lane for lane in lanes(prs, now, limit=len(prs)) if lane.end >= start])


# ---- the page


def working_table(rows: list[AgentRow], now: datetime) -> str:
    if not rows:
        return '<p class="muted">No worktrees: nothing is being worked on.</p>'
    out = []
    for r in rows:
        tree = r.tree
        pr = r.pr
        task = (
            f'<a class="clip" href="/task/{quote(r.task.id, safe="")}" title="{escape(r.task.name)}">'
            f"{escape(r.task.name)}</a>"
            if r.task
            else '<span class="muted">Not on the roadmap</span>'
        )
        link = f' · <a href="{escape(pr.url)}">PR #{pr.number}</a>' if pr else ""
        if tree.branch == DETACHED:
            link = f" {DETACHED}{link}"
        state = (
            '<span class="pill blocked">can\'t read</span>'
            if tree.unreadable
            else f'<span class="pill {STATE_PILL[r.state]}">{STATE_WORD[r.state]}</span>'
        )
        figures = (
            '<td class="num">—</td><td class="num">—</td>'
            if tree.unreadable
            else f'<td class="num">{tree.ahead}</td><td class="num">{tree.dirty}</td>'
        )
        out.append(
            f"<tr><td>{state}</td><td>{task}<span class='small muted'><code>{escape(r.name)}</code>{link}</span></td>"
            f'{figures}<td class="num small muted">{ago(r.last, now)}</td></tr>'
        )
    return (
        '<div class="table-wrap"><table><tr><th>State</th><th>Worktree</th><th class="num">Commits</th>'
        f'<th class="num">Unsaved files</th><th class="num">Last activity</th></tr>{"".join(out)}</table></div>'
    )


def _scale(start: datetime, end: datetime) -> str:
    hours = (end - start).total_seconds() / 3600
    step = 6 if hours <= 48 else 24 if hours <= 24 * 7 else 24 * 7
    marks = []
    mark = start
    while mark < end:
        text = f"{mark:%H:%M}" if hours <= 48 else day(mark)
        marks.append(f'<span class="tl-mark" style="left:{_at(mark, start, end):.2f}%">{text}</span>')
        mark += timedelta(hours=step)
    return "".join(marks)


def swimlanes(found: list[Lane], now: datetime) -> str:
    if not found:
        return '<p class="muted">No PRs yet.</p>'
    start = min(lane.start for lane in found)
    room = max((now - start) * 0.02, timedelta(minutes=5))
    end = now + room
    today = f'<i class="today" style="left:{_at(now, start, end):.2f}%"></i>'
    rows = []
    for lane in found:
        pr = lane.pr
        left = _at(lane.start, start, end)
        width = max(_at(lane.end, start, end) - left, 0.5)
        kind = {"MERGED": "done", "OPEN": "building"}.get(pr.state, "planned")
        hover = f"#{pr.number} {pr.title}: {lane.start:%-d %b %H:%M} to {lane.end:%-d %b %H:%M}"
        rows.append(
            f'<div class="tl-row"><span class="tl-name" title="{escape(pr.title)}">'
            f"#{pr.number} {escape(pr.title)}</span>"
            f'<div class="tl-track"><a class="lane {kind}" href="{escape(pr.url)}" title="{escape(hover)}" '
            f'style="left:{left:.2f}%;width:{width:.2f}%"></a>{today}</div></div>'
        )
    return (
        '<div class="timeline"><div class="tl-row tl-head"><span></span>'
        f'<div class="tl-scale">{_scale(start, end)}</div></div>{"".join(rows)}</div>'
        '<div class="legend"><span><i class="building"></i>Open</span><span><i class="done"></i>Merged</span>'
        '<span><i class="closed"></i>Closed</span></div>'
    )


def _section(key: str, title: str, note: str, body: str) -> str:
    return (
        f'<details id="section-{key}" class="panel" open><summary><h2>{title}</h2></summary>'
        f'<p class="small muted" style="margin:6px 0 8px">{note}</p>{body}</details>'
    )


def agents_page(roadmap: Roadmap, snapshot: Snapshot, now: datetime | None = None) -> str:
    now = now or datetime.now().astimezone()
    rows = agent_rows(roadmap, snapshot, now)
    known_git = snapshot.git_ok or bool(snapshot.worktrees)
    known_github = snapshot.github_ok or bool(snapshot.live.prs)
    found = lanes(snapshot.live.prs, now)
    counts = {s: sum(r.state == s and not r.tree.unreadable for r in rows) for s in STATE_ORDER}
    summary = f"{counts['working']} working, {counts['idle']} idle, {counts['stale']} stale."
    working = _section(
        "working",
        "Working now",
        f"{summary} Worktrees other than main. Working means an edit or commit of its own in the last "
        f"{int(WORKING.total_seconds() // 60)} minutes; idle, in the last {int(IDLE.total_seconds() // 3600)} hours."
        if known_git
        else "",
        working_table(rows, now) if known_git else '<p class="muted">git hasn\'t answered yet.</p>',
    )
    note = (
        f"The latest {len(found)} PRs from opened to merged. A bar is a PR, not an agent: it's a sign of when work "
        f"ran, and subagents such as reviewers don't appear. Over this period, counting older PRs still "
        f"running, at most {peak_in_window(snapshot.live.prs, found, now)} ran at once. "
        "Since PRs open as drafts when work starts, recent bars are closest to the truth."
        if found
        else ""
    )
    lanes_html = _section(
        "lanes",
        "Swimlanes",
        note,
        swimlanes(found, now) if known_github else '<p class="muted">GitHub hasn\'t answered yet.</p>',
    )
    return f'<div class="stack">{working}{lanes_html}</div>'
