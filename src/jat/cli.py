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
from .snapshot.git import SnapshotError


def _data_dir(args) -> Path:
    path = resolve_data_dir(Settings(), args.data_dir)
    check_outside_code_repo(path)
    return path


def _require_db(path: Path) -> None:
    if not db_path(path).exists():
        hint = " (it rebuilds the database from export/)" if (path / "export" / META_FILE).exists() else ""
        raise DataDirError(f"No database at {db_path(path)}. Run `jat init` first{hint}.")


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
    elif (path / "export" / META_FILE).exists():
        print("database: missing; `jat init` rebuilds it from export/")
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


def cmd_serve(args) -> int:
    import os

    import uvicorn

    settings = Settings()
    path = _data_dir(args)
    _require_db(path)
    migrate(db_path(path))  # always serve on the current schema
    host, port = args.host or settings.host, args.port or settings.port
    # uvicorn builds the app in its own import (needed for --dev reload), so hand over via env.
    os.environ["JAT_DATA_DIR"] = str(path)
    os.environ["JAT_DEV"] = "1" if args.dev else "0"
    os.environ["JAT_HOST"] = host  # the app only answers to this host (and loopback names)
    print(f"Job Application Tracker: http://{host}:{port}  (data: {path})")
    if args.dev:
        print("dev mode: API reloads on change; run `pnpm --dir frontend dev` for the UI on :5173")
    uvicorn.run(
        "jat.app:app_from_env",
        factory=True,
        host=host,
        port=port,
        reload=args.dev,
        reload_dirs=[str(Path(__file__).resolve().parent)] if args.dev else None,
        log_level="info" if args.dev else "warning",
    )
    return 0


def _service(path: Path):
    from .snapshot.git import SnapshotService

    _require_db(path)
    migrate(db_path(path))
    return SnapshotService(path, make_engine(db_path(path)), debounce_seconds=0)


def cmd_snapshot(args) -> int:
    commit = _service(_data_dir(args)).snapshot_now()
    print(f"committed snapshot {commit}" if commit else "nothing changed since the last snapshot")
    return 0


def cmd_push(args) -> int:
    service = _service(_data_dir(args))
    service.snapshot_now()
    print(service.push() or "pushed")
    return 0


def cmd_archive(args) -> int:
    from .snapshot.archive import archive_name, write_archive

    dest = args.output or Path.cwd() / f"{archive_name()}.zip"
    if dest.exists():
        print(f"error: {dest} already exists; pick another --output", file=sys.stderr)
        return 2
    info = write_archive(_service(_data_dir(args)), dest)
    print(f"wrote {info.path} ({info.files} files, {info.bytes:,} bytes before compression)")
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
    p = sub.add_parser("serve", help="run the web app (localhost only by default)")
    p.add_argument("--host", help="bind address (default JAT_HOST or 127.0.0.1)")
    p.add_argument("--port", type=int, help="port (default JAT_PORT or 8770)")
    p.add_argument("--dev", action="store_true", help="reload on code changes and allow the Vite dev origin")
    p.set_defaults(func=cmd_serve)
    sub.add_parser("snapshot", help="export and commit to the data repo now").set_defaults(func=cmd_snapshot)
    sub.add_parser("push", help="snapshot, then push the data repo (never forced)").set_defaults(func=cmd_push)
    p = sub.add_parser("archive", help="write the data directory to one zip file, to keep anywhere")
    p.add_argument("-o", "--output", type=Path, help="where to write it (default ./jat-backup-DATE.zip)")
    p.set_defaults(func=cmd_archive)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except (ConfigError, DataDirError, RestoreError, ExportError, MigrationError, SnapshotError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
