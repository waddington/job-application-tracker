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
from jat.db.models import Agency, Company, Contact, ContactDetail, Interview, Role
from jat.domain.applications import create_application, history, log_activity, move
from jat.domain.workflow import DEFAULT_WORKFLOW as W

NOW = datetime.now(UTC).replace(microsecond=0)


def days_ago(n: float) -> datetime:
    return NOW - timedelta(days=n)


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
        [("applied", 15), ("screen", 11), ("interviewing", 6), ("final", 2)],
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
    engine.dispose()
    print(f"Seeded {len(APPLICATIONS)} demo applications in {path}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    seed(Path(sys.argv[1]).expanduser().resolve())
