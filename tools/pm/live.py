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
PR_LIMIT = 1000
ROADMAP_PATH = "docs/ROADMAP.yaml"
TASK_LINE = re.compile(r"^\s+- \{id: .*$", re.M)
_scope_seen: dict[str, int] = {}
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
    git_at: float = 0.0  # when each source last answered
    github_at: float = 0.0
    scope: list[tuple[str, int]] = field(default_factory=list)  # (when, tasks on the roadmap)


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


def count_scope(roadmap_text: str) -> int:
    """How many tasks a version of the roadmap file holds, leaving out bugs."""
    return sum("type: bug" not in line for line in TASK_LINE.findall(roadmap_text))


def scope_history(root: Path, main: str) -> list[tuple[str, int]]:
    """(when, tasks) for each version of the roadmap to reach main, oldest first. A version never
    changes, so each is only read once."""
    log = _run(["git", "log", "--first-parent", "--reverse", f"--format=%h{SEP}%cI", main, "--", ROADMAP_PATH], root)
    history = []
    for line in log.splitlines():
        parts = line.split(SEP)
        if len(parts) != 2:
            continue
        sha, when = parts
        if sha not in _scope_seen:
            _scope_seen[sha] = count_scope(_run(["git", "show", f"{sha}:{ROADMAP_PATH}"], root))
        history.append((when, _scope_seen[sha]))
    return history


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
    snapshot = Snapshot(live=live)
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
        snapshot.scope = scope_history(root, main)
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
            str(PR_LIMIT),
            "--json",
            "number,title,state,headRefName,url,isDraft,updatedAt,createdAt,mergedAt,additions,deletions",
        ]
        if repo:
            args += ["--repo", repo]
        live.prs = parse_prs(_run(args, root, timeout=30))
        if len(live.prs) >= PR_LIMIT:
            live.warnings.append(f"GitHub: only the latest {PR_LIMIT} PRs are read, so PR counts are too low")
    except (subprocess.SubprocessError, OSError, ValueError, KeyError) as exc:
        snapshot.github_ok = False
        live.warnings.append(f"GitHub PRs unavailable (is `gh` installed and logged in?): {exc}")
    snapshot.taken_at = time.time()
    snapshot.git_at = snapshot.taken_at if snapshot.git_ok else 0.0
    snapshot.github_at = snapshot.taken_at if snapshot.github_ok else 0.0
    return snapshot


def keep_last_good(new: Snapshot, old: Snapshot | None) -> Snapshot:
    """A source that failed keeps what it last said, so one timeout doesn't blank the page. Its light
    stays red and the Problems panel says how old that data is."""
    if old is None:
        return new
    if not new.git_ok:
        new.git_at = old.git_at
        new.scope = new.scope or old.scope
        new.commits = new.commits or old.commits
        new.worktrees = new.worktrees or old.worktrees
        new.lines, new.tests = (new.lines, new.tests) if new.lines else (old.lines, old.tests)
        new.live.branches_ahead = new.live.branches_ahead or old.live.branches_ahead
    if not new.github_ok:
        new.github_at = old.github_at
        new.live.prs = old.live.prs
    return new


class Collector:
    """Serves the latest snapshot straight away and refreshes a stale one in the background, so a slow
    `gh` never holds up a page. The first load, or whoever asks for a refresh, waits; nobody else does."""

    def __init__(self, root: Path, repo: str, ttl: float = 30):
        self.root, self.repo, self.ttl = root, repo, ttl
        self._lock = threading.Lock()  # never held while collecting
        self._snapshot: Snapshot | None = None
        self._refreshing = False
        self._started = 0  # collections started, and the latest published,
        self._published = 0  # so a slow older one can't overwrite a newer one

    def _collect(self) -> Snapshot:
        with self._lock:
            self._started += 1
            run = self._started
        fresh = collect(self.root, self.repo)
        with self._lock:
            if run > self._published:
                self._published = run
                self._snapshot = keep_last_good(fresh, self._snapshot)
            return self._snapshot

    def _refresh(self) -> None:
        try:
            self._collect()
        finally:
            with self._lock:
                self._refreshing = False

    def get(self, force: bool = False) -> Snapshot:
        with self._lock:
            snapshot = self._snapshot
            if snapshot is not None and not force:
                if time.time() - snapshot.taken_at > self.ttl and not self._refreshing:
                    self._refreshing = True
                    threading.Thread(target=self._refresh, daemon=True).start()
                return snapshot
        return self._collect()
