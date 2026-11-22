"""tools/dev/scope.sh, the guard behind checks.sh --no-e2e and --website, run on a throwaway git repo."""

import os
import shutil
import subprocess
from pathlib import Path

import pytest

SCOPE = Path(__file__).resolve().parents[2] / "tools/dev/scope.sh"

pytestmark = pytest.mark.skipif(not (shutil.which("git") and shutil.which("python3")), reason="needs git and python3")

BASE = {
    "src/jat/__init__.py": '__version__ = "1.0.0"\n',
    "pyproject.toml": '[project]\nname = "job-application-tracker"\nversion = "1.0.0"\n',
    "uv.lock": (
        '[[package]]\nname = "anyio"\nversion = "4.0.0"\n\n'
        '[[package]]\nname = "job-application-tracker"\nversion = "1.0.0"\nsource = { editable = "." }\n'
    ),
    "frontend/package.json": '{\n  "name": "frontend",\n  "version": "1.0.0",\n  "private": true\n}\n',
    "frontend/openapi.json": '{\n  "info": {\n    "title": "jat",\n    "version": "1.0.0"\n  }\n}\n',
    "frontend/src/api/schema.d.ts": "export type Paths = {};\n",
    "website/package.json": '{\n  "name": "website",\n  "version": "1.0.0",\n  "private": true\n}\n',
    "website/src/components/SiteHead.astro": '---\nconst ld = {\n      softwareVersion: "1.0.0",\n};\n---\n',
    "frontend/src/i18n/language.ts": (
        'export const DRAFT_LANGUAGES: Readonly<Record<string, string>> = {\n  "fr-CA": "Français",\n};\n'
    ),
    "frontend/src/App.tsx": "export const App = () => null;\n",
    "scripts/i18n/check.py": "print('ok')\n",
    "scripts/seed_demo.py": "print('seed')\n",
    "CHANGELOG.md": "# Changelog\n\n## 1.0.0 (2026-01-01)\n\n- First.\n",
}

BUMPED = {path: text.replace('"1.0.0"', '"1.0.1"') for path, text in BASE.items() if '"1.0.0"' in text} | {
    "CHANGELOG.md": BASE["CHANGELOG.md"].replace("## 1.0.0", "## 1.0.1 (2026-01-02)\n\n- Fix.\n\n## 1.0.0")
}


ENV = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")} | {
    "GIT_AUTHOR_NAME": "Test",
    "GIT_AUTHOR_EMAIL": "test@example.com",
    "GIT_COMMITTER_NAME": "Test",
    "GIT_COMMITTER_EMAIL": "test@example.com",
}


def git(cwd: Path, *args: str) -> None:
    subprocess.run(["git", "-c", "commit.gpgsign=false", *args], cwd=cwd, check=True, capture_output=True, env=ENV)


def write(root: Path, files: dict[str, str]) -> None:
    for path, text in files.items():
        (root / path).parent.mkdir(parents=True, exist_ok=True)
        (root / path).write_text(text)


@pytest.fixture
def repo(tmp_path: Path) -> Path:
    """A clone whose origin/main has BASE, on a branch with nothing changed yet."""
    origin, work = tmp_path / "origin.git", tmp_path / "work"
    git(tmp_path, "init", "-q", "--bare", "-b", "main", str(origin))
    git(tmp_path, "init", "-q", "-b", "main", str(work))
    write(work, BASE)
    git(work, "add", "-A")
    git(work, "commit", "-qm", "base")
    git(work, "remote", "add", "origin", str(origin))
    git(work, "push", "-q", "origin", "main")
    git(work, "checkout", "-qb", "worktree-x")
    return work


def scope(repo: Path, mode: str) -> subprocess.CompletedProcess[str]:
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "change", "--allow-empty")
    return subprocess.run(["bash", str(SCOPE), mode], cwd=repo, capture_output=True, text=True, env=ENV)


