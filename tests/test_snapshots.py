import subprocess
import time

import pytest
from fastapi.testclient import TestClient

from jat.app import create_app
from jat.cli import main
from jat.datadir import init_data_dir
from jat.db import db_path, make_engine, migrate
from jat.snapshot.git import SnapshotError, SnapshotService, debounce_from_config


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout


@pytest.fixture
def data_repo(git_repo):
    (git_repo / "README.md").write_text("private notes\n")  # a user file the app must never stage
    init_data_dir(git_repo)
    migrate(db_path(git_repo))
    return git_repo


@pytest.fixture
def remote(tmp_path, data_repo):
    bare = tmp_path / "remote.git"
    subprocess.run(["git", "init", "-q", "--bare", "-b", "main", str(bare)], check=True)
    git(data_repo, "remote", "add", "origin", str(bare))
    return bare


def commits(repo):
    return git(repo, "log", "--format=%s").splitlines()


def test_snapshot_commits_only_tracked_paths(data_repo):
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0)
    sha = service.snapshot_now()
    assert sha and commits(data_repo)[0].startswith("snapshot:")
    tracked = git(data_repo, "ls-files")
    assert "export/_meta.json" in tracked and "export/applications.jsonl" in tracked
    assert "README.md" not in tracked and "tracker.sqlite3" not in tracked
    assert service.snapshot_now() is None  # nothing changed
    assert service.status().last_commit == sha


def test_writes_trigger_debounced_snapshot(data_repo):
    app = create_app(data_repo, dist=data_repo / "none", snapshot_debounce=0.3)
    client = TestClient(app)
    before = len(commits(data_repo))
    client.post("/api/v1/companies", json={"name": "Contoso"})
    client.post("/api/v1/companies", json={"name": "Fabrikam"})
    assert app.state.snapshots.status().dirty
    deadline = time.time() + 5
    while len(commits(data_repo)) == before and time.time() < deadline:
        time.sleep(0.05)
    assert len(commits(data_repo)) == before + 1  # both writes in one snapshot
    assert "Fabrikam" in (data_repo / "export" / "companies.jsonl").read_text()
    assert not app.state.snapshots.status().dirty


def test_shutdown_flushes_pending_snapshot(data_repo):
    app = create_app(data_repo, dist=data_repo / "none", snapshot_debounce=3600)
    with TestClient(app) as client:
        client.post("/api/v1/companies", json={"name": "Contoso"})
        before = len(commits(data_repo))
    assert len(commits(data_repo)) == before + 1


def test_backup_api_and_push(data_repo, remote):
    app = create_app(data_repo, dist=data_repo / "none", snapshot_debounce=3600)
    client = TestClient(app)
    client.post("/api/v1/companies", json={"name": "Contoso"})
    status = client.get("/api/v1/backup").json()
    assert status["enabled"] and status["dirty"] and status["has_remote"]
    result = client.post("/api/v1/backup/push").json()
    assert result["status"]["unpushed_commits"] == 0 and not result["status"]["dirty"]
    assert "snapshot:" in git(remote, "log", "--format=%s", "main")


def test_push_without_remote_is_a_clear_error(data_repo):
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0)
    with pytest.raises(SnapshotError, match="no remote"):
        service.push()


def test_disabled_when_not_a_git_repo(tmp_path):
    path = tmp_path / "plain"
    init_data_dir(path, commit=False)
    migrate(db_path(path))
    app = create_app(path, dist=path / "none", snapshot_debounce=0)
    client = TestClient(app)
    client.post("/api/v1/companies", json={"name": "Contoso"})
    assert client.get("/api/v1/backup").json()["enabled"] is False
    assert client.post("/api/v1/backup/snapshot").status_code == 409


def test_cli_snapshot_and_push(data_repo, remote, capsys):
    assert main(["--data-dir", str(data_repo), "snapshot"]) == 0
    assert main(["--data-dir", str(data_repo), "push"]) == 0
    assert git(remote, "log", "--format=%s", "main")


def service_for(repo):
    return SnapshotService(repo, make_engine(db_path(repo)), debounce_seconds=0)


def test_folder_git_doesnt_know_about_doesnt_break_snapshots(data_repo):
    # files/ exists but holds only an untracked ignored file and no .gitkeep in git
    git(data_repo, "rm", "-q", "--cached", "files/.gitkeep")
    git(data_repo, "commit", "-q", "-m", "untrack gitkeep")
    (data_repo / "files" / ".gitkeep").unlink()
    (data_repo / "files" / "scratch.tmp").write_text("ignored")
    assert service_for(data_repo).snapshot_now()


def test_users_other_staged_changes_stay_staged(data_repo):
    (data_repo / "README.md").write_text("changed\n")
    git(data_repo, "add", "README.md")
    service_for(data_repo).snapshot_now()
    assert "README.md" in git(data_repo, "diff", "--cached", "--name-only")
    assert "README.md" not in git(data_repo, "show", "--name-only", "--format=", "HEAD")


def test_refuses_detached_head(data_repo):
    service_for(data_repo).snapshot_now()
    git(data_repo, "checkout", "-q", "--detach")
    with pytest.raises(SnapshotError, match="detached HEAD"):
        service_for(data_repo).snapshot_now()


def test_close_stops_scheduling(data_repo):
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0.05)
    service.close()
    service.mark_dirty()
    time.sleep(0.2)
    assert service._timer is None
    with pytest.raises(SnapshotError, match="shut down"):
        service.snapshot_now()


def test_git_never_prompts_and_timeouts_are_clean(data_repo, monkeypatch):
    from jat.snapshot import git as gitmod

    seen = {}

    def fake_run(*args, **kwargs):
        seen.update(kwargs)
        raise gitmod.subprocess.TimeoutExpired(cmd="git", timeout=1)

    monkeypatch.setattr(gitmod.subprocess, "run", fake_run)
    with pytest.raises(SnapshotError, match="timed out"):
        gitmod._git(data_repo, "push")
    assert seen["env"]["GIT_TERMINAL_PROMPT"] == "0"
    assert seen["stdin"] is gitmod.subprocess.DEVNULL


def test_debounce_config(tmp_path):
    assert debounce_from_config(tmp_path) == 60
    (tmp_path / "config.toml").write_text("[snapshot]\ndebounce_seconds = 5\n")
    assert debounce_from_config(tmp_path) == 5
    (tmp_path / "config.toml").write_text('[snapshot]\ndebounce_seconds = "soon"\n')
    assert debounce_from_config(tmp_path) == 60
