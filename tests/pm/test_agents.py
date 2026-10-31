import os
import subprocess
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from tools.pm import agents
from tools.pm.live import Snapshot, Worktree, parse_worktrees, read_activity
from tools.pm.roadmap import Live, PullRequest, apply_live, from_data

NOW = datetime(2026, 10, 31, 12, 0).astimezone()


def before(**kw):
    return NOW - timedelta(**kw)


def road(prs=()):
    data = {
        "project": "d",
        "repo": "o/d",
        "phases": [{"id": "P", "name": "n", "goal": "g", "tasks": [{"id": "a", "name": "Task <A>"}]}],
    }
    return apply_live(from_data(data), Live(prs=list(prs)))


def tree(name="a", **kw):
    return Worktree(f"/repo/.claude/worktrees/{name}", f"worktree-{name}", **kw)


def pr(number, opened, merged=None, state="MERGED", updated=None):
    return PullRequest(
        number,
        f"T{number}",
        state,
        f"worktree-{number}",
        "https://example.com",
        created_at=before(hours=opened).isoformat(),
        merged_at=before(hours=merged).isoformat() if merged is not None else "",
        updated_at=before(hours=updated).isoformat() if updated is not None else "",
    )


class StateTests(unittest.TestCase):
    def test_the_thresholds(self):
        for last, state in (
            (before(minutes=44), "working"),
            (before(minutes=46), "idle"),
            (before(hours=2, minutes=59), "idle"),
            (before(hours=3, minutes=1), "stale"),
            (None, "stale"),
        ):
            self.assertEqual(agents.state_of(last, NOW), state)

    def test_the_latest_of_an_edit_or_a_commit_counts(self):
        edit = before(minutes=5)
        both = tree(last_commit=before(hours=9).isoformat(), last_edit=edit.timestamp())
        self.assertEqual(agents.last_active(both), edit)
        self.assertIsNone(agents.last_active(tree()))

    def test_how_long_ago_reads(self):
        for when, text in (
            (None, "—"),
            (before(seconds=5), "just now"),
            (before(minutes=5), "5 min ago"),
            (before(hours=5), "5 h ago"),
            (before(days=4), "4 days ago"),
        ):
            self.assertEqual(agents.ago(when, NOW), text)


class RowTests(unittest.TestCase):
    def test_main_stays_out_and_the_busiest_come_first(self):
        snapshot = Snapshot(
            live=Live(),
            worktrees=[
                Worktree("/repo", "main"),
                tree("old"),
                tree("recent", last_edit=before(minutes=1).timestamp()),
                tree("sooner", last_edit=before(minutes=30).timestamp()),
            ],
        )
        rows = agents.agent_rows(road(), snapshot, NOW)
        self.assertEqual([r.name for r in rows], ["recent", "sooner", "old"])

    def test_a_worktree_links_to_its_task(self):
        snapshot = Snapshot(live=Live(), worktrees=[tree("a"), tree("elsewhere")])
        rows = {r.name: r.task for r in agents.agent_rows(road(), snapshot, NOW)}
        self.assertEqual(rows["a"].id, "a")
        self.assertIsNone(rows["elsewhere"])


class ReadActivityTests(unittest.TestCase):
    def run_with(self, tmp, ahead="0\n", status="", log="2026-10-31T10:00:00+00:00\n"):
        def run(args, cwd, timeout=15):
            if "rev-list" in args:
                return ahead
            if "status" in args:
                return status
            return log

        found = Worktree(tmp, "worktree-a")
        with mock.patch("tools.pm.live._run", side_effect=run):
            read_activity(found, "origin/main")
        return found

    def test_with_nothing_of_its_own_mains_commit_doesnt_count(self):
        with TemporaryDirectory() as tmp:
            found = self.run_with(tmp)
        self.assertEqual((found.ahead, found.last_commit), (0, ""))

    def test_its_own_commit_counts(self):
        with TemporaryDirectory() as tmp:
            found = self.run_with(tmp, ahead="2\n")
        self.assertEqual((found.ahead, found.last_commit), (2, "2026-10-31T10:00:00+00:00"))

    def test_unsaved_files_are_counted_and_dated_and_a_deleted_one_is_fine(self):
        with TemporaryDirectory() as tmp:
            (Path(tmp) / "a.py").write_text("x")
            (Path(tmp) / "b c.py").write_text("x")
            os.utime(Path(tmp) / "a.py", (1000, 1000))
            os.utime(Path(tmp) / "b c.py", (2000, 2000))
            (Path(tmp) / "new.py").write_text("x")
            os.utime(Path(tmp) / "new.py", (3000, 3000))
            found = self.run_with(tmp, status=" M a.py\0?? b c.py\0 D gone.py\0R  new.py\0old.py\0")
        self.assertEqual((found.dirty, found.last_edit), (4, 3000.0))  # the rename's new name is dated

    def test_against_real_git(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)

            def git(*args):
                env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
                identity = ["-c", "user.name=T", "-c", "user.email=t@example.com"]
                subprocess.run(["git", *identity, *args], cwd=root, check=True, capture_output=True, env=env)

            git("init", "-q", "-b", "main")
            (root / "old.py").write_text("x")
            (root / "kept.py").write_text("x")
            git("add", "-A")
            git("commit", "-qm", "first")
            git("branch", "base")
            (root / "kept.py").write_text("changed")
            git("add", "-A")
            git("commit", "-qm", "second")
            git("mv", "old.py", "renamed.py")
            (root / "new dir").mkdir()
            (root / "new dir" / "café.py").write_text("x")
            (root / "new dir" / "two.py").write_text("x")
            newest = root / "new dir" / "café.py"
            os.utime(newest, (4_000_000_000, 4_000_000_000))

            env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
            found = Worktree(tmp, "worktree-a")
            with mock.patch.dict(os.environ, env, clear=True):
                read_activity(found, "base")
        self.assertFalse(found.unreadable)
        self.assertEqual(found.ahead, 1)
        self.assertEqual(found.dirty, 3)  # the rename, and each file in the new folder
        self.assertEqual(found.last_edit, 4_000_000_000.0)  # the folder's own time would hide this

    def test_one_that_cant_be_read_is_marked(self):
        found = Worktree("/nowhere", "worktree-a")
        with mock.patch("tools.pm.live._run", side_effect=OSError("gone")):
            read_activity(found, "origin/main")
        self.assertTrue(found.unreadable)


