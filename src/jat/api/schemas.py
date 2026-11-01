"""Pydantic request/response models for the JSON API (FR23)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated, Any, ClassVar, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, TypeAdapter, ValidationError, model_validator

WorkMode = Literal["remote", "hybrid", "office"]
EmploymentType = Literal["permanent", "contract", "fixed_term"]
IR35 = Literal["inside", "outside", "unknown"]
Route = Literal["direct", "agency", "referral"]
DetailKind = Literal["email", "phone", "linkedin", "url", "other"]
Relation = Literal["recruiter", "internal_recruiter", "hiring_manager", "interviewer", "referrer", "other"]
ActivityKind = Literal["call", "email", "message", "note", "file", "interview", "manual"]


class Out(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class In(BaseModel):
    """Base for request bodies: unknown fields are an error, not silently ignored."""

    model_config = ConfigDict(extra="forbid")


class Patch(In):
    """Base for partial updates: only fields that were sent are applied.

    Fields listed in `not_null` are required columns: they may be omitted but not set to null.
    """

    not_null: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="after")
    def _reject_null_required(self):
        bad = sorted(f for f in self.model_fields_set & self.not_null if getattr(self, f) is None)
        if bad:
            raise ValueError(f"{', '.join(bad)} can't be null")
        return self


# --- companies ---------------------------------------------------------------------------


class CompanyIn(In):
    name: str = Field(min_length=1, max_length=200)
    website: HttpUrl | None = None
    description: str | None = None


class CompanyPatch(Patch):
    not_null = frozenset({"name"})
    name: str | None = Field(default=None, min_length=1, max_length=200)
    website: HttpUrl | None = None
    description: str | None = None


class CompanyOut(Out):
    id: str
    name: str
    website: str | None
    description: str | None
    created_at: datetime
    updated_at: datetime


# --- agencies ----------------------------------------------------------------------------


class AgencyIn(In):
    name: str = Field(min_length=1, max_length=200)
    website: HttpUrl | None = None


class AgencyPatch(Patch):
    not_null = frozenset({"name"})
    name: str | None = Field(default=None, min_length=1, max_length=200)
    website: HttpUrl | None = None


class AgencyOut(Out):
    id: str
    name: str
    website: str | None
    created_at: datetime
    updated_at: datetime


# --- contacts ----------------------------------------------------------------------------


class ContactDetailIn(In):
    kind: DetailKind
    value: str = Field(min_length=1, max_length=500)
    label: str | None = Field(default=None, max_length=100)


class ContactDetailOut(Out):
    id: str
    kind: str
    value: str
    label: str | None
    position: int


class ContactIn(In):
    name: str = Field(min_length=1, max_length=200)
    title: str | None = None
    agency_id: str | None = None
    company_id: str | None = None
    details: list[ContactDetailIn] = []
    favourite: bool = False


class MergeIn(In):
    from_id: str  # the other record of the same person, merged in and then deleted


ContactClosed = Literal["ghosted", "not_interested"]


class ContactPatch(Patch):
    not_null = frozenset({"name", "favourite"})
    name: str | None = Field(default=None, min_length=1, max_length=200)
    title: str | None = None
    agency_id: str | None = None
    company_id: str | None = None
    details: list[ContactDetailIn] | None = None  # replaces all details when sent
    awaiting_reply_since: date | None = None  # you replied and are waiting; null: you heard back
    reply_to_read_since: date | None = None  # they've replied and you need to read it (clears waiting)
    chased_on: date | None = None  # you chased them: waiting again from this day
    closed_as: ContactClosed | None = None  # ghosted or not interested: off Next actions
    closed_on: date | None = None  # defaults to today when closed_as is set
    favourite: bool | None = None  # one of your favourites: a star by their name


class ContactOut(Out):
    id: str
    name: str
    title: str | None
    agency_id: str | None
    company_id: str | None
    details: list[ContactDetailOut] = []
    awaiting_reply_since: date | None = None
    reply_to_read_since: date | None = None
    chased_on: date | None = None
    closed_as: ContactClosed | None = None
    closed_on: date | None = None
    favourite: bool = False
    replies: int = 0  # times they got back to you after you'd been waiting
    usual_reply_days: int | None = None  # median working days to reply, rounded up
    created_at: datetime
    updated_at: datetime


# --- roles -------------------------------------------------------------------------------


class RoleFields(In):
    url: HttpUrl | None = None
    location: str | None = None
    work_mode: WorkMode | None = None
    employment_type: EmploymentType | None = None
    salary_min: int | None = Field(default=None, ge=0)
    salary_max: int | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    day_rate: int | None = Field(default=None, ge=0)
    ir35: IR35 | None = None
    description: str | None = None
    contact_id: str | None = None  # who told you about it
    meeting_id: str | None = None  # the call it came up in
    decision: Literal["passed"] | None = None  # null: still to decide (or you applied)
    decision_reason: str | None = None


class RoleIn(RoleFields):
    @model_validator(mode="after")
    def _salary_range(self):
        if self.salary_min is not None and self.salary_max is not None and self.salary_min > self.salary_max:
            raise ValueError("salary_min can't be more than salary_max")
        return self

    company_id: str
    title: str = Field(min_length=1, max_length=300)


class RolePatch(RoleFields, Patch):
    not_null = frozenset({"company_id", "title"})
    company_id: str | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)


class RoleOut(Out):
    id: str
    company_id: str
    title: str
    url: str | None
    location: str | None
    work_mode: str | None
    employment_type: str | None
    salary_min: int | None
    salary_max: int | None
    currency: str | None
    day_rate: int | None
    ir35: str | None
    description: str | None
    contact_id: str | None = None
    meeting_id: str | None = None
    decision: str | None = None
    decision_reason: str | None = None
    decided_on: date | None = None
    created_at: datetime
    updated_at: datetime


RoleStatus = Literal["to_decide", "interested", "closed", "applied", "passed"]


class RoleSummary(RoleOut):
    """A role with where it came from and where it stands: still to decide, applied, or passed."""

    company_name: str
    status: RoleStatus  # from its applications once it has any, whatever `decision` says
    closed_as: str | None = None  # when `closed`: the stage it ended at ("Withdrawn")
    closed_stage: str | None = None  # that stage's id, so a default one can show in your language
    application_ids: list[str]
    contact_name: str | None = None
    agency_id: str | None = None  # the person's agency
    agency_name: str | None = None
    meeting_label: str | None = None
    # What the frontend names the call from, in your language.
    meeting_kind: str | None = None
    meeting_title: str | None = None
    meeting_contact_name: str | None = None


# --- applications ------------------------------------------------------------------------


class ApplicationIn(In):
    role_id: str
    route: Route = "direct"
    agency_id: str | None = None
    recruiter_id: str | None = None
    stage: str | None = None  # defaults to the workflow's initial stage
    applied_on: date | None = None
    follow_up_on: date | None = None
    tags: list[str] = []


class ApplicationPatch(Patch):
    """Stage is changed with POST /applications/{id}/move, not here."""

    not_null = frozenset({"role_id", "route", "tags", "archived"})

    role_id: str | None = None
    route: Route | None = None
    agency_id: str | None = None
    recruiter_id: str | None = None
    applied_on: date | None = None
    follow_up_on: date | None = None
    snoozed_until: date | None = None
    awaiting_reply_since: date | None = None  # you replied and are waiting; null: you heard back
    reply_to_read_since: date | None = None  # they've replied and you need to read it (clears waiting)
    tags: list[str] | None = None
    archived: bool | None = None


class ApplicationOut(Out):
    id: str
    role_id: str
    route: str
    agency_id: str | None
    recruiter_id: str | None
    stage: str
    applied_on: date | None
    follow_up_on: date | None
    snoozed_until: date | None
    awaiting_reply_since: date | None = None
    reply_to_read_since: date | None = None
    last_activity_at: datetime
    tags: list[str]
    archived: bool
    created_at: datetime
    updated_at: datetime


# --- attachments -------------------------------------------------------------------------


class AttachmentOut(Out):
    id: str
    entity_type: str | None  # none: an unattached file (its application or company was deleted)
    entity_id: str | None
    original_name: str
    content_type: str | None
    size: int
    sha256: str
    path: str  # under files/ in the data directory
    created_at: datetime
    url: str  # where to download or view it
    inline: bool  # opens in the browser (PDFs, images, text); anything else downloads
    # For exported emails (.eml): subject, from, to, cc, date and a snippet.
    meta: dict[str, Any] = {}


class AttachmentPatch(Patch):
    """Rename a file (its display name; the file on disk keeps its path) or move it to something else."""

    original_name: str | None = Field(default=None, min_length=1, max_length=300, pattern=r"\S")
    entity_type: Literal["application", "company", "role", "agency", "contact", "interview", "document"] | None = None
    entity_id: str | None = Field(default=None, max_length=36)


# --- documents (CVs and cover letters) ---------------------------------------------------

DocumentKind = Literal["cv", "cover_letter", "other"]


class DocumentIn(In):
    kind: DocumentKind = "cv"
    name: str = Field(min_length=1, max_length=200, pattern=r"\S")


class DocumentPatch(Patch):
    not_null = frozenset({"kind", "name"})

    kind: DocumentKind | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200, pattern=r"\S")


class VersionPatch(Patch):
    not_null = frozenset({"label"})

    label: str | None = Field(default=None, min_length=1, max_length=100, pattern=r"\S")
    notes: str | None = Field(default=None, max_length=2000)


class VersionOut(BaseModel):
    id: str
    document_id: str
    label: str
    notes: str | None
    created_at: datetime
    file: AttachmentOut | None
    used_in: int  # how many applications it was sent with


class DocumentOut(BaseModel):
    id: str
    kind: str
    name: str
    created_at: datetime
    updated_at: datetime
    versions: list[VersionOut]  # newest first


class DocumentUsage(BaseModel):
    """One application a version of this document was sent with."""

    link_id: str
    application_id: str
    company_name: str
    role_title: str
    stage_name: str
    version_id: str
    version_label: str
    sent_on: date | None
    stage: str | None = None  # the id beside `stage_name`, so a default stage can show in your language


class DocumentDetail(DocumentOut):
    used_in: list[DocumentUsage]


class CvFileApplication(BaseModel):
    id: str
    company_name: str
    role_title: str
    has_it: bool  # already recorded as sent with the matching version


class CvFileSource(BaseModel):
    kind: Literal["application", "role", "contact"]
    id: str
    name: str  # "Contoso · Backend Engineer", "Platform Engineer at Fabrikam", "Alex Morgan"


class CvFileVersion(BaseModel):
    id: str
    label: str
    document_id: str
    document_name: str


class CvFile(BaseModel):
    """A file that looks like a CV, attached to applications, roles or people: one per distinct
    file (by content)."""

    sha256: str
    name: str
    size: int
    content_type: str | None
    sources: list[CvFileSource]  # where it's attached: applications, roles, people
    applications: list[CvFileApplication]  # the applications it counts for
    version: CvFileVersion | None  # a document version with the very same file, if there is one


class CvFileAdopt(In):
    """Make a file a version of a document (an existing one, or a new one named here), or, when
    it already is one, record it as sent with the applications it's attached to."""

    sha256: str = Field(min_length=64, max_length=64)
    document_id: str | None = None
    document_name: str | None = Field(None, max_length=200)
    kind: DocumentKind = "cv"
    label: str | None = Field(None, max_length=100)
    # Only these of its applications (all of them when left out).
    application_ids: list[str] | None = None


