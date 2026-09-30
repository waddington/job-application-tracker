"""Keep other websites out of a localhost app.

The tracker listens on 127.0.0.1, but any page open in the same browser can still send it
requests. Two defences, for every route:

- **Host check (DNS rebinding):** requests must be addressed to a loopback name
  (`127.0.0.1`, `localhost`, `[::1]`), or to the host the server was explicitly bound to.
  If you bind to all interfaces (`0.0.0.0`), you've chosen to expose it and this is skipped.
- **Cross-site writes (CSRF):** a POST/PUT/PATCH/DELETE from a browser page on another origin
  is refused. Browsers mark those with `Origin` and `Sec-Fetch-Site`; scripts and the CLI
  (curl, httpie) send neither and are let through.

It also refuses uploads bigger than the attachment limit before they're read, since the
multipart parser would otherwise spool the whole body to disk first.
"""

from __future__ import annotations

import json
from collections.abc import Iterable
from urllib.parse import urlsplit

from starlette.types import ASGIApp, Receive, Scope, Send

LOOPBACK = {"127.0.0.1", "localhost", "::1"}
UNSAFE = {"POST", "PUT", "PATCH", "DELETE"}
UPLOAD_PATH = "/api/v1/attachments"


def _host_name(value: str) -> str:
    """'127.0.0.1:8770' → '127.0.0.1', '[::1]:8770' → '::1'."""
    value = value.strip().lower()
    if value.startswith("["):
        return value[1:].split("]", 1)[0]
    return value.rsplit(":", 1)[0] if value.count(":") == 1 else value


class LocalOnly:
    def __init__(
        self,
        app: ASGIApp,
        *,
        bind_host: str | None = None,
        extra_origins: Iterable[str] = (),
        max_upload_bytes: int | None = None,
    ) -> None:
        self.app = app
        self.check_host = bind_host not in ("0.0.0.0", "::")
        self.hosts = LOOPBACK | ({bind_host.lower()} if bind_host else set())
        self.extra_origins = {o.rstrip("/").lower() for o in extra_origins}
        self.max_upload_bytes = max_upload_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        headers = {k.decode("latin-1"): v.decode("latin-1") for k, v in scope["headers"]}
        host = headers.get("host", "")
        if self.check_host and _host_name(host) not in self.hosts:
            return await _reject(send, 400, "This app only answers on localhost.")
        if scope["method"] in UNSAFE:
            origin = headers.get("origin")
            if origin and origin != "null":
                same = urlsplit(origin).netloc.lower() == host.lower()
                if not same and origin.rstrip("/").lower() not in self.extra_origins:
                    return await _reject(send, 403, "Cross-site requests aren't allowed.")
            elif origin == "null" or headers.get("sec-fetch-site") == "cross-site":
                return await _reject(send, 403, "Cross-site requests aren't allowed.")
            if self.max_upload_bytes and scope["path"] == UPLOAD_PATH:
                length = headers.get("content-length")
                if length and length.isdigit() and int(length) > self.max_upload_bytes + 64 * 1024:
                    mb = self.max_upload_bytes // (1024 * 1024)
                    return await _reject(send, 413, f"files can be up to {mb} MB")
        return await self.app(scope, receive, send)


async def _reject(send: Send, status: int, detail: str) -> None:
    body = json.dumps({"detail": detail}).encode()
    await send(
        {
            "type": "http.response.start",
            "status": status,
            "headers": [(b"content-type", b"application/json"), (b"content-length", str(len(body)).encode())],
        }
    )
    await send({"type": "http.response.body", "body": body})
