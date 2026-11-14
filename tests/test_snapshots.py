import subprocess
import sys
import time

import pytest
from fastapi.testclient import TestClient

from jat.app import create_app
from jat.cli import main
from jat.datadir import init_data_dir
from jat.db import db_path, make_engine, migrate
from jat.platform import lock_path, snapshots_allowed
from jat.snapshot.git import SnapshotError, SnapshotService, debounce_from_config

# Snapshots are on by default everywhere with windows-snapshots (docs/rfc/windows.md step 2).


def git(repo, *args):
    return subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True, check=True).stdout


@pytest.fixture
def data_repo(git_repo):
    (git_repo / "README.md").write_text("private notes\n")  # a user file the app must never stage
    init_data_dir(git_repo, windows_snapshots=True)  # commit the layout on Windows too
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
    client = TestClient(base_url="http://127.0.0.1", app=app)
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
    with TestClient(base_url="http://127.0.0.1", app=app) as client:
        client.post("/api/v1/companies", json={"name": "Contoso"})
        before = len(commits(data_repo))
    assert len(commits(data_repo)) == before + 1


def test_backup_api_and_push(data_repo, remote):
    app = create_app(data_repo, dist=data_repo / "none", snapshot_debounce=3600)
    client = TestClient(base_url="http://127.0.0.1", app=app)
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
    client = TestClient(base_url="http://127.0.0.1", app=app)
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


@pytest.fixture
def windows(monkeypatch):
    """Fake Windows: what the code reads at call time, and no fcntl (as there)."""
    monkeypatch.setattr("jat.platform.IS_WINDOWS", True)
    monkeypatch.setattr("jat.platform.fcntl", None)
    if sys.platform != "win32":

        class FakeMsvcrt:
            LK_NBLCK, LK_UNLCK = 1, 2

            @staticmethod
            def locking(fd, mode, nbytes):
                pass

        monkeypatch.setattr("jat.platform.msvcrt", FakeMsvcrt)


def test_snapshots_allowed_everywhere(monkeypatch):
    monkeypatch.setattr("jat.platform.IS_WINDOWS", False)
    assert snapshots_allowed() and snapshots_allowed(False) and snapshots_allowed(True)
    monkeypatch.setattr("jat.platform.IS_WINDOWS", True)
    assert snapshots_allowed() and snapshots_allowed(False) and snapshots_allowed(True)


def test_windows_snapshots_run_by_default(data_repo, windows):
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0)
    assert service.enabled is True
    assert service.snapshot_now()
    assert lock_path(data_repo).exists()


def test_errors_inside_the_lock_pass_through(data_repo):
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0)
    with pytest.raises(PermissionError, match="disk says no"), service.fresh_export():
        raise PermissionError("disk says no")  # not reported as a lock failure


def test_failing_to_take_the_lock_is_backup_lock_failed(data_repo, monkeypatch):
    class StuckLock:
        LOCK_EX, LOCK_NB, LOCK_UN = 2, 4, 8

        @staticmethod
        def flock(fh, op):
            if op & StuckLock.LOCK_NB:
                raise BlockingIOError
            raise OSError("stuck")

    monkeypatch.setattr("jat.platform.fcntl", StuckLock)
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0)
    with pytest.raises(SnapshotError, match="couldn't lock") as exc:
        service.snapshot_now()
    assert exc.value.code == "backup_lock_failed"


def test_windows_init_commits_the_layout(tmp_path, git_env, windows):
    repo = tmp_path / "repo"
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    assert init_data_dir(repo).committed is True


def test_windows_cli_runs_snapshot(tmp_path, git_env, windows, capsys):
    repo = tmp_path / "repo"
    subprocess.run(["git", "init", "-q", "-b", "main", str(repo)], check=True)
    assert main(["--data-dir", str(repo), "init"]) == 0
    assert "git: committed the layout" in capsys.readouterr().out
    assert main(["--data-dir", str(repo), "snapshot"]) == 0


def test_health_on_windows_says_snapshots_are_on(data_repo, windows):
    client = TestClient(base_url="http://127.0.0.1", app=create_app(data_repo, snapshot_debounce=0))
    body = client.get("/api/v1/health").json()
    assert (body["git_repo"], body["snapshots_enabled"], body["windows"]) == (True, True, True)


def test_windows_lock_does_not_empty_lock_file(data_repo, windows):
    lock = lock_path(data_repo)
    lock.write_bytes(b"existing-content")
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0)
    service.snapshot_now()
    assert lock.read_bytes() == b"existing-content"


def test_windows_lock_failure_is_backup_lock_failed(data_repo, monkeypatch):
    class FailingMsvcrt:
        LK_NBLCK, LK_UNLCK = 1, 2

        @staticmethod
        def locking(fd, mode, nbytes):
            raise OSError(22, "Invalid argument")

    monkeypatch.setattr("jat.platform.fcntl", None)
    monkeypatch.setattr("jat.platform.msvcrt", FailingMsvcrt)
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0)
    with pytest.raises(SnapshotError, match="couldn't lock") as exc:
        service.snapshot_now()
    assert exc.value.code == "backup_lock_failed"


def test_windows_lock_retries_until_release(data_repo, monkeypatch):
    calls = []

    class RetryingMsvcrt:
        LK_NBLCK, LK_UNLCK = 1, 2

        @staticmethod
        def locking(fd, mode, nbytes):
            if mode == RetryingMsvcrt.LK_NBLCK:
                calls.append("lock")
                if len(calls) < 3:
                    raise OSError(13, "Permission denied")
            elif mode == RetryingMsvcrt.LK_UNLCK:
                calls.append("unlock")

    monkeypatch.setattr("jat.platform.fcntl", None)
    monkeypatch.setattr("jat.platform.msvcrt", RetryingMsvcrt)
    service = SnapshotService(data_repo, make_engine(db_path(data_repo)), debounce_seconds=0)
    service.snapshot_now()
    assert calls.count("lock") == 3
    assert "unlock" in calls
