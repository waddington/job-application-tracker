"""Roadmap model: load docs/ROADMAP.yaml, validate it and merge in live git/GitHub status."""

from __future__ import annotations

from dataclasses import dataclass, field, replace
from math import isfinite
from pathlib import Path

from .yamlish import YamlishError, parse

# "unknown" only comes from live evidence: commits on a branch while GitHub has never answered.
STATUSES = ("bug", "planned", "building", "review", "unknown", "done", "blocked")
SEVERITIES = ("high", "medium", "low")
BRANCH_PREFIX = "worktree-"


@dataclass
class PullRequest:
    number: int
    title: str
    state: str  # OPEN | MERGED | CLOSED
    branch: str
    url: str
    is_draft: bool = False
    updated_at: str = ""
    created_at: str = ""
    merged_at: str = ""
    additions: int = 0
    deletions: int = 0
    merge_commit: str = ""
    head_sha: str = ""


@dataclass
class BranchRoadmap:
    """What one branch's copy of the roadmap adds: its phases, holding only the tasks it added."""

    branch: str
    sha: str = ""
    phases: list[Phase] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


@dataclass
class Live:
    """Live evidence from git and GitHub. Everything is optional: missing tools mean no evidence."""

    branches_ahead: dict[str, int] = field(default_factory=dict)  # branch -> commits ahead of main
    prs: list[PullRequest] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    branch_roadmaps: dict[str, BranchRoadmap] = field(default_factory=dict)
    prs_known: bool = True  # False until GitHub has answered once: `prs` being empty then means nothing

    def pr_for(self, branch: str) -> PullRequest | None:
        """The PR for a branch: an open one if any, else the most recently merged, else closed."""
        candidates = [p for p in self.prs if p.branch == branch]
        for state in ("OPEN", "MERGED", "CLOSED"):
            matching = [p for p in candidates if p.state == state]
            if matching:
                return max(matching, key=lambda p: p.number)
        return None


@dataclass
class Task:
    id: str
    name: str
    phase: str
    owner: str = "lead"
    planned_status: str = "planned"
    # "bug" for a bug: it starts in the bug status and keeps this as a fix moves it along.
    type: str = "task"
    severity: str | None = None
    # A longer description: what happens and how it was found. Names stay short.
    detail: str | None = None
    estimate_h: float = 0.0
    depends: list[str] = field(default_factory=list)
    prd: str | None = None
    rfc: str | None = None
    # The branch whose roadmap it came from, when it isn't on main's yet.
    on_branch: str | None = None
    # Filled in by apply_live.
    status: str = "planned"
    status_source: str = "roadmap"
    branch: str | None = None
    commits_ahead: int = 0
    pr: PullRequest | None = None
    # A task added by another task's branch, with no branch of its own: where its work is.
    via_branch: str | None = None
    pr_unknown: bool = False  # GitHub has never answered, so nothing is known about its PRs

    @property
    def branch_name(self) -> str:
        return BRANCH_PREFIX + self.id

    @property
    def work_branch(self) -> str:
        return self.via_branch or self.branch_name


@dataclass
class Phase:
    id: str
    name: str
    goal: str = ""
    tasks: list[Task] = field(default_factory=list)

    @property
    def estimate_h(self) -> float:
        return sum(t.estimate_h for t in self.tasks)

    @property
    def done_h(self) -> float:
        return sum(t.estimate_h for t in self.tasks if t.status == "done")


@dataclass
class Roadmap:
    project: str = ""
    repo: str = ""
    start: str = ""
    phases: list[Phase] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    @property
    def tasks(self) -> list[Task]:
        return [t for p in self.phases for t in p.tasks]

    def task(self, task_id: str) -> Task | None:
        return next((t for t in self.tasks if t.id == task_id), None)

    def deps_done(self, task: Task) -> bool:
        return all((d := self.task(dep)) is not None and d.status == "done" for dep in task.depends)

    def next_up(self) -> list[Task]:
        """Planned tasks whose dependencies are all done, in roadmap order."""
        return [t for t in self.tasks if t.status == "planned" and self.deps_done(t)]

    def open_bugs(self) -> list[Task]:
        """Bugs not fixed yet, worst first, then in roadmap order."""
        rank = {s: i for i, s in enumerate(SEVERITIES)}
        bugs = [t for t in self.tasks if t.type == "bug" and t.status != "done"]
        return sorted(bugs, key=lambda t: rank.get(t.severity or "", len(SEVERITIES)))

    def waiting(self, task: Task) -> list[str]:
        """Dependencies of `task` that aren't done yet."""
        return [dep for dep in task.depends if (d := self.task(dep)) is None or d.status != "done"]

    def summary(self) -> dict:
        tasks = self.tasks
        total_h = sum(t.estimate_h for t in tasks)
        done_h = sum(t.estimate_h for t in tasks if t.status == "done")
        counts = {s: sum(1 for t in tasks if t.status == s) for s in STATUSES}
        return {
            "tasks": len(tasks),
            "counts": counts,
            "estimate_h": total_h,
            "done_h": done_h,
            "percent": round(100 * done_h / total_h) if total_h else 0,
        }


