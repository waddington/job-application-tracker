"""Roadmap model: load docs/ROADMAP.yaml, validate it and merge in live git/GitHub status."""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .yamlish import YamlishError, parse

STATUSES = ("planned", "building", "review", "done", "blocked")
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


@dataclass
class Live:
    """Live evidence from git and GitHub. Everything is optional: missing tools mean no evidence."""

    branches_ahead: dict[str, int] = field(default_factory=dict)  # branch -> commits ahead of main
    prs: list[PullRequest] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

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
    estimate_h: float = 0.0
    depends: list[str] = field(default_factory=list)
    prd: str | None = None
    rfc: str | None = None
    # Filled in by apply_live.
    status: str = "planned"
    status_source: str = "roadmap"
    branch: str | None = None
    commits_ahead: int = 0
    pr: PullRequest | None = None

    @property
    def branch_name(self) -> str:
        return BRANCH_PREFIX + self.id


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
    for i, raw_phase in enumerate(data.get("phases") or []):
        if not isinstance(raw_phase, dict) or not raw_phase.get("id"):
            roadmap.errors.append(f"phase #{i + 1} needs an id")
            continue
        phase = Phase(id=str(raw_phase["id"]), name=str(raw_phase.get("name") or raw_phase["id"]),
                      goal=str(raw_phase.get("goal") or ""))
        for raw in raw_phase.get("tasks") or []:
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
    depends = raw.get("depends") or []
    if not isinstance(depends, list):
        errors.append(f"{task_id}: depends must be a list")
        depends = []
    try:
        estimate = float(raw.get("estimate_h") or 0)
    except (TypeError, ValueError):
        errors.append(f"{task_id}: estimate_h must be a number")
        estimate = 0.0
    return Task(
        id=task_id,
        name=str(raw.get("name") or task_id),
        phase=phase_id,
        owner=str(raw.get("owner") or "lead"),
        planned_status=status,
        status=status,
        estimate_h=estimate,
        depends=[str(d) for d in depends],
        prd=raw.get("prd"),
        rfc=raw.get("rfc"),
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
                return path[path.index(nxt):] + [nxt]
            if state.get(nxt) is None and (found := visit(nxt)):
                return found
        path.pop()
        state[node] = 2
        return None

    for node in graph:
        if state.get(node) is None and (found := visit(node)):
            return found
    return None


def apply_live(roadmap: Roadmap, live: Live) -> Roadmap:
    """Set each task's live status from git and GitHub evidence, falling back to the roadmap.

    merged PR -> done; open PR -> review; branch with commits ahead of main -> building.
    A task the roadmap already marks done or blocked keeps that status.
    """
    for task in roadmap.tasks:
        task.status, task.status_source = task.planned_status, "roadmap"
        task.pr = live.pr_for(task.branch_name)
        task.commits_ahead = live.branches_ahead.get(task.branch_name, 0)
        task.branch = task.branch_name if task.branch_name in live.branches_ahead else None
        if task.planned_status in ("done", "blocked"):
            continue
        if task.pr and task.pr.state == "MERGED":
            task.status, task.status_source = "done", f"PR #{task.pr.number} merged"
        elif task.pr and task.pr.state == "OPEN":
            task.status, task.status_source = "review", f"PR #{task.pr.number} open"
        elif task.commits_ahead > 0:
            task.status, task.status_source = "building", f"{task.commits_ahead} commits on {task.branch_name}"
    return roadmap
