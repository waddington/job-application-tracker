import subprocess

import pytest

from jat.cli import main
from jat.config import ConfigError, Settings, resolve_data_dir
from jat.datadir import CODE_ROOT, DataDirError, init_data_dir


def git_log(repo):
    return subprocess.run(["git", "-C", str(repo), "log", "--format=%s"], capture_output=True, text=True).stdout


def test_init_creates_layout_and_is_idempotent(tmp_path):
    path = tmp_path / "data"
    report = init_data_dir(path)
    assert {"export/", "notes/", "files/", "config.toml"} <= set(report.created)
    assert (path / "notes" / ".gitkeep").exists()
    assert "tracker.sqlite3" in (path / ".gitignore").read_text()
    assert not report.is_git_repo and not report.committed

    (path / "config.toml").write_text("# edited\n")
    again = init_data_dir(path)
    assert again.created == [] and again.gitignore_added == []
    assert (path / "config.toml").read_text() == "# edited\n"


def test_gitignore_keeps_existing_lines(tmp_path):
    path = tmp_path / "data"
    path.mkdir()
    (path / ".gitignore").write_text(".idea/\ntracker.sqlite3\n")
    report = init_data_dir(path)
    text = (path / ".gitignore").read_text()
    assert text.startswith(".idea/\n")
    assert text.count("tracker.sqlite3\n") == 1
    assert "tracker.sqlite3" not in report.gitignore_added


def test_refuses_data_dir_inside_code_repo():
    with pytest.raises(DataDirError):
        init_data_dir(CODE_ROOT / "data")
    with pytest.raises(DataDirError):
        init_data_dir(CODE_ROOT)


def test_commits_scaffold_in_git_repo(git_repo):
    (git_repo / "README.md").write_text("mine\n")  # untracked user file must not be committed
    report = init_data_dir(git_repo)
    assert report.is_git_repo and report.committed
    assert "initialise job-application-tracker data layout" in git_log(git_repo)
    tracked = subprocess.run(["git", "-C", str(git_repo), "ls-files"], capture_output=True, text=True).stdout
    assert "README.md" not in tracked
    assert "config.toml" in tracked and "notes/.gitkeep" in tracked
    assert init_data_dir(git_repo).committed is False


def test_resolve_data_dir(tmp_path, monkeypatch):
    monkeypatch.delenv("JAT_DATA_DIR", raising=False)
    monkeypatch.chdir(tmp_path)  # no .env here
    with pytest.raises(ConfigError):
        resolve_data_dir(Settings())
    monkeypatch.setenv("JAT_DATA_DIR", str(tmp_path / "d"))
    assert resolve_data_dir(Settings()) == (tmp_path / "d").resolve()


def test_cli_init_and_errors(tmp_path, monkeypatch, capsys):
    monkeypatch.delenv("JAT_DATA_DIR", raising=False)
    monkeypatch.chdir(tmp_path)
    assert main(["init"]) == 2
    assert "No data directory configured" in capsys.readouterr().err
    assert main(["--data-dir", str(tmp_path / "d"), "init"]) == 0
    assert "not a git repo" in capsys.readouterr().out
    assert main(["--data-dir", str(CODE_ROOT), "init"]) == 2
