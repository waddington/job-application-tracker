import sys

import pytest
from fastapi.testclient import TestClient

from jat.app import create_app
from jat.datadir import init_data_dir
from jat.db import db_path, head_revision, migrate
from jat.openapi import build_schema


@pytest.fixture
def data_dir(tmp_path):
    path = tmp_path / "data"
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    return path


@pytest.fixture
def dist(tmp_path):
    d = tmp_path / "dist"
    (d / "assets").mkdir(parents=True)
    (d / "index.html").write_text("<!doctype html><div id=root>SPA</div>")
    (d / "assets" / "app.js").write_text("console.log('hi')")
    (d / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("outside dist")
    return d


def test_health(data_dir, dist):
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))
    body = client.get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert body["schema"] == body["schema_head"] == head_revision()
    assert body["git_repo"] is False
    assert body["snapshots_enabled"] is False
    assert body["windows"] is (sys.platform == "win32")


def test_health_schema_publishes_the_alias():
    props = build_schema()["components"]["schemas"]["HealthOut"]["properties"]
    assert "schema" in props and "schema_" not in props


def test_spa_routes_and_assets(data_dir, dist):
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))
    for path in ("/", "/applications", "/recruiters/123"):
        r = client.get(path)
        assert r.status_code == 200 and "SPA" in r.text
        assert "text/html" in r.headers["content-type"]
    r_js = client.get("/assets/app.js")
    assert r_js.text == "console.log('hi')"
    assert "text/javascript" in r_js.headers["content-type"]
    r_svg = client.get("/favicon.svg")
    assert r_svg.text == "<svg/>"
    assert "image/svg+xml" in r_svg.headers["content-type"]


def test_static_file_types_override_system_registry(data_dir, dist, monkeypatch):
    """Windows' registry often maps .js to text/plain, and the page then loads blank. Fake that system guess where
    Starlette makes it, and check the app's own files still get their fixed types."""
    monkeypatch.setattr("starlette.responses.guess_type", lambda *args, **kwargs: ("text/plain", None))
    (dist / "assets" / "module.mjs").write_text("export const x = 1;")
    (dist / "assets" / "style.css").write_text("body { color: red; }")
    (dist / "assets" / "font.woff2").write_bytes(b"woff2")
    (dist / "site.webmanifest").write_text('{"name": "JAT"}')
    (dist / "data.json").write_text('{"key": "value"}')
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))

    def served(path: str, method: str = "GET") -> str:
        return client.request(method, path).headers["content-type"]

    assert served("/assets/app.js") == "text/javascript; charset=utf-8"
    assert served("/assets/app.js", "HEAD") == "text/javascript; charset=utf-8"
    assert served("/assets/module.mjs") == "text/javascript; charset=utf-8"
    assert served("/assets/style.css") == "text/css; charset=utf-8"
    assert served("/assets/font.woff2") == "font/woff2"
    assert served("/favicon.svg") == "image/svg+xml"
    assert served("/site.webmanifest") == "application/manifest+json"
    assert served("/data.json") == "application/json"
    assert served("/") == "text/html; charset=utf-8"


def test_static_files_still_answer_not_modified(data_dir, dist):
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))
    etag = client.get("/assets/app.js").headers["etag"]
    assert client.get("/assets/app.js", headers={"if-none-match": etag}).status_code == 304


def test_part_of_a_static_file_keeps_its_type(data_dir, dist, monkeypatch):
    monkeypatch.setattr("starlette.responses.guess_type", lambda *args, **kwargs: ("text/plain", None))
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))
    r = client.get("/assets/app.js", headers={"range": "bytes=0-6"})
    assert (r.status_code, r.text, r.headers["content-type"]) == (206, "console", "text/javascript; charset=utf-8")


def test_api_paths_never_fall_through_to_spa(data_dir, dist):
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))
    for path in ("/api/v1/nope", "/api", "/api/"):
        r = client.get(path)
        assert r.status_code == 404
        assert "SPA" not in r.text


def test_no_path_traversal(data_dir, dist):
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))
    for path in ("/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt"):
        assert "outside dist" not in client.get(path).text


def test_unbuilt_frontend_message(data_dir, tmp_path):
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=tmp_path / "missing"))
    r = client.get("/")
    assert r.status_code == 200 and "isn't built yet" in r.text


def test_openapi_available(data_dir, dist):
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))
    assert "/api/v1/health" in client.get("/api/openapi.json").json()["paths"]


def test_api_docs_load_nothing_from_the_web(data_dir, dist):
    (dist / "api-docs").mkdir()
    (dist / "api-docs" / "swagger-ui-bundle.js").write_text("// swagger")
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_dir, dist=dist))
    page = client.get("/api/docs")
    assert page.status_code == 200 and "/api/openapi.json" in page.text
    assert "http" not in page.text  # no CDN, no external favicon: every URL is on this app
    assert client.get("/api-docs/swagger-ui-bundle.js").text == "// swagger"


def test_requires_initialised_data_dir(tmp_path):
    with pytest.raises(RuntimeError, match="jat init"):
        create_app(tmp_path / "empty")
