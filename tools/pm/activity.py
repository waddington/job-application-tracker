"""The Activity page: how the build has gone over time. The numbers first (pure), then the HTML and SVG."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from html import escape
from statistics import median

from .charts import _steps, day
from .derive import is_merge, parse_time
from .live import Snapshot
from .roadmap import PullRequest

TYPES = ("feat", "fix", "test", "docs", "refactor", "chore", "other")
SUBJECT = re.compile(r"^(\w+)(?:\(([^)]+)\))?!?:")
TOO_MANY_DAYS = 120  # past this, a bar per week
HEATMAP_DAYS = 14
BIG_PR = 1000  # CLAUDE.md's PR size limit

WIDTH, HEIGHT = 800, 240
LEFT, RIGHT, TOP, BOTTOM = 48, 12, 16, 28


def commit_kind(subject: str) -> tuple[str, str | None]:
    """A commit's Conventional Commit type and scope. Anything else is `other`."""
    match = SUBJECT.match(subject)
    if not match:
        return "other", None
    kind = match.group(1).lower()
    return (kind if kind in TYPES else "other"), match.group(2)


def work_commits(snapshot: Snapshot) -> list[tuple[datetime, str]]:
    """(when, subject), leaving out merges, which aren't work of their own."""
    return [(when, c.subject) for c in snapshot.commits if not is_merge(c.subject) and (when := parse_time(c.date))]


@dataclass
class CommitBars:
    starts: list[date]  # the first day of each bar
    days_each: int
    series: dict[str, list[int]]  # per type, a count per bar


def commits_over_time(snapshot: Snapshot, now: datetime) -> CommitBars:
    commits = work_commits(snapshot)
    first = min((when.date() for when, _ in commits), default=now.date())
    span = (now.date() - first).days + 1
    each = 1 if span <= TOO_MANY_DAYS else 7
    bars = (span - 1) // each + 1
    series = {kind: [0] * bars for kind in TYPES}
    for when, subject in commits:
        index = (when.date() - first).days // each
        if 0 <= index < bars:
            series[commit_kind(subject)[0]][index] += 1
    return CommitBars([first + timedelta(days=i * each) for i in range(bars)], each, series)


def scopes(snapshot: Snapshot, limit: int = 10) -> list[tuple[str, int]]:
    counts = Counter(commit_kind(subject)[1] or "no scope" for _, subject in work_commits(snapshot))
    return counts.most_common(limit)


def heatmap(snapshot: Snapshot, now: datetime) -> tuple[list[date], Counter]:
    """The last two weeks by day and hour of day, local time."""
    days = [now.date() - timedelta(days=i) for i in range(HEATMAP_DAYS - 1, -1, -1)]
    return days, Counter((when.date(), when.hour) for when, _ in work_commits(snapshot))


def throughput(prs: list[PullRequest], now: datetime) -> tuple[list[tuple[datetime, int]], list[tuple[datetime, int]]]:
    """Cumulative PRs opened and merged, each running up to now."""

    def running(raw: list[str]) -> list[tuple[datetime, int]]:
        times = sorted(when for value in raw if (when := parse_time(value)))
        if not times:
            return []
        return [(times[0], 0), *((when, i) for i, when in enumerate(times, 1)), (now, len(times))]

    return running([p.created_at for p in prs]), running([p.merged_at for p in prs])


def pr_sizes(prs: list[PullRequest], limit: int = 40) -> list[PullRequest]:
    """The latest PRs that weren't abandoned, oldest first."""
    kept = [p for p in prs if p.state != "CLOSED"]
    return sorted(kept, key=lambda p: p.number)[-limit:]


# ---- the page


def section(key: str, title: str, note: str, body: str) -> str:
    return (
        f'<details id="section-{key}" class="panel" open><summary><h2>{title}</h2></summary>'
        f'<p class="small muted" style="margin:6px 0 8px">{note}</p>{body}</details>'
    )


