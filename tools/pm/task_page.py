"""A page per task: where it stands, the evidence for that, and what its work came to."""

from __future__ import annotations

from datetime import datetime
from html import escape

from .derive import parse_time
from .live import TaskEvidence
from .render import PIPELINE_STAGES, bug_tag, pill, repo_link, task_link
from .roadmap import Roadmap, Task


def stage_why(task: Task) -> str:
    """Why the task is at its stage, in words."""
    if task.status_source == "roadmap":
        return f"<code>docs/ROADMAP.yaml</code> says {escape(task.status)}, and no open PR says otherwise."
    return f"{escape(task.status_source)}."


def stage_track(task: Task) -> str:
    order = [status for _, status in PIPELINE_STAGES]
    if task.status not in order:  # blocked, or a bug nobody has started: not on the way to merged yet
        return ""
    at = order.index(task.status)
    cells = "".join(
        f'<div class="stage"><span class="dot{f" {status} at" if i == at else " past" if i < at else ""}"></span>'
        f'<br><span class="small{"" if i == at else " muted"}">{label}</span></div>'
        for i, (label, status) in enumerate(PIPELINE_STAGES)
    )
    return f'<div class="track">{cells}</div>'


def fact(label: str, value: str) -> str:
    return f"<dt>{label}</dt><dd>{value}</dd>"


def when(raw: str) -> str:
    moment = parse_time(raw)
    return f"{moment:%-d %b %Y, %H:%M}" if moment else "—"


def links(ids: list[str], roadmap: Roadmap) -> str:
    def one(task_id: str) -> str:
        found = roadmap.task(task_id)
        if not found:
            return f"<code>{escape(task_id)}</code> (not on the roadmap)"
        return f"{pill(found.status)} {task_link(task_id)}"

    return "<br>".join(one(task_id) for task_id in ids) or "—"


def code_section(evidence: TaskEvidence, task: Task) -> str:
    if evidence.unreadable:
        return '<p class="muted">git couldn\'t read this just now.</p>'
    if not evidence.source:
        if task.pr:
            return '<p class="muted">Its branch is gone, and it never merged, so there\'s no diff to read.</p>'
        if task.status == "done":
            return '<p class="muted">Marked done on the roadmap, with no PR or branch to read.</p>'
        return '<p class="muted">No branch yet.</p>'
    origin = "the merge commit" if evidence.source == "merged" else "the branch against main"
    facts = [
        fact(
            "Source lines",
            f"+{evidence.added:,} −{evidence.removed:,} <span class='small muted'>from {origin}, generated "
            "files left out</span>",
        ),
        fact("Tests added", f"{evidence.tests:,}"),
    ]
    if evidence.ahead is not None:
        facts.append(fact("Against main", f"{evidence.ahead} ahead, {evidence.behind} behind"))
    if evidence.last_sha:
        facts.append(
            fact(
                "Last commit",
                f"<code>{escape(evidence.last_sha)}</code> {escape(evidence.last_subject)}"
                f"<br><span class='small muted'>{when(evidence.last_when)}</span>",
            )
        )
    return f'<dl class="facts">{"".join(facts)}</dl>'


def task_page(task: Task, roadmap: Roadmap, evidence: TaskEvidence, now: datetime | None = None) -> str:
    needed_by = [t.id for t in roadmap.tasks if task.id in t.depends]
    owner = "Kai" if task.owner == "kai" else escape(task.owner)
    about = [
        fact("Phase", escape(task.phase)),
        fact("Estimate", f"{task.estimate_h:g} h"),
        fact("Owner", owner),
        fact("Depends on", links(task.depends, roadmap)),
        fact("Needed by", links(needed_by, roadmap)),
    ]
    documents = " · ".join(
        repo_link(roadmap, path, label) for path, label in ((task.prd, "PRD"), (task.rfc, "RFC")) if path
    )
    if documents:
        about.append(fact("Documents", documents))
    branch = fact(
        "Branch",
        f"<code>{escape(task.branch_name)}</code>{'' if evidence.source == 'branch' else ' (no longer exists)'}"
        if task.pr or evidence.source
        else f"<code>{escape(task.branch_name)}</code> (not started)",
    )
    if task.pr:
        pr = task.pr
        draft = ", draft" if pr.is_draft else ""
        pr_facts = [
            fact("PR", f'<a href="{escape(pr.url)}">#{pr.number}</a> {escape(pr.title)}'),
            fact("State", f"{escape(pr.state.lower())}{draft}"),
            fact("Opened", when(pr.created_at)),
            fact("Merged", when(pr.merged_at)),
            fact("Size", f"+{pr.additions:,} −{pr.deletions:,} <span class='small muted'>everything, on GitHub</span>"),
        ]
    else:
        pr_facts = [fact("PR", "None yet")]
    detail = f'<p style="margin:8px 0 0">{escape(task.detail)}</p>' if task.detail else ""
    waiting = roadmap.waiting(task)
    wait_note = (
        f'<p class="small muted" style="margin:8px 0 0">Waiting on {escape(", ".join(waiting))}.</p>'
        if waiting and task.status == "planned"
        else ""
    )
    return f"""<div class="stack">
<div class="panel"><p class="small muted" style="margin:0 0 4px"><code>{escape(task.id)}</code></p>
<h1 style="font-size:18px;margin:0 0 8px">{bug_tag(task)}{escape(task.name)}</h1>{pill(task.status)}{detail}</div>
<div class="panel"><h2>Stage</h2>{stage_track(task)}<p style="margin:8px 0 0">{stage_why(task)}</p>{wait_note}</div>
<div class="rm-grid">
<div class="panel"><h2>Pull request</h2><dl class="facts">{branch}{"".join(pr_facts)}</dl></div>
<div class="panel"><h2>Code</h2>{code_section(evidence, task)}</div>
<div class="panel"><h2>About</h2><dl class="facts">{"".join(about)}</dl></div>
</div></div>"""