class CvFileAdopted(BaseModel):
    document_id: str
    version_id: str
    recorded: int  # applications it was newly recorded as sent with


class SentDocumentIn(In):
    document_version_id: str
    sent_on: date | None = None


class SentDocumentOut(BaseModel):
    """A document version sent with an application."""

    id: str
    document_id: str
    document_name: str
    kind: str
    version_id: str
    version_label: str
    sent_on: date | None
    file_url: str | None


# --- links -------------------------------------------------------------------------------

EntityRef = Literal["application", "company", "role", "agency", "contact", "interview", "document"]


class LinkIn(In):
    """An external link (a Google Doc, the job ad, a repo…) on something. Title defaults from the URL."""

    entity_type: EntityRef
    entity_id: str = Field(min_length=1, max_length=36)
    url: HttpUrl
    title: str | None = Field(default=None, max_length=300)


class LinkPatch(Patch):
    not_null = frozenset({"url"})

    url: HttpUrl | None = None
    title: str | None = Field(default=None, max_length=300)


class LinkOut(Out):
    id: str
    entity_type: str
    entity_id: str
    url: str
    title: str | None
    kind: str  # google_doc | google_sheet | google_slides | google_drive | github | linkedin | web
    created_at: datetime


# --- to-dos ------------------------------------------------------------------------------

