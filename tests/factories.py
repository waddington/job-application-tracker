"""Fake data for tests. Invented names and example.com addresses only."""

from __future__ import annotations

from datetime import UTC, date, datetime

from jat.db.models import (
    Agency,
    Application,
    ApplicationContact,
    ApplicationDocument,
    Attachment,
    Company,
    Contact,
    ContactDetail,
    Document,
    DocumentVersion,
    Event,
    Interview,
    InterviewContact,
    Link,
    Role,
)


def post(client, url, json, status=201):
    """POST through the API test client and return the JSON, failing loudly on the wrong status."""
    r = client.post(url, json=json)
    assert r.status_code == status, r.text
    return r.json()


def populate(session) -> dict[str, str]:
    """One row in every exported table, with unicode, JSON, booleans, dates and nulls."""
    company = Company(name="Contoso Ltd", website="https://contoso.example.com")
    agency = Agency(name="Northwind Talent")
    session.add_all([company, agency])
    session.flush()
    recruiter = Contact(name="Alex Recruiter", agency_id=agency.id, title="Senior Consultant")
    session.add(recruiter)
    session.flush()
    session.add_all(
        [
            ContactDetail(contact_id=recruiter.id, kind="email", label="work", value="alex@northwind.example.com"),
            ContactDetail(contact_id=recruiter.id, kind="phone", label="mobile", value="+44 7700 900000", position=1),
        ]
    )
    role = Role(
        company_id=company.id,
        title="Senior Backend Engineer – Payments",
        work_mode="hybrid",
        employment_type="contract",
        day_rate=650,
        currency="GBP",
        ir35="outside",
    )
    session.add(role)
    session.flush()
    app = Application(
        role_id=role.id,
        route="agency",
        agency_id=agency.id,
        recruiter_id=recruiter.id,
        stage="screen",
        applied_on=date(2026, 9, 28),
        tags=["python", "fintech"],
        archived=False,
    )
    session.add(app)
    session.flush()
    interview = Interview(
        application_id=app.id,
        kind="coding_task",
        format="take_home",
        deadline_at=datetime(2026, 10, 3, 17, 0, tzinfo=UTC),
        task_instructions="Build a rate limiter. Ünïcödé ✓",
        task_repo_url="https://git.example.com/task",
    )
    attachment = Attachment(
        entity_type="application",
        entity_id=app.id,
        path="2026/09/brief.pdf",
        original_name="brief.pdf",
        content_type="application/pdf",
        size=1234,
        sha256="0" * 64,
        meta={"pages": 2},
    )
    cv = Document(kind="cv", name="Backend CV")
    session.add_all([interview, attachment, cv])
    session.flush()
    version = DocumentVersion(document_id=cv.id, label="v3 (backend)", attachment_id=attachment.id)
    session.add(version)
    session.flush()
    session.add_all(
        [
            ApplicationContact(application_id=app.id, contact_id=recruiter.id, relation="recruiter"),
            InterviewContact(interview_id=interview.id, contact_id=recruiter.id),
            ApplicationDocument(application_id=app.id, document_version_id=version.id, sent_on=date(2026, 9, 28)),
            Event(application_id=app.id, kind="stage_change", from_stage="applied", to_stage="screen", data={}),
            Link(entity_type="role", entity_id=role.id, url="https://docs.example.com/d/1", title="JD notes"),
        ]
    )
    session.flush()
    return {"application": app.id, "company": company.id, "role": role.id}
