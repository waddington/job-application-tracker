"""SQLAlchemy models: the structured half of the data (notes live as Markdown files).

See docs/rfc/stack.md §6 and docs/prd/tracker.md FR1–FR14. Workflow stages are configured in
config.toml, so `application.stage` and event stage fields hold stage slugs.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    event,
    func,
    inspect,
    select,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

from .types import ISODate, UTCDateTime, new_id, utcnow

# Entity types that links, attachments and notes can point at.
ENTITY_TYPES = ("company", "agency", "contact", "role", "application", "interview", "document")


class Base(DeclarativeBase):
    type_annotation_map = {datetime: UTCDateTime, date: ISODate, dict[str, Any]: JSON, list[str]: JSON}


class IdMixin:
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_id)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)


class Company(IdMixin, TimestampMixin, Base):
    __tablename__ = "companies"
    name: Mapped[str] = mapped_column(String(200), index=True)
    website: Mapped[str | None] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text)


class Agency(IdMixin, TimestampMixin, Base):
    """A recruitment agency."""

    __tablename__ = "agencies"
    name: Mapped[str] = mapped_column(String(200), index=True)
    website: Mapped[str | None] = mapped_column(String(500))


class Contact(IdMixin, TimestampMixin, Base):
    """A person: recruiter, hiring manager, interviewer, referrer."""

    __tablename__ = "contacts"
    name: Mapped[str] = mapped_column(String(200), index=True)
    title: Mapped[str | None] = mapped_column(String(200))
    agency_id: Mapped[str | None] = mapped_column(ForeignKey("agencies.id", ondelete="SET NULL"), index=True)
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id", ondelete="SET NULL"), index=True)
    # You replied to them and are waiting to hear back, since this day.
    awaiting_reply_since: Mapped[date | None]


class ContactDetail(IdMixin, Base):
    """One way to reach a contact (FR3): several emails, phones, links, each labelled."""

    __tablename__ = "contact_details"
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(20))  # email | phone | linkedin | url | other
    label: Mapped[str | None] = mapped_column(String(100))
    value: Mapped[str] = mapped_column(String(500))
    position: Mapped[int] = mapped_column(Integer, default=0)


class Role(IdMixin, TimestampMixin, Base):
    """A job at a company (FR2, FR4)."""

    __tablename__ = "roles"
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id", ondelete="RESTRICT"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    url: Mapped[str | None] = mapped_column(String(1000))
    location: Mapped[str | None] = mapped_column(String(200))
    work_mode: Mapped[str | None] = mapped_column(String(20))  # remote | hybrid | office
    employment_type: Mapped[str | None] = mapped_column(String(20))  # permanent | contract | fixed_term
    salary_min: Mapped[int | None] = mapped_column(Integer)
    salary_max: Mapped[int | None] = mapped_column(Integer)
    currency: Mapped[str | None] = mapped_column(String(3))
    day_rate: Mapped[int | None] = mapped_column(Integer)
    ir35: Mapped[str | None] = mapped_column(String(20))  # inside | outside | unknown
    description: Mapped[str | None] = mapped_column(Text)
    # Where it came from: who told you about it, and the call it came up in (if any).
    contact_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id", ondelete="SET NULL"), index=True)
    # No foreign key: meetings point at applications, which point at roles, so one here would
    # make a cycle (no safe order to export or restore tables in). Cleared in
    # clear_role_meetings below when the meeting goes.
    meeting_id: Mapped[str | None] = mapped_column(String(36), index=True)
    # Your decision before applying. A role with an application is "applied" whatever this says.
    decision: Mapped[str | None] = mapped_column(String(20))  # None (still to decide) | passed
    decision_reason: Mapped[str | None] = mapped_column(Text)
    decided_on: Mapped[date | None]


class Application(IdMixin, TimestampMixin, Base):
    """Kai pursuing a role through one route (FR2): direct, via an agency/recruiter, or a referral."""

    __tablename__ = "applications"
    role_id: Mapped[str] = mapped_column(ForeignKey("roles.id", ondelete="RESTRICT"), index=True)
    route: Mapped[str] = mapped_column(String(20), default="direct")  # direct | agency | referral
    agency_id: Mapped[str | None] = mapped_column(ForeignKey("agencies.id", ondelete="SET NULL"), index=True)
    recruiter_id: Mapped[str | None] = mapped_column(ForeignKey("contacts.id", ondelete="SET NULL"), index=True)
    stage: Mapped[str] = mapped_column(String(40), index=True)
    applied_on: Mapped[date | None]
    follow_up_on: Mapped[date | None]
    snoozed_until: Mapped[date | None]
    # You replied and are waiting to hear back, since this day; cleared when you hear back or it moves on.
    awaiting_reply_since: Mapped[date | None]
    last_activity_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    tags: Mapped[list[str]] = mapped_column(default=list)
    archived: Mapped[bool] = mapped_column(Boolean, default=False)


class ApplicationContact(IdMixin, Base):
    __tablename__ = "application_contacts"
    __table_args__ = (UniqueConstraint("application_id", "contact_id", "relation"),)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), index=True)
    relation: Mapped[str] = mapped_column(String(30))  # recruiter | hiring_manager | interviewer | referrer | other


class Event(IdMixin, Base):
    """Append-only application history (FR7, FR8). Never updated or deleted by the app."""

    __tablename__ = "events"
    __table_args__ = (UniqueConstraint("seq", name="uq_events_seq"),)
    # Recording order across all events, assigned on insert (see assign_event_seq). Exported and
    # restored, so ordering never depends on SQLite rowids or same-millisecond UUIDs.
    seq: Mapped[int] = mapped_column(Integer)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    kind: Mapped[str] = mapped_column(String(30))  # stage_change | call | email | note | file | interview | manual
    occurred_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)
    from_stage: Mapped[str | None] = mapped_column(String(40))
    to_stage: Mapped[str | None] = mapped_column(String(40))
    summary: Mapped[str | None] = mapped_column(Text)
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Interview(IdMixin, TimestampMixin, Base):
    """An interview or take-home/coding task (FR9, FR10)."""

    __tablename__ = "interviews"
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    # Which interview this is for the application: 1, 2, 3… (FR9a).
    round: Mapped[int | None] = mapped_column(Integer)
    # What the round is, in Kai's words: "Engineering manager chat", "System design test".
    title: Mapped[str | None] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(30))  # screen | technical | coding_task | system_design | ...
    status: Mapped[str] = mapped_column(String(20), default="scheduled")  # scheduled | done | cancelled
    starts_at: Mapped[datetime | None] = mapped_column(index=True)
    ends_at: Mapped[datetime | None]
    deadline_at: Mapped[datetime | None] = mapped_column(index=True)
    format: Mapped[str | None] = mapped_column(String(20))  # video | phone | onsite | take_home
    location: Mapped[str | None] = mapped_column(String(300))
    meeting_url: Mapped[str | None] = mapped_column(String(1000))
    prep: Mapped[str | None] = mapped_column(Text)
    debrief: Mapped[str | None] = mapped_column(Text)
    questions: Mapped[str | None] = mapped_column(Text)
    task_instructions: Mapped[str | None] = mapped_column(Text)
    task_repo_url: Mapped[str | None] = mapped_column(String(1000))


class InterviewContact(IdMixin, Base):
    __tablename__ = "interview_contacts"
    __table_args__ = (UniqueConstraint("interview_id", "contact_id"),)
    interview_id: Mapped[str] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), index=True)


class Meeting(IdMixin, TimestampMixin, Base):
    """A call or meeting with a person, booked or already had: a recruiter catch-up about the
    market, a chat with a hiring manager before applying. Not tied to an application unless one
    comes out of it (interview rounds on an application are Interviews)."""

    __tablename__ = "meetings"
    contact_id: Mapped[str] = mapped_column(ForeignKey("contacts.id", ondelete="CASCADE"), index=True)
    application_id: Mapped[str | None] = mapped_column(ForeignKey("applications.id", ondelete="SET NULL"), index=True)
    kind: Mapped[str] = mapped_column(String(20), default="call")  # call | video | in_person
    title: Mapped[str | None] = mapped_column(String(200))  # what it's about
    status: Mapped[str] = mapped_column(String(20), default="scheduled")  # scheduled | done | cancelled
    starts_at: Mapped[datetime] = mapped_column(index=True)
    ends_at: Mapped[datetime | None]
    location: Mapped[str | None] = mapped_column(String(300))
    meeting_url: Mapped[str | None] = mapped_column(String(1000))
    agenda: Mapped[str | None] = mapped_column(Text)  # what to ask, what to say
    notes: Mapped[str | None] = mapped_column(Text)  # how it went


class Offer(IdMixin, TimestampMixin, Base):
    """An offer on an application, with its pay and terms (FR4, offer comparison).

    An application can have more than one (a revised offer after negotiating); the newest
    counts. Money is whole units of `currency` a year, except `day_rate`.
    """

    __tablename__ = "offers"
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending | accepted | declined | withdrawn
    received_on: Mapped[date | None]
    respond_by: Mapped[date | None] = mapped_column(index=True)
    start_on: Mapped[date | None]
    employment_type: Mapped[str | None] = mapped_column(String(20))  # permanent | contract | fixed_term
    currency: Mapped[str | None] = mapped_column(String(3))
    salary: Mapped[int | None] = mapped_column(Integer)  # base, a year
    bonus: Mapped[int | None] = mapped_column(Integer)  # expected, a year
    equity: Mapped[str | None] = mapped_column(Text)  # the terms, in words
    equity_value: Mapped[int | None] = mapped_column(Integer)  # your estimate, a year
    pension_percent: Mapped[float | None] = mapped_column(Float)  # employer contribution
    holiday_days: Mapped[int | None] = mapped_column(Integer)
    day_rate: Mapped[int | None] = mapped_column(Integer)
    ir35: Mapped[str | None] = mapped_column(String(20))  # inside | outside | unknown
    contract_months: Mapped[int | None] = mapped_column(Integer)
    benefits: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class Attachment(IdMixin, Base):
    """A file stored under files/ (FR13). `path` is relative to files/."""

    __tablename__ = "attachments"
    entity_type: Mapped[str | None] = mapped_column(String(20))
    entity_id: Mapped[str | None] = mapped_column(String(36), index=True)
    path: Mapped[str] = mapped_column(String(500), unique=True)
    original_name: Mapped[str] = mapped_column(String(300))
    content_type: Mapped[str | None] = mapped_column(String(100))
    size: Mapped[int] = mapped_column(Integer)
    sha256: Mapped[str] = mapped_column(String(64), index=True)
    meta: Mapped[dict[str, Any]] = mapped_column(default=dict)  # e.g. parsed .eml headers
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Document(IdMixin, TimestampMixin, Base):
    """A CV or cover letter with versions (FR14)."""

    __tablename__ = "documents"
    kind: Mapped[str] = mapped_column(String(20))  # cv | cover_letter | other
    name: Mapped[str] = mapped_column(String(200))


class DocumentVersion(IdMixin, Base):
    __tablename__ = "document_versions"
    document_id: Mapped[str] = mapped_column(ForeignKey("documents.id", ondelete="CASCADE"), index=True)
    label: Mapped[str] = mapped_column(String(100))  # e.g. "v3 (backend)"
    attachment_id: Mapped[str | None] = mapped_column(ForeignKey("attachments.id", ondelete="SET NULL"))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class ApplicationDocument(IdMixin, Base):
    """Which document version was sent with an application."""

    __tablename__ = "application_documents"
    __table_args__ = (UniqueConstraint("application_id", "document_version_id"),)
    application_id: Mapped[str] = mapped_column(ForeignKey("applications.id", ondelete="CASCADE"), index=True)
    document_version_id: Mapped[str] = mapped_column(
        ForeignKey("document_versions.id", ondelete="RESTRICT"), index=True
    )
    sent_on: Mapped[date | None]


class Link(IdMixin, Base):
    """An external link (e.g. a Google Doc) on any entity (FR12)."""

    __tablename__ = "links"
    entity_type: Mapped[str] = mapped_column(String(20))
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    url: Mapped[str] = mapped_column(String(2000))
    title: Mapped[str | None] = mapped_column(String(300))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class Todo(IdMixin, TimestampMixin, Base):
    """A to-do in your own words ("reply to Alex", "look into what they do"), on its own or about
    one thing. It points at that thing by type and id, like a link (no foreign key)."""

    __tablename__ = "todos"
    text: Mapped[str] = mapped_column(String(500))
    due_on: Mapped[date | None] = mapped_column(index=True)
    done_at: Mapped[datetime | None] = mapped_column(index=True)
    entity_type: Mapped[str | None] = mapped_column(String(20))
    entity_id: Mapped[str | None] = mapped_column(String(36), index=True)


class NoteIndex(IdMixin, Base):
    """Index of Markdown notes under notes/. Derived data: rebuilt from the files, never exported."""

    __tablename__ = "note_index"
    path: Mapped[str] = mapped_column(String(500), unique=True)
    title: Mapped[str] = mapped_column(String(300))
    links: Mapped[list[str]] = mapped_column(default=list)  # ["application:<id>", ...]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
    mtime_ns: Mapped[int] = mapped_column(Integer)


@event.listens_for(Session, "before_flush")
def assign_event_seq(session: Session, flush_context, instances) -> None:
    """Give new events consecutive `seq` numbers in the order they were added to the session."""
    new_events = [obj for obj in session.new if isinstance(obj, Event) and obj.seq is None]
    if not new_events:
        return
    new_events.sort(key=lambda obj: inspect(obj).insert_order)
    current = session.execute(select(func.coalesce(func.max(Event.seq), 0))).scalar_one()
    for offset, obj in enumerate(new_events, start=1):
        obj.seq = current + offset


# Things notes and links can be attached to, by the type name used in the API.
ENTITY_MODELS: dict[str, type[Base]] = {
    "application": Application,
    "company": Company,
    "role": Role,
    "agency": Agency,
    "contact": Contact,
    "interview": Interview,
    "document": Document,
}


@event.listens_for(Session, "before_flush")
def remove_orphan_links(session: Session, flush_context, instances) -> None:
    """Links and attachments point at their entity by type and id (no foreign key).

    When the entity goes, its links go with it. Its attachments and to-dos are only detached:
    the files and your words are yours, so they stay (unattached) rather than vanish with a record.

    Deleting an application also removes its interviews in the database (ON DELETE CASCADE),
    out of the ORM's sight, so theirs are collected here too.
    """
    kinds = {model: kind for kind, model in ENTITY_MODELS.items()}
    targets: list[tuple[str, str]] = []
    with session.no_autoflush:
        for obj in list(session.deleted):
            kind = kinds.get(type(obj))
            if kind is None:
                continue
            targets.append((kind, obj.id))
            if kind == "application":
                for interview_id in session.scalars(select(Interview.id).where(Interview.application_id == obj.id)):
                    targets.append(("interview", interview_id))
        for kind, entity_id in targets:
            for link in session.scalars(select(Link).where(Link.entity_type == kind, Link.entity_id == entity_id)):
                session.delete(link)
            attached = select(Attachment).where(Attachment.entity_type == kind, Attachment.entity_id == entity_id)
            for attachment in session.scalars(attached):
                attachment.entity_type = attachment.entity_id = None
            for todo in session.scalars(select(Todo).where(Todo.entity_type == kind, Todo.entity_id == entity_id)):
                todo.entity_type = todo.entity_id = None


@event.listens_for(Session, "before_flush")
def clear_role_meetings(session: Session, flush_context, instances) -> None:
    """A role remembers the call it came up in by id (no foreign key; see Role.meeting_id).
    When that call is deleted, or the person it was with (their calls go too), forget it."""
    gone: list[str] = []
    with session.no_autoflush:
        for obj in list(session.deleted):
            if isinstance(obj, Meeting):
                gone.append(obj.id)
            elif isinstance(obj, Contact):
                gone.extend(session.scalars(select(Meeting.id).where(Meeting.contact_id == obj.id)))
        if gone:
            for role in session.scalars(select(Role).where(Role.meeting_id.in_(gone))):
                role.meeting_id = None


# Tables whose rows are exported to export/*.jsonl, in foreign-key-safe order.
DERIVED_TABLES = {"note_index"}


def exported_tables():
    return [t for t in Base.metadata.sorted_tables if t.name not in DERIVED_TABLES]