TodoAbout = Literal["application", "company", "role", "agency", "contact"]


class TodoIn(In):
    """A to-do in your own words. Leave `entity_type` and `entity_id` out for one about nothing in
    particular, or give both to put it on a company, agency, person, role or application."""

    text: str = Field(min_length=1, max_length=500)
    due_on: date | None = None
    entity_type: TodoAbout | None = None
    entity_id: str | None = Field(default=None, min_length=1, max_length=36)

    @model_validator(mode="after")
    def _both_or_neither(self):
        if (self.entity_type is None) != (self.entity_id is None):
            raise ValueError("give both entity_type and entity_id, or neither")
        return self


class TodoPatch(Patch):
    """`done: true` ticks it off (stamping `done_at`); `done: false` brings it back."""

    not_null = frozenset({"text", "done"})

    text: str | None = Field(default=None, min_length=1, max_length=500)
    due_on: date | None = None
    done: bool | None = None


class TodoOut(Out):
    id: str
    text: str
    due_on: date | None
    done_at: datetime | None
    entity_type: str | None
    entity_id: str | None
    about: str | None = None  # what it's about: "Alex Morgan", "Contoso · Backend Engineer"
    company_id: str | None = None  # a role's company (roles have no page of their own)
    created_at: datetime
    updated_at: datetime


