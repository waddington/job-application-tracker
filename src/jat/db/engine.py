"""Engine, sessions and migrations for the data directory's SQLite database."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from alembic.util.exc import CommandError
from sqlalchemy import Connection, Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from ..datadir import DB_NAME


class MigrationError(RuntimeError):
    pass


def db_path(data_dir: Path) -> Path:
    return data_dir / DB_NAME


def make_engine(path: Path, *, foreign_keys: bool = True, wal: bool = True) -> Engine:
    """SQLite engine with real transactions.

    pysqlite's own transaction handling doesn't BEGIN before DDL or SELECTs, so a failed
    migration could leave a half-applied schema and a multi-table read wouldn't be one
    snapshot. We take over, per the SQLAlchemy pysqlite recipe: disable the driver's
    handling on connect and emit BEGIN ourselves.
    """
    engine = create_engine(f"sqlite:///{path}")

    @event.listens_for(engine, "connect")
    def _on_connect(dbapi_conn, _):
        dbapi_conn.isolation_level = None
        cur = dbapi_conn.cursor()
        cur.execute(f"PRAGMA foreign_keys={'ON' if foreign_keys else 'OFF'}")
        cur.execute(f"PRAGMA journal_mode={'WAL' if wal else 'DELETE'}")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.close()

    @event.listens_for(engine, "begin")
    def _on_begin(conn: Connection):
        conn.exec_driver_sql("BEGIN")

    return engine


def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(engine, expire_on_commit=False)


def alembic_config(path: Path) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", "jat.db:migrations")
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{path}")
    return cfg


def script_directory() -> ScriptDirectory:
    return ScriptDirectory.from_config(alembic_config(Path("unused")))


def is_known_revision(revision: str) -> bool:
    try:
        return script_directory().get_revision(revision) is not None
    except CommandError:
        return False


def migrate(path: Path, revision: str = "head", *, wal: bool = True) -> None:
    """Upgrade the database at `path` (created if missing) to `revision`, in one transaction.

    Foreign keys are off while migrating (Alembic batch mode recreates tables) and checked
    before commit.
    """
    engine = make_engine(path, foreign_keys=False, wal=wal)
    try:
        with engine.begin() as conn:
            cfg = alembic_config(path)
            cfg.attributes["connection"] = conn
            try:
                command.upgrade(cfg, revision)
            except CommandError as exc:
                raise MigrationError(str(exc)) from exc
            problems = conn.exec_driver_sql("PRAGMA foreign_key_check").all()
            if problems:
                raise MigrationError(f"foreign key violations after migrating: {problems[:5]}")
    finally:
        engine.dispose()


def current_revision(conn_or_engine: Engine | Connection) -> str | None:
    if isinstance(conn_or_engine, Connection):
        return MigrationContext.configure(conn_or_engine).get_current_revision()
    with conn_or_engine.connect() as conn:
        return MigrationContext.configure(conn).get_current_revision()


def head_revision() -> str:
    head = script_directory().get_current_head()
    assert head is not None
    return head