class LaneTests(unittest.TestCase):
    def test_newest_first_and_kept_to_the_limit(self):
        found = agents.lanes([pr(1, 9, 8), pr(2, 5, 4), pr(3, 7, 6)], NOW, limit=2)
        self.assertEqual([lane.pr.number for lane in found], [2, 3])

    def test_where_each_kind_ends(self):
        merged, still_open, closed = agents.lanes(
            [pr(1, 9, 8), pr(2, 7, state="OPEN"), pr(3, 5, state="CLOSED", updated=4)], NOW
        )[::-1]
        self.assertEqual(merged.end, before(hours=8))
        self.assertEqual(still_open.end, NOW)
        self.assertEqual(closed.end, before(hours=4))

    def test_a_bad_or_missing_date_cant_break_it(self):
        broken = PullRequest(1, "T", "CLOSED", "b", "u", created_at="nope")
        self.assertEqual(agents.lanes([broken], NOW), [])
        no_end = PullRequest(2, "T", "CLOSED", "b", "u", created_at=before(hours=1).isoformat())
        lane = agents.lanes([no_end], NOW)[0]
        self.assertEqual(lane.end, lane.start)

    def test_the_peak_counts_an_older_pr_still_running_in_the_period(self):
        prs = [pr(1, 20, 5), pr(2, 8, 6), pr(3, 3, 2)]  # 1 is too old for a bar, but overlaps 2
        shown = agents.lanes(prs, NOW, limit=2)
        self.assertEqual([lane.pr.number for lane in shown], [3, 2])
        self.assertEqual(agents.most_at_once(shown), 1)
        self.assertEqual(agents.peak_in_window(prs, shown, NOW), 2)
        self.assertEqual(agents.peak_in_window([], [], NOW), 0)

    def test_a_detached_worktree_stays_on_the_page(self):
        trees = parse_worktrees("worktree /r\nHEAD abc\nbranch refs/heads/main\n\nworktree /r/w\nHEAD abc\ndetached\n")
        self.assertEqual([t.branch for t in trees], ["main", "(detached)"])
        rows = agents.agent_rows(road(), Snapshot(live=Live(), worktrees=trees), NOW)
        self.assertEqual([r.name for r in rows], ["w"])

    def test_the_most_at_once(self):
        self.assertEqual(agents.most_at_once(agents.lanes([pr(1, 9, 5), pr(2, 8, 6), pr(3, 3, 2)], NOW)), 2)
        self.assertEqual(agents.most_at_once(agents.lanes([pr(1, 9, 8), pr(2, 8, 7)], NOW)), 1)  # end meets start
        self.assertEqual(agents.most_at_once([]), 0)


class PageTests(unittest.TestCase):
    def test_a_worktree_row_shows_its_state_task_and_figures(self):
        task_pr = PullRequest(
            7, "T", "OPEN", "worktree-a", "https://example.com/7", created_at=before(hours=1).isoformat()
        )
        working = tree("a", ahead=3, dirty=2, last_edit=before(minutes=5).timestamp())
        html = agents.agents_page(road([task_pr]), Snapshot(live=Live(prs=[task_pr]), worktrees=[working]), NOW)
        self.assertIn('<span class="pill building">working</span>', html)
        self.assertIn("Task &lt;A&gt;", html)
        self.assertIn("PR #7", html)
        self.assertIn('<td class="num">3</td><td class="num">2</td>', html)
        self.assertIn("5 min ago", html)
        self.assertIn("1 working, 0 idle, 0 stale", html)
        self.assertEqual(html.count("<details"), html.count("</details>"))

    def test_one_that_cant_be_read_says_so(self):
        html = agents.agents_page(road(), Snapshot(live=Live(), worktrees=[tree("a", unreadable=True)]), NOW)
        self.assertIn("can't read", html)
        self.assertIn("0 working, 0 idle, 0 stale", html)

    def test_titles_are_escaped(self):
        evil = PullRequest(1, '"><script>x', "OPEN", "b", "u", created_at=before(hours=1).isoformat())
        html = agents.agents_page(road(), Snapshot(live=Live(prs=[evil])), NOW)
        self.assertNotIn("<script>x", html)
        self.assertNotIn('"><script', html)

    def test_nothing_going_on(self):
        html = agents.agents_page(road(), Snapshot(live=Live()), NOW)
        self.assertIn("No worktrees", html)
        self.assertIn("No PRs yet", html)

    def test_sources_that_never_answered_say_so(self):
        html = agents.agents_page(road(), Snapshot(live=Live(), git_ok=False, github_ok=False), NOW)
        self.assertIn("git hasn't answered", html)
        self.assertIn("GitHub hasn't answered", html)
        self.assertNotIn("No worktrees", html)
        self.assertNotIn("No PRs yet", html)


if __name__ == "__main__":
    unittest.main()
