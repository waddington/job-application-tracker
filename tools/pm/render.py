"""HTML rendering for the PM dashboard. Pure functions: data in, HTML string out."""

from __future__ import annotations

from datetime import datetime
from html import escape
from urllib.parse import quote

from . import charts, derive
from .charts import day
from .live import Snapshot
from .roadmap import STATUSES, Roadmap, Task
from .style import CSS, KEEP_FOLDS, THEME_BUTTON, THEME_HEAD

NAV = (
    ("/", "Overview"),
    ("/board", "Board"),
    ("/roadmap", "Roadmap"),
    ("/activity", "Activity"),
    ("/agents", "Agents"),
)


def sources(roadmap: Roadmap, snapshot: Snapshot) -> str:
    """A light per source of live data: green when it answered, red when it didn't."""
    lights = (("git", snapshot.git_ok), ("GitHub", snapshot.github_ok), ("roadmap", not roadmap.errors))
    return "".join(
        f'<span class="src{"" if ok else " bad"}" title="{name}: {"ok" if ok else "has problems, listed below"}">'
        f"<i></i>{name}{'' if ok else ' (problem)'}</span>"
        for name, ok in lights
    )


def page(title: str, active: str, body: str, roadmap: Roadmap, snapshot: Snapshot) -> str:
    nav = "".join(
        f'<a href="{href}" class="tab active" aria-current="page">{label}</a>'
        if href == active
        else f'<a href="{href}" class="tab">{label}</a>'
        for href, label in NAV
    )
    taken = datetime.fromtimestamp(snapshot.taken_at).strftime("%H:%M:%S") if snapshot.taken_at else "never"
    project = escape(roadmap.project or "Project")
    healthy = snapshot.git_ok and snapshot.github_ok and not roadmap.errors
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="60"><title>{escape(title)} · {project} PM</title>
<link rel="icon" href="data:,">{THEME_HEAD}<style>{CSS}</style></head>
<body><a class="skip" href="#view">Skip to content</a><header class="top"><div class="brand">
<svg class="mark" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5"/>
<path d="M8 1.5A6.5 6.5 0 0 1 14.5 8H8z"/></svg>
<span class="brand-name">{project}</span><span class="brand-sub">PM</span></div>
<nav class="tabs" aria-label="Views">{nav}</nav><div class="top-right">
<span class="live{"" if healthy else " down"}"><span class="live-dot"></span>Checked {taken}</span>
<a href="?refresh=1">Refresh</a><span class="sources" aria-label="Data sources">{sources(roadmap, snapshot)}</span>
{THEME_BUTTON}</div></header>
<main id="view" tabindex="-1">{problems(roadmap, snapshot)}{body}</main>{KEEP_FOLDS}</body></html>"""


def problems(roadmap: Roadmap, snapshot: Snapshot) -> str:
    items = [*roadmap.errors, *snapshot.live.warnings]
    ages = ((snapshot.git_ok, snapshot.git_at, "commits"), (snapshot.github_ok, snapshot.github_at, "PRs"))
    for ok, at, what in ages:
        if not ok and at:
            items.append(f"Showing {what} from {datetime.fromtimestamp(at):%-d %b, %H:%M}, when they last answered")
    live = snapshot.live
    if not live.prs_known and any(b.phases for b in live.branch_roadmaps.values()):
        items.append("Tasks only on a branch's roadmap are held back, and out of the totals, until GitHub answers")
    if not items:
        return ""
    lis = "".join(f"<li>{escape(i)}</li>" for i in items)
    return f'<div class="panel errors" style="margin-bottom:16px"><h2>Problems</h2><ul class="plain">{lis}</ul></div>'


def pill(status: str) -> str:
    return f'<span class="pill {escape(status)}">{escape(status)}</span>'


def repo_link(roadmap: Roadmap, path: str, label: str, ref: str | None = None) -> str:
    if not roadmap.repo:
        return f"<code>{escape(path)}</code>"
    target = f"{escape(roadmap.repo)}/blob/{escape(ref or 'main')}/{escape(path)}"
    return f'<a href="https://github.com/{target}">{escape(label)}</a>'


def task_link(task_id: str) -> str:
    return f'<a href="/task/{quote(task_id, safe="")}"><code>{escape(task_id)}</code></a>'


def bug_tag(task: Task) -> str:
    """BUG, its severity, how easy the fix is and its hours, on a bug wherever it is, even once a
    fix has moved it along."""
    if task.type != "bug":
        return ""
    severity = f" · {escape(task.severity)}" if task.severity else ""
    ease = f" · {escape(str(task.review['ease']))} fix" if task.review.get("ease") else ""
    hours = f" · {task.estimate_h:g} h" if task.review.get("ease") and task.estimate_h else ""
    return f'<span class="pill bug">BUG{severity}{ease}{hours}</span> '


def task_tags(task: Task) -> str:
    """The bug tag, and a mark on a task that isn't on main's roadmap yet."""
    if not task.on_branch:
        return bug_tag(task)
    about = f"Only on the roadmap of {task.on_branch} so far, not on main"
    return f'{bug_tag(task)}<span class="on-branch" title="{escape(about)}">on its branch</span> '


def task_links(roadmap: Roadmap, task: Task) -> str:
    parts = []
    if task.pr:
        draft = " draft" if task.pr.is_draft else ""
        parts.append(
            f'<a href="{escape(task.pr.url)}">PR #{task.pr.number}</a>'
            f' <span class="muted">({task.pr.state.lower()}{draft})</span>'
        )
    elif task.branch:
        parts.append(f"<code>{escape(task.branch)}</code> +{task.commits_ahead}")
    if task.prd:
        parts.append(repo_link(roadmap, task.prd, "PRD", task.on_branch))
    if task.rfc:
        parts.append(repo_link(roadmap, task.rfc, "RFC", task.on_branch))
    return " · ".join(parts)


def task_line(roadmap: Roadmap, task: Task, show_status: bool = True) -> str:
    # A bug not started shows its tag instead of a second "bug" pill.
    status = pill(task.status) + " " if show_status and task.status != "bug" else ""
    links = task_links(roadmap, task)
    owner = ' <span class="pill blocked">Kai</span>' if task.owner == "kai" else ""
    detail = f'<br><span class="small">{escape(task.detail)}</span>' if task.detail else ""
    return (
        f"<li>{status}{task_tags(task)}<b>{escape(task.name)}</b>{owner}{detail}<br>"
        f'<span class="small muted">{task_link(task.id)} · {escape(task.phase)} · {task.estimate_h:g} h'
        f"{' · ' + links if links else ''}</span></li>"
    )


def percent(part: int, whole: int) -> int:
    return round(100 * part / whole) if whole else 0


def kpi(label: str, value: str, note: str, extra: str = "") -> str:
    return f'<div class="kpi"><div class="label">{label}</div><b>{value}</b>{extra}<div class="note">{note}</div></div>'


def kpis(roadmap: Roadmap, snapshot: Snapshot, now: datetime) -> str:
    tasks = derive.work_tasks(roadmap)
    done = sum(t.status == "done" for t in tasks)
    bugs = roadmap.open_bugs()
    high = sum(t.severity == "high" for t in bugs)
    prs = snapshot.live.prs
    open_prs = sum(p.state == "OPEN" for p in prs)
    merged = sum(p.state == "MERGED" for p in prs)
    today, last_hour, by_hour = derive.commits_today(snapshot, now)
    tallest = max(by_hour) or 1
    spark = "".join(
        f'<i style="height:{max(10, percent(n, tallest))}%"></i>' if n else '<i class="none"></i>' for n in by_hour
    )
    cards = []
    if phase := derive.current_phase(roadmap):
        phase_done = sum(t.status == "done" for t in phase.tasks)
        bar = f'<div class="bar"><i style="width:{percent(phase_done, len(phase.tasks))}%"></i></div>'
        cards.append(
            kpi(
                f"{escape(phase.id)} {escape(phase.name)}",
                f"{percent(phase_done, len(phase.tasks))}%",
                f"{phase_done} of {len(phase.tasks)} tasks done",
                bar,
            )
        )
    bar = f'<div class="bar"><i style="width:{percent(done, len(tasks))}%"></i></div>'
    # A source that failed before it ever answered has no numbers: saying 0 would be false.
    no_prs = not snapshot.github_ok and not prs
    no_commits = not snapshot.git_ok and not snapshot.commits
    no_code = not snapshot.git_ok and not snapshot.lines
    cards += [
        kpi("Whole roadmap", f"{percent(done, len(tasks))}%", f"{done} of {len(tasks)} tasks done", bar),
        kpi("Pull requests", "—", UNKNOWN_GITHUB)
        if no_prs
        else kpi("Pull requests", f"{open_prs} <small>open</small>", f"{merged} merged, {len(prs)} total"),
        kpi("Open bugs", str(len(bugs)), f"{high} high"),
        kpi("Commits today", "—", UNKNOWN_GIT)
        if no_commits
        else kpi("Commits today", str(today), f"{last_hour} in the last hour", f'<div class="spark">{spark}</div>'),
        kpi("Code", "—", UNKNOWN_GIT)
        if no_code
        else kpi("Code", f"{snapshot.lines:,} <small>lines</small>", f"{snapshot.tests:,} tests defined"),
    ]
    return f'<div class="kpis">{"".join(cards)}</div>'


def phase_rows(roadmap: Roadmap, snapshot: Snapshot) -> str:
    known = snapshot.github_ok or bool(snapshot.live.prs)
    current = derive.current_phase(roadmap)
    rows = []
    for p in roadmap.phases:
        total = len(p.tasks)
        counts = {s: sum(t.status == s for t in p.tasks) for s in ("done", "review", "building")}
        segs = "".join(f'<i class="{s}" style="width:{100 * n / total:.2f}%"></i>' for s, n in counts.items() if n)
        dates = derive.phase_dates(p)
        if dates:
            when = f"{day(dates[0])} – {day(dates[1])}"
        elif not known:
            when = "unknown"
        else:  # finished without a PR is possible: the roadmap can mark a task done by hand
            when = "no PRs" if counts["done"] else "not started"
        tag = ' <span class="now">now</span>' if p is current else ""
        rows.append(
            f'<div class="phase-row"><code class="muted">{escape(p.id)}</code>'
            f'<span class="name" title="{escape(p.name)}">{escape(p.name)}{tag}</span>'
            f'<div class="segs" role="img" aria-label="{counts["done"]} of {total} tasks done">{segs}</div>'
            f'<span class="num">{percent(counts["done"], total)}%</span>'
            f'<span class="small muted num dates">{when}</span></div>'
        )
    return "".join(rows)


UNKNOWN_GITHUB = "GitHub hasn't answered"
UNKNOWN_GIT = "git hasn't answered"
PIPELINE_STAGES = (("Planned", "planned"), ("Building", "building"), ("In review", "review"), ("Merged", "done"))


def pipeline_table(roadmap: Roadmap, snapshot: Snapshot) -> str:
    order = [status for _, status in PIPELINE_STAGES]
    head = "".join(f'<th class="stage">{label}</th>' for label, _ in PIPELINE_STAGES)
    rows = []
    for t in derive.pipeline(roadmap):
        at = order.index(t.status)
        cells = "".join(
            f'<td class="stage"><span class="dot {t.status} at" title="{label}"></span></td>'
            if i == at
            else f'<td class="stage"><span class="dot{" past" if i < at else ""}"></span></td>'
            for i, (label, _) in enumerate(PIPELINE_STAGES)
        )
        commits = f"{t.commits_ahead} commit{'' if t.commits_ahead == 1 else 's'}"
        size = f"+{t.pr.additions:,} −{t.pr.deletions:,}" if t.pr else commits
        rows.append(
            f'<tr><td><span class="sr">{escape(t.status)}: </span>{task_tags(t)}'
            f'<span class="clip" title="{escape(t.name)}">{escape(t.name)}</span>'
            f'<span class="small muted">{task_link(t.id)} · {task_links(roadmap, t)}</span></td>{cells}'
            f'<td class="small muted">{size}</td></tr>'
        )
    if not rows:
        if not snapshot.github_ok:
            return f'<p class="muted">Can\'t tell: {UNKNOWN_GITHUB}.</p>'
        return '<p class="muted">Nothing in flight or merged yet.</p>'
    return f'<div class="table-wrap"><table><tr><th>Task</th>{head}<th>Size</th></tr>{"".join(rows)}</table></div>'


def feed_list(snapshot: Snapshot, now: datetime) -> str:
    items = []
    for e in derive.feed(snapshot):
        stamp = f"{e.when:%H:%M}" if e.when.date() == now.date() else day(e.when)
        title = f'<a href="{escape(e.url)}">{escape(e.title)}</a>' if e.url else escape(e.title)
        dot = {"commit": "past", "drafted": "building", "opened": "review", "merged": "done"}[e.kind]
        about = f"<code>{escape(e.detail)}</code> on main" if e.kind == "commit" else escape(e.detail)
        items.append(
            f'<li><span class="time">{stamp}</span><span class="dot {dot}"></span>'
            f'<span style="min-width:0"><span class="what" title="{escape(e.title)}">{title}</span>'
            f'<span class="about" title="{escape(e.detail)}">{about}</span></span></li>'
        )
    if items:
        return "".join(items)
    known = snapshot.git_ok and snapshot.github_ok
    return '<li class="muted">Nothing yet.</li>' if known else '<li class="muted">Can\'t tell: a source failed.</li>'


def overview(roadmap: Roadmap, snapshot: Snapshot, now: datetime | None = None) -> str:
    now = now or datetime.now().astimezone()
    legend = "".join(
        f'<span><i class="{status}"></i>{label}</span>'
        for label, status in (
            ("Planned", "planned"),
            ("Building", "building"),
            ("In review", "review"),
            ("Done", "done"),
        )
    )
    header = f"""{kpis(roadmap, snapshot, now)}<div class="ov-grid"><div class="ov-main">
