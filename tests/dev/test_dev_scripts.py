"""The pure parts of the maintainer scripts in tools/dev."""

from pathlib import Path

import pytest

from tools.dev import bump, check_links, pr_shots, release_notes, roadmap_dedupe


def test_dedupe_keeps_the_longer_line_in_the_first_place():
    text = (
        "phases:\n"
        "  - id: P7\n"
        "    tasks:\n"
        "      - {id: a, name: A, status: done}\n"
        "      - {id: b, name: B, status: planned}\n"
        "      - {id: a, name: A with more detail, status: building}\n"
    )
    out = roadmap_dedupe.dedupe(text)
    assert out.splitlines()[3] == "      - {id: a, name: A with more detail, status: building}"
    assert out.count("{id: a,") == 1
    assert "{id: b," in out


def test_release_notes_make_relative_links_absolute():
    changelog = (
        "# Changelog\n\n## 1.2.0 (2026-11-07)\n\n- New [guide](docs/guide/README.md), "
        "[site](https://example.com), [here](#top) (#5).\n\n## 1.1.0 (2026-11-01)\n\n- Old.\n"
    )
    notes = release_notes.section(changelog, "1.2.0")
    assert "](https://github.com/waddington/job-application-tracker/blob/main/docs/guide/README.md)" in notes
    assert "](https://example.com)" in notes
    assert "](#top)" in notes
    assert "Old." not in notes


def test_bump_versions_and_changelog():
    assert bump.next_version("1.19.3", minor=False) == "1.19.4"
    assert bump.next_version("1.19.3", minor=True) == "1.20.0"
    text = "# Changelog\n\n## 1.19.3 (2026-11-06)\n\n- Old.\n"
    out = bump.changelog_with(text, "1.19.3", "1.19.4", "Fixes a thing", "12", "2026-11-07")
    assert out.startswith("# Changelog\n\n## 1.19.4 (2026-11-07)\n\n- Fixes a thing (#12).\n\n## 1.19.3 (")
    with pytest.raises(SystemExit):
        bump.changelog_with(text, "1.0.0", "1.0.1", "x", "1", "2026-11-07")


def test_check_links_finds_missing_files_and_anchors(tmp_path: Path):
    (tmp_path / "b.md").write_text("# Getting started, quickly\n")
    a = tmp_path / "a.md"
    a.write_text("[ok](b.md#getting-started-quickly) [gone](c.md) [bad](b.md#nope) [web](https://example.com)\n")
    assert check_links.slug("Getting started, quickly") == "getting-started-quickly"
    assert check_links.broken(a) == [f"{a}: missing file c.md", f"{a}: missing anchor b.md#nope"]


def test_pr_shots_reads_a_view_and_its_options():
    v = pr_shots.parse_view("Board card, not booked=/applications?view=board@375@light@sel=.card@click=Open")
    assert (v.label, v.path, v.width, v.scheme, v.sel, v.click, v.full) == (
        "Board card, not booked",
        "/applications?view=board",
        375,
        "light",
        ".card",
        "Open",
        False,
    )
    assert v.slug == "board-card-not-booked"
    assert pr_shots.parse_view("Today=/@full") == pr_shots.View("Today", "/", full=True)
    assert pr_shots.parse_view("Person={person:Alex Morgan}").path == "{person:Alex Morgan}"


def test_pr_shots_refuses_what_isnt_a_view():
    for spec in ("no path", "=/", "Label=applications", "Today=/@wide", "Today=/@sel="):
        with pytest.raises(ValueError):
            pr_shots.parse_view(spec)


def test_pr_shots_table_has_a_row_per_view_and_marks_a_missing_side():
    views = [pr_shots.parse_view("Board=/applications"), pr_shots.parse_view("New dialog=/@click=New")]
    have = {"before/board.png", "after/board.png", "after/new-dialog.png"}
    lines = pr_shots.table(views, "abc123", "my-task", have).splitlines()
    assert lines[:2] == ["| Item | Before | After |", "| --- | --- | --- |"]
    raw = "https://raw.githubusercontent.com/waddington/job-application-tracker/abc123/my-task"
    assert lines[2] == f"| Board | ![Board, before]({raw}/before/board.png) | ![Board, after]({raw}/after/board.png) |"
    assert lines[3] == f"| New dialog | (none) | ![New dialog, after]({raw}/after/new-dialog.png) |"
