"""Markdown notes (PRD FR11; stack RFC §4).

Each note is a real `.md` file under `notes/`, and that file is the source of truth:

    ---
    id: 0192f…
    title: Call with Northwind
    links:
    - {type: application, id: 0192f…}
    created: 2026-09-30T14:05:07Z
    updated: 2026-09-30T14:05:07Z
    ---
    Markdown body…

SQLite keeps only an index (`note_index`: path, title, links, times) so notes can be listed
per entity. The index is derived: `sync_index` rescans changed files, so notes written or
edited outside the app (in an editor, or by Claude) show up too.
"""

from __future__ import annotations

import os
import re
import tempfile
import unicodedata
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import yaml
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import NoteIndex
from ..db.types import new_id, utcnow

ENTITY_TYPES = ("application", "company", "role", "agency", "contact", "interview")
_FRONTMATTER = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n?", re.DOTALL)


class NoteError(ValueError):
    pass


@dataclass
class Note:
    id: str
    title: str
    body: str
    links: list[str] = field(default_factory=list)  # ["application:<id>", ...]
    created_at: datetime = field(default_factory=utcnow)
    updated_at: datetime = field(default_factory=utcnow)
    path: str = ""  # relative to notes/, with forward slashes


def slugify(title: str, limit: int = 60) -> str:
    text = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug[:limit].rstrip("-") or "note"


def _iso(dt: datetime) -> str:
    return dt.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def _as_datetime(value, fallback: datetime) -> datetime:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=UTC)
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return fallback
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=UTC)
    return fallback


def check_link(link: str) -> str:
    kind, _, target = link.partition(":")
    if kind not in ENTITY_TYPES or not target:
        raise NoteError(f"links: {link!r} should look like 'application:<id>' ({', '.join(ENTITY_TYPES)})")
    return link


def render(note: Note) -> str:
    meta = {
        "id": note.id,
        "title": note.title,
        "links": [{"type": k, "id": t} for k, _, t in (link.partition(":") for link in note.links)],
        "created": _iso(note.created_at),
        "updated": _iso(note.updated_at),
    }
    front = yaml.safe_dump(meta, sort_keys=False, allow_unicode=True, default_flow_style=None).strip()
    body = note.body if note.body.endswith("\n") or not note.body else note.body + "\n"
    return f"---\n{front}\n---\n{body}"


def parse(text: str, rel_path: str, mtime: datetime) -> Note:
    """Read a note file. Tolerant of hand-written files: missing fields get sensible defaults."""
    meta: dict = {}
    body = text
    match = _FRONTMATTER.match(text)
    if match:
        try:
            loaded = yaml.safe_load(match.group(1))
        except yaml.YAMLError:
            loaded = None
        if isinstance(loaded, dict):
            meta = loaded
            body = text[match.end() :]
    links: list[str] = []
    for item in meta.get("links") or []:
        if isinstance(item, dict) and item.get("type") in ENTITY_TYPES and item.get("id"):
            links.append(f"{item['type']}:{item['id']}")
        elif isinstance(item, str) and item.partition(":")[0] in ENTITY_TYPES and item.partition(":")[2]:
            links.append(item)
    title = str(meta.get("title") or "").strip()
    if not title:
        heading = re.search(r"^#\s+(.+)$", body, re.MULTILINE)
        title = heading.group(1).strip() if heading else Path(rel_path).stem
    # A file without an id gets a stable one derived from its path.
    note_id = str(meta.get("id") or uuid.uuid5(uuid.NAMESPACE_URL, f"jat-note:{rel_path}"))
    created = _as_datetime(meta.get("created"), mtime)
    return Note(
        id=note_id,
        title=title[:300],
        body=body,
        links=links,
        created_at=created,
        updated_at=_as_datetime(meta.get("updated"), mtime),
        path=rel_path,
    )


class NoteStore:
    def __init__(self, data_dir: Path) -> None:
        self.root = (data_dir / "notes").resolve()

    # --- files --------------------------------------------------------------------------

    def _abs(self, rel_path: str) -> Path:
        path = (self.root / rel_path).resolve()
        if not path.is_relative_to(self.root) or path.suffix != ".md":
            raise NoteError(f"{rel_path} isn't a note under notes/")
        return path

    def _write(self, path: Path, content: str) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=path.parent, prefix=".tmp-", suffix=".md")
        try:
            with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
                fh.write(content)
            os.replace(tmp, path)
        except BaseException:
            Path(tmp).unlink(missing_ok=True)
            raise

    def read(self, rel_path: str) -> Note:
        path = self._abs(rel_path)
        mtime = datetime.fromtimestamp(path.stat().st_mtime, UTC)
        return parse(path.read_text(encoding="utf-8"), rel_path, mtime)

    def create(self, title: str, body: str, links: list[str]) -> Note:
        now = utcnow()
        note = Note(id=new_id(), title=title.strip(), body=body, links=[check_link(x) for x in links])
        note.created_at = note.updated_at = now
        note.path = f"{now:%Y/%m}/{note.id}-{slugify(note.title)}.md"
        self._write(self._abs(note.path), render(note))
        return note

    def save(self, note: Note) -> Note:
        """Rewrite an existing note. The file keeps its path, so git history follows it."""
        note.links = [check_link(x) for x in note.links]
        note.updated_at = utcnow()
        self._write(self._abs(note.path), render(note))
        return note

    def delete(self, rel_path: str) -> None:
        self._abs(rel_path).unlink(missing_ok=True)

    # --- index --------------------------------------------------------------------------

    def _index_row(self, row: NoteIndex | None, note: Note, mtime_ns: int) -> NoteIndex:
        row = row or NoteIndex(id=note.id, path=note.path)
        row.path = note.path
        row.title = note.title
        row.links = note.links
        row.created_at = note.created_at
        row.updated_at = note.updated_at
        row.mtime_ns = mtime_ns
        return row

    def index(self, session: Session, note: Note) -> NoteIndex:
        """Record a note the app just wrote."""
        mtime_ns = self._abs(note.path).stat().st_mtime_ns
        row = session.get(NoteIndex, note.id)
        row = self._index_row(row, note, mtime_ns)
        session.add(row)
        return row

    def sync_index(self, session: Session) -> None:
        """Bring note_index in line with the files: add new ones, re-read changed ones, drop deleted ones."""
        on_disk: dict[str, Path] = {}
        if self.root.exists():
            for path in self.root.rglob("*.md"):
                if path.name.startswith(".tmp-") or not path.is_file():
                    continue
                on_disk[path.relative_to(self.root).as_posix()] = path
        rows = {row.path: row for row in session.scalars(select(NoteIndex))}
        for rel, row in rows.items():
            if rel not in on_disk:
                session.delete(row)
        session.flush()
        seen_ids: set[str] = set()
        for rel, path in sorted(on_disk.items()):
            mtime_ns = path.stat().st_mtime_ns
            row = rows.get(rel)
            if row is not None and row.mtime_ns == mtime_ns:
                seen_ids.add(row.id)
                continue
            note = self.read(rel)
            if note.id in seen_ids:  # a copied file with the same id: index it under its path
                note.id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"jat-note:{rel}"))
            seen_ids.add(note.id)
            existing = row or session.get(NoteIndex, note.id)
            if existing is not None and existing.path != rel and existing.path in on_disk:
                note.id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"jat-note:{rel}"))
                existing = None
            session.add(self._index_row(existing, note, mtime_ns))
            session.flush()