def test_no_e2e_allows_skip_list_files_and_a_version_bump(repo: Path):
    write(repo, BUMPED)
    write(
        repo,
        {
            "scripts/i18n/check.py": "print('changed')\n",
            "tests/test_new.py": "def test_x(): pass\n",
            "docs/guide/new.md": "# New\n",
            "README.md": "# Readme\n",
            "frontend/src/locales/fr-CA/common.json": "{}\n",
            ".claude/settings.json": "{}\n",
        },
    )
    (repo / "tools/dev").mkdir(parents=True)
    (repo / "tools/dev/untracked.sh").write_text("true\n")  # untracked files count too
    out = scope(repo, "--no-e2e")
    assert out.returncode == 0, out.stdout + out.stderr
    assert "website's checks" not in out.stdout  # a bump's lines in website/ don't call for them


@pytest.mark.parametrize(
    "changed",
    [
        {"website/src/pages/index.astro": "<p>Hi</p>\n"},
        {"website/pnpm-lock.yaml": "lockfileVersion: '9.0'\n"},
        # A version file with more than the bump's line
        {"website/src/components/SiteHead.astro": BUMPED["website/src/components/SiteHead.astro"] + "<meta />\n"},
    ],
)
def test_no_e2e_allows_the_website_and_asks_for_its_checks(repo: Path, changed: dict[str, str]):
    write(repo, BUMPED | changed)
    out = scope(repo, "--no-e2e")
    assert out.returncode == 0, out.stdout + out.stderr
    assert "--no-e2e: website/ changed, so the website's checks run too" in out.stdout


def test_no_e2e_allows_the_two_icons_without_the_websites_checks(repo: Path):
    icons = {"frontend/public/favicon.svg": "<svg/>\n", "frontend/public/apple-touch-icon.png": "png\n"}
    write(repo, BUMPED | icons)
    out = scope(repo, "--no-e2e")
    assert out.returncode == 0, out.stdout + out.stderr
    assert "website's checks" not in out.stdout


def test_no_e2e_refuses_a_deleted_icon(repo: Path):
    git(repo, "checkout", "-q", "main")
    write(repo, {"frontend/public/favicon.svg": "<svg/>\n"})
    git(repo, "add", "-A")
    git(repo, "commit", "-qm", "icon")
    git(repo, "push", "-q", "origin", "main")
    git(repo, "checkout", "-qB", "worktree-x")
    (repo / "frontend/public/favicon.svg").unlink()
    out = scope(repo, "--no-e2e")
    assert out.returncode == 2
    assert "--no-e2e: frontend/public/favicon.svg isn't on" in out.stdout


@pytest.mark.parametrize(
    "path",
    [
        "frontend/public/other.svg",  # only the two icons, by name
        "frontend/public/favicon.svg.bak",
        "frontend/index.html",
        "websitex/a.astro",
        ".github/workflows/website.yml",
        "frontend/src/App.tsx",
        "frontend/src/locales/de/common.json",  # not a draft language
        "frontend/src/i18n/language.ts",
        "frontend/e2e/today.spec.ts",
        "scripts/seed_demo.py",
        "frontend/src/notes.md",  # Markdown counts as docs only at the top or under docs/
        "tests_x/a.py",  # lookalikes of allowed folders
        "docsx/a.md",
        "frontend/src/locales/fr-CAN/common.json",  # only starts like the draft code fr-CA
    ],
)
def test_no_e2e_refuses_files_off_the_list(repo: Path, path: str):
    write(repo, BUMPED | {path: "changed\n"})
    out = scope(repo, "--no-e2e")
    assert out.returncode == 2
    assert f"--no-e2e: {path} isn't on CLAUDE.md's browser-test skip list" in out.stdout
    assert out.stdout.count("\n") == 1  # only that file: the bump's lines are fine


def test_no_e2e_refuses_a_lockfile_change_beyond_the_version(repo: Path):
    write(repo, BUMPED)
    write(repo, {"uv.lock": BUMPED["uv.lock"].replace('version = "4.0.0"', 'version = "4.1.0"')})
    out = scope(repo, "--no-e2e")
    assert out.returncode == 2
    assert "--no-e2e: uv.lock changes more than its version line (1.0.0 → 1.0.1)" in out.stdout


