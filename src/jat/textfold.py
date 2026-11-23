"""Text compared without case or accents, the same way in every search: "José" matches "jose", "Zürich" "zurich".

`fold` is also a SQL function on every connection (db/engine.py), so a filter can fold a column in the query:
`folded_contains(Contact.name, q)`. The browser folds the same way for Latin, Greek and Cyrillic accents
(frontend/src/utils/fold.ts); a few other scripts' marks and Greek's final sigma differ, which only matters where
the same text is folded on both sides, and nothing here does that.
"""

from __future__ import annotations

import unicodedata

from sqlalchemy import ColumnElement, func


def fold(text: str) -> str:
    """Lower case without accents: "Zürich" matches "zurich"."""
    return "".join(c for c in unicodedata.normalize("NFKD", text.casefold()) if not unicodedata.combining(c))


def sql_fold(text: str | None) -> str | None:
    """`fold` for SQLite, which hands over NULL as None."""
    return None if text is None else fold(text)


def folded_contains(column, query: str) -> ColumnElement[bool]:
    """The column, folded, contains the query, trimmed and folded (LIKE's wildcards in it match themselves)."""
    return func.fold(column).contains(fold(query.strip()), autoescape=True)
