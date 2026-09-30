"""A small standard-library HTTP server for the PM dashboard. Binds to localhost only."""

from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from . import render
from .live import Collector
from .roadmap import apply_live, load


class Dashboard:
    def __init__(self, root: Path, ttl: float = 30):
        self.root = root
        self.roadmap_path = root / "docs" / "ROADMAP.yaml"
        repo = load(self.roadmap_path).repo
        self.collector = Collector(root, repo, ttl=ttl)

    def state(self, refresh: bool = False):
        # The roadmap file is re-read on every request so edits show up immediately.
        roadmap = load(self.roadmap_path)
        snapshot = self.collector.get(force=refresh)
        return apply_live(roadmap, snapshot.live), snapshot

    def handle(self, path: str, query: dict[str, list[str]]) -> tuple[int, str, str]:
        refresh = query.get("refresh", ["0"])[0] == "1"
        roadmap, snapshot = self.state(refresh)
        if path == "/":
            return 200, "text/html", render.page("Overview", "/", render.overview(roadmap, snapshot), roadmap, snapshot)
        if path == "/board":
            phase = query.get("phase", [None])[0]
            body = render.board(roadmap, snapshot, phase)
            return 200, "text/html", render.page("Board", "/board", body, roadmap, snapshot)
        if path == "/roadmap":
            body = render.roadmap_page(roadmap, snapshot)
            return 200, "text/html", render.page("Roadmap", "/roadmap", body, roadmap, snapshot)
        if path == "/api/roadmap.json":
            return 200, "application/json", json.dumps(render.as_json(roadmap, snapshot), indent=2)
        return 404, "text/plain", "not found"


def make_handler(dashboard: Dashboard):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            url = urlparse(self.path)
            try:
                status, ctype, body = dashboard.handle(url.path, parse_qs(url.query))
            except Exception as exc:  # keep the server up; show the error
                status, ctype, body = 500, "text/plain", f"error: {exc}"
            data = body.encode()
            self.send_response(status)
            self.send_header("Content-Type", f"{ctype}; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, fmt, *args):  # quieter than the default
            pass

    return Handler


def serve(root: Path, host: str = "127.0.0.1", port: int = 8767, ttl: float = 30) -> None:
    dashboard = Dashboard(root, ttl=ttl)
    server = ThreadingHTTPServer((host, port), make_handler(dashboard))
    print(f"PM dashboard: http://{host}:{port}  (roadmap: {dashboard.roadmap_path})")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
