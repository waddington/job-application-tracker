"""The data directory: layout, initialisation and safety checks.

Layout (see docs/rfc/stack.md §4):
    tracker.sqlite3   working database (git-ignored, rebuilt by `jat restore`)
    export/           JSONL export of every table (committed)
    notes/            Markdown notes (committed)
    files/            attachments, CVs, cover letters, .eml (committed)
    config.toml       workflow stages, staleness thresholds, snapshot settings (committed)
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass, field
from pathlib import Path

CODE_ROOT = Path(__file__).resolve().parents[2]
DB_NAME = "tracker.sqlite3"
LAYOUT_DIRS = ("export", "notes", "files")
GITIGNORE_ENTRIES = (
    f"{DB_NAME}",
    f"{DB_NAME}-wal",
    f"{DB_NAME}-shm",
    f"{DB_NAME}-journal",
    f"{DB_NAME}.bak-*",
    "*.tmp",
    ".tmp/",  # uploads in progress
    ".tmp-*",  # atomic writes in progress (notes)
)

DEFAULT_CONFIG = """\
# Job Application Tracker settings for this data directory.
# Edited by the app; safe to edit by hand while the app is stopped.

[snapshot]
# Seconds without writes before the app commits a snapshot to this git repo.
debounce_seconds = 60

# [workflow]
# transitions = "any"        # move applications between any stages (default)
# transitions = "configured" # only allow the moves each stage lists in `next` (Jira-style)
"""


class DataDirError(RuntimeError):
    pass


@dataclass
class InitReport:
    path: Path
    created: list[str] = field(default_factory=list)
    gitignore_added: list[str] = field(default_factory=list)
    committed: bool = False
    is_git_repo: bool = False


def check_outside_code_repo(path: Path, code_root: Path = CODE_ROOT) -> None:
    """The code repo is public: refuse any data directory inside it."""
    path, code_root = path.resolve(), code_root.resolve()
    if path == code_root or code_root in path.parents:
        raise DataDirError(
            f"Refusing to use {path}: it is inside the public code repo ({code_root}). "
            "Keep your data in a separate directory."
        )


def is_git_repo(path: Path) -> bool:
    try:
        out = subprocess.run(
            ["git", "-C", str(path), "rev-parse", "--show-toplevel"], capture_output=True, text=True, check=True
        ).stdout.strip()
    except (subprocess.CalledProcessError, OSError):
        return False
    return Path(out).resolve() == path.resolve()


def _ensure_gitignore(path: Path) -> list[str]:
    gitignore = path / ".gitignore"
    existing = gitignore.read_text().splitlines() if gitignore.exists() else []
    missing = [e for e in GITIGNORE_ENTRIES if e not in existing]
    if missing:
        block = ["", "# Job Application Tracker: working files (rebuilt from export/ by `jat restore`)", *missing]
        text = "\n".join(existing).rstrip("\n")
        gitignore.write_text((text + "\n" if text else "") + "\n".join(block).lstrip("\n") + "\n")
    return missing


def init_data_dir(path: Path, commit: bool = True, code_root: Path = CODE_ROOT) -> InitReport:
    """Create the layout. Idempotent: existing files are never overwritten."""
    check_outside_code_repo(path, code_root)
    report = InitReport(path=path)
    if not path.exists():
        path.mkdir(parents=True)
        report.created.append(str(path))
    for name in LAYOUT_DIRS:
        folder = path / name
        if not folder.exists():
            folder.mkdir()
            report.created.append(f"{name}/")
        keep = folder / ".gitkeep"
        if not any(folder.iterdir()):
            keep.touch()
    config = path / "config.toml"
    if not config.exists():
        config.write_text(DEFAULT_CONFIG)
        report.created.append("config.toml")
    report.gitignore_added = _ensure_gitignore(path)
    report.is_git_repo = is_git_repo(path)
    if commit and report.is_git_repo and (report.created or report.gitignore_added):
        report.committed = _commit_scaffold(path)
    return report


def _commit_scaffold(path: Path) -> bool:
    paths = [".gitignore", "config.toml", *(f"{d}/.gitkeep" for d in LAYOUT_DIRS)]
    paths = [p for p in paths if (path / p).exists()]
    git = ["git", "-C", str(path)]
    subprocess.run([*git, "add", "--", *paths], check=True, capture_output=True)
    staged = subprocess.run([*git, "diff", "--cached", "--quiet"], capture_output=True)
    if staged.returncode == 0:
        return False
    subprocess.run(
        [*git, "commit", "-q", "-m", "chore: initialise job-application-tracker data layout", "--", *paths],
        check=True,
        capture_output=True,
    )
    return True
