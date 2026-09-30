import os
import subprocess

import pytest
from fastapi.testclient import TestClient

from jat.app import create_app
from jat.datadir import init_data_dir
from jat.db import db_path, migrate

from .factories import post


@pytest.fixture
def app(tmp_path):
    path = tmp_path / "data"
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    return create_app(path, dist=tmp_path / "no-dist")


@pytest.fixture
def client(app):
    return TestClient(base_url="http://127.0.0.1", app=app)


@pytest.fixture
def seeded(client):
    """A company, agency, recruiter and role created through the API."""
    company = post(client, "/api/v1/companies", {"name": "Contoso", "website": "https://contoso.example.com"})
    agency = post(client, "/api/v1/agencies", {"name": "Northwind Talent"})
    recruiter = post(
        client,
        "/api/v1/contacts",
        {
            "name": "Alex Recruiter",
            "agency_id": agency["id"],
            "details": [
                {"kind": "email", "value": "alex@northwind.example.com", "label": "work"},
                {"kind": "phone", "value": "+44 7700 900000", "label": "mobile"},
            ],
        },
    )
    role = post(
        client,
        "/api/v1/roles",
        {
            "company_id": company["id"],
            "title": "Senior Backend Engineer",
            "work_mode": "hybrid",
            "day_rate": 650,
            "employment_type": "contract",
            "ir35": "outside",
            "currency": "GBP",
        },
    )
    return {"company": company, "agency": agency, "recruiter": recruiter, "role": role}


@pytest.fixture
def git_env(monkeypatch):
    """Deterministic git identity for tests that create commits."""
    for key, value in {
        "GIT_AUTHOR_NAME": "Test",
        "GIT_AUTHOR_EMAIL": "test@example.com",
        "GIT_COMMITTER_NAME": "Test",
        "GIT_COMMITTER_EMAIL": "test@example.com",
        "GIT_CONFIG_GLOBAL": os.devnull,
        "GIT_CONFIG_NOSYSTEM": "1",
    }.items():
        monkeypatch.setenv(key, value)


@pytest.fixture
def git_repo(tmp_path, git_env):
    repo = tmp_path / "data"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    return repo