def load(path: Path) -> Roadmap:
    """Load and validate a roadmap. Problems are collected in `errors` rather than raised,
    so the dashboard can still show whatever parsed."""
    try:
        data = parse(path.read_text())
    except (OSError, YamlishError) as exc:
        return Roadmap(errors=[f"{path.name}: {exc}"])
    return from_data(data)


def from_data(data) -> Roadmap:
    if not isinstance(data, dict):
        return Roadmap(errors=["roadmap must be a mapping"])
    roadmap = Roadmap(
        project=str(data.get("project") or ""),
        repo=str(data.get("repo") or ""),
        start=str(data.get("start") or ""),
    )
    raw_phases = data.get("phases") or []
    if not isinstance(raw_phases, list):
        roadmap.errors.append("phases must be a list")
        raw_phases = []
    for i, raw_phase in enumerate(raw_phases):
        if not isinstance(raw_phase, dict) or not raw_phase.get("id"):
            roadmap.errors.append(f"phase #{i + 1} needs an id")
            continue
        phase = Phase(
            id=str(raw_phase["id"]),
            name=str(raw_phase.get("name") or raw_phase["id"]),
            goal=str(raw_phase.get("goal") or ""),
        )
        raw_tasks = raw_phase.get("tasks") or []
        if not isinstance(raw_tasks, list):
            roadmap.errors.append(f"{phase.id}: tasks must be a list")
            raw_tasks = []
        for raw in raw_tasks:
            task = _task(raw, phase.id, roadmap.errors)
            if task:
                phase.tasks.append(task)
        roadmap.phases.append(phase)
    _validate(roadmap)
    return roadmap


def _task(raw, phase_id: str, errors: list[str]) -> Task | None:
    if not isinstance(raw, dict) or not raw.get("id"):
        errors.append(f"{phase_id}: every task needs an id")
        return None
    task_id = str(raw["id"])
    status = str(raw.get("status") or "planned")
    if status not in STATUSES:
        errors.append(f"{task_id}: unknown status {status!r}")
        status = "planned"
    kind = str(raw.get("type") or ("bug" if status == "bug" else "task"))
    if kind not in ("task", "bug"):
        errors.append(f"{task_id}: unknown type {kind!r}")
        kind = "task"
    if kind == "bug" and status == "planned":
        status = "bug"
    if status == "bug" and kind != "bug":
        errors.append(f"{task_id}: status bug on a task that isn't a bug")
    severity = raw.get("severity")
    if severity is not None and str(severity) not in SEVERITIES:
        errors.append(f"{task_id}: unknown severity {severity!r}")
        severity = None
    if kind == "bug" and severity is None:
        errors.append(f"{task_id}: a bug needs a severity (high, medium or low)")
    depends = raw.get("depends") or []
    if not isinstance(depends, list):
        errors.append(f"{task_id}: depends must be a list")
        depends = []
    try:
        estimate = float(raw.get("estimate_h") or 0)
        if not isfinite(estimate):
            raise ValueError
    except (TypeError, ValueError):
        errors.append(f"{task_id}: estimate_h must be a number")
        estimate = 0.0
    documents = {}
    for key in ("prd", "rfc"):
        documents[key] = raw.get(key)
        if documents[key] is not None and not isinstance(documents[key], str):
            errors.append(f"{task_id}: {key} must be a path")
            documents[key] = None
    return Task(
        id=task_id,
        name=str(raw.get("name") or task_id),
        phase=phase_id,
        owner=str(raw.get("owner") or "lead"),
        planned_status=status,
        status=status,
        type=kind,
        severity=str(severity) if severity is not None else None,
        detail=str(raw["detail"]) if raw.get("detail") is not None else None,
        estimate_h=estimate,
        depends=[str(d) for d in depends],
        prd=documents["prd"],
        rfc=documents["rfc"],
    )


def _validate(roadmap: Roadmap) -> None:
    seen: set[str] = set()
    for task in roadmap.tasks:
        if task.id in seen:
            roadmap.errors.append(f"duplicate task id {task.id!r}")
        seen.add(task.id)
    for task in roadmap.tasks:
        for dep in task.depends:
            if dep not in seen:
                roadmap.errors.append(f"{task.id}: depends on unknown task {dep!r}")
    cycle = _find_cycle(roadmap)
    if cycle:
        roadmap.errors.append("dependency cycle: " + " -> ".join(cycle))


