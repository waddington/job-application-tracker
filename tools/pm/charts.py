"""The Roadmap page's timeline, burn-up and phase table, as HTML and inline SVG. Pure, and no libraries."""

from __future__ import annotations

from datetime import datetime, timedelta
from html import escape

from . import derive
from .roadmap import Roadmap

WIDTH, HEIGHT = 800, 280
LEFT, RIGHT, TOP, BOTTOM = 40, 16, 12, 28


def day(when: datetime) -> str:
    return f"{when.day} {when:%b}"


def _at(when: datetime, start: datetime, end: datetime) -> float:
    """Where a time falls between two others, as a percentage, kept in range."""
    span = (end - start).total_seconds()
    return max(0.0, min(100.0, 100 * (when - start).total_seconds() / span)) if span > 0 else 0.0


def timeline_html(roadmap: Roadmap, now: datetime) -> str:
    t = derive.timeline(roadmap, now)
    days = (t.end - t.start).days
    step = 1 if days <= 10 else 7 if days <= 70 else 30
    marks = []
    mark = t.start
    while mark < t.end:
        marks.append(f'<span class="mark" style="left:{_at(mark, t.start, t.end):.2f}%">{day(mark)}</span>')
        mark += timedelta(days=step)
    today = f'<i class="today" style="left:{_at(t.now, t.start, t.end):.2f}%"></i>'
    rows = []
    for row in t.rows:
        total = len(row.phase.tasks)
        label = f"{escape(row.phase.id)} {escape(row.phase.name)}"
        bar = ""
        if row.start and row.end:
            left = _at(row.start, t.start, t.end)
            width = max(_at(row.end, t.start, t.end) - left, 0.4)
            fill = 100 * row.done / total if total else 0
            ticks = "".join(
                f'<i class="tick" style="left:{_at(when, t.start, t.end):.2f}%" '
                f'title="{escape(name)}, merged {day(when)}"></i>'
                for when, name in row.merges
            )
            bar = (
                f'<div class="span" style="left:{left:.2f}%;width:{width:.2f}%" '
                f'title="{label}: {day(row.start)} to {day(row.end)}"><i style="width:{fill:.1f}%"></i></div>{ticks}'
            )
        rows.append(
            f'<div class="tl-row"><span class="tl-name" title="{label}">{label}</span>'
            f'<div class="tl-track" role="img" aria-label="{label}: {row.done} of {total} tasks done">'
            f"{bar}{today}</div></div>"
        )
    return (
        '<div class="timeline"><div class="tl-row tl-head"><span></span>'
        f'<div class="tl-scale">{"".join(marks)}</div></div>'
        f"{''.join(rows)}</div>"
    )


def _steps(points: list[tuple[datetime, int]], x, y) -> str:
    """A line that holds its value until the next change, as burn-ups do."""
    out = []
    last = None
    for when, value in points:
        if last is not None:
            out.append(f"{x(when):.1f},{y(last):.1f}")
        out.append(f"{x(when):.1f},{y(value):.1f}")
        last = value
    return " ".join(out)