def _axis(tallest: int, y) -> str:
    return "".join(
        f'<line class="grid" x1="{LEFT}" x2="{WIDTH - RIGHT}" y1="{y(v):.1f}" y2="{y(v):.1f}"/>'
        f'<text class="axis" x="{LEFT - 6}" y="{y(v) + 4:.1f}" text-anchor="end">{v:,}</text>'
        for v in sorted({0, tallest // 2, tallest})
    )


def commits_chart(bars: CommitBars) -> str:
    totals = [sum(bars.series[k][i] for k in TYPES) for i in range(len(bars.starts))]
    tallest = max(totals, default=0) or 1
    inner = WIDTH - LEFT - RIGHT
    each = inner / max(len(bars.starts), 1)

    def y(value: float) -> float:
        return HEIGHT - BOTTOM - (HEIGHT - TOP - BOTTOM) * value / tallest

    rects, labels = [], []
    for i, start in enumerate(bars.starts):
        below = 0
        for kind in TYPES:
            n = bars.series[kind][i]
            if n:
                rects.append(
                    f'<rect class="k-{kind}" x="{LEFT + i * each + 0.5:.1f}" y="{y(below + n):.1f}" '
                    f'width="{max(each - 1, 0.5):.1f}" height="{y(below) - y(below + n):.1f}">'
                    f"<title>{day(start)}: {n} {kind}</title></rect>"
                )
                below += n
        if i % max(len(bars.starts) // 5, 1) == 0:
            labels.append(f'<text class="axis" x="{LEFT + i * each:.1f}" y="{HEIGHT - 8}">{day(start)}</text>')
    legend = "".join(f'<span><i class="k-{k}"></i>{k}</span>' for k in TYPES if any(bars.series[k]))
    total = sum(totals)
    return (
        f'<svg class="chart" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="{total} commits by type over time">'
        f'{_axis(tallest, y)}{"".join(rects)}{"".join(labels)}</svg><div class="legend">{legend}</div>'
    )


def throughput_chart(opened: list[tuple[datetime, int]], merged: list[tuple[datetime, int]], now: datetime) -> str:
    start = min((when for when, _ in opened + merged), default=now)
    tallest = max((n for _, n in opened + merged), default=0) or 1
    span = (now - start).total_seconds() or 1

    def x(when: datetime) -> float:
        return LEFT + (WIDTH - LEFT - RIGHT) * (when - start).total_seconds() / span

    def y(value: float) -> float:
        return HEIGHT - BOTTOM - (HEIGHT - TOP - BOTTOM) * value / tallest

    lines = "".join(
        f'<polyline class="{name}" points="{_steps(points, x, y)}"/>'
        for name, points in (("ln-scope", opened), ("ln-merged", merged))
        if points
    )
    done = merged[-1][1] if merged else 0
    made = opened[-1][1] if opened else 0
    return (
        f'<svg class="chart" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="{made} PRs opened, {done} merged">'
        f'{_axis(tallest, y)}{lines}<text class="axis" x="{LEFT}" y="{HEIGHT - 8}">{day(start)}</text>'
        f'<text class="axis" x="{WIDTH - RIGHT}" y="{HEIGHT - 8}" text-anchor="end">today</text></svg>'
        '<div class="legend"><span><i class="key-scope"></i>Opened</span>'
        '<span><i class="key-merged"></i>Merged</span></div>'
    )


def size_chart(prs: list[PullRequest]) -> str:
    tallest = max((max(p.additions, p.deletions) for p in prs), default=0) or 1
    middle = (HEIGHT - BOTTOM + TOP) / 2
    half = (HEIGHT - BOTTOM - TOP) / 2
    each = (WIDTH - LEFT - RIGHT) / max(len(prs), 1)
    bars = []
    for i, p in enumerate(prs):
        title = f"<title>#{p.number}: +{p.additions:,} −{p.deletions:,}</title>"
        left = LEFT + i * each + 0.5
        width = max(each - 1, 0.5)
        up, down = half * p.additions / tallest, half * p.deletions / tallest
        bars.append(
            f'<rect class="add" x="{left:.1f}" y="{middle - up:.1f}" width="{width:.1f}" height="{up:.1f}">'
            f"{title}</rect>"
            f'<rect class="del" x="{left:.1f}" y="{middle:.1f}" width="{width:.1f}" height="{down:.1f}">{title}</rect>'
        )
    axis = (
        f'<line class="grid" x1="{LEFT}" x2="{WIDTH - RIGHT}" y1="{middle}" y2="{middle}"/>'
        f'<text class="axis" x="{LEFT - 6}" y="{TOP + 4}" text-anchor="end">{tallest:,}</text>'
        f'<text class="axis" x="{LEFT - 6}" y="{HEIGHT - BOTTOM + 4}" text-anchor="end">{tallest:,}</text>'
    )
    ends = ""
    if prs:
        ends = (
            f'<text class="axis" x="{LEFT}" y="{HEIGHT - 8}">#{prs[0].number}</text>'
            f'<text class="axis" x="{WIDTH - RIGHT}" y="{HEIGHT - 8}" text-anchor="end">#{prs[-1].number}</text>'
        )
    return (
        f'<svg class="chart" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="Lines added and removed per PR">'
        f'{axis}{"".join(bars)}{ends}</svg><div class="legend"><span><i class="add"></i>Added</span>'
        '<span><i class="del"></i>Removed</span></div>'
    )


def size_note(prs: list[PullRequest]) -> str:
    if not prs:
        return "No PRs yet."
    sizes = [p.additions + p.deletions for p in prs]
    over = sum(size > BIG_PR for size in sizes)
    return (
        f"The latest {len(prs)} PRs: typically {median(sizes):,.0f} changed lines, {over} over {BIG_PR:,}. "
        "Counts everything, including lockfiles and generated files."
    )


def bar_rows(rows: list[tuple[str, int, str]]) -> str:
    """Rows of a name, a bar and a figure."""
    tallest = max((n for _, n, _ in rows), default=0) or 1
    return "".join(
        f'<div class="hbar"><span class="hname" title="{escape(name)}">{escape(name)}</span>'
        f'<div class="htrack"><i style="width:{100 * n / tallest:.1f}%"></i></div>'
        f'<span class="num small muted">{escape(figure)}</span></div>'
        for name, n, figure in rows
    )


def heatmap_grid(days: list[date], counts: Counter) -> str:
    tallest = max((counts[(d, h)] for d in days for h in range(24)), default=0) or 1
    hours = "".join(f'<span class="hm-h">{h if h % 6 == 0 else ""}</span>' for h in range(24))
    rows = []
    for d in days:
        cells = []
        for hour in range(24):
            n = counts[(d, hour)]
            shade = f' style="opacity:{0.25 + 0.75 * n / tallest:.2f}"' if n else ""
            cells.append(f'<i class="{"on" if n else "off"}"{shade} title="{day(d)}, {hour}:00: {n}"></i>')
        rows.append(f'<span class="hm-day">{d.day} {d:%b}</span>{"".join(cells)}')
    return (
        f'<div class="heat" role="img" aria-label="Commits by day and hour"><span></span>{hours}{"".join(rows)}</div>'
    )


def activity_page(snapshot: Snapshot, now: datetime | None = None) -> str:
    now = now or datetime.now().astimezone()
    prs = snapshot.live.prs
    no_git = '<p class="muted">git hasn\'t answered yet.</p>'
    no_github = '<p class="muted">GitHub hasn\'t answered yet.</p>'
    known_git = snapshot.git_ok or bool(snapshot.commits)
    known_github = snapshot.github_ok or bool(prs)
    latest = pr_sizes(prs)
    opened, merged = throughput(prs, now)
    days, counts = heatmap(snapshot, now)
    areas = sorted(snapshot.areas.items(), key=lambda item: -item[1][0])
    area_lines = [(name, n[0], f"{n[0]:,} lines") for name, n in areas]
    area_tests = [(name, n[1], f"{n[1]:,} tests") for name, n in sorted(areas, key=lambda i: -i[1][1]) if n[1]]
    return f"""<div class="stack">
{
        section(
            "commits",
            "Commits over time",
            "On main, by Conventional Commit type, merges left out.",
            commits_chart(commits_over_time(snapshot, now)) if known_git else no_git,
        )
    }
<div class="rm-grid">
{
        section(
            "throughput",
            "PR throughput",
            "All PRs opened and merged so far.",
            throughput_chart(opened, merged, now) if known_github else no_github,
        )
    }
{
        section(
            "prsize",
            "PR size",
            size_note(latest) if known_github else "",
            size_chart(latest) if known_github else no_github,
        )
    }
{
        section(
            "lines",
            "Lines by area",
            "Source in the checkout the dashboard runs in, generated files left out.",
            bar_rows(area_lines) if known_git else no_git,
        )
    }
{
        section(
            "tests",
            "Tests by area",
            "Tests defined in the source. A parameterised test counts once.",
            bar_rows(area_tests) if known_git else no_git,
        )
    }
{
        section(
            "heat",
            "When commits land",
            f"The last {HEATMAP_DAYS} days by hour, local time.",
            heatmap_grid(days, counts) if known_git else no_git,
        )
    }
{
        section(
            "scope",
            "Commits by scope",
            "The scope in each commit's subject.",
            bar_rows([(name, n, str(n)) for name, n in scopes(snapshot)]) if known_git else no_git,
        )
    }
</div></div>"""
