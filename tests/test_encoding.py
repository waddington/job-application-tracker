"""Tests for UTF-8 encoding across files, settings, git, and schema."""

from __future__ import annotations

import ast
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from jat.config import Settings
from jat.datadir import _ensure_gitignore, init_data_dir
from jat.db import head_revision
from jat.domain.workflow import WorkflowError, load_workflow
from jat.openapi import main as openapi_main
from jat.snapshot.export import _read_export
from jat.snapshot.git import _git, debounce_from_config
from jat.storage.notes import NoteStore

SUBPROCESS_TEXT = {"run", "Popen", "check_output", "call", "check_call"}
TEMPFILES = {"NamedTemporaryFile", "TemporaryFile", "SpooledTemporaryFile"}


def _const(node: ast.expr | None) -> object:
    return node.value if isinstance(node, ast.Constant) else None


def _keyword(call: ast.Call, name: str) -> ast.expr | None:
    return next((kw.value for kw in call.keywords if kw.arg == name), None)


def text_io_without_encoding(source: str) -> list[int]:
    """Lines that read or write text without naming an encoding, so on Windows they'd use the locale's (cp1252):
    read_text/write_text, open/io.open/Path.open/os.fdopen, tempfiles in a text mode, and subprocess calls
    that decode their output (text=True or universal_newlines=True)."""
    lines = []
    for call in ast.walk(ast.parse(source)):
        if not isinstance(call, ast.Call):
            continue
        func = call.func
        name = func.id if isinstance(func, ast.Name) else func.attr if isinstance(func, ast.Attribute) else None
        has_encoding = _keyword(call, "encoding") is not None
        if name == "read_text":
            bad = not has_encoding and not call.args  # read_text(encoding, errors)
        elif name == "write_text":
            bad = not has_encoding and len(call.args) < 2  # write_text(data, encoding, ...)
        elif name in ("open", "fdopen"):
            # open(file, mode) and io.open/os.fdopen(fd, mode) take the mode second; Path.open(mode) first.
            # codecs.open(filename, mode, encoding) takes encoding third (index 2).
            is_codecs = (
                isinstance(func, ast.Attribute) and isinstance(func.value, ast.Name) and func.value.id == "codecs"
            )
            method = isinstance(func, ast.Attribute) and not (
                isinstance(func.value, ast.Name) and func.value.id in ("io", "os", "codecs")
            )
            mode_at = 0 if method else 1
            encoding_at = 2 if (method or is_codecs) else 3
            positional = call.args[mode_at] if len(call.args) > mode_at else None
            mode = _const(_keyword(call, "mode") or positional)
            binary = isinstance(mode, str) and "b" in mode
            bad = not binary and not has_encoding and len(call.args) <= encoding_at
        elif name in TEMPFILES:
            mode_at = 1 if name == "SpooledTemporaryFile" else 0
            positional = call.args[mode_at] if len(call.args) > mode_at else None
            mode = _const(_keyword(call, "mode") or positional)
            bad = isinstance(mode, str) and "b" not in mode and not has_encoding
        elif name in SUBPROCESS_TEXT:
            decodes = (
                any(_const(_keyword(call, k)) is True for k in ("text", "universal_newlines"))
                or _keyword(call, "errors") is not None
            )
            bad = decodes and not has_encoding
        else:
            bad = False
        if bad:
            lines.append(call.lineno)
    return sorted(lines)


def test_source_code_text_io_names_encoding():
    """Fail on any text read or write in src/jat that doesn't name an encoding.

    On Linux and macOS the default is UTF-8, so a missing encoding works there and breaks only on Windows.
    """
    root = Path(__file__).resolve().parents[1] / "src" / "jat"
    violations = [
        f"{path.relative_to(root)}:{line}"
        for path in sorted(root.rglob("*.py"))
        for line in text_io_without_encoding(path.read_text(encoding="utf-8"))
    ]
    assert not violations, "Text read or written without an encoding:\n" + "\n".join(violations)


@pytest.mark.parametrize(
    "line",
    [
        "Path('a').read_text()",
        "Path('a').write_text('x')",
        "open('backup.txt')",
        "open(path, 'w')",
        "Path('a').open('r')",
        "io.open(path)",
        "os.fdopen(fd, 'w')",
        "tempfile.NamedTemporaryFile(mode='w')",
        "tempfile.SpooledTemporaryFile(1024, 'w')",
        "subprocess.run(['git', 'log'], text=True)",
        "subprocess.run(['git'], errors='replace')",
        "subprocess.check_output(['git'], universal_newlines=True)",
        "codecs.open('test.txt', 'r')",
        "codecs.open('test.txt')",
    ],
)
def test_the_check_catches_text_io_without_an_encoding(line):
    assert text_io_without_encoding(line) == [1]


