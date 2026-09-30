import os
import subprocess

import pytest


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