# --- notes -------------------------------------------------------------------------------

NoteLink = Annotated[
    str, Field(pattern=r"^(application|company|role|agency|contact|interview|document):\S+$", max_length=80)
]


class NoteIn(In):
    """A Markdown note. `links` attach it to things, e.g. ["application:<id>"]; none makes it a general note."""

    title: str = Field(min_length=1, max_length=300, pattern=r"\S")
    body: str = Field(default="", max_length=200_000)
    links: list[NoteLink] = []


class NotePatch(Patch):
    not_null = frozenset({"title", "body", "links"})

    title: str | None = Field(default=None, min_length=1, max_length=300, pattern=r"\S")
    body: str | None = Field(default=None, max_length=200_000)
    links: list[NoteLink] | None = None
    # The note's updated_at when you opened it: if it changed since (another tab, an outside
    # editor), the save is refused with 409 rather than overwriting those changes.
    base_updated_at: AwareDatetime | None = None


class NoteSummary(BaseModel):
    id: str
    title: str
    links: list[str]
    path: str  # under notes/ in the data directory
    excerpt: str
    created_at: datetime
    updated_at: datetime


class NoteOut(NoteSummary):
    body: str


# --- interviews --------------------------------------------------------------------------

InterviewKind = Literal[
    "screen",
    "hiring_manager",
    "technical",
    "coding_task",
    "system_design",
    "pairing",
    "behavioural",
    "onsite",
    "final",
    "other",
]
InterviewStatus = Literal["scheduled", "done", "cancelled"]
InterviewFormat = Literal["video", "phone", "onsite", "take_home"]


class InterviewIn(In):
    """An interview round. Leave `round` out to make it the next round for the application."""

    round: int | None = Field(default=None, ge=1, le=99)
    title: str | None = Field(default=None, max_length=200)
    kind: InterviewKind = "technical"
    status: InterviewStatus = "scheduled"
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    deadline_at: AwareDatetime | None = None
    format: InterviewFormat | None = None
    location: str | None = Field(default=None, max_length=300)
    meeting_url: HttpUrl | None = None
    prep: str | None = None
    debrief: str | None = None
    questions: str | None = None
    task_instructions: str | None = None
    task_repo_url: HttpUrl | None = None
    interviewer_ids: list[str] = []


class InterviewPatch(Patch):
    not_null = frozenset({"round", "kind", "status", "interviewer_ids"})

    round: int | None = Field(default=None, ge=1, le=99)
    title: str | None = Field(default=None, max_length=200)
    kind: InterviewKind | None = None
    status: InterviewStatus | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    deadline_at: AwareDatetime | None = None
    format: InterviewFormat | None = None
    location: str | None = Field(default=None, max_length=300)
    meeting_url: HttpUrl | None = None
    prep: str | None = None
    debrief: str | None = None
    questions: str | None = None
    # Why it moved, when this PATCH reschedules it (a new time for a booked round): goes on the
    # timeline entry, not stored on the round.
    reschedule_reason: str | None = Field(default=None, max_length=500)
    task_instructions: str | None = None
    task_repo_url: HttpUrl | None = None
    interviewer_ids: list[str] | None = None


class RoundSummary(Out):
    """The round an application is at, for the board and list: "Round 2 · System design test"."""

    id: str
    round: int | None
    title: str | None
    kind: str
    status: str
    label: str
    starts_at: datetime | None
    deadline_at: datetime | None


class InterviewOut(RoundSummary):
    application_id: str
    ends_at: datetime | None
    format: str | None
    location: str | None
    meeting_url: str | None
    prep: str | None
    debrief: str | None
    questions: str | None
    task_instructions: str | None
    task_repo_url: str | None
    interviewer_ids: list[str]
    rescheduled_count: int  # times a booked round moved to another time
    rescheduled_from: datetime | None  # the time it moved from last (unknown for moves before 0014)
    # For lists across applications (the Interviews page).
    company_name: str
    role_title: str
    created_at: datetime
    updated_at: datetime