@pytest.mark.parametrize(
    "line",
    [
        "Path('a').read_text(encoding='utf-8')",
        "Path('a').read_text('utf-8')",
        "Path('a').write_text('x', 'utf-8')",
        "Path('a').read_bytes()",
        "open('backup.bin', 'rb')",
        "open(path, mode='wb')",
        "Path('a').open('rb')",
        "os.fdopen(fd, 'wb')",
        "tempfile.NamedTemporaryFile()",
        "tempfile.SpooledTemporaryFile(1024)",
        "tempfile.SpooledTemporaryFile(1024, 'wb')",
        "subprocess.run(['git'], capture_output=True)",
        "subprocess.run(['git'], text=True, encoding='utf-8')",
        "subprocess.run(['git'], errors='replace', encoding='utf-8')",
        "codecs.open('test.txt', 'r', 'utf-8')",
        "codecs.open('test.txt', encoding='utf-8')",
        "codecs.open('test.txt', 'rb')",
    ],
)
def test_the_check_leaves_bytes_and_named_encodings_alone(line):
    assert text_io_without_encoding(line) == []


def test_config_toml_utf8_and_bom(tmp_path: Path):
    """config.toml can contain non-ASCII characters and may start with a UTF-8 BOM."""
    config_content = (
        "[workflow]\n"
        'initial = "candidature"\n'
        "[[workflow.stages]]\n"
        'id = "candidature"\n'
        'name = "Candidature déposée"\n'
        "[[workflow.stages]]\n"
        'id = "entretien"\n'
        'name = "Entretien technique — café & démo"\n'
    )
    # 1. Plain UTF-8 without BOM
    config_file = tmp_path / "config.toml"
    config_file.write_text(config_content, encoding="utf-8")
    wf1 = load_workflow(tmp_path)
    assert len(wf1.stages) == 2
    assert wf1.stages[1].name == "Entretien technique — café & démo"

    # 2. UTF-8 with BOM (Notepad on Windows adds \ufeff)
    config_file.write_text(config_content, encoding="utf-8-sig")
    assert config_file.read_bytes().startswith(b"\xef\xbb\xbf")
    wf2 = load_workflow(tmp_path)
    assert len(wf2.stages) == 2
    assert wf2.stages[1].name == "Entretien technique — café & démo"


def test_debounce_from_config_utf8_and_bom(tmp_path: Path):
    """debounce_from_config handles UTF-8 BOM from Windows editors."""
    config_file = tmp_path / "config.toml"
    config_content = "[snapshot]\ndebounce_seconds = 42\n# Commentaire: réactivité\n"
    config_file.write_text(config_content, encoding="utf-8-sig")
    assert debounce_from_config(tmp_path) == 42.0


