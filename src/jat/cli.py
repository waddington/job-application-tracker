"""Command line: `jat init`, `jat info` (more commands arrive with later roadmap tasks)."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .config import ConfigError, Settings, resolve_data_dir
from .datadir import DataDirError, init_data_dir, is_git_repo


def _data_dir(args) -> Path:
    return resolve_data_dir(Settings(), args.data_dir)


def cmd_init(args) -> int:
    report = init_data_dir(_data_dir(args), commit=not args.no_commit)
    print(f"Data directory: {report.path}")
    print("  created: " + (", ".join(report.created) or "nothing (already initialised)"))
    if report.gitignore_added:
        print("  .gitignore: added " + ", ".join(report.gitignore_added))
    if report.is_git_repo:
        print("  git: " + ("committed the layout" if report.committed else "nothing to commit"))
    else:
        print("  git: not a git repo, so snapshots will be disabled")
    return 0


def cmd_info(args) -> int:
    settings = Settings()
    path = _data_dir(args)
    print(f"data_dir: {path} ({'exists' if path.exists() else 'missing'})")
    print(f"git repo: {is_git_repo(path) if path.exists() else False}")
    print(f"serve:    http://{settings.host}:{settings.port}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="jat", description="Job Application Tracker")
    parser.add_argument("--data-dir", type=Path, help="override JAT_DATA_DIR")
    sub = parser.add_subparsers(dest="command", required=True)
    p_init = sub.add_parser("init", help="create the data directory layout")
    p_init.add_argument("--no-commit", action="store_true", help="don't commit the layout to the data repo")
    p_init.set_defaults(func=cmd_init)
    p_info = sub.add_parser("info", help="show resolved settings")
    p_info.set_defaults(func=cmd_info)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (ConfigError, DataDirError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
