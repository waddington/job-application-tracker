"""Engine, sessions and migrations for the data directory's SQLite database."""

from __future__ import annotations

from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from ..datadir import DB_NAME


def db_path(data_dir: Path) -> Path:
    return data_dir / DB_NAME


def make_engine(path: Path) -> Engine:
    engine = create_engine(f"sqlite:///{path}", future=True)

    @event.listens_for(engine, "connect")
    def _pragmas(dbapi_conn, _):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.close()

    return engine


def session_factory(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(engine, expire_on_commit=False)


def alembic_config(path: Path) -> Config:
    cfg = Config()
    cfg.set_main_option("script_location", "jat.db:migrations")
    cfg.set_main_option("sqlalchemy.url", f"sqlite:///{path}")
    return cfg


def migrate(path: Path, revision: str = "head") -> None:
    """Upgrade the database at `path` (created if missing) to `revision`."""
    engine = make_engine(path)
    try:
        with engine.begin() as conn:
            cfg = alembic_config(path)
            cfg.attributes["connection"] = conn
            command.upgrade(cfg, revision)
    finally:
        engine.dispose()


def current_revision(engine: Engine) -> str | None:
    with engine.connect() as conn:
        return MigrationContext.configure(conn).get_current_revision()


def head_revision() -> str:
    return ScriptDirectory.from_config(alembic_config(Path("unused"))).get_current_head()
