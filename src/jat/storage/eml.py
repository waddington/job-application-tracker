"""Read the headers of an exported email (.eml) so it can go on the timeline (PRD FR13).

Only headers and a short plain-text snippet are read, from the start of the file. Nothing in
the message is run, fetched or rendered as HTML.
"""

from __future__ import annotations

import html
import re
from datetime import UTC, datetime
from email import policy
from email.message import EmailMessage
from email.parser import BytesParser
from email.utils import getaddresses, parsedate_to_datetime
from pathlib import Path

SNIPPET = 300
READ_BYTES = 1024 * 1024  # headers and the first text part; attachments further in are skipped
_MAX_ADDRESS = 200
_EARLIEST = datetime(1995, 1, 1, tzinfo=UTC)


def is_eml(name: str, content_type: str | None) -> bool:
    return name.lower().endswith(".eml") or content_type == "message/rfc822"


def _clean(text: str) -> str:
    """One line of text: encoded words can decode to newlines or control characters."""
    return " ".join("".join(c if c.isprintable() else " " for c in text).split())


def _addresses(msg: EmailMessage, header: str) -> list[str]:
    try:
        values = [str(v) for v in msg.get_all(header, [])]
        pairs = getaddresses(values)
    except Exception:  # a malformed header shouldn't cost the others
        return []
    out = []
    for name, addr in pairs:
        if addr:
            entry = _clean(f"{name} <{addr}>" if name else addr)
            out.append(entry[:_MAX_ADDRESS])
    return out[:20]


def _text(msg: EmailMessage) -> str:
    try:
        part = msg.get_body(preferencelist=("plain", "html"))
        if part is None:
            return ""
        content = part.get_content()
    except Exception:  # unknown charset, broken encoding, truncated part
        return ""
    if not isinstance(content, str):
        return ""
    if part.get_content_type() == "text/html":
        content = re.sub(r"(?is)<(script|style|head)\b.*?</\1\s*>", " ", content)
        content = html.unescape(re.sub(r"<[^>]+>", " ", content))
    return _clean(content)


def _date(msg: EmailMessage) -> str | None:
    try:
        raw = msg.get("date")
        when = parsedate_to_datetime(str(raw)) if raw else None
    except Exception:
        return None
    if when is None:
        return None
    when = when if when.tzinfo else when.replace(tzinfo=UTC)
    return when.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def parse_eml(path: Path) -> dict:
    """Subject, from, to, cc, date (ISO, UTC) and a short snippet. Missing parts are left out."""
    with path.open("rb") as fh:
        head = fh.read(READ_BYTES)
    msg = BytesParser(policy=policy.default).parsebytes(head)
    meta: dict = {"email": True}
    try:
        subject = _clean(str(msg.get("subject", "") or ""))
    except Exception:
        subject = ""
    if subject:
        meta["subject"] = subject[:300]
    for header in ("from", "to", "cc"):
        if found := _addresses(msg, header):
            meta[header] = found
    if date := _date(msg):
        meta["date"] = date
    if snippet := _text(msg):
        meta["snippet"] = snippet[:SNIPPET]
    return meta


def sent_at(meta: dict) -> datetime | None:
    """When the email was sent, if its Date header is believable (not in the future or 1970)."""
    raw = meta.get("date")
    if not raw:
        return None
    when = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return when if _EARLIEST <= when <= datetime.now(UTC) else None
