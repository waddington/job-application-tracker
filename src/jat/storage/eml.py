"""Read the headers of an exported email (.eml) so it can go on the timeline (PRD FR13).

Only headers and a short plain-text snippet are read. Nothing in the message is run, fetched
or rendered as HTML.
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


def is_eml(name: str, content_type: str | None) -> bool:
    return name.lower().endswith(".eml") or content_type == "message/rfc822"


def _addresses(msg: EmailMessage, header: str) -> list[str]:
    values = msg.get_all(header, [])
    out = []
    for name, addr in getaddresses([str(v) for v in values]):
        if addr:
            out.append(f"{name} <{addr}>" if name else addr)
    return out


def _text(msg: EmailMessage) -> str:
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return ""
    try:
        content = part.get_content()
    except (LookupError, ValueError):  # unknown charset or broken encoding
        return ""
    if not isinstance(content, str):
        return ""
    if part.get_content_type() == "text/html":
        content = html.unescape(re.sub(r"<[^>]+>", " ", content))
    return " ".join(content.split())


def parse_eml(path: Path) -> dict:
    """Subject, from, to, cc, date (ISO, UTC) and a short snippet. Missing parts are left out."""
    with path.open("rb") as fh:
        msg = BytesParser(policy=policy.default).parse(fh)
    meta: dict = {"email": True}
    if subject := str(msg.get("subject", "") or "").strip():
        meta["subject"] = subject[:300]
    for header in ("from", "to", "cc"):
        if found := _addresses(msg, header):
            meta[header] = found[:20]
    raw_date = msg.get("date")
    if raw_date:
        try:
            when = parsedate_to_datetime(str(raw_date))
        except (TypeError, ValueError):
            when = None
        if when is not None:
            when = when if when.tzinfo else when.replace(tzinfo=UTC)
            meta["date"] = when.astimezone(UTC).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    if snippet := _text(msg):
        meta["snippet"] = snippet[:SNIPPET]
    return meta


def sent_at(meta: dict) -> datetime | None:
    """When the email was sent, if its Date header is believable (not in the future)."""
    raw = meta.get("date")
    if not raw:
        return None
    when = datetime.fromisoformat(raw.replace("Z", "+00:00"))
    return when if when <= datetime.now(UTC) else None