<div class="panel"><h2>Phases</h2>{phase_rows(roadmap, snapshot)}<div class="legend">{legend}</div></div>
<div class="panel"><h2>Pipeline</h2><p class="small muted" style="margin:0 0 6px">In flight, then the latest merged,
live from branches and PRs</p>{pipeline_table(roadmap, snapshot)}</div></div>
<div class="panel"><h2>Happening now</h2><ol class="feed">{feed_list(snapshot, now)}</ol></div></div>"""

    bugs = "".join(task_line(roadmap, t) for t in roadmap.open_bugs())
    if bugs:
        header += (
            '<details id="open-bugs" class="panel errors gap">'
            f"<summary>Open bugs · {len(roadmap.open_bugs())}</summary>"
            f'<ul class="plain">{bugs}</ul></details>'
        )
    nxt = "".join(task_line(roadmap, t, False) for t in roadmap.next_up()[:8])
    nxt = nxt or '<li class="muted">Nothing ready.</li>'
    blocked = [t for t in roadmap.tasks if t.status == "blocked"]
    blocked_html = (
        "".join(
            task_line(roadmap, t, False).replace(
                "</span></li>", f" · waiting on {escape(', '.join(roadmap.waiting(t)) or 'Kai')}</span></li>", 1
            )
            for t in blocked
        )
        or '<li class="muted">Nothing blocked.</li>'
    )

    open_prs = [p for p in snapshot.live.prs if p.state == "OPEN"]
    prs = (
        "".join(
            f'<li><a href="{escape(p.url)}">#{p.number}</a> {escape(p.title)} '
            f'<span class="small muted"><code>{escape(p.branch)}</code>{" · draft" if p.is_draft else ""}</span></li>'
            for p in open_prs
        )
        or f'<li class="muted">{"No open PRs" if snapshot.github_ok else UNKNOWN_GITHUB}.</li>'
    )

    trees = [w for w in snapshot.worktrees if w.branch != "main"]
    no_trees = f'<li class="muted">{"None" if snapshot.git_ok else UNKNOWN_GIT}.</li>'
    trees_html = "".join(f"<li><code>{escape(w.branch)}</code></li>" for w in trees) or no_trees

    return (
        header
        + f"""<div class="grid">
