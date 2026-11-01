"""Fill a throwaway data directory with fictional demo data (for screenshots and trying things out).

    uv run python scripts/seed_demo.py /tmp/jat-demo
    uv run jat --data-dir /tmp/jat-demo serve

Every name here is invented; example.com addresses only. Refuses any directory that isn't
new or empty, so it can't mix demo data into real data.
"""

from __future__ import annotations

import sys
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

from jat.datadir import init_data_dir
from jat.db import db_path, make_engine, migrate, session_factory
from jat.db.models import (
    Agency,
    Application,
    ApplicationDocument,
    Company,
    Contact,
    ContactDetail,
    Document,
    DocumentVersion,
    Event,
    Interview,
    Meeting,
    Offer,
    Reply,
    Role,
    Todo,
)
from jat.domain.applications import create_application, history, log_activity, move
from jat.domain.interviews import record
from jat.domain.workflow import DEFAULT_WORKFLOW as W
from jat.storage.notes import NoteStore

NOW = datetime.now(UTC).replace(microsecond=0)


def days_ago(n: float) -> datetime:
    return NOW - timedelta(days=n)


def add_moves(s, by_title: dict[str, Application]) -> None:
    """Moved rounds for Insights' Rescheduling block: three at one company and recruiter, one from
    the round's Edit form (no who) and one from before moves kept a record (only the count)."""
    s.flush()

    def move_round(title: str, round_no: int, by: str | None, reason: str = "", pushed_days: int = 2) -> None:
        app = by_title[title]
        interview = s.query(Interview).filter_by(application_id=app.id, round=round_no).one()
        was = interview.starts_at - timedelta(days=pushed_days)
        interview.rescheduled_count += 1
        interview.rescheduled_from = was
        last_activity = app.last_activity_at
        record(s, app, interview, "rescheduled", reason=reason, by=by, moved_from=was)
        s.flush()
        ev = s.query(Event).filter(Event.application_id == app.id).order_by(Event.seq.desc()).first()
        ev.occurred_at = was - timedelta(days=3)  # in the past, so it isn't today's news
        app.last_activity_at = last_activity

    move_round("Senior Python Developer", 1, "them", "Their manager is away")
    # Moved twice: two days early to a day early, then to its final time.
    twice = s.query(Interview).filter_by(application_id=by_title["Senior Python Developer"].id, round=2).one()
    final_time = twice.starts_at
    twice.starts_at = final_time - timedelta(days=1)
    move_round("Senior Python Developer", 2, "me", "A clash with another interview", 1)
    twice.starts_at = final_time
    move_round("Senior Python Developer", 2, "them", pushed_days=1)
    move_round("Senior Python Developer", 3, "mutual", pushed_days=3)
    move_round("Senior Software Engineer", 1, None)
    older = s.query(Interview).filter_by(application_id=by_title["Senior Backend Engineer"].id, round=1).one()
    older.rescheduled_count = 1


# Interview rounds held on the day an application reached a stage: (stage, description, kind).
ROUNDS = [
    ("screen", "Recruiter screen", "screen"),
    ("interviewing", "Engineering manager chat", "hiring_manager"),
    ("final", "Final with the CTO", "final"),
]

# (company, role, route, agency, recruiter, path through stages with days-ago, tags)
APPLICATIONS = [
    (
        "Contoso",
        "Senior Backend Engineer",
        "agency",
        "Northwind Talent",
        "Alex Morgan",
        [("applied", 24), ("screen", 18), ("interviewing", 9)],
        ["python", "fintech"],
    ),
    ("Fabrikam", "Staff Platform Engineer", "direct", None, None, [("applied", 12)], ["kubernetes"]),
    (
        "Tailspin Toys",
        "Engineering Manager",
        "agency",
        "Northwind Talent",
        "Alex Morgan",
        [("applied", 30), ("rejected", 20)],
        ["management"],
    ),
    (
        "Wide World Importers",
        "Senior Python Developer",
        "agency",
        "Blue Yonder Recruitment",
        "Sam Patel",
        [("applied", 15), ("screen", 11), ("interviewing", 6), ("final", 2), ("offer", 1)],
        ["python", "remote"],
    ),
    ("Adventure Works", "Backend Engineer (Go)", "direct", None, None, [("applied", 3)], ["go"]),
    (
        "Litware",
        "Senior Software Engineer",
        "referral",
        None,
        None,
        [("applied", 40), ("screen", 35), ("interviewing", 28), ("final", 21), ("offer", 3)],
        ["python"],
    ),
    (
        "Proseware",
        "Data Platform Engineer",
        "agency",
        "Blue Yonder Recruitment",
        "Sam Patel",
        [("applied", 26), ("ghosted", 4)],
        ["data"],
    ),
    ("Northwind Traders", "Lead Engineer", "direct", None, None, [], ["leadership"]),
    (
        "Coho Winery",
        "Full-stack Engineer",
        "agency",
        "Northwind Talent",
        "Jordan Lee",
        [("applied", 9)],
        ["typescript", "react"],
    ),
    # The same job applied for twice: directly first, then through a recruiter (duplicate warning).
    ("Coho Winery", "Senior Full-stack Engineer", "direct", None, None, [("applied", 14)], ["typescript"]),
    (
        "Alpine Ski House",
        "Site Reliability Engineer",
        "direct",
        None,
        None,
        [("applied", 50), ("screen", 45), ("withdrawn", 40)],
        ["sre"],
    ),
]


