from datetime import UTC, date, datetime, timedelta, timezone

import pytest
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from sqlalchemy import inspect, text

from jat.db import Base, current_revision, head_revision, make_engine, migrate, session_factory
from jat.db.models import Application, Company, Event, Role


@pytest.fixture
def engine(tmp_path):
    path = tmp_path / "t.sqlite3"
    migrate(path)
    eng = make_engine(path)
    yield eng
    eng.dispose()


def test_migrations_match_models(engine):
    with engine.connect() as conn:
        diff = compare_metadata(MigrationContext.configure(conn), Base.metadata)
    assert diff == []
    assert current_revision(engine) == head_revision()
    assert "applications" in inspect(engine).get_table_names()


def test_pragmas(engine):
    with engine.connect() as conn:
        assert conn.execute(text("PRAGMA foreign_keys")).scalar() == 1
        assert conn.execute(text("PRAGMA journal_mode")).scalar() == "wal"


def test_models_roundtrip_types(engine):
    Session = session_factory(engine)
    bst = timezone(timedelta(hours=1))
    with Session.begin() as s:
        company = Company(name="Contoso")
        s.add(company)
        s.flush()
        role = Role(company_id=company.id, title="Backend Engineer", salary_min=70000, currency="GBP")
        s.add(role)
        s.flush()
        app = Application(role_id=role.id, stage="applied", applied_on=date(2026, 9, 30), tags=["python"])
        s.add(app)
        s.flush()
        s.add(
            Event(
                application_id=app.id,
                kind="stage_change",
                to_stage="applied",
                occurred_at=datetime(2026, 9, 30, 15, 0, tzinfo=bst),
                data={"note": "via site"},
            )
        )
        app_id = app.id
    with Session() as s:
        app = s.get(Application, app_id)
        assert app.applied_on == date(2026, 9, 30) and app.tags == ["python"]
        (event,) = s.query(Event).all()
        assert event.occurred_at == datetime(2026, 9, 30, 14, 0, tzinfo=UTC)
        assert event.data == {"note": "via site"}
        raw = s.execute(text("select occurred_at from events")).scalar()
        assert raw == "2026-09-30T14:00:00Z"
        assert len(app.id) == 36


def test_naive_datetime_rejected(engine):
    Session = session_factory(engine)
    with pytest.raises(Exception, match="naive"), Session.begin() as s:
        s.add(Company(name="X", created_at=datetime(2026, 1, 1)))


def test_foreign_keys_enforced(engine):
    Session = session_factory(engine)
    with pytest.raises(Exception, match="FOREIGN KEY"), Session.begin() as s:
        s.add(Role(company_id="missing", title="x"))


def test_datetime_precision_is_fixed(engine):
    Session = session_factory(engine)
    with Session.begin() as s:
        s.add(Company(name="A", created_at=datetime(2026, 9, 30, 14, 5, 7, 123456, tzinfo=UTC)))
    with engine.connect() as conn:
        assert conn.execute(text("select created_at from companies")).scalar() == "2026-09-30T14:05:07Z"


def test_date_column_rejects_datetime(engine):
    Session = session_factory(engine)
    with pytest.raises(Exception, match="expected a date"), Session.begin() as s:
        company = Company(name="C")
        s.add(company)
        s.flush()
        role = Role(company_id=company.id, title="t")
        s.add(role)
        s.flush()
        s.add(Application(role_id=role.id, stage="applied", applied_on=datetime(2026, 9, 30, tzinfo=UTC)))
        s.flush()


def test_0002_backfills_seq_in_insert_order(tmp_path):
    path = tmp_path / "old.sqlite3"
    migrate(path, "0001")
    eng = make_engine(path)
    with eng.begin() as conn:
        conn.execute(
            text(
                "INSERT INTO companies (id, name, created_at, updated_at) "
                "VALUES ('c', 'C', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO roles (id, company_id, title, created_at, updated_at) "
                "VALUES ('r', 'c', 'T', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
            )
        )
        conn.execute(
            text(
                "INSERT INTO applications (id, role_id, route, stage, last_activity_at, tags, archived, created_at, "
                "updated_at) VALUES ('a', 'r', 'direct', 'applied', '2026-01-01T00:00:00Z', '[]', 0, "
                "'2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
            )
        )
        for eid in ("zzz", "aaa", "mmm"):  # ids deliberately not in insert order
            conn.execute(
                text(
                    "INSERT INTO events (id, application_id, kind, occurred_at, data, created_at) "
                    f"VALUES ('{eid}', 'a', 'note', '2026-01-01T00:00:00Z', '{{}}', '2026-01-01T00:00:00Z')"
                )
            )
    eng.dispose()
    migrate(path)
    eng = make_engine(path)
    with eng.connect() as conn:
        rows = conn.execute(text("SELECT id, seq FROM events ORDER BY seq")).all()
    eng.dispose()
    assert rows == [("zzz", 1), ("aaa", 2), ("mmm", 3)]


def test_0003_numbers_existing_interviews_per_application(tmp_path):
    path = tmp_path / "old.sqlite3"
    migrate(path, "0002")
    eng = make_engine(path)
    ts = "'2026-01-01T00:00:00Z'"
    with eng.begin() as conn:
        conn.execute(text(f"INSERT INTO companies (id, name, created_at, updated_at) VALUES ('c', 'C', {ts}, {ts})"))
        conn.execute(
            text(
                f"INSERT INTO roles (id, company_id, title, created_at, updated_at) VALUES ('r', 'c', 'T', {ts}, {ts})"
            )
        )
        for app_id in ("a", "b"):
            conn.execute(
                text(
                    "INSERT INTO applications (id, role_id, route, stage, last_activity_at, tags, archived, "
                    f"created_at, updated_at) VALUES ('{app_id}', 'r', 'direct', 'interviewing', {ts}, '[]', 0, "
                    f"{ts}, {ts})"
                )
            )
        for iid, app_id, starts in [
            ("i3", "a", "'2026-03-01T10:00:00Z'"),
            ("i1", "a", "'2026-01-05T10:00:00Z'"),
            ("i2", "a", "NULL"),  # no time yet: falls back to created_at (2026-01-01), so first
            ("j1", "b", "'2026-02-01T10:00:00Z'"),
        ]:
            conn.execute(
                text(
                    "INSERT INTO interviews (id, application_id, kind, status, starts_at, created_at, updated_at) "
                    f"VALUES ('{iid}', '{app_id}', 'technical', 'scheduled', {starts}, {ts}, {ts})"
                )
            )
    eng.dispose()
    migrate(path)
    eng = make_engine(path)
    with eng.connect() as conn:
        rows = dict(conn.execute(text("SELECT id, round FROM interviews")).all())
    eng.dispose()
    assert rows == {"i2": 1, "i1": 2, "i3": 3, "j1": 1}


def test_failed_migration_rolls_back(tmp_path):
    from jat.db import MigrationError

    path = tmp_path / "m.sqlite3"
    with pytest.raises(MigrationError):
        migrate(path, "nonexistent")
    eng = make_engine(path)
    assert "companies" not in inspect(eng).get_table_names()
    eng.dispose()