def _find_cycle(roadmap: Roadmap) -> list[str] | None:
    graph = {t.id: [d for d in t.depends] for t in roadmap.tasks}
    state: dict[str, int] = {}  # 1 = visiting, 2 = done
    path: list[str] = []

    def visit(node: str) -> list[str] | None:
        state[node] = 1
        path.append(node)
        for nxt in graph.get(node, []):
            if nxt not in graph:
                continue
            if state.get(nxt) == 1:
                return path[path.index(nxt) :] + [nxt]
            if state.get(nxt) is None and (found := visit(nxt)):
                return found
        path.pop()
        state[node] = 2
        return None

    for node in graph:
        if state.get(node) is None and (found := visit(node)):
            return found
    return None


def add_branch_tasks(roadmap: Roadmap, live: Live) -> None:
    """Add the tasks that so far exist only on a branch's roadmap. A task on main keeps main's definition.

    A branch whose latest PR merged or closed has nothing to add: what merged is on main, and what closed
    was dropped. Two branches adding the same id: the task's own branch wins, else the first by name.
    Until GitHub has answered, which branches are still open is unknown, so none are added: a dropped
    branch's tasks would count in the totals. The Problems panel says they're held back.
    """
    if not live.prs_known:
        return
    known = {t.id for t in roadmap.tasks}
    found: dict[str, tuple[Phase, Task]] = {}
    for name, branch in sorted(live.branch_roadmaps.items()):
        pr = live.pr_for(name)
        if pr and pr.state != "OPEN":
            continue
        roadmap.errors.extend(f"{name}: {error}" for error in branch.errors)
        for phase in branch.phases:
            for task in phase.tasks:
                if task.id not in known and (task.id not in found or task.branch_name == name):
                    # A copy, because apply_live writes to it and this branch's data is shared between requests.
                    # Nothing on a branch is done until it merges, whatever its roadmap says.
                    planned = "building" if task.planned_status == "done" else task.planned_status
                    found[task.id] = (phase, replace(task, on_branch=name, planned_status=planned, status=planned))
    phases = {p.id: p for p in roadmap.phases}
    for phase, task in found.values():
        if phase.id not in phases:
            phases[phase.id] = Phase(phase.id, phase.name, phase.goal)
            roadmap.phases.append(phases[phase.id])
        phases[phase.id].tasks.append(task)


def apply_live(roadmap: Roadmap, live: Live) -> Roadmap:
    """Set each task's live status from git and GitHub evidence, falling back to the roadmap.

    merged PR -> done; open ready PR -> review; open draft PR, or a branch with commits ahead of main
    -> building. A task the roadmap already marks blocked keeps that status. One marked done keeps it,
    unless its only PR is still open: a PR marks its task done just before merging, and it isn't done until then.
    A follow-up PR on a branch that has already merged doesn't reopen the task. Commits on a branch while
    GitHub has never answered are unknown: its PR could be a draft, ready, merged or closed.
    A task added by another task's branch shows that branch and PR, and keeps the status in that branch's file.
    """
    add_branch_tasks(roadmap, live)
    for task in roadmap.tasks:
        task.status, task.status_source = task.planned_status, "roadmap"
        task.pr_unknown = not live.prs_known
        own = task.branch_name
        if task.on_branch and task.on_branch != own and not live.pr_for(own) and own not in live.branches_ahead:
            task.via_branch = task.on_branch
        where = task.work_branch
        task.pr = live.pr_for(where)
        task.commits_ahead = live.branches_ahead.get(where, 0)
        task.branch = where if where in live.branches_ahead else None
        if task.via_branch or task.planned_status == "blocked":
            continue
        merged = [p for p in live.prs if p.branch == task.branch_name and p.state == "MERGED"]
        if task.planned_status == "done" and merged:
            task.pr = max(merged, key=lambda p: p.number)  # the PR that finished it, not the follow-up
            continue
        if task.pr and task.pr.state == "OPEN":
            if task.pr.is_draft:
                task.status, task.status_source = "building", f"PR #{task.pr.number} open as a draft"
            else:
                task.status, task.status_source = "review", f"PR #{task.pr.number} open"
        elif task.planned_status == "done":
            continue
        elif task.pr and task.pr.state == "MERGED":
            task.status, task.status_source = "done", f"PR #{task.pr.number} merged"
        elif task.commits_ahead > 0:
            commits = f"{task.commits_ahead} commit{'' if task.commits_ahead == 1 else 's'} on {task.branch_name}"
            if live.prs_known:
                task.status, task.status_source = "building", commits
            else:
                task.status, task.status_source = "unknown", f"{commits}; its PR is unknown: GitHub hasn't answered"
    return roadmap