<div class="panel"><h2>Next up</h2><ul class="plain">{nxt}</ul></div>
<div class="panel"><h2>Blocked</h2><ul class="plain">{blocked_html}</ul></div>
<div class="panel"><h2>Open PRs</h2><ul class="plain">{prs}</ul></div>
<div class="panel"><h2>Active worktrees</h2><ul class="plain">{trees_html}</ul></div>
</div>"""
    )


def phase_filter(roadmap: Roadmap, base: str, selected: str | None) -> str:
    links = [f'<a href="{base}" class="{"" if selected else "active"}">All</a>']
    for p in roadmap.phases:
        cls = "active" if p.id == selected else ""
        links.append(f'<a href="{base}?phase={escape(p.id)}" class="{cls}">{escape(p.id)} {escape(p.name)}</a>')
    return f'<div class="filters">{"".join(links)}</div>'


def board(roadmap: Roadmap, snapshot: Snapshot, phase: str | None = None) -> str:
    tasks = [t for t in roadmap.tasks if not phase or t.phase == phase]
    cols = []
    for status in STATUSES:
        cards = []
        for t in (t for t in tasks if t.status == status):
            extra = ""
            if status == "planned" and (waiting := roadmap.waiting(t)):
                extra = f'<div class="small muted">waits on {escape(", ".join(waiting))}</div>'
            links = task_links(roadmap, t)
            cards.append(
                f'<div class="card {status}">{task_tags(t)}<b>{escape(t.name)}</b>'
                f"{f'<div class=small>{escape(t.detail)}</div>' if t.detail else ''}"
                f'<div class="small muted">{task_link(t.id)} · {escape(t.phase)} · {t.estimate_h:g} h'
                f"{' · Kai' if t.owner == 'kai' else ''}</div>{extra}"
                f"{f'<div class=small>{links}</div>' if links else ''}</div>"
            )
        count = len(cards)
        if status == "unknown" and not count:  # only while GitHub has never answered
            continue
        cols.append(
            f'<div class="col"><h2 class="small muted">{pill(status)} <span>{count}</span></h2>'
            f"{''.join(cards) or '<p class=muted>—</p>'}</div>"
        )
    return phase_filter(roadmap, "/board", phase) + f'<div class="board">{"".join(cols)}</div>'


def roadmap_page(roadmap: Roadmap, snapshot: Snapshot, now: datetime | None = None) -> str:
    now = now or datetime.now().astimezone()
    current = derive.current_phase(roadmap)
    out = [
        f"""<div class="stack"><details id="section-timeline" class="panel" open><summary><h2>Timeline</h2></summary>
