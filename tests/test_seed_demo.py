"""scripts/seed_demo.py: the Chinese demo has the English one's shape, and the English one stays as the browser tests
and docs know it."""

import re
import sqlite3
import subprocess
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from jat.app import create_app

REPO = Path(__file__).resolve().parents[1]


def seed(folder: Path, *lang: str) -> Path:
    subprocess.run(
        [sys.executable, "scripts/seed_demo.py", *lang, str(folder)], cwd=REPO, check=True, capture_output=True
    )
    return folder


@pytest.fixture(scope="module")
def demos(tmp_path_factory):
    root = tmp_path_factory.mktemp("demo")
    return seed(root / "en"), seed(root / "zh", "--lang", "zh-CN")


def rows(folder: Path, sql: str) -> list:
    with sqlite3.connect(folder / "tracker.sqlite3") as con:
        return con.execute(sql).fetchall()


def names(folder: Path, sql: str) -> list[str]:
    return [r[0] for r in rows(folder, sql)]


def tables(folder: Path) -> list[str]:
    return names(folder, "select name from sqlite_master where type='table' and name != 'alembic_version' order by 1")


def test_the_english_demo_has_what_the_browser_tests_rely_on(demos):
    en, _ = demos
    assert names(en, "select name from companies order by rowid") == [
        "Contoso",
        "Fabrikam",
        "Tailspin Toys",
        "Wide World Importers",
        "Adventure Works",
        "Litware",
        "Proseware",
        "Northwind Traders",
        "Coho Winery",
        "Alpine Ski House",
        "Northwind Pay",
    ]
    assert names(en, "select name from agencies order by rowid") == ["Northwind Talent", "Blue Yonder Recruitment"]
    assert names(en, "select name from contacts order by rowid") == ["Alex Morgan", "Sam Patel", "Jordan Lee"]
    assert names(en, "select value from contact_details where kind = 'email' order by rowid") == [
        "alex.morgan@northwind.example.com",
        "sam.patel@blue.example.com",
        "jordan.lee@northwind.example.com",
    ]
    assert names(en, "select name from documents order by rowid") == ["Backend CV", "Short cover letter", "Portfolio"]
    assert names(en, "select label from document_versions order by rowid") == ["v2", "v3 (impact first)", "plain"]
    assert names(en, "select title from roles order by rowid")[:3] == [
        "Senior Backend Engineer",
        "Staff Platform Engineer",
        "Engineering Manager",
    ]
    assert rows(en, "select currency, salary, day_rate from offers order by rowid") == [
        ("GBP", 95_000, None),
        ("GBP", None, 600),
        ("GBP", 88_000, None),
        ("GBP", 105_000, None),
    ]
    assert rows(en, "select stage, count(*) from applications group by stage order by 1") == [
        ("applied", 4),
        ("ghosted", 1),
        ("interested", 1),
        ("interviewing", 1),
        ("offer", 2),
        ("rejected", 1),
        ("withdrawn", 1),
    ]


def test_the_chinese_demo_has_the_english_ones_shape(demos):
    en, zh = demos
    assert tables(zh) == tables(en)
    for table in tables(en):
        assert rows(zh, f"select count(*) from '{table}'") == rows(en, f"select count(*) from '{table}'"), table
    for sql in [
        "select stage, count(*) from applications group by stage",
        "select status, count(*) from offers group by status",
        "select kind, status, count(*) from interviews group by kind, status",
    ]:
        assert sorted(rows(zh, sql)) == sorted(rows(en, sql)), sql
    assert rows(zh, "select version_num from alembic_version") == rows(en, "select version_num from alembic_version")


def test_the_chinese_demo_opens_in_the_app(demos, tmp_path):
    _, zh = demos
    client = TestClient(base_url="http://127.0.0.1", app=create_app(zh, dist=tmp_path / "no-dist"))
    companies = client.get("/api/v1/companies").json()
    assert "青梧支付" in [c["name"] for c in companies]
    assert len(client.get("/api/v1/applications").json()) == 11


def test_the_chinese_demo_names_are_chinese_and_addresses_made_up(demos):
    _, zh = demos
    people = names(
        zh, "select name from companies union all select name from agencies union all select name from contacts"
    )
    assert people and not [n for n in people if n.isascii()]
    assert not [n for n in names(zh, "select title from roles") if n.isascii()]
    assert set(names(zh, "select currency from offers")) == {"CNY"}
    texts = [
        str(v)
        for table in tables(zh)
        for row in rows(zh, f"select * from '{table}'")
        for v in row
        if isinstance(v, str)
    ]
    texts += [p.read_text(encoding="utf-8") for p in (zh / "notes").rglob("*.md")]
    hosts = {h for t in texts for h in re.findall(r"https?://([^/\s\"')]+)", t)}
    hosts |= {h for t in texts for h in re.findall(r"[\w.]+@([\w.-]+)", t)}
    assert hosts and {h for h in hosts if h != "example.com" and not h.endswith(".example.com")} == set()


def test_demo_phone_numbers_cant_ring_anyone(demos):
    # English: Ofcom's range kept for drama (07700 900xxx). Chinese has none, so a 000 that no
    # number starts with; a real-looking 138 would be a China Mobile number.
    en, zh = demos
    sql = "select value from contact_details where kind = 'phone'"
    assert names(en, sql) and all(re.fullmatch(r"\+44 7700 900\d{3}", p) for p in names(en, sql))
    assert names(zh, sql) and all(re.fullmatch(r"\+86 000 0000 \d{4}", p) for p in names(zh, sql))


def test_demo_contact_detail_labels_are_in_the_demos_language(demos):
    # Labels are free text, so the demo writes them; English keeps work and mobile (the browser tests use them).
    en, zh = demos
    sql = "select kind, label from contact_details order by rowid"
    assert set(rows(en, sql)) == {("email", "work"), ("phone", "mobile")}
    assert set(rows(zh, sql)) == {("email", "工作"), ("phone", "手机")}


def test_every_language_has_the_same_demo_keys():
    # A key missing from one table would only fail when that language is seeded. The lookups by
    # id must match too; a record's own fields may differ (Chinese has no IR35 or pension).
    sys.path.insert(0, str(REPO / "scripts"))
    from demo_content import CONTENT

    english = CONTENT["en"]
    lookups = ("companies", "agencies", "recruiters", "apps", "rounds", "files")
    for lang, table in CONTENT.items():
        assert set(table) == set(english), lang
        for key in lookups:
            assert set(table[key]) == set(english[key]), f"{lang}: {key}"