class ApplicationRow(ApplicationOut):
    """An application with the names the list and board need."""

    role_title: str
    company_id: str
    company_name: str
    agency_name: str | None
    recruiter_name: str | None
    stage_name: str
    stage_kind: str
    days_since_activity: int
    stale: bool
    current_round: RoundSummary | None = None


class MoveIn(In):
    to_stage: str
    occurred_at: AwareDatetime | None = None
    note: str | None = None


class ActivityIn(In):
    kind: ActivityKind
    summary: str | None = None
    occurred_at: AwareDatetime | None = None
    data: dict[str, Any] = Field(
        default={}, description="Saved with the event, except a `msg`, which is ignored: only the app writes messages."
    )


class TitleParams(BaseModel):
    title: str


class FileNameParams(BaseModel):
    name: str


class EmailParams(BaseModel):
    subject: str
    sender: str


class EmailNoSubjectParams(BaseModel):
    sender: str


class EmailUnknownSenderParams(BaseModel):
    subject: str


class NoParams(BaseModel):
    pass


class DocumentSentParams(BaseModel):
    name: str
    label: str


class RoundParams(BaseModel):
    round: int | None
    title: str | None
    kind: str


class RoundReasonParams(RoundParams):
    reason: str


class MoneyParams(BaseModel):
    amount: int
    currency: str | None


class LinkAddedMsg(BaseModel):
    key: Literal["event.linkAdded"]
    params: TitleParams


class NoteAddedMsg(BaseModel):
    key: Literal["event.noteAdded"]
    params: TitleParams


class FileAddedMsg(BaseModel):
    key: Literal["event.fileAdded"]
    params: FileNameParams


class EmailMsg(BaseModel):
    key: Literal["event.email"]
    params: EmailParams


class EmailNoSubjectMsg(BaseModel):
    key: Literal["event.emailNoSubject"]
    params: EmailNoSubjectParams


class EmailUnknownSenderMsg(BaseModel):
    key: Literal["event.emailUnknownSender"]
    params: EmailUnknownSenderParams


class EmailNoSubjectUnknownSenderMsg(BaseModel):
    key: Literal["event.emailNoSubjectUnknownSender"]
    params: NoParams


class CvSentMsg(BaseModel):
    key: Literal["event.cvSent"]
    params: DocumentSentParams


class CoverLetterSentMsg(BaseModel):
    key: Literal["event.coverLetterSent"]
    params: DocumentSentParams


class DocumentSentMsg(BaseModel):
    key: Literal["event.documentSent"]
    params: DocumentSentParams


class RoundScheduledMsg(BaseModel):
    key: Literal["event.roundScheduled"]
    params: RoundParams


class RoundAddedMsg(BaseModel):
    key: Literal["event.roundAdded"]
    params: RoundParams


class RoundCancelledMsg(BaseModel):
    key: Literal["event.roundCancelled"]
    params: RoundParams


class RoundBackOnMsg(BaseModel):
    key: Literal["event.roundBackOn"]
    params: RoundParams


class RoundDoneMsg(BaseModel):
    key: Literal["event.roundDone"]
    params: RoundParams


class RoundRemovedMsg(BaseModel):
    key: Literal["event.roundRemoved"]
    params: RoundParams


class RoundRescheduledMsg(BaseModel):
    key: Literal["event.roundRescheduled"]
    params: RoundParams


class RoundRescheduledReasonMsg(BaseModel):
    key: Literal["event.roundRescheduledReason"]
    params: RoundReasonParams


class OfferReceivedYearMsg(BaseModel):
    key: Literal["event.offerReceivedYear"]
    params: MoneyParams


class OfferReceivedDayMsg(BaseModel):
    key: Literal["event.offerReceivedDay"]
    params: MoneyParams


class OfferReceivedNoFiguresMsg(BaseModel):
    key: Literal["event.offerReceivedNoFigures"]
    params: NoParams


class OfferBackYearMsg(BaseModel):
    key: Literal["event.offerBackYear"]
    params: MoneyParams


class OfferBackDayMsg(BaseModel):
    key: Literal["event.offerBackDay"]
    params: MoneyParams


class OfferBackNoFiguresMsg(BaseModel):
    key: Literal["event.offerBackNoFigures"]
    params: NoParams


class OfferAcceptedYearMsg(BaseModel):
    key: Literal["event.offerAcceptedYear"]
    params: MoneyParams


class OfferAcceptedDayMsg(BaseModel):
    key: Literal["event.offerAcceptedDay"]
    params: MoneyParams


class OfferAcceptedNoFiguresMsg(BaseModel):
    key: Literal["event.offerAcceptedNoFigures"]
    params: NoParams


class OfferDeclinedYearMsg(BaseModel):
    key: Literal["event.offerDeclinedYear"]
    params: MoneyParams


