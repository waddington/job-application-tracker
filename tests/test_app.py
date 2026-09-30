import pytest
from fastapi.testclient import TestClient

from jat.app import create_app
from jat.datadir import init_data_dir
from jat.db import db_path, head_revision, migrate


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
    client = TestClient(create_app(data_dir, dist=dist))
    body = client.get("/api/v1/health").json()
    assert body["status"] == "ok"
    assert body["schema"] == body["schema_head"] == head_revision()
    assert body["git_repo"] is False


def test_spa_routes_and_assets(data_dir, dist):
    client = TestClient(create_app(data_dir, dist=dist))
    for path in ("/", "/applications", "/recruiters/123"):
        r = client.get(path)
        assert r.status_code == 200 and "SPA" in r.text
    assert client.get("/assets/app.js").text == "console.log('hi')"
    assert client.get("/favicon.svg").text == "<svg/>"


def test_api_paths_never_fall_through_to_spa(data_dir, dist):
    client = TestClient(create_app(data_dir, dist=dist))
    for path in ("/api/v1/nope", "/api", "/api/"):
        r = client.get(path)
        assert r.status_code == 404
        assert "SPA" not in r.text


def test_no_path_traversal(data_dir, dist):
    client = TestClient(create_app(data_dir, dist=dist))
    for path in ("/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt"):
        assert "outside dist" not in client.get(path).text


def test_unbuilt_frontend_message(data_dir, tmp_path):
    client = TestClient(create_app(data_dir, dist=tmp_path / "missing"))
    r = client.get("/")
    assert r.status_code == 200 and "isn't built yet" in r.text


def test_openapi_available(data_dir, dist):
    client = TestClient(create_app(data_dir, dist=dist))
    assert "/api/v1/health" in client.get("/api/openapi.json").json()["paths"]


def test_requires_initialised_data_dir(tmp_path):
    with pytest.raises(RuntimeError, match="jat init"):
        create_app(tmp_path / "empty")
