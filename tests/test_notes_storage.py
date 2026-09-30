import os

import pytest
from sqlalchemy import select

from jat.db import db_path, make_engine, migrate, session_factory
from jat.db.models import NoteIndex
from jat.storage.notes import NoteError, NoteStore, parse, slugify


@pytest.fixture
def store(tmp_path):
    (tmp_path / "notes").mkdir()
    return NoteStore(tmp_path)


@pytest.fixture
def session(tmp_path):
    migrate(db_path(tmp_path))
    engine = make_engine(db_path(tmp_path))
    with session_factory(engine)() as s:
        yield s
    engine.dispose()


def test_slugify():
    assert slugify("Call with Northwind — Café!") == "call-with-northwind-cafe"
    assert slugify("!!!") == "note"


def test_create_writes_readable_markdown(store):
    note = store.create("Call with Northwind", "Talked about **the role**.\n", ["application:a1", "contact:c1"])
    path = store.root / note.path
    assert note.path.startswith(note.created_at.strftime("%Y/%m/"))
    assert note.path.endswith("-call-with-northwind.md")
    text = path.read_text()
    assert text.startswith("---\nid: ")
    assert "title: Call with Northwind" in text
    assert "- {type: application, id: a1}" in text
    assert text.endswith("---\nTalked about **the role**.\n")
    again = store.read(note.path)
    assert (again.id, again.title, again.links, again.body) == (note.id, note.title, note.links, note.body)


def test_save_keeps_the_path(store):
    note = store.create("First title", "one", [])
    note.title, note.body = "Renamed", "two"
    store.save(note)
    assert store.read(note.path).title == "Renamed"
    assert len(list(store.root.rglob("*.md"))) == 1


def test_rejects_bad_links_and_paths(store):
    with pytest.raises(NoteError, match="links"):
        store.create("x", "", ["planet:earth"])
    with pytest.raises(NoteError):
        store.read("../outside.md")
    with pytest.raises(NoteError):
        store.read("2026/09/not-markdown.txt")


def test_parse_is_tolerant_of_hand_written_files():
    note = parse("# Prep for Contoso\n\nRead up on queues.\n", "prep.md", mtime=_now())
    assert note.title == "Prep for Contoso"
    assert note.links == []
    assert note.id == parse("anything", "prep.md", mtime=_now()).id  # stable id from the path
    broken = parse("---\n: : not yaml [\n---\nbody", "b.md", mtime=_now())
    assert broken.title == "b"
    mixed = parse("---\ntitle: T\nlinks: [company:co1, {type: role, id: r1}, bogus]\n---\n", "m.md", mtime=_now())
    assert mixed.links == ["company:co1", "role:r1"]


def test_sync_index_follows_the_files(store, session):
    made = store.create("Made in the app", "", ["application:a1"])
    store.index(session, made)
    session.commit()

    # Someone adds a note in an editor, edits another, and deletes one.
    (store.root / "hand.md").write_text("---\ntitle: Hand written\nlinks: [{type: company, id: co1}]\n---\nHi\n")
    other = store.create("Old", "", [])
    store.index(session, other)
    session.commit()
    (store.root / other.path).unlink()
    path = store.root / made.path
    path.write_text(path.read_text().replace("title: Made in the app", "title: Edited outside"))
    os.utime(path, ns=(path.stat().st_atime_ns, path.stat().st_mtime_ns + 1_000_000))

    store.sync_index(session)
    session.commit()
    rows = {r.title: r for r in session.scalars(select(NoteIndex))}
    assert set(rows) == {"Edited outside", "Hand written"}
    assert rows["Hand written"].links == ["company:co1"]
    assert rows["Edited outside"].id == made.id


def test_sync_index_handles_copied_files(store, session):
    note = store.create("Original", "", [])
    copy = store.root / "copy.md"
    copy.write_text((store.root / note.path).read_text())
    store.sync_index(session)
    session.commit()
    rows = session.scalars(select(NoteIndex)).all()
    assert len(rows) == 2 and len({r.id for r in rows}) == 2


def _now():
    from datetime import UTC, datetime

    return datetime.now(UTC)
