"""Collect live evidence from git and the GitHub CLI. Every call degrades to "no evidence"
with a warning when a tool is missing or fails, so the dashboard always renders."""

from __future__ import annotations

import json
import re
import subprocess
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

from .roadmap import BRANCH_PREFIX, Live, PullRequest

SEP = "\x1f"
SOURCE_SUFFIXES = {".py", ".ts", ".tsx", ".css", ".astro", ".mjs", ".js"}
GENERATED = {"schema.d.ts"}
PY_TEST = re.compile(r"^\s*(?:async\s+)?def test_", re.M)
JS_TEST = re.compile(r"^\s*(?:it|test)(?:\.(?:only|skip|each|fixme)(?:\([^)]*\))?)?\(", re.M)


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
    git_ok: bool = True
    github_ok: bool = True
    lines: int = 0  # lines of source in tracked files
    tests: int = 0  # tests defined in tracked files


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
                created_at=raw.get("createdAt", ""),
                merged_at=raw.get("mergedAt") or "",
                additions=int(raw.get("additions") or 0),
                deletions=int(raw.get("deletions") or 0),
            )
        )
    return prs


def count_code(root: Path, files: list[str]) -> tuple[int, int]:
    """Lines of source and tests defined across `files`. Generated files don't count, and a
    parameterised test counts once."""
    lines = tests = 0
    for name in files:
        path = root / name
        if path.suffix not in SOURCE_SUFFIXES or path.name in GENERATED:
            continue
        try:
            text = path.read_text(errors="ignore")
        except OSError:  # listed by git but gone from the checkout
            continue
        lines += text.count("\n")
        if path.suffix == ".py":
            tests += len(PY_TEST.findall(text))
        elif ".test." in path.name or ".spec." in path.name:
            tests += len(JS_TEST.findall(text))
    return lines, tests


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
        if main == "HEAD":
            snapshot.git_ok = False
            live.warnings.append("git: no main branch found, so 'main' here means whatever is checked out")
        refs = _run(["git", "for-each-ref", "--format=%(refname:short)", "refs/heads", "refs/remotes/origin"], root)
        for branch in parse_branches(refs):
            counted = False
            for ref in (branch, f"origin/{branch}"):  # one of these may not exist, which is fine
                try:
                    count = int(_run(["git", "rev-list", "--count", f"{main}..{ref}"], root).strip())
                except (subprocess.SubprocessError, OSError, ValueError):
                    continue
                counted = True
                live.branches_ahead[branch] = max(count, live.branches_ahead.get(branch, 0))
            if not counted:
                snapshot.git_ok = False
                live.warnings.append(f"git: couldn't compare {branch} with main")
        log = _run(["git", "log", main, "-n", "300", f"--format=%h{SEP}%s{SEP}%cI{SEP}%an"], root)
        snapshot.commits = parse_commits(log)
        snapshot.worktrees = parse_worktrees(_run(["git", "worktree", "list", "--porcelain"], root))
        snapshot.lines, snapshot.tests = count_code(root, _run(["git", "ls-files"], root).splitlines())
    except (subprocess.SubprocessError, OSError, ValueError) as exc:
        snapshot.git_ok = False
        live.warnings.append(f"git failed: {exc}")
    try:
        args = [
            "gh",
            "pr",
            "list",
            "--state",
            "all",
            "--limit",
            "1000",
            "--json",
            "number,title,state,headRefName,url,isDraft,updatedAt,createdAt,mergedAt,additions,deletions",
        ]
        if repo:
            args += ["--repo", repo]
        live.prs = parse_prs(_run(args, root, timeout=30))
    except (subprocess.SubprocessError, OSError, ValueError, KeyError) as exc:
        snapshot.github_ok = False
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
