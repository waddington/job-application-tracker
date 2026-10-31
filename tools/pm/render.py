"""HTML rendering for the PM dashboard. Pure functions: data in, HTML string out."""

from __future__ import annotations

from datetime import datetime
from html import escape

from .live import Snapshot
from .roadmap import STATUSES, Roadmap, Task
from .style import CSS, THEME_BUTTON, THEME_HEAD

NAV = (("/", "Overview"), ("/board", "Board"), ("/roadmap", "Roadmap"))


def sources(roadmap: Roadmap, snapshot: Snapshot) -> str:
    """A light per source of live data: green when it answered, red when it didn't."""
    lights = (("git", snapshot.git_ok), ("GitHub", snapshot.github_ok), ("roadmap", not roadmap.errors))
    return "".join(
        f'<span class="src{"" if ok else " bad"}" title="{name}: {"ok" if ok else "not available"}">'
        f"<i></i>{name}</span>"
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
<span class="brand-name">{project}</span><span class="brand-sub">build control</span></div>
<nav class="tabs" aria-label="Views">{nav}</nav><div class="top-right">
<span class="live{"" if healthy else " down"}"><span class="live-dot"></span>Updated {taken}</span>
<a href="?refresh=1">Refresh</a><span class="sources" aria-label="Data sources">{sources(roadmap, snapshot)}</span>
{THEME_BUTTON}</div></header>
<main id="view" tabindex="-1">{problems(roadmap, snapshot)}{body}</main></body></html>"""


def problems(roadmap: Roadmap, snapshot: Snapshot) -> str:
    items = [*roadmap.errors, *snapshot.live.warnings]
    if not items:
        return ""
    lis = "".join(f"<li>{escape(i)}</li>" for i in items)
    return f'<div class="panel errors" style="margin-bottom:16px"><h2>Problems</h2><ul class="plain">{lis}</ul></div>'


def pill(status: str) -> str:
    return f'<span class="pill {escape(status)}">{escape(status)}</span>'


def repo_link(roadmap: Roadmap, path: str, label: str) -> str:
    if not roadmap.repo:
        return f"<code>{escape(path)}</code>"
    return f'<a href="https://github.com/{escape(roadmap.repo)}/blob/main/{escape(path)}">{escape(label)}</a>'


def bug_tag(task: Task) -> str:
    """BUG and its severity, on a bug wherever it is, even once a fix has moved it along."""
    if task.type != "bug":
        return ""
    severity = f" · {escape(task.severity)}" if task.severity else ""
    return f'<span class="pill bug">BUG{severity}</span> '


def task_links(roadmap: Roadmap, task: Task) -> str:
    parts = []
    if task.pr:
        draft = " draft" if task.pr.is_draft else ""
        parts.append(f'<a href="{escape(task.pr.url)}">PR #{task.pr.number}</a>'
                     f' <span class="muted">({task.pr.state.lower()}{draft})</span>')
    elif task.branch:
        parts.append(f"<code>{escape(task.branch)}</code> +{task.commits_ahead}")
    if task.prd:
        parts.append(repo_link(roadmap, task.prd, "PRD"))
    if task.rfc:
        parts.append(repo_link(roadmap, task.rfc, "RFC"))
    return " · ".join(parts)


def task_line(roadmap: Roadmap, task: Task, show_status: bool = True) -> str:
    # A bug not started shows its tag instead of a second "bug" pill.
    status = pill(task.status) + " " if show_status and task.status != "bug" else ""
    links = task_links(roadmap, task)
    owner = ' <span class="pill blocked">Kai</span>' if task.owner == "kai" else ""
    detail = f'<br><span class="small">{escape(task.detail)}</span>' if task.detail else ""
    return (f'<li>{status}{bug_tag(task)}<b>{escape(task.name)}</b>{owner}{detail}<br>'
            f'<span class="small muted"><code>{escape(task.id)}</code> · {escape(task.phase)} · {task.estimate_h:g} h'
            f'{" · " + links if links else ""}</span></li>')


def overview(roadmap: Roadmap, snapshot: Snapshot) -> str:
    s = roadmap.summary()
    counts = s["counts"]
    stats = "".join(
        f'<div class="stat"><b>{counts[k]}</b><span>{k}</span></div>' for k in STATUSES
    )
    header = f"""<div class="panel" style="margin-bottom:16px"><h2>Progress</h2>
<div class="stats"><div class="stat"><b>{s["percent"]}%</b>
<span>{s["done_h"]:g} of {s["estimate_h"]:g} h done</span></div>
{stats}</div><div class="bar"><i style="width:{s["percent"]}%"></i></div></div>"""

    bugs = "".join(task_line(roadmap, t) for t in roadmap.open_bugs())
    bugs_panel = (
        f'<div class="panel errors" style="margin-bottom:16px"><h2>Open bugs · {len(roadmap.open_bugs())}</h2>'
        f'<ul class="plain">{bugs}</ul></div>'
        if bugs
        else ""
    )
    header += bugs_panel
    active = [t for t in roadmap.tasks if t.status in ("building", "review")]
    now = "".join(task_line(roadmap, t) for t in active) or '<li class="muted">Nothing in flight.</li>'
    nxt = "".join(task_line(roadmap, t, False) for t in roadmap.next_up()[:8])
    nxt = nxt or '<li class="muted">Nothing ready.</li>'
    blocked = [t for t in roadmap.tasks if t.status == "blocked"]
    blocked_html = "".join(
        task_line(roadmap, t, False).replace(
            "</span></li>",
            f' · waiting on {escape(", ".join(roadmap.waiting(t)) or "Kai")}</span></li>', 1)
        for t in blocked) or '<li class="muted">Nothing blocked.</li>'

    open_prs = [p for p in snapshot.live.prs if p.state == "OPEN"]
    prs = "".join(
        f'<li><a href="{escape(p.url)}">#{p.number}</a> {escape(p.title)} '
        f'<span class="small muted"><code>{escape(p.branch)}</code></span></li>' for p in open_prs
    ) or '<li class="muted">No open PRs.</li>'

    commits = "".join(
        f'<li><code>{escape(c.sha)}</code> {escape(c.subject)} '
        f'<span class="small muted">{escape(c.date[:16].replace("T", " "))}</span></li>' for c in snapshot.commits[:12]
    ) or '<li class="muted">No commits found.</li>'

    phases = "".join(
        f'<li><b>{escape(p.id)}</b> {escape(p.name)} <span class="small muted">'
        f'{p.done_h:g}/{p.estimate_h:g} h</span><div class="bar"><i style="width:'
        f'{round(100 * p.done_h / p.estimate_h) if p.estimate_h else 0}%"></i></div></li>'
        for p in roadmap.phases
    )
    trees = [w for w in snapshot.worktrees if w.branch != "main"]
    trees_html = "".join(f"<li><code>{escape(w.branch)}</code></li>" for w in trees) or '<li class="muted">None.</li>'

    return header + f"""<div class="grid">
<div class="panel"><h2>In progress</h2><ul class="plain">{now}</ul></div>
<div class="panel"><h2>Next up</h2><ul class="plain">{nxt}</ul></div>
<div class="panel"><h2>Blocked</h2><ul class="plain">{blocked_html}</ul></div>
<div class="panel"><h2>Phases</h2><ul class="plain">{phases}</ul></div>
<div class="panel"><h2>Open PRs</h2><ul class="plain">{prs}</ul></div>
<div class="panel"><h2>Active worktrees</h2><ul class="plain">{trees_html}</ul></div>
<div class="panel"><h2>Recent commits on main</h2><ul class="plain">{commits}</ul></div>
</div>"""


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
                f'<div class="card {status}">{bug_tag(t)}<b>{escape(t.name)}</b>'
                f'{f"<div class=small>{escape(t.detail)}</div>" if t.detail else ""}'
                f'<div class="small muted"><code>{escape(t.id)}</code> · {escape(t.phase)} · {t.estimate_h:g} h'
                f'{" · Kai" if t.owner == "kai" else ""}</div>{extra}'
                f'{f"<div class=small>{links}</div>" if links else ""}</div>'
            )
        count = len(cards)
        cols.append(f'<div class="col"><h2 class="small muted">{pill(status)} <span>{count}</span></h2>'
                    f'{"".join(cards) or "<p class=muted>—</p>"}</div>')
    return phase_filter(roadmap, "/board", phase) + f'<div class="board">{"".join(cols)}</div>'


def roadmap_page(roadmap: Roadmap, snapshot: Snapshot) -> str:
    out = []
    for p in roadmap.phases:
        pct = round(100 * p.done_h / p.estimate_h) if p.estimate_h else 0
        rows = []
        for t in p.tasks:
            deps = ", ".join(
                f'{"✓ " if (d := roadmap.task(dep)) and d.status == "done" else ""}{escape(dep)}' for dep in t.depends
            ) or "—"
            rows.append(
                f"<tr><td>{pill(t.status)}</td><td>{bug_tag(t)}<b>{escape(t.name)}</b>"
                f'{f"<br><span class=small>{escape(t.detail)}</span>" if t.detail else ""}<br>'
                f'<code class="muted">{escape(t.id)}</code></td><td>{t.estimate_h:g} h</td>'
                f'<td class="small">{deps}</td><td class="small">{escape(t.owner)}</td>'
                f'<td class="small">{task_links(roadmap, t)}<br>'
                f'<span class="muted">{escape(t.status_source)}</span></td></tr>'
            )
        out.append(
            f'<div class="panel" style="margin-bottom:16px"><h2>{escape(p.id)} · {escape(p.name)} '
            f'<span class="muted">· {p.done_h:g}/{p.estimate_h:g} h · {pct}%</span></h2>'
            f'<p class="muted" style="margin:0">{escape(p.goal)}</p><div class="bar"><i style="width:{pct}%"></i></div>'
            f'<div class="table-wrap"><table><tr><th>Status</th><th>Task</th><th>Estimate</th><th>Depends on</th>'
            f'<th>Owner</th><th>Links</th></tr>{"".join(rows)}</table></div></div>'
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
                "id": p.id, "name": p.name, "goal": p.goal, "estimate_h": p.estimate_h, "done_h": p.done_h,
                "tasks": [
                    {
                        "id": t.id, "name": t.name, "type": t.type, "severity": t.severity,
                        "status": t.status, "status_source": t.status_source,
                        "owner": t.owner, "estimate_h": t.estimate_h, "depends": t.depends,
                        "prd": t.prd, "rfc": t.rfc, "branch": t.branch, "commits_ahead": t.commits_ahead,
                        "pr": {"number": t.pr.number, "state": t.pr.state, "url": t.pr.url} if t.pr else None,
                    }
                    for t in p.tasks
                ],
            }
            for p in roadmap.phases
        ],
    }
