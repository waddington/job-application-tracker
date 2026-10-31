"""People: one person per email address and LinkedIn profile, and merging two records of the
same person into one.
"""

from __future__ import annotations

import re
from collections.abc import Iterable
from urllib.parse import unquote

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from jat.db.models import (
    Application,
    ApplicationContact,
    Attachment,
    Contact,
    ContactDetail,
    InterviewContact,
    Link,
    Meeting,
    NoteIndex,
    Reply,
    Role,
    Todo,
)
from jat.storage.notes import NoteStore

# /in/<handle>, or an old-style /pub/<name>/<a>/<b>/<c> (all of it: the name alone isn't unique).
_LINKEDIN = re.compile(
    r"^(?:https?://)?(?:[a-z]{2,3}\.)?(?:www\.)?linkedin\.com/(?:in/([^/?#]+)|pub/([^?#]+?))/?(?:[?#].*)?$", re.I
)


def identity(kind: str, value: str) -> tuple[str, str] | None:
    """What makes a detail point at exactly one person, normalised: an email address, or a
    LinkedIn profile (written however: with or without https://, www., a trailing slash or
    ?tracking). Other details (phone numbers, sites) can be shared, so they don't count."""
    value = value.strip()
    if kind == "email":
        value = value.removeprefix("mailto:").removeprefix("MAILTO:").strip()
        return ("email", value.lower()) if "@" in value else None
    if kind in ("linkedin", "url", "other") and (m := _LINKEDIN.match(value)):
        if m.group(1):
            return ("linkedin", f"linkedin.com/in/{unquote(m.group(1)).lower()}")
        return ("linkedin", f"linkedin.com/pub/{unquote(m.group(2)).lower()}")
    return None


def _identities(details: Iterable[tuple[str, str]]) -> dict[tuple[str, str], str]:
    """Identity -> the detail's value as written, for the given (kind, value) pairs."""
    out: dict[tuple[str, str], str] = {}
    for kind, value in details:
        if key := identity(kind, value):
            out.setdefault(key, value.strip())
    return out


def conflicts(
    session: Session, details: Iterable[tuple[str, str]], *, exclude: str | None = None
) -> list[tuple[str, Contact]]:
    """Other people who already have one of these email addresses or LinkedIn profiles, as
    (the value as given, that person)."""
    wanted = _identities(details)
    if not wanted:
        return []
    found: list[tuple[str, Contact]] = []
    seen: set[tuple[str, str]] = set()
    stmt = select(ContactDetail, Contact).join(Contact, ContactDetail.contact_id == Contact.id)
    if exclude:
        stmt = stmt.where(ContactDetail.contact_id != exclude)
    for detail, contact in session.execute(stmt.order_by(Contact.name)):
        key = identity(detail.kind, detail.value)
        if key in wanted and (key, contact.id) not in seen:
            seen.add((key, contact.id))
            found.append((wanted[key], contact))
    return found


def check_unique(
    session: Session,
    details: Iterable[tuple[str, str]],
    *,
    contact: Contact | None = None,
) -> tuple[str, str] | None:
    """Who already has an email address or LinkedIn profile, as (their name, the value), or None.

    Only details new to `contact` are checked, so people who already shared one (from before
    this rule) can still be edited, and merged.
    """
    details = list(details)
    if contact is not None:
        had = set(
            _identities(
                (d.kind, d.value)
                for d in session.scalars(select(ContactDetail).where(ContactDetail.contact_id == contact.id))
            )
        )
        details = [(k, v) for k, v in details if identity(k, v) not in had]
    clashes = conflicts(session, details, exclude=contact.id if contact else None)
    if not clashes:
        return None
    value, other = clashes[0]
    return other.name, value