<p class="small muted" style="margin:8px 0">
Each phase from its first PR to its latest. Fill shows tasks done, a tick is a task merged, and the line is today.</p>
{charts.timeline_html(roadmap, now)}</details>
<div class="rm-grid">{charts.burnup_panel(roadmap, snapshot, now)}{charts.status_table(roadmap)}</div></div>"""
    ]
    for p in roadmap.phases:
        pct = round(100 * p.done_h / p.estimate_h) if p.estimate_h else 0
        rows = []
        for t in p.tasks:
            deps = (
                ", ".join(
                    f"{'✓ ' if (d := roadmap.task(dep)) and d.status == 'done' else ''}{escape(dep)}"
                    for dep in t.depends
                )
                or "—"
            )
            rows.append(
                f"<tr><td>{pill(t.status)}</td><td>{task_tags(t)}<b>{escape(t.name)}</b>"
                f"{f'<br><span class=small>{escape(t.detail)}</span>' if t.detail else ''}<br>"
                f"{task_link(t.id)}</td><td>{t.estimate_h:g} h</td>"
                f'<td class="small">{deps}</td><td class="small">{escape(t.owner)}</td>'
                f'<td class="small">{task_links(roadmap, t)}<br>'
                f'<span class="muted">{escape(t.status_source)}</span></td></tr>'
            )
        out.append(
            f'<details id="phase-{escape(p.id)}" class="panel gap"{" open" if p is current else ""}>'
            f"<summary><h2>{escape(p.id)} · "
            f'{escape(p.name)} <span class="muted">· {p.done_h:g}/{p.estimate_h:g} h · {pct}%</span></h2></summary>'
            f'<p class="muted" style="margin:0">{escape(p.goal)}</p><div class="bar"><i style="width:{pct}%"></i></div>'
            f'<div class="table-wrap"><table><tr><th>Status</th><th>Task</th><th>Estimate</th><th>Depends on</th>'
            f"<th>Owner</th><th>Links</th></tr>{''.join(rows)}</table></div></details>"
        )
    return "".join(out)


def as_json(roadmap: Roadmap, snapshot: Snapshot) -> dict:
    return {
        "project": roadmap.project,
        "repo": roadmap.repo,
        "summary": roadmap.summary(),
        "errors": roadmap.errors,
        "warnings": snapshot.live.warnings,
        "next_up": [t.id for t in roadmap.next_up()],
        "phases": [
            {
                "id": p.id,
                "name": p.name,
                "goal": p.goal,
                "estimate_h": p.estimate_h,
                "done_h": p.done_h,
                "tasks": [
                    {
                        "id": t.id,
                        "name": t.name,
                        "type": t.type,
                        "severity": t.severity,
                        "status": t.status,
                        "status_source": t.status_source,
                        "owner": t.owner,
                        "estimate_h": t.estimate_h,
                        "depends": t.depends,
                        "prd": t.prd,
                        "rfc": t.rfc,
                        "branch": t.branch,
                        "on_branch": t.on_branch,
                        "commits_ahead": t.commits_ahead,
                        "pr": {"number": t.pr.number, "state": t.pr.state, "is_draft": t.pr.is_draft, "url": t.pr.url}
                        if t.pr
                        else None,
                    }
                    for t in p.tasks
                ],
            }
            for p in roadmap.phases
        ],
    }