class OfferDeclinedDayMsg(BaseModel):
    key: Literal["event.offerDeclinedDay"]
    params: MoneyParams


class OfferDeclinedNoFiguresMsg(BaseModel):
    key: Literal["event.offerDeclinedNoFigures"]
    params: NoParams


class OfferWithdrawnYearMsg(BaseModel):
    key: Literal["event.offerWithdrawnYear"]
    params: MoneyParams


class OfferWithdrawnDayMsg(BaseModel):
    key: Literal["event.offerWithdrawnDay"]
    params: MoneyParams


class OfferWithdrawnNoFiguresMsg(BaseModel):
    key: Literal["event.offerWithdrawnNoFigures"]
    params: NoParams


class OfferRemovedYearMsg(BaseModel):
    key: Literal["event.offerRemovedYear"]
    params: MoneyParams


class OfferRemovedDayMsg(BaseModel):
    key: Literal["event.offerRemovedDay"]
    params: MoneyParams


class OfferRemovedNoFiguresMsg(BaseModel):
    key: Literal["event.offerRemovedNoFigures"]
    params: NoParams


class FollowedUpMsg(BaseModel):
    key: Literal["event.followedUp"]
    params: NoParams


class NoReplyMsg(BaseModel):
    key: Literal["event.noReply"]
    params: NoParams


class ReplyToReadMsg(BaseModel):
    key: Literal["event.replyToRead"]
    params: NoParams


class ReplyReadMsg(BaseModel):
    key: Literal["event.replyRead"]
    params: NoParams


class RepliedWaitingMsg(BaseModel):
    key: Literal["event.repliedWaiting"]
    params: NoParams


class HeardBackMsg(BaseModel):
    key: Literal["event.heardBack"]
    params: NoParams


class StageParams(BaseModel):
    stage: str


class UndoMoveMsg(BaseModel):
    key: Literal["event.undoMove"]
    params: StageParams


class RecruiterChangeParams(BaseModel):
    old: str
    new: str


class RecruiterSetParams(BaseModel):
    new: str


class RecruiterRemovedParams(BaseModel):
    old: str


class RecruiterChangeAgencyParams(RecruiterChangeParams):
    agency: str


class RecruiterSetAgencyParams(RecruiterSetParams):
    agency: str


class RecruiterRemovedAgencyParams(RecruiterRemovedParams):
    agency: str


class RecruiterChangedMsg(BaseModel):
    key: Literal["event.recruiterChanged"]
    params: RecruiterChangeParams


class RecruiterSetMsg(BaseModel):
    key: Literal["event.recruiterSet"]
    params: RecruiterSetParams


class RecruiterRemovedMsg(BaseModel):
    key: Literal["event.recruiterRemoved"]
    params: RecruiterRemovedParams


class RecruiterChangedAgencyMsg(BaseModel):
    key: Literal["event.recruiterChangedAgency"]
    params: RecruiterChangeAgencyParams


class RecruiterSetAgencyMsg(BaseModel):
    key: Literal["event.recruiterSetAgency"]
    params: RecruiterSetAgencyParams


class RecruiterRemovedAgencyMsg(BaseModel):
    key: Literal["event.recruiterRemovedAgency"]
    params: RecruiterRemovedAgencyParams


class RecruiterChangedOnRoleMsg(BaseModel):
    key: Literal["event.recruiterChangedOnRole"]
    params: RecruiterChangeParams


class RecruiterSetOnRoleMsg(BaseModel):
    key: Literal["event.recruiterSetOnRole"]
    params: RecruiterSetParams


class RolePersonKeptAgencyMsg(BaseModel):
    key: Literal["event.rolePersonKeptAgency"]
    params: RecruiterChangeAgencyParams


class RolePersonKeptUnnamedAgencyMsg(BaseModel):
    key: Literal["event.rolePersonKeptUnnamedAgency"]
    params: RecruiterChangeParams


class RolePersonKeptDirectMsg(BaseModel):
    key: Literal["event.rolePersonKeptDirect"]
    params: RecruiterChangeParams


