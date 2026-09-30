"""Column types that store portable, deterministic text (so JSONL exports diff cleanly)."""

from __future__ import annotations

from datetime import UTC, date, datetime

import uuid_utils
from sqlalchemy import String
from sqlalchemy.types import TypeDecorator


def new_id() -> str:
    """Time-ordered UUIDv7 as a string."""
    return str(uuid_utils.uuid7())


def utcnow() -> datetime:
    return datetime.now(UTC).replace(microsecond=0)


class UTCDateTime(TypeDecorator):
    """Timezone-aware datetime stored as ISO 8601 UTC text at whole-second precision,
    e.g. 2026-09-30T14:05:00Z. One fixed width keeps text ordering equal to time ordering."""

    impl = String(32)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            value = parse_datetime(value)
        if value.tzinfo is None:
            raise ValueError("naive datetimes are not allowed; use timezone-aware UTC")
        return value.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    def process_result_value(self, value, dialect):
        return None if value is None else parse_datetime(value)


class ISODate(TypeDecorator):
    """A calendar date stored as YYYY-MM-DD text."""

    impl = String(10)
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            value = date.fromisoformat(value)
        if isinstance(value, datetime):  # a datetime is a date subclass; don't store a timestamp
            raise ValueError("expected a date, got a datetime")
        return value.isoformat()

    def process_result_value(self, value, dialect):
        return None if value is None else date.fromisoformat(value)


def parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError(f"datetime without timezone: {value!r}")
    return parsed.astimezone(UTC)
