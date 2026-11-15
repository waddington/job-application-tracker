"""Bump the version for this branch's PR, from the worktree root, after merging main.

usage: uv run python tools/dev/bump.py <task id> "<changelog entry>" "<conventional PR title>" [minor]

Patch by default, minor with `minor` (a major is never scripted: it needs Kai's yes, CLAUDE.md). It:
sets the version in the five version files, adds a CHANGELOG section with the entry and "(#<PR>)" appended
(so don't write the PR number yourself), marks the roadmap task done, runs uv lock, jat.openapi and
gen:api, commits, pushes, and sets the PR title to "<title> (<version>)". The PR body is left alone.
"""

import os
import re
import subprocess
import sys
from datetime import date
from pathlib import Path

ROOT = Path.cwd()
TRAILER = "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
VERSION_FILES = [
    ("pyproject.toml", 'version = "{}"'),
    ("src/jat/__init__.py", '__version__ = "{}"'),
    ("frontend/package.json", '"version": "{}"'),
    ("website/package.json", '"version": "{}"'),
]


def run(*args: str, **kw) -> str:
    try:
        return subprocess.run(args, check=True, capture_output=True, text=True, **kw).stdout.strip()
    except subprocess.CalledProcessError as e:
        sys.exit(f"{' '.join(args)} failed:\n{e.stderr or e.stdout}")


def node_env() -> dict[str, str]:
    env = dict(os.environ)
    node = env.get("NODE_BIN") or str(Path.home() / ".nvm/versions/node/v22.23.5/bin")
    if Path(node).is_dir():
        env["PATH"] = f"{node}:{env['PATH']}"
    return env


def next_version(old: str, minor: bool) -> str:
    a, b, c = old.split(".")
    return f"{a}.{int(b) + 1}.0" if minor else f"{a}.{b}.{int(c) + 1}"


def changelog_with(text: str, old: str, new: str, entry: str, pr: str, today: str) -> str:
    marker = f"## {old} ("
    if text.count(marker) != 1:
        raise SystemExit(f"CHANGELOG.md should have one '{marker}' section")
    return text.replace(marker, f"## {new} ({today})\n\n- {entry} (#{pr}).\n\n{marker}")


def main() -> None:
    if len(sys.argv) not in (4, 5) or (len(sys.argv) == 5 and sys.argv[4] != "minor"):
        sys.exit(__doc__)
    task, entry, title = sys.argv[1:4]
    minor = len(sys.argv) == 5
    if not (ROOT / "pyproject.toml").exists():
        sys.exit("Run this from the root of a checkout.")
    if run("git", "diff", "--name-only", "--diff-filter=U"):
        sys.exit("Unresolved merge conflict: fix it first")
    branch = run("git", "branch", "--show-current")
    m = re.search(r'^version = "(\d+\.\d+\.\d+)"', (ROOT / "pyproject.toml").read_text(), re.M)
    if not m:
        sys.exit("pyproject.toml: no version line")
    old = m.group(1)
    new = next_version(old, minor)
    pr = run("gh", "pr", "view", "--json", "number", "-q", ".number")
    repo = run("gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner")

    # Work out every change first, so a problem stops the bump before any file is written.
    changes: dict[Path, str] = {}
    for name, pattern in VERSION_FILES:
        s = (ROOT / name).read_text()
        if s.count(pattern.format(old)) != 1:
            sys.exit(f"{name}: expected one {pattern.format(old)}")
        changes[ROOT / name] = s.replace(pattern.format(old), pattern.format(new))
    p = ROOT / "website/src/components/SiteHead.astro"
    s = p.read_text()
    changes[p] = re.sub(r'(softwareVersion["\']?\s*:\s*["\'])' + re.escape(old), r"\g<1>" + new, s)
    if changes[p] == s:
        sys.exit("SiteHead.astro: softwareVersion not found")
    p = ROOT / "CHANGELOG.md"
    changes[p] = changelog_with(p.read_text(), old, new, entry, pr, str(date.today()))
    p = ROOT / "docs/ROADMAP.yaml"
    changes[p], n = re.subn(
        rf"(id: {re.escape(task)}, .*?status: )(next|planned|building|done)", r"\1done", p.read_text(), count=1
    )
    if n != 1:
        sys.exit(f"roadmap task {task} not found")
    for path, text in changes.items():
        path.write_text(text)

    run("uv", "lock", "-q")
    run("uv", "run", "python", "-m", "jat.openapi")
    run("pnpm", "--dir", "frontend", "gen:api", env=node_env())
    run("git", "add", "-A")
    run("git", "commit", "-qm", f"{title}; {new}\n\n{TRAILER}")
    run("git", "push", "-q", "origin", f"HEAD:{branch}")
    run("gh", "api", "-X", "PATCH", f"repos/{repo}/pulls/{pr}", "-f", f"title={title} ({new})", "--silent")
    print(new, pr)


if __name__ == "__main__":
    main()