# A saved event's text as data (`data.msg`): a new key here without text in the frontend fails `pnpm typecheck`.
EventMsg = Annotated[
    LinkAddedMsg
    | NoteAddedMsg
    | FileAddedMsg
    | EmailMsg
    | EmailNoSubjectMsg
    | EmailUnknownSenderMsg
    | EmailNoSubjectUnknownSenderMsg
    | CvSentMsg
    | CoverLetterSentMsg
    | DocumentSentMsg
    | RoundScheduledMsg
    | RoundAddedMsg
    | RoundCancelledMsg
    | RoundBackOnMsg
    | RoundDoneMsg
    | RoundRemovedMsg
    | RoundRescheduledMsg
    | RoundRescheduledReasonMsg
    | OfferReceivedYearMsg
    | OfferReceivedDayMsg
    | OfferReceivedNoFiguresMsg
    | OfferBackYearMsg
    | OfferBackDayMsg
    | OfferBackNoFiguresMsg
    | OfferAcceptedYearMsg
    | OfferAcceptedDayMsg
    | OfferAcceptedNoFiguresMsg
    | OfferDeclinedYearMsg
    | OfferDeclinedDayMsg
    | OfferDeclinedNoFiguresMsg
    | OfferWithdrawnYearMsg
    | OfferWithdrawnDayMsg
    | OfferWithdrawnNoFiguresMsg
    | OfferRemovedYearMsg
    | OfferRemovedDayMsg
    | OfferRemovedNoFiguresMsg
    | FollowedUpMsg
    | NoReplyMsg
    | ReplyToReadMsg
    | ReplyReadMsg
    | RepliedWaitingMsg
    | HeardBackMsg
    | UndoMoveMsg
    | RecruiterChangedMsg
    | RecruiterSetMsg
    | RecruiterRemovedMsg
    | RecruiterChangedAgencyMsg
    | RecruiterSetAgencyMsg
    | RecruiterRemovedAgencyMsg
    | RecruiterChangedOnRoleMsg
    | RecruiterSetOnRoleMsg
    | RolePersonKeptAgencyMsg
    | RolePersonKeptUnnamedAgencyMsg
    | RolePersonKeptDirectMsg,
    Field(discriminator="key"),
]
_EVENT_MSG: TypeAdapter[Any] = TypeAdapter(EventMsg)


def read_event_msg(data: Any) -> Any:
    """An event's saved message. Data may not match (hand-edited, or from a newer version): that's null, never a 500."""
    if not isinstance(data, dict) or "msg" not in data:
        return None
    try:
        return _EVENT_MSG.validate_python(data["msg"])
    except ValidationError:
        return None


class EventOut(Out):
    id: str
    application_id: str
    kind: str
    occurred_at: datetime
    from_stage: str | None
    to_stage: str | None
    summary: str | None
    data: dict[str, Any]
    created_at: datetime
    msg: EventMsg | None = None

    @model_validator(mode="after")
    def _read_msg(self) -> EventOut:
        self.msg = read_event_msg(self.data)
        return self


class ApplicationContactIn(In):
    contact_id: str
    relation: Relation


class ApplicationContactOut(Out):
    id: str
    application_id: str
    contact_id: str
    relation: str


class CompanySummary(BaseModel):
    company: CompanyOut
    roles: list[RoleOut]
    applications: list[ApplicationRow]
    contacts: list[ContactOut]


class AgencySummary(BaseModel):
    agency: AgencyOut
    recruiters: list[ContactOut]
    applications: list[ApplicationRow]


class PersonApplication(ApplicationRow):
    relations: list[str]  # "source" (they brought it to you), then how they're linked: hiring_manager…


class ContactSummary(BaseModel):
    """Everything about one person: who they are and what they've been part of."""

    contact: ContactOut
    agency_name: str | None
    company_name: str | None
    applications: list[PersonApplication]
    interviews: list[InterviewOut]


class DuplicateOut(ApplicationRow):
    """Another application that looks like the same job: same company, same or similar title."""

    match: Literal["same_role", "similar_title"]


class ApplicationDetail(ApplicationRow):
    events: list[EventOut]
    contacts: list[ApplicationContactOut]
    allowed_next: list[str]
    suggested_next: list[str]  # the usual next stages; with transitions = "any", allowed_next is every stage
    can_undo: bool
    duplicates: list[DuplicateOut]
    documents: list[SentDocumentOut]  # CV and cover-letter versions sent with it


class QuickApplicationIn(In):
    """Create an application and, in the same transaction, anything it needs that doesn't exist yet.

    Company, agency and recruiter can each be given by id or by name. A name that matches an
    existing record (case-insensitively) reuses it; otherwise a new one is created. A recruiter
    name is matched within the application's agency.
    """

    company_id: str | None = None
    company_name: str | None = Field(default=None, max_length=200)
    role_title: str = Field(min_length=1, max_length=300)
    role_url: HttpUrl | None = None
    route: Route = "direct"
    agency_id: str | None = None
    agency_name: str | None = Field(default=None, max_length=200)
    recruiter_id: str | None = None
    recruiter_name: str | None = Field(default=None, max_length=200)
    stage: str | None = None
    applied_on: date | None = None
    tags: list[str] = []

    @model_validator(mode="after")
    def _company_given(self):
        if not self.company_id and not (self.company_name or "").strip():
            raise ValueError("give company_id or company_name")
        return self