def merge(session: Session, keep: Contact, gone: Contact, notes: NoteStore) -> None:
    """Fold `gone` into `keep`, then delete `gone`.

    Everything that points at `gone` moves to `keep`: contact details (not ones `keep` already
    has), roles they pitched, applications they're the recruiter on or part of, interview
    panels, calls, links, files, to-dos and notes. `keep`'s own fields win: `gone`'s job title
    is used if `keep` has none, its agency or company if `keep` has neither, and its waiting,
    to-read or closed state if `keep` has none of those; the later of the two chased dates
    stays.
    """
    if keep.id == gone.id:
        raise ValueError("Pick two different people to merge.")

    # Contact details: append the ones `keep` doesn't have; duplicates go.
    mine = session.scalars(
        select(ContactDetail).where(ContactDetail.contact_id == keep.id).order_by(ContactDetail.position)
    ).all()

    def key(d: ContactDetail) -> tuple[str, str]:
        return identity(d.kind, d.value) or (d.kind, d.value.strip().lower())

    have = {key(d) for d in mine}
    position = len(mine)
    theirs = session.scalars(
        select(ContactDetail).where(ContactDetail.contact_id == gone.id).order_by(ContactDetail.position)
    ).all()
    for d in theirs:
        if key(d) in have:
            session.delete(d)
            continue
        have.add(key(d))
        d.contact_id = keep.id
        d.position = position
        position += 1

    if keep.title is None:
        keep.title = gone.title
    if keep.agency_id is None and keep.company_id is None:  # where they work: one or the other
        keep.agency_id, keep.company_id = gone.agency_id, gone.company_id
    # Reply states: keep `keep`'s if it has any, else take `gone`'s (never both at once).
    if not (keep.awaiting_reply_since or keep.reply_to_read_since or keep.closed_as):
        keep.awaiting_reply_since = gone.awaiting_reply_since
        keep.reply_to_read_since = gone.reply_to_read_since
        keep.closed_as, keep.closed_on = gone.closed_as, gone.closed_on
    keep.chased_on = max(filter(None, (keep.chased_on, gone.chased_on)), default=None)
    keep.favourite = keep.favourite or gone.favourite

    session.execute(update(Role).where(Role.contact_id == gone.id).values(contact_id=keep.id))
    session.execute(update(Application).where(Application.recruiter_id == gone.id).values(recruiter_id=keep.id))
    session.execute(update(Meeting).where(Meeting.contact_id == gone.id).values(contact_id=keep.id))
    session.execute(update(Reply).where(Reply.contact_id == gone.id).values(contact_id=keep.id))

    # On applications and interview panels, once per (application, relation) or interview.
    on_apps = {
        (link.application_id, link.relation)
        for link in session.scalars(select(ApplicationContact).where(ApplicationContact.contact_id == keep.id))
    }
    for link in session.scalars(select(ApplicationContact).where(ApplicationContact.contact_id == gone.id)):
        if (link.application_id, link.relation) in on_apps:
            session.delete(link)
        else:
            link.contact_id = keep.id
    panels = set(session.scalars(select(InterviewContact.interview_id).where(InterviewContact.contact_id == keep.id)))
    for link in session.scalars(select(InterviewContact).where(InterviewContact.contact_id == gone.id)):
        if link.interview_id in panels:
            session.delete(link)
        else:
            link.contact_id = keep.id

    for model in (Link, Attachment, Todo):
        session.execute(
            update(model).where(model.entity_type == "contact", model.entity_id == gone.id).values(entity_id=keep.id)
        )

    # Notes keep their links in the Markdown file itself. Read every one first, so a note that
    # can't be read stops the merge before anything is written. Their edit times stay; the notes
    # index catches up on its next sync (everything that reads it syncs first).
    old, new = f"contact:{gone.id}", f"contact:{keep.id}"
    linked = [notes.read(row.path) for row in session.scalars(select(NoteIndex)) if old in row.links]
    for note in linked:
        note.links = list(dict.fromkeys(new if link == old else link for link in note.links))
        notes.save(note, touch=False)

    # Moved first, then deleted: deleting `gone` would otherwise take its links with it.
    session.flush()
    session.expire_all()
    session.delete(session.get(Contact, gone.id))
    session.flush()
