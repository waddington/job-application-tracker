from datetime import UTC, datetime, timedelta

import pytest

from jat.db import db_path, make_engine, migrate, session_factory
from jat.db.models import Company, Role
from jat.domain.applications import (
    TransitionError,
    create_application,
    history,
    log_activity,
    move,
    undo_last_move,
)
from jat.domain.workflow import DEFAULT_WORKFLOW as W


@pytest.fixture
def session(tmp_path):
    migrate(db_path(tmp_path))
    engine = make_engine(db_path(tmp_path))
    with session_factory(engine)() as s:
        yield s
    engine.dispose()


@pytest.fixture
def role(session):
    company = Company(name="Contoso")
    session.add(company)
    session.flush()
    role = Role(company_id=company.id, title="Backend Engineer")
    session.add(role)
    session.flush()
    return role


def stages(session, app):
    return [(e.from_stage, e.to_stage) for e in history(session, app.id) if e.kind == "stage_change"]


def test_create_records_initial_stage(session, role):
    app = create_application(session, W, role_id=role.id, route="direct")
    assert app.stage == "interested"
    assert stages(session, app) == [(None, "interested")]
    app2 = create_application(session, W, role_id=role.id, stage="applied")
    assert app2.stage == "applied"


def test_move_validates_and_records(session, role):
    app = create_application(session, W, role_id=role.id)
    move(session, W, app, "applied")
    move(session, W, app, "interviewing", note="Recruiter booked tech round")
    assert app.stage == "interviewing"
    with pytest.raises(TransitionError, match="allowed:"):
        move(session, W, app, "applied")
    assert stages(session, app)[-1] == ("applied", "interviewing")
    assert history(session, app.id)[-1].summary == "Recruiter booked tech round"


def test_undo_is_a_stack_of_correcting_events(session, role):
    app = create_application(session, W, role_id=role.id)
    move(session, W, app, "applied")
    move(session, W, app, "screen")
    move(session, W, app, "rejected")
    undo_last_move(session, app)
    assert app.stage == "screen"
    undo_last_move(session, app)
    assert app.stage == "applied"
    undo_last_move(session, app)
    assert app.stage == "interested"
    with pytest.raises(TransitionError, match="nothing to undo"):
        undo_last_move(session, app)
    # Nothing was deleted: 1 create + 3 moves + 3 undos.
    assert len(history(session, app.id)) == 7


def test_undo_after_new_move(session, role):
    app = create_application(session, W, role_id=role.id)
    move(session, W, app, "applied")
    undo_last_move(session, app)
    move(session, W, app, "rejected")
    undo_last_move(session, app)
    assert app.stage == "interested"


def test_activity_updates_last_activity_but_not_backwards(session, role):
    app = create_application(session, W, role_id=role.id)
    before = app.last_activity_at
    later = before + timedelta(hours=2)
    log_activity(session, app, "call", summary="Intro call with recruiter", occurred_at=later)
    assert app.last_activity_at == later
    log_activity(session, app, "email", occurred_at=datetime(2020, 1, 1, tzinfo=UTC))
    assert app.last_activity_at == later
    with pytest.raises(ValueError):
        log_activity(session, app, "carrier-pigeon")


def test_undo_reverts_last_recorded_move_even_if_backdated(session, role):
    app = create_application(session, W, role_id=role.id)
    move(session, W, app, "applied")
    # Recorded second but dated in the past (Kai logging something late).
    move(session, W, app, "screen", occurred_at=datetime(2020, 1, 1, tzinfo=UTC))
    undo_last_move(session, app)
    assert app.stage == "applied"


def test_rapid_moves_in_same_second_keep_order(session, role):
    app = create_application(session, W, role_id=role.id)
    for stage in ("applied", "screen", "interviewing", "final"):
        move(session, W, app, stage)
    assert [to for _, to in stages(session, app)] == ["interested", "applied", "screen", "interviewing", "final"]
    for expected in ("interviewing", "screen", "applied", "interested"):
        undo_last_move(session, app)
        assert app.stage == expected


def test_undo_restores_last_activity(session, role):
    app = create_application(session, W, role_id=role.id)
    idle_since = datetime(2026, 8, 1, 9, 0, tzinfo=UTC)
    log_activity(session, app, "email", occurred_at=idle_since)
    app.last_activity_at = idle_since  # pretend it's been quiet since August
    for ev in history(session, app.id):
        ev.occurred_at = min(ev.occurred_at, idle_since)
    session.flush()
    move(session, W, app, "applied")  # accidental
    assert app.last_activity_at > idle_since
    undo_last_move(session, app)
    assert app.last_activity_at == idle_since


def test_events_get_consecutive_seq(session, role):
    app = create_application(session, W, role_id=role.id)
    move(session, W, app, "applied")
    log_activity(session, app, "call")
    seqs = [e.seq for e in history(session, app.id)]
    assert seqs == sorted(seqs) and len(set(seqs)) == 3
    assert seqs[-1] - seqs[0] == 2


def test_removed_stage_gives_transition_error(session, role):
    from jat.domain.workflow import workflow_from_config

    app = create_application(session, W, role_id=role.id, stage="screen")
    slim = workflow_from_config({"stages": [{"id": "applied"}, {"id": "rejected", "kind": "closed"}]})
    with pytest.raises(TransitionError):
        move(session, slim, app, "rejected")


def test_backdated_move(session, role):
    app = create_application(session, W, role_id=role.id)
    when = datetime(2026, 9, 1, 9, 0, tzinfo=UTC)
    event = move(session, W, app, "applied", occurred_at=when)
    assert event.occurred_at == when
    assert history(session, app.id)[0].to_stage == "applied"  # history is in time order