# --- meetings (calls and meetings with people) ------------------------------------------

MeetingKind = Literal["call", "video", "in_person"]


class MeetingIn(In):
    """A call or meeting with a person. Book one ahead (`scheduled`) or log one you've had (`done`)."""

    contact_id: str
    application_id: str | None = None
    kind: MeetingKind = "call"
    title: str | None = Field(default=None, max_length=200)
    status: InterviewStatus = "scheduled"
    starts_at: AwareDatetime
    ends_at: AwareDatetime | None = None
    location: str | None = Field(default=None, max_length=300)
    meeting_url: HttpUrl | None = None
    agenda: str | None = None
    notes: str | None = None


class MeetingPatch(Patch):
    not_null = frozenset({"contact_id", "kind", "status", "starts_at"})

    contact_id: str | None = None
    application_id: str | None = None
    kind: MeetingKind | None = None
    title: str | None = Field(default=None, max_length=200)
    status: InterviewStatus | None = None
    starts_at: AwareDatetime | None = None
    ends_at: AwareDatetime | None = None
    location: str | None = Field(default=None, max_length=300)
    meeting_url: HttpUrl | None = None
    agenda: str | None = None
    notes: str | None = None


class MeetingOut(Out):
    id: str
    contact_id: str
    application_id: str | None
    kind: str
    title: str | None
    status: str
    starts_at: datetime
    ends_at: datetime | None
    location: str | None
    meeting_url: str | None
    agenda: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime
    # Who it's with, and the application if there is one, for lists across people.
    label: str  # "Call with Alex Morgan: market catch-up"
    contact_name: str
    agency_id: str | None = None
    agency_name: str | None = None
    company_id: str | None = None
    company_name: str | None = None
    role_title: str | None = None  # the linked application's role
    application_company_name: str | None = None


# --- offers ------------------------------------------------------------------------------

OfferStatus = Literal["pending", "accepted", "declined", "withdrawn"]


class OfferIn(In):
    """An offer on an application. Money is whole units of `currency` a year, except `day_rate`."""

    status: OfferStatus = "pending"
    received_on: date | None = None
    respond_by: date | None = None
    start_on: date | None = None
    employment_type: EmploymentType | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    salary: int | None = Field(default=None, ge=0)
    bonus: int | None = Field(default=None, ge=0)
    equity: str | None = None
    equity_value: int | None = Field(default=None, ge=0)
    pension_percent: float | None = Field(default=None, ge=0, le=100)
    holiday_days: int | None = Field(default=None, ge=0, le=366)
    day_rate: int | None = Field(default=None, ge=0)
    ir35: IR35 | None = None
    contract_months: int | None = Field(default=None, ge=0, le=120)
    benefits: str | None = None
    notes: str | None = None


class OfferPatch(Patch):
    not_null = frozenset({"status"})

    status: OfferStatus | None = None
    received_on: date | None = None
    respond_by: date | None = None
    start_on: date | None = None
    employment_type: EmploymentType | None = None
    currency: str | None = Field(default=None, pattern=r"^[A-Za-z]{3}$")
    salary: int | None = Field(default=None, ge=0)
    bonus: int | None = Field(default=None, ge=0)
    equity: str | None = None
    equity_value: int | None = Field(default=None, ge=0)
    pension_percent: float | None = Field(default=None, ge=0, le=100)
    holiday_days: int | None = Field(default=None, ge=0, le=366)
    day_rate: int | None = Field(default=None, ge=0)
    ir35: IR35 | None = None
    contract_months: int | None = Field(default=None, ge=0, le=120)
    benefits: str | None = None
    notes: str | None = None


class OfferOut(BaseModel):
    id: str
    application_id: str
    status: OfferStatus
    received_on: date | None
    respond_by: date | None
    start_on: date | None
    employment_type: str | None
    currency: str | None
    salary: int | None
    bonus: int | None
    equity: str | None
    equity_value: int | None
    pension_percent: float | None
    holiday_days: int | None
    day_rate: int | None
    ir35: str | None
    contract_months: int | None
    benefits: str | None
    notes: str | None
    annual_value: int | None  # salary + bonus + equity + employer pension, or day rate x working days
    value_basis: Literal["salary", "day rate"] | None
    company_name: str
    role_title: str
    stage: str  # the application's stage
    created_at: datetime
    updated_at: datetime