def test_no_e2e_refuses_a_rename_from_off_the_list_into_it(repo: Path):
    (repo / "tests").mkdir(exist_ok=True)
    git(repo, "mv", "frontend/src/App.tsx", "tests/x.py")
    out = scope(repo, "--no-e2e")
    assert out.returncode == 2
    assert "--no-e2e: frontend/src/App.tsx isn't on CLAUDE.md's browser-test skip list" in out.stdout


def test_no_e2e_refuses_a_deleted_version_file(repo: Path):
    write(repo, BUMPED)
    (repo / "frontend/package.json").unlink()
    out = scope(repo, "--no-e2e")
    assert out.returncode == 2
    assert "--no-e2e: frontend/package.json changes more than its version line" in out.stdout


def test_no_e2e_refuses_a_mode_change_on_a_version_file(repo: Path):
    write(repo, BUMPED)
    (repo / "pyproject.toml").chmod(0o755)
    out = scope(repo, "--no-e2e")
    assert out.returncode == 2
    assert "--no-e2e: pyproject.toml changes more than its version line" in out.stdout


def test_no_e2e_refuses_a_new_draft_and_its_folder(repo: Path):
    language = BASE["frontend/src/i18n/language.ts"].replace(
        '"fr-CA": "Français",', '"fr-CA": "Français",\n  "de": "Deutsch",'
    )
    write(repo, {"frontend/src/i18n/language.ts": language, "frontend/src/locales/de/common.json": "{}\n"})
    out = scope(repo, "--no-e2e")
    assert out.returncode == 2
    assert "--no-e2e: frontend/src/i18n/language.ts isn't on" in out.stdout
    assert "--no-e2e: frontend/src/locales/de/common.json isn't on" in out.stdout


def test_no_e2e_reads_the_drafts_from_origin_main(repo: Path):
    # Main ships fr-CA after the branch was cut: the branch's edit to it now changes the production build.
    shipped = BASE["frontend/src/i18n/language.ts"].replace('  "fr-CA": "Français",\n', "")
    git(repo, "checkout", "-q", "main")
    write(repo, {"frontend/src/i18n/language.ts": shipped})
    git(repo, "commit", "-qam", "ship fr-CA")
    git(repo, "push", "-q", "origin", "main")
    git(repo, "checkout", "-q", "worktree-x")
    write(repo, {"frontend/src/locales/fr-CA/common.json": "{}\n"})
    out = scope(repo, "--no-e2e")
    assert out.returncode == 2
    assert "--no-e2e: frontend/src/locales/fr-CA/common.json isn't on" in out.stdout


def test_no_e2e_refuses_an_uncommitted_change(repo: Path):
    out = scope(repo, "--no-e2e")
    assert out.returncode == 0, out.stdout + out.stderr
    write(repo, {"frontend/src/App.tsx": "changed\n"})
    out = subprocess.run(["bash", str(SCOPE), "--no-e2e"], cwd=repo, capture_output=True, text=True, env=ENV)
    assert out.returncode == 2
    assert "frontend/src/App.tsx" in out.stdout


def test_website_keeps_its_own_list(repo: Path):
    write(repo, BUMPED | {"website/src/pages/index.astro": "<p>Hi</p>\n"})
    assert scope(repo, "--website").returncode == 0
    write(repo, {"scripts/i18n/check.py": "print('changed')\n"})
    out = scope(repo, "--website")
    assert out.returncode == 2
    assert "--website: scripts/i18n/check.py isn't a website-only file" in out.stdout


def test_scope_refuses_other_arguments_and_a_subfolder(repo: Path):
    out = subprocess.run(["bash", str(SCOPE), "--all"], cwd=repo, capture_output=True, text=True, env=ENV)
    assert out.returncode == 2
    out = subprocess.run(["bash", str(SCOPE), "--no-e2e"], cwd=repo / "src", capture_output=True, text=True, env=ENV)
    assert out.returncode == 2
    assert "root of a checkout" in out.stderr