def test_env_file_utf8(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    """Settings reads .env files with UTF-8 characters."""
    monkeypatch.chdir(tmp_path)
    env_file = tmp_path / ".env"
    # Write a .env file with UTF-8 comments and values
    env_file.write_text("JAT_HOST=127.0.0.1\n# Données d'application: Montréal\n", encoding="utf-8")
    settings = Settings()
    assert settings.host == "127.0.0.1"


def test_ensure_gitignore_utf8_and_bom(tmp_path: Path):
    """.gitignore can be read with BOM and preserves UTF-8 characters."""
    gitignore = tmp_path / ".gitignore"
    gitignore.write_text("# Fichiers ignorés: temporaires\n.custom_cache\n", encoding="utf-8-sig")
    added = _ensure_gitignore(tmp_path)
    assert "tracker.sqlite3" in added
    content = gitignore.read_text(encoding="utf-8")
    assert "# Fichiers ignorés: temporaires" in content
    assert "tracker.sqlite3" in content
    raw = gitignore.read_bytes()
    assert b"\r\n" not in raw  # LF line endings
    assert not raw.startswith(b"\xef\xbb\xbf")  # git would read a BOM as part of the first pattern


def test_init_data_dir_writes_utf8_and_lf(tmp_path: Path):
    """init_data_dir writes config.toml with UTF-8 and LF endings."""
    data_dir = tmp_path / "test_data"
    init_data_dir(data_dir, commit=False)
    config_bytes = (data_dir / "config.toml").read_bytes()
    assert b"\r\n" not in config_bytes
    assert (data_dir / "config.toml").read_text(encoding="utf-8")


def test_export_meta_utf8(tmp_path: Path):
    """_read_export loads _meta.json containing non-ASCII UTF-8 characters."""
    meta = {
        "format": 1,
        "schema_revision": head_revision(),
        "exported_at": "2026-11-09T12:00:00Z",
        "note": "Sauvegarde des candidatures — Zürich",
        "tables": {},
    }
    (tmp_path / "_meta.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    rev, rows = _read_export(tmp_path)
    assert rev == head_revision()
    assert rows == {}


def test_notes_storage_utf8_and_bom(tmp_path: Path):
    """NoteStore reads notes with UTF-8 and UTF-8 BOM from Windows editors."""
    notes_dir = tmp_path / "notes" / "2026/11"
    notes_dir.mkdir(parents=True)
    note_path = notes_dir / "note-1-test.md"

    # Note with frontmatter and BOM
    raw_content = (
        "---\n"
        "id: note-1\n"
        "title: Entretien d'embauche — Zürich & München\n"
        "links: []\n"
        "created: '2026-11-09T10:00:00Z'\n"
        "updated: '2026-11-09T10:00:00Z'\n"
        "---\n"
        "Compte rendu de l'échange avec l'équipe d'ingénierie.\n"
    )
    note_path.write_text(raw_content, encoding="utf-8-sig")
    assert note_path.read_bytes().startswith(b"\xef\xbb\xbf")

    store = NoteStore(tmp_path)
    note = store.read("2026/11/note-1-test.md")
    assert note.id == "note-1"
    assert note.title == "Entretien d'embauche — Zürich & München"
    assert "Compte rendu" in note.body


def test_openapi_main_writes_utf8_and_lf(tmp_path: Path):
    """jat.openapi writes openapi.json in UTF-8 with LF line endings."""
    out_file = tmp_path / "openapi.json"
    openapi_main([str(out_file)])
    raw_bytes = out_file.read_bytes()
    assert b"\r\n" not in raw_bytes
    text = out_file.read_text(encoding="utf-8")
    assert "Job Application Tracker" in text


def test_git_output_decodes_utf8(git_repo: Path):
    """_git correctly decodes non-ASCII UTF-8 output from git commands."""
    (git_repo / "test.txt").write_text("Données de test\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(git_repo), "add", "test.txt"], check=True)
    message = git_repo.parent / "message.txt"  # a file, so the message never passes through the locale's encoding
    message.write_text("feat: ajout des données de test — résumé & notes\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(git_repo), "commit", "-q", "-F", str(message)], check=True)

    result = _git(git_repo, "log", "-1", "--pretty=%B")
    assert result.returncode == 0
    assert "résumé & notes" in result.stdout


def test_git_output_that_isnt_utf8_doesnt_crash(git_repo: Path):
    (git_repo / "a.txt").write_bytes(b"caf\xe9 in Latin-1\n")  # git show prints a file's bytes as they are
    subprocess.run(["git", "-C", str(git_repo), "add", "a.txt"], check=True)
    subprocess.run(["git", "-C", str(git_repo), "commit", "-q", "-m", "a Latin-1 file"], check=True)
    assert _git(git_repo, "show", "HEAD:a.txt").stdout == "caf� in Latin-1\n"


@pytest.mark.skipif(sys.platform != "linux", reason="Windows' own default (cp1252) already does this; macOS is UTF-8")
def test_these_pass_without_a_utf8_default():
    """On Linux the default encoding is UTF-8, so a missing encoding= only fails on Windows. Run this file's other
    tests again with an ASCII default (no UTF-8 mode, no locale coercion), so a missing encoding fails here too."""
    env = {**os.environ, "LC_ALL": "C", "LANG": "C", "PYTHONUTF8": "0", "PYTHONCOERCECLOCALE": "0"}
    env["PYTHONIOENCODING"] = "utf-8"  # only its output, so a failure prints; files still use ASCII
    probe = subprocess.run(
        [sys.executable, "-c", "import locale; print(locale.getpreferredencoding(False))"],
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    )
    assert "utf" not in probe.stdout.lower(), probe.stdout  # the child really has a non-UTF-8 default
    run = subprocess.run(
        [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", __file__, "-k", "not without_a_utf8"],
        env=env,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert run.returncode == 0, run.stdout[-3000:]


def test_a_config_toml_that_isnt_utf8_gives_a_clear_error(tmp_path: Path):
    (tmp_path / "config.toml").write_bytes(b"[snapshot]\ndebounce_seconds = 5\n# caf\xe9\n")  # saved as cp1252
    assert debounce_from_config(tmp_path) == 60  # snapshots fall back to the default, no crash
    with pytest.raises(WorkflowError, match="config.toml"):
        load_workflow(tmp_path)
