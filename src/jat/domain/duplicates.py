"""Spot a second application for the same job (PRD FR5).

Two applications look like the same job when they are at the same company and the role titles
are the same or close: "Senior Backend Engineer" and "Backend Engineer (Senior)", or
"Python Developer" and "Senior Python Engineer". Different jobs at one company
("Frontend Engineer" and "Backend Engineer") don't match. This only ever warns; it never blocks.
"""

import re
from difflib import SequenceMatcher
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from jat.db.models import Company

Match = Literal["same_role", "similar_title"]

# Trailing words that don't change which company it is ("Tailspin & Co" is Tailspin).
_COMPANY_SUFFIXES = {
    "ltd",
    "limited",
    "inc",
    "incorporated",
    "plc",
    "llc",
    "llp",
    "gmbh",
    "corp",
    "corporation",
    "co",
    "and",
}
# Words that say the same thing in job titles.
_SYNONYMS = {
    "sr": "senior",
    "snr": "senior",
    "jr": "junior",
    "jnr": "junior",
    "eng": "engineer",
    "dev": "engineer",
    "developer": "engineer",
    "mgr": "manager",
    "swe": "software engineer",
}
_FILLER = {"a", "an", "and", "the", "of", "for", "to", "in", "at", "with", "m", "f", "d"}
# Seniority: one title having a level the other lacks is fine; two different levels are different jobs.
_LEVELS = {"junior", "graduate", "intern", "associate", "mid", "senior", "staff", "principal", "lead"}
_LEVELS |= {"i", "ii", "iii", "iv", "1", "2", "3", "4"}
# Words that qualify a job without changing what it is.
_QUALIFIERS = _LEVELS | {"remote", "hybrid", "onsite", "contract", "contractor", "permanent", "perm", "fte"}


def _words(text: str) -> list[str]:
    return re.findall(r"[a-z0-9+#]+", text.casefold().replace("&", " and "))


def normalize_company(name: str) -> str:
    """Compare company names loosely: "Contoso Ltd." and "contoso" are the same company."""
    words = _words(name)
    if words and words[0] == "the":
        words = words[1:]
    while len(words) > 1 and words[-1] in _COMPANY_SUFFIXES:
        words = words[:-1]
    return " ".join(words)


def _title_words(title: str) -> list[str]:
    out: list[str] = []
    for word in _words(title):
        out.extend(_SYNONYMS.get(word, word).split())
    return [w for w in out if w not in _FILLER]


def title_match(a: str, b: str) -> Match | None:
    """How close two role titles are: the same role, a similar title, or not a match."""
    wa, wb = _title_words(a), _title_words(b)
    if not wa or not wb:
        return None
    if sorted(wa) == sorted(wb):
        return "same_role"
    levels_a, levels_b = set(wa) & _LEVELS, set(wb) & _LEVELS
    if levels_a and levels_b and levels_a != levels_b:
        return None  # "Junior Backend Engineer" isn't "Senior Backend Engineer"
    core_a = [w for w in wa if w not in _QUALIFIERS]
    core_b = [w for w in wb if w not in _QUALIFIERS]
    if not core_a or not core_b:
        return None
    # The same job with a qualifier added or dropped ("Senior", "Remote", "Contract"…).
    if sorted(core_a) == sorted(core_b):
        return "similar_title"
    # Typos: "Platfrom Engineer". Not extra words: "Frontend Engineer" vs "Frontend Engineering Manager".
    if len(core_a) == len(core_b) and SequenceMatcher(None, " ".join(core_a), " ".join(core_b)).ratio() >= 0.9:
        return "similar_title"
    return None


def company_ids_named(session: Session, name: str) -> list[str]:
    """Ids of every company whose name matches `name` once suffixes and punctuation are ignored."""
    wanted = normalize_company(name)
    if not wanted:
        return []
    return [c.id for c in session.scalars(select(Company)) if normalize_company(c.name) == wanted]
