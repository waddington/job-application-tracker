"""Pydantic request/response models for the JSON API (FR23)."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any, ClassVar, Literal

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, HttpUrl, model_validator

WorkMode = Literal["remote", "hybrid", "office"]
EmploymentType = Literal["permanent", "contract", "fixed_term"]
IR35 = Literal["inside", "outside", "unknown"]
Route = Literal["direct", "agency", "referral"]
DetailKind = Literal["email", "phone", "linkedin", "url", "other"]
Relation = Literal["recruiter", "hiring_manager", "interviewer", "referrer", "other"]
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


class ContactPatch(Patch):
    not_null = frozenset({"name"})
    name: str | None = Field(default=None, min_length=1, max_length=200)
    title: str | None = None
    agency_id: str | None = None
    company_id: str | None = None
    details: list[ContactDetailIn] | None = None  # replaces all details when sent


class ContactOut(Out):
    id: str
    name: str
    title: str | None
    agency_id: str | None
    company_id: str | None
    details: list[ContactDetailOut] = []
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
    created_at: datetime
    updated_at: datetime


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
    last_activity_at: datetime
    tags: list[str]
    archived: bool
    created_at: datetime
    updated_at: datetime


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
    data: dict[str, Any] = {}


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


class DuplicateOut(ApplicationRow):
    """Another application that looks like the same job: same company, same or similar title."""

    match: Literal["same_role", "similar_title"]


class ApplicationDetail(ApplicationRow):
    events: list[EventOut]
    contacts: list[ApplicationContactOut]
    allowed_next: list[str]
    can_undo: bool
    duplicates: list[DuplicateOut]


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