def seed(path: Path) -> None:
    # Only ever a missing or empty directory, so demo data can't land in real data (or ~).
    if path.exists() and any(path.iterdir()):
        sys.exit(f"{path} isn't empty; pick a new or empty directory for demo data.")
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    engine = make_engine(db_path(path))
    with session_factory(engine).begin() as s:
        agencies: dict[str, Agency] = {}
        recruiters: dict[str, Contact] = {}
        companies: dict[str, Company] = {}
        first_app: dict[str, Application] = {}
        by_title: dict[str, Application] = {}  # role title -> application (titles are unique here)
        for company, title, route, agency_name, recruiter_name, path_, tags in APPLICATIONS:
            if company not in companies:
                companies[company] = Company(
                    name=company, website=f"https://{company.lower().replace(' ', '')}.example.com"
                )
                s.add(companies[company])
            agency = recruiter = None
            if agency_name:
                agency = agencies.get(agency_name)
                if agency is None:
                    agency = agencies[agency_name] = Agency(name=agency_name)
                    s.add(agency)
                    s.flush()
                recruiter = recruiters.get(recruiter_name)
                if recruiter is None:
                    recruiter = recruiters[recruiter_name] = Contact(
                        name=recruiter_name, agency_id=agency.id, title="Senior Consultant"
                    )
                    s.add(recruiter)
                    s.flush()
                    handle = recruiter_name.lower().replace(" ", ".")
                    s.add(
                        ContactDetail(
                            contact_id=recruiter.id,
                            kind="email",
                            label="work",
                            value=f"{handle}@{agency_name.split()[0].lower()}.example.com",
                        )
                    )
                    s.add(
                        ContactDetail(
                            contact_id=recruiter.id,
                            kind="phone",
                            label="mobile",
                            value="+44 7700 900" + str(len(recruiters)).zfill(3),
                            position=1,
                        )
                    )
            s.flush()
            role = Role(company_id=companies[company].id, title=title, work_mode="hybrid")
            if recruiter:  # their pitch, added just before the application
                role.contact_id = recruiter.id
                role.created_at = days_ago((path_[0][1] if path_ else 5) + 3)
            s.add(role)
            s.flush()
            first_day = path_[0][1] + 2 if path_ else 5
            app = create_application(
                s,
                W,
                role_id=role.id,
                route=route,
                tags=tags,
                agency_id=agency.id if agency else None,
                recruiter_id=recruiter.id if recruiter else None,
            )
            for ev in history(s, app.id):  # the creation event
                ev.occurred_at = days_ago(first_day)
            app.last_activity_at = days_ago(first_day)
            for stage, ago in path_:
                if stage == "applied":
                    app.applied_on = date.today() - timedelta(days=ago)
                move(s, W, app, stage, occurred_at=days_ago(ago))
            if recruiter and path_:
                log_activity(
                    s, app, "call", summary=f"Intro call with {recruiter.name}", occurred_at=days_ago(path_[0][1] + 1)
                )
            by_title[title] = app
            # Interview rounds for the stages it went through, and the next one if it's mid-process.
            reached = dict(path_)
            rounds = [(reached[stage], title, kind) for stage, title, kind in ROUNDS if stage in reached]
            if path_ and path_[-1][0] == "interviewing":
                rounds.append((-2, "System design test", "system_design"))  # in two days
            for n, (ago, title, kind) in enumerate(rounds, start=1):
                s.add(
                    Interview(
                        application_id=app.id,
                        round=n,
                        title=title,
                        kind=kind,
                        status="done" if ago >= 0 else "scheduled",
                        starts_at=days_ago(ago),
                        format="video",
                        meeting_url="https://meet.example.com/demo",
                    )
                )
            first_app.setdefault(company, app)
        add_moves(s, by_title)
        # Notes are Markdown files under notes/, indexed in the database.
        store = NoteStore(path)
        for title, body, links in [
            (
                "Call with Alex about Contoso",
                "## Role\n\n- Payments platform, **Python + Kafka**\n- Hybrid, 2 days in London\n\n"
                "## Money\n\n| | |\n|---|---|\n| Day rate | £650 |\n| IR35 | Outside |\n\n"
                "- [ ] Send updated CV\n- [x] Confirm availability\n",
                [f"application:{first_app['Contoso'].id}", f"company:{companies['Contoso'].id}"],
            ),
            (
                "Job search plan",
                "Focus on **fintech** and **platform** roles.\n\n1. Five applications a week\n2. Chase after 7 days\n",
                [],
            ),
        ]:
            store.index(s, store.create(title, body, links))
        # Two offers to compare: a permanent package and a contract.
        s.add_all(
            [
                Offer(
                    application_id=first_app["Litware"].id,
                    employment_type="permanent",
                    currency="GBP",
                    salary=95_000,
                    bonus=9_500,
                    equity="Share options, 4-year vest",
                    equity_value=4_000,
                    pension_percent=6,
                    holiday_days=28,
                    benefits="Private health, £1,000 learning budget",
                    received_on=date.today() - timedelta(days=3),
                    respond_by=date.today() + timedelta(days=4),
                ),
                Offer(
                    application_id=first_app["Wide World Importers"].id,
                    employment_type="contract",
                    currency="GBP",
                    day_rate=600,
                    ir35="outside",
                    contract_months=6,
                    received_on=date.today() - timedelta(days=1),
                    respond_by=date.today() + timedelta(days=9),
                ),
            ]
        )
        # Calls with a recruiter that aren't about one application: one had, one booked.
        first_recruiter = next(iter(recruiters.values()))
        catch_up = Meeting(
            contact_id=first_recruiter.id,
            kind="call",
            title="Market catch-up",
            status="done",
            starts_at=days_ago(6),
            notes="Contract market is picking up. Three roles to look at: **Fabrikam**, "
            "**Proseware** and a fintech startup.",
        )
        s.add(catch_up)
        s.flush()
        # The roles from that call: two still to decide, one passed on.
        startup = Company(name="Northwind Pay", website="https://pay.northwind.example.com")
        s.add(startup)
        s.flush()
        pitched = dict(contact_id=first_recruiter.id, meeting_id=catch_up.id, created_at=days_ago(6))
        s.add_all(
            [
                Role(
                    company_id=companies["Fabrikam"].id,
                    title="Platform Engineer (contract)",
                    employment_type="contract",
                    day_rate=625,
                    ir35="outside",
                    work_mode="remote",
                    **pitched,
                ),
                Role(
                    company_id=startup.id,
                    title="Founding Backend Engineer",
                    salary_min=90_000,
                    salary_max=110_000,
                    **pitched,
                ),
                Role(
                    company_id=companies["Proseware"].id,
                    title="Data Engineer",
                    decision="passed",
                    decision_reason="Mostly BI work, not what I'm after",
                    decided_on=date.today() - timedelta(days=5),
                    **pitched,
                ),
            ]
        )
        s.add_all(
            [
                Meeting(
                    contact_id=first_recruiter.id,
                    kind="call",
                    title="Earlier catch-up",
                    status="done",
                    starts_at=days_ago(30),
                    notes="Introductions; sent over my CV.",
                ),
                Meeting(
                    contact_id=first_recruiter.id,
                    kind="video",
                    title="Roles for the new year",
                    starts_at=days_ago(-1),
                    meeting_url="https://meet.example.com/catch-up",
                    agenda="- Day rates for platform roles\n- Anything fully remote?",
                ),
            ]
        )
        sam, jordan = recruiters["Sam Patel"], recruiters["Jordan Lee"]
        sam_call = Meeting(
            contact_id=sam.id, kind="call", title="Contract roles", status="done", starts_at=days_ago(19)
        )
        jordan_call = Meeting(contact_id=jordan.id, kind="video", title="Intro", status="done", starts_at=days_ago(12))
        s.add_all([sam_call, jordan_call])
        s.flush()
        s.add_all(
            [
                Role(
                    company_id=companies["Adventure Works"].id,
                    title="Contract SRE",
                    employment_type="contract",
                    ir35="inside",
                    decision="passed",
                    decision_reason="Inside IR35, and five days in the office",
                    decided_on=date.today() - timedelta(days=17),
                    contact_id=sam.id,
                    meeting_id=sam_call.id,
                    created_at=days_ago(19),
                ),
                Role(
                    company_id=companies["Tailspin Toys"].id,
                    title="Senior Frontend Engineer",
                    work_mode="hybrid",
                    contact_id=jordan.id,
                    meeting_id=jordan_call.id,
                    created_at=days_ago(12),
                ),
            ]
        )
        # They've replied and it's waiting to be read: on an application, and from a recruiter.
        first_app["Fabrikam"].reply_to_read_since = date.today()
        other_recruiter = [r for r in recruiters.values() if r.id != first_recruiter.id][0]
        other_recruiter.reply_to_read_since = date.today() - timedelta(days=1)
        # Waiting to hear back: one just sent, one past its stage's limit (red: time to chase),
        # and a recruiter taking longer than they usually do.
        by_title["Backend Engineer (Go)"].awaiting_reply_since = date.today() - timedelta(days=2)
        by_title["Full-stack Engineer"].awaiting_reply_since = date.today() - timedelta(days=8)
        first_recruiter.awaiting_reply_since = date.today() - timedelta(days=4)
        recruiters["Jordan Lee"].favourite = True
        # A follow-up that's due, a call whose time has passed (How did it go?), and a round
        # that isn't booked yet, so every section of Today has something in it.
        by_title["Lead Engineer"].follow_up_on = date.today() - timedelta(days=1)
        s.add(
            Meeting(
                contact_id=recruiters["Sam Patel"].id,
                kind="call",
                title="Feedback on the final",
                starts_at=days_ago(1),
            )
        )
        s.add(
            Interview(
                application_id=by_title["Senior Backend Engineer"].id,
                round=4,
                title="Final with the CTO",
                kind="final",
                status="scheduled",
            )
        )
        # To-dos in your own words: about a person, a company, a role, and one about nothing.
        fabrikam_role = s.query(Role).filter_by(title="Platform Engineer (contract)").one()
        s.add_all(
            [
                Todo(text="They messaged me on LinkedIn: reply", entity_type="contact", entity_id=first_recruiter.id),
                Todo(
                    text="See what Northwind Pay actually builds: do I like the product?",
                    entity_type="company",
                    entity_id=startup.id,
                    due_on=date.today(),
                ),
                Todo(
                    text="Ask who's on the platform team",
                    entity_type="role",
                    entity_id=fabrikam_role.id,
                    due_on=date.today() + timedelta(days=2),
                ),
                Todo(text="Update my portfolio site", done_at=days_ago(2)),
                # Alex usually gets back within a couple of working days; Sam takes longer.
                *(
                    Reply(contact_id=recruiters[name].id, waited_since=start, replied_on=start + timedelta(days=gap))
                    for name, start, gap in (
                        ("Alex Morgan", date(2026, 9, 7), 2),
                        ("Alex Morgan", date(2026, 9, 18), 3),
                        ("Alex Morgan", date(2026, 9, 28), 1),
                        ("Sam Patel", date(2026, 9, 8), 6),
                        ("Sam Patel", date(2026, 9, 22), 9),
                    )
                ),
            ]
        )
        # A CV with two versions and a cover letter, recorded against most applications, so
        # Insights can compare them.
        cv = Document(kind="cv", name="Backend CV")
        letter = Document(kind="cover_letter", name="Short cover letter")
        s.add_all([cv, letter])
        s.flush()
        v2 = DocumentVersion(document_id=cv.id, label="v2", created_at=days_ago(60))
        v3 = DocumentVersion(
            document_id=cv.id, label="v3 (impact first)", notes="Leads with results", created_at=days_ago(45)
        )
        plain = DocumentVersion(document_id=letter.id, label="plain", created_at=days_ago(60))
        s.add_all([v2, v3, plain])
        s.flush()
        sent = {
            v2: [
                "Engineering Manager",
                "Data Platform Engineer",
                "Staff Platform Engineer",
                "Senior Full-stack Engineer",
                "Site Reliability Engineer",
            ],
            v3: [
                "Senior Backend Engineer",
                "Senior Python Developer",
                "Senior Software Engineer",
                "Backend Engineer (Go)",
                "Full-stack Engineer",
            ],
            plain: ["Senior Software Engineer", "Staff Platform Engineer", "Site Reliability Engineer"],
        }
        for version, titles in sent.items():
            for title in titles:
                s.add(ApplicationDocument(application_id=by_title[title].id, document_version_id=version.id))
    engine.dispose()
    print(f"Seeded {len(APPLICATIONS)} demo applications in {path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    seed(Path(sys.argv[1]).expanduser().resolve())