def burnup_svg(b: derive.Burnup) -> str:
    span = b.now - b.start
    # A forecast far off would squash the rest, so the chart stops at half as long again.
    furthest = b.now + max(span / 2, timedelta(days=1))
    end = min(b.forecast, furthest) if b.forecast else b.now
    tallest = max(b.total, *(n for _, n in b.scope), 1)

    def x(when: datetime) -> float:
        return LEFT + (WIDTH - LEFT - RIGHT) * _at(when, b.start, end) / 100

    def y(value: float) -> float:
        return HEIGHT - BOTTOM - (HEIGHT - TOP - BOTTOM) * value / tallest

    grid = "".join(
        f'<line class="grid" x1="{LEFT}" x2="{WIDTH - RIGHT}" y1="{y(v):.1f}" y2="{y(v):.1f}"/>'
        f'<text class="axis" x="{LEFT - 6}" y="{y(v) + 4:.1f}" text-anchor="end">{v}</text>'
        for v in sorted({0, tallest // 2, tallest})
    )
    labels = (
        f'<text class="axis" x="{LEFT}" y="{HEIGHT - 8}">{day(b.start)}</text>'
        f'<text class="axis" x="{x(b.now):.1f}" y="{HEIGHT - 8}" text-anchor="middle">today</text>'
    )
    if end > b.now:
        labels += f'<text class="axis" x="{WIDTH - RIGHT}" y="{HEIGHT - 8}" text-anchor="end">{day(end)}</text>'
    forecast = ""
    if b.forecast:
        # Runs towards the forecast; if that's past the chart's end, it stops partway up.
        share = (end - b.now) / (b.forecast - b.now) if b.forecast > b.now else 1
        reach = b.done + (b.total - b.done) * share
        forecast = (
            f'<line class="ln-forecast" x1="{x(b.now):.1f}" y1="{y(b.done):.1f}" '
            f'x2="{x(end):.1f}" y2="{y(reach):.1f}"/>'
        )
    summary = f"{b.done} of {b.total} tasks merged"
    return (
        f'<svg class="chart" viewBox="0 0 {WIDTH} {HEIGHT}" role="img" aria-label="Burn-up: {summary}">{grid}'
        f'<line class="today-line" x1="{x(b.now):.1f}" x2="{x(b.now):.1f}" y1="{TOP}" y2="{HEIGHT - BOTTOM}"/>'
        f'<polyline class="ln-scope" points="{_steps(b.scope, x, y)}"/>'
        f'<polyline class="ln-merged" points="{_steps(b.merged, x, y)}"/>{forecast}{labels}</svg>'
    )


def burnup_panel(roadmap: Roadmap, snapshot, now: datetime) -> str:
    b = derive.burnup(roadmap, snapshot, now)
    if b.forecast:
        pace = (
            f"{b.recent} merged in the last {derive.PACE_DAYS} days. At that pace the rest are done around "
            f"{day(b.forecast)}: a forecast, as the roadmap holds no planned dates."
        )
    elif b.done >= b.total:
        pace = "Everything on the roadmap is done."
    else:
        pace = f"Nothing merged in the last {derive.PACE_DAYS} days, so there's no forecast."
    undated = f" {b.undated} done with no merged PR count from the start." if b.undated else ""
    legend = (
        '<div class="legend"><span><i class="key-merged"></i>Merged</span>'
        '<span><i class="key-scope"></i>Scope (tasks on the roadmap)</span>'
        '<span><i class="key-forecast"></i>Forecast</span></div>'
    )
    return (
        f'<div class="panel"><h2>Burn-up</h2>{burnup_svg(b)}{legend}'
        f'<p class="small muted" style="margin:8px 0 0">{pace}{undated}</p></div>'
    )


def status_table(roadmap: Roadmap) -> str:
    rows = []
    for p in roadmap.phases:
        n = {
            s: sum(t.status == s for t in p.tasks) for s in ("done", "review", "building", "planned", "blocked", "bug")
        }
        total = len(p.tasks)
        pct = round(100 * n["done"] / total) if total else 0
        dates = derive.phase_dates(p)
        when = f"{day(dates[0])} – {day(dates[1])}" if dates else "—"
        cells = "".join(f'<td class="num">{n[s] or "·"}</td>' for s in n)
        rows.append(
            f'<tr><td><code class="muted">{escape(p.id)}</code> {escape(p.name)}</td>{cells}'
            f'<td class="num">{p.done_h:g} / {p.estimate_h:g}</td><td class="num">{pct}%</td>'
            f'<td class="small muted">{when}</td></tr>'
        )
    heads = "".join(
        f'<th class="num">{h}</th>'
        for h in ("Done", "In review", "Building", "Planned", "Blocked", "Bugs", "Hours", "%")
    )
    return (
        f'<div class="panel"><h2>Phase status</h2><div class="table-wrap"><table><tr><th>Phase</th>{heads}'
        f"<th>Dates</th></tr>{''.join(rows)}</table></div></div>"
    )
