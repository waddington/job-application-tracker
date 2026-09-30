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

_COMPANY_SUFFIXES = {"ltd", "limited", "inc", "incorporated", "plc", "llc", "llp", "gmbh", "corp", "corporation", "co"}
# Words that say the same thing in job titles.
_SYNONYMS = {
    "sr": "senior",
    "snr": "senior",
    "jr": "junior",
    "jnr": "junior",
    "eng": "engineer",
    "engineering": "engineer",
    "dev": "engineer",
    "developer": "engineer",
    "mgr": "manager",
    "swe": "software engineer",
}
_FILLER = {"a", "an", "and", "the", "of", "for", "to", "in", "at", "with", "m", "f", "d"}


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
    small, big = sorted((set(wa), set(wb)), key=len)
    # One title is the other plus a qualifier ("Senior", "Remote", "Contract"…).
    if small <= big and len(small) >= 1 and len(big) - len(small) <= 2:
        return "similar_title"
    # Typos and small rewordings.
    if SequenceMatcher(None, " ".join(wa), " ".join(wb)).ratio() >= 0.9:
        return "similar_title"
    return None


def company_ids_named(session: Session, name: str) -> list[str]:
    """Ids of every company whose name matches `name` once suffixes and punctuation are ignored."""
    wanted = normalize_company(name)
    if not wanted:
        return []
    return [c.id for c in session.scalars(select(Company)) if normalize_company(c.name) == wanted]
