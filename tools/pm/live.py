"""Collect live evidence from git and the GitHub CLI. Every call degrades to "no evidence"
with a warning when a tool is missing or fails, so the dashboard always renders."""

from __future__ import annotations

import json
import subprocess
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from .roadmap import BRANCH_PREFIX, Live, PullRequest

SEP = "\x1f"


@dataclass
class Commit:
    sha: str
    subject: str
    date: str
    author: str


@dataclass
class Worktree:
    path: str
    branch: str


@dataclass
class Snapshot:
    live: Live
    commits: list[Commit] = field(default_factory=list)
    worktrees: list[Worktree] = field(default_factory=list)
    taken_at: float = 0.0


def _run(args: list[str], cwd: Path, timeout: float = 15) -> str:
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, timeout=timeout, check=True)
    return result.stdout


def parse_branches(output: str) -> list[str]:
    """Branch names from `git for-each-ref --format=%(refname:short)`, deduplicated, with
    `origin/` stripped and only `worktree-*` branches kept."""
    names = []
    for line in output.splitlines():
        name = line.strip().removeprefix("origin/")
        if name.startswith(BRANCH_PREFIX) and name not in names:
            names.append(name)
    return names


def parse_prs(output: str) -> list[PullRequest]:
    prs = []
    for raw in json.loads(output or "[]"):
        prs.append(
            PullRequest(
                number=int(raw["number"]),
                title=raw.get("title", ""),
                state=raw.get("state", "").upper(),
                branch=raw.get("headRefName", ""),
                url=raw.get("url", ""),
                is_draft=bool(raw.get("isDraft")),
                updated_at=raw.get("updatedAt", ""),
            )
        )
    return prs


def parse_commits(output: str) -> list[Commit]:
    commits = []
    for line in output.splitlines():
        parts = line.split(SEP)
        if len(parts) == 4:
            commits.append(Commit(*parts))
    return commits


def parse_worktrees(output: str) -> list[Worktree]:
    trees, path = [], None
    for line in output.splitlines():
        if line.startswith("worktree "):
            path = line.removeprefix("worktree ")
        elif line.startswith("branch ") and path:
            trees.append(Worktree(path, line.removeprefix("branch refs/heads/")))
    return trees


def _main_ref(root: Path) -> str:
    for ref in ("origin/main", "main"):
        try:
            _run(["git", "rev-parse", "--verify", "--quiet", ref], root)
            return ref
        except (subprocess.SubprocessError, OSError):
            continue
    return "HEAD"


def collect(root: Path, repo: str) -> Snapshot:
    live = Live()
    snapshot = Snapshot(live=live, taken_at=time.time())
    try:
        main = _main_ref(root)
        refs = _run(["git", "for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes/origin"], root)
        for branch in parse_branches(refs):
            for ref in (branch, f"origin/{branch}"):
                try:
                    count = int(_run(["git", "rev-list", "--count", f"{main}..{ref}"], root).strip())
                except (subprocess.SubprocessError, OSError, ValueError):
                    continue
                live.branches_ahead[branch] = max(count, live.branches_ahead.get(branch, 0))
        log = _run(["git", "log", main, "-n", "20", f"--format=%h{SEP}%s{SEP}%cI{SEP}%an"], root)
        snapshot.commits = parse_commits(log)
        snapshot.worktrees = parse_worktrees(_run(["git", "worktree", "list", "--porcelain"], root))
    except (subprocess.SubprocessError, OSError) as exc:
        live.warnings.append(f"git unavailable: {exc}")
    try:
        args = ["gh", "pr", "list", "--state", "all", "--limit", "200",
                "--json", "number,title,state,headRefName,url,isDraft,updatedAt"]
        if repo:
            args += ["--repo", repo]
        live.prs = parse_prs(_run(args, root, timeout=30))
    except (subprocess.SubprocessError, OSError, ValueError, KeyError) as exc:
        live.warnings.append(f"GitHub PRs unavailable (is `gh` installed and logged in?): {exc}")
    return snapshot


class Collector:
    """Caches snapshots so page loads stay fast; refreshes at most every `ttl` seconds."""

    def __init__(self, root: Path, repo: str, ttl: float = 30):
        self.root, self.repo, self.ttl = root, repo, ttl
        self._lock = threading.Lock()
        self._snapshot: Snapshot | None = None

    def get(self, force: bool = False) -> Snapshot:
        with self._lock:
            stale = self._snapshot is None or time.time() - self._snapshot.taken_at > self.ttl
            if force or stale:
                self._snapshot = collect(self.root, self.repo)
            return self._snapshot
