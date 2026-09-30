"""Command line: `jat init | info | migrate | export | restore`."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .config import ConfigError, Settings, resolve_data_dir
from .datadir import DataDirError, check_outside_code_repo, init_data_dir, is_git_repo
from .db import MigrationError, current_revision, db_path, head_revision, make_engine, migrate
from .snapshot import ExportError, RestoreError, export_data_dir, restore_data_dir
from .snapshot.export import META_FILE


def _data_dir(args) -> Path:
    path = resolve_data_dir(Settings(), args.data_dir)
    check_outside_code_repo(path)
    return path


def _require_db(path: Path) -> None:
    if not db_path(path).exists():
        raise DataDirError(f"No database at {db_path(path)}. Run `jat init` first.")


def cmd_init(args) -> int:
    path = _data_dir(args)
    report = init_data_dir(path, commit=not args.no_commit)
    print(f"Data directory: {report.path}")
    print("  created: " + (", ".join(report.created) or "nothing (already initialised)"))
    if report.gitignore_added:
        print("  .gitignore: added " + ", ".join(report.gitignore_added))
    if report.is_git_repo:
        print("  git: " + ("committed the layout" if report.committed else "nothing to commit"))
    else:
        print("  git: not a git repo, so snapshots will be disabled")
    # A fresh clone has export/ but no database: rebuild it rather than starting empty,
    # otherwise the next snapshot would overwrite the export with an empty database.
    if not db_path(path).exists() and (path / "export" / META_FILE).exists():
        counts = restore_data_dir(path)
        print(f"  database: restored from export/ ({sum(counts.values())} rows)")
    else:
        migrate(db_path(path))
        print(f"  database: up to date (schema {head_revision()})")
    return 0


def cmd_info(args) -> int:
    settings = Settings()
    path = _data_dir(args)
    print(f"data_dir: {path} ({'exists' if path.exists() else 'missing'})")
    print(f"git repo: {is_git_repo(path) if path.exists() else False}")
    if db_path(path).exists():
        engine = make_engine(db_path(path))
        print(f"database: schema {current_revision(engine)} (head {head_revision()})")
        engine.dispose()
    else:
        print("database: missing (run `jat init`)")
    print(f"serve:    http://{settings.host}:{settings.port}")
    return 0


def cmd_migrate(args) -> int:
    path = _data_dir(args)
    _require_db(path)
    migrate(db_path(path))
    print(f"database: up to date (schema {head_revision()})")
    return 0


def cmd_export(args) -> int:
    path = _data_dir(args)
    _require_db(path)
    files = export_data_dir(path)
    print(f"exported {len(files)} files to {path / 'export'}")
    return 0


def cmd_restore(args) -> int:
    counts = restore_data_dir(_data_dir(args), force=args.force)
    print(f"restored {sum(counts.values())} rows across {len(counts)} tables")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="jat", description="Job Application Tracker")
    parser.add_argument("--data-dir", type=Path, help="override JAT_DATA_DIR")
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("init", help="create the data directory layout and database")
    p.add_argument("--no-commit", action="store_true", help="don't commit the layout to the data repo")
    p.set_defaults(func=cmd_init)
    sub.add_parser("info", help="show resolved settings").set_defaults(func=cmd_info)
    sub.add_parser("migrate", help="upgrade the database schema").set_defaults(func=cmd_migrate)
    sub.add_parser("export", help="write export/*.jsonl from the database").set_defaults(func=cmd_export)
    p = sub.add_parser("restore", help="rebuild the database from export/")
    p.add_argument("--force", action="store_true", help="move an existing database aside first")
    p.set_defaults(func=cmd_restore)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (ConfigError, DataDirError, RestoreError, ExportError, MigrationError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
