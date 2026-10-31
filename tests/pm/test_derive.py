import threading
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from tools.pm import derive, render
from tools.pm.live import Collector, Commit, Snapshot, count_code, keep_last_good, parse_prs
from tools.pm.roadmap import Live, PullRequest, apply_live, from_data
from tools.pm.server import Dashboard

NOW = datetime(2026, 10, 31, 12, 0).astimezone()  # noon here, wherever the tests run


def pr(number, branch, state="MERGED", created="2026-10-01T10:00:00Z", merged="2026-10-02T10:00:00Z", **kw):
    return PullRequest(
        number,
        f"Title {number}",
        state,
        branch,
        f"https://example.com/{number}",
        created_at=created,
        merged_at=merged,
        **kw,
    )


def roadmap(prs=(), **live):
    data = {
        "project": "demo",
        "repo": "owner/demo",
        "phases": [
            {
                "id": "B",
                "name": "Bugs",
                "goal": "g",
                "tasks": [{"id": "fix-a", "name": "Bug", "type": "bug", "severity": "high"}],
            },
            {"id": "P0", "name": "Old", "goal": "g", "tasks": [{"id": "a", "name": "A"}, {"id": "b", "name": "B"}]},
            {"id": "P1", "name": "Next", "goal": "g", "tasks": [{"id": "c", "name": "C"}]},
        ],
    }
    return apply_live(from_data(data), Live(prs=list(prs), **live))


class PhaseTests(unittest.TestCase):
    def test_the_current_phase_has_work_in_flight(self):
        road = roadmap([pr(1, "worktree-c", "OPEN", merged="")])
        self.assertEqual(derive.current_phase(road).id, "P1")

    def test_otherwise_its_the_first_with_work_left_and_never_the_bugs(self):
        self.assertEqual(derive.current_phase(roadmap()).id, "P0")

    def test_with_everything_done_there_is_none(self):
        road = roadmap([pr(1, "worktree-a"), pr(2, "worktree-b"), pr(3, "worktree-c")])
        self.assertIsNone(derive.current_phase(road))

    def test_dates_run_from_first_opened_to_last_merged(self):
        road = roadmap([pr(1, "worktree-a"), pr(2, "worktree-b", merged="2026-10-09T10:00:00Z")])
        start, end = derive.phase_dates(road.phases[1])
        self.assertEqual(end - start, timedelta(days=8))

    def test_a_phase_without_prs_has_no_dates(self):
        self.assertIsNone(derive.phase_dates(roadmap().phases[2]))

    def test_a_bad_time_is_ignored(self):
        self.assertIsNone(derive.parse_time("not a time"))
        self.assertIsNone(derive.phase_dates(roadmap([pr(1, "worktree-a", created="x", merged="y")]).phases[1]))


class PipelineTests(unittest.TestCase):
    def test_in_flight_first_then_latest_merged(self):
        road = roadmap(
            [
                pr(1, "worktree-a", merged="2026-10-02T10:00:00Z"),
                pr(2, "worktree-b", merged="2026-10-05T10:00:00Z"),
                pr(3, "worktree-c", "OPEN", merged=""),
            ]
        )
        self.assertEqual([t.id for t in derive.pipeline(road)], ["c", "b", "a"])

    def test_it_keeps_only_the_latest_merged(self):
        road = roadmap([pr(1, "worktree-a"), pr(2, "worktree-b", merged="2026-10-05T10:00:00Z")])
        self.assertEqual([t.id for t in derive.pipeline(road, merged=1)], ["b"])

    def test_a_planned_task_stays_out(self):
        self.assertEqual(derive.pipeline(roadmap()), [])

    def test_a_task_marked_done_stays_in_review_while_its_pr_is_open(self):
        data = {
            "project": "d",
            "repo": "o/d",
            "phases": [{"id": "P", "name": "n", "goal": "g", "tasks": [{"id": "a", "name": "A", "status": "done"}]}],
        }
        road = apply_live(from_data(data), Live(prs=[pr(1, "worktree-a", "OPEN", merged="")]))
        self.assertEqual(road.task("a").status, "review")
        self.assertEqual([t.id for t in derive.pipeline(road)], ["a"])


class FeedTests(unittest.TestCase):
    def test_newest_first_without_merge_commits(self):
        snapshot = Snapshot(
            live=Live(prs=[pr(1, "worktree-a")]),
            commits=[
                Commit("aaa", "feat: thing", "2026-10-03T10:00:00+00:00", "x"),
                Commit("bbb", "Merge pull request #1", "2026-10-04T10:00:00+00:00", "x"),
            ],
        )
        self.assertEqual([e.title for e in derive.feed(snapshot)], ["feat: thing", "PR #1 merged", "PR #1 opened"])

    def test_it_stops_at_the_limit(self):
        snapshot = Snapshot(live=Live(prs=[pr(n, "x") for n in range(10)]))
        self.assertEqual(len(derive.feed(snapshot, limit=3)), 3)


class CommitCountTests(unittest.TestCase):
    def test_today_and_the_last_hour_leave_out_merges(self):
        snapshot = Snapshot(
            live=Live(),
            commits=[
                Commit("a", "feat: now", (NOW - timedelta(minutes=30)).isoformat(), "x"),
                Commit("b", "fix: earlier", (NOW - timedelta(hours=3)).isoformat(), "x"),
                Commit("c", "Merge pull request", (NOW - timedelta(minutes=20)).isoformat(), "x"),
                Commit("d", "fix: yesterday", (NOW - timedelta(hours=24)).isoformat(), "x"),
            ],
        )
        today, last_hour, by_hour = derive.commits_today(snapshot, NOW)
        self.assertEqual((today, last_hour, sum(by_hour), len(by_hour)), (2, 1, 2, 24))


class CodeCountTests(unittest.TestCase):
    def test_lines_and_tests_skip_generated_and_other_files(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "a.py").write_text(
                "def test_one():\n    pass\n\nasync def test_two():\n    pass\n\ndef other():\n    pass\n"
            )
            (root / "b.spec.ts").write_text(
                'test("x", () => {});\ntest.each(["a"])("y", () => {});\ntest.use({});\ntest.fail();\n'
            )
            (root / "plain.ts").write_text('test("not a test file");\n')
            (root / "schema.d.ts").write_text("generated\n" * 50)
            (root / "notes.md").write_text("words\n" * 50)
            files = ["a.py", "b.spec.ts", "plain.ts", "schema.d.ts", "notes.md", "gone.py"]
            self.assertEqual(count_code(root, files), (13, 4))


class ParseTests(unittest.TestCase):
    def test_pr_sizes_and_times_are_read_and_a_null_merge_time_is_empty(self):
        raw = '[{"number":1,"additions":5,"deletions":2,"createdAt":"2026-10-01T10:00:00Z","mergedAt":null}]'
        parsed = parse_prs(raw)[0]
        self.assertEqual((parsed.additions, parsed.deletions, parsed.merged_at), (5, 2, ""))


class FollowUpTests(unittest.TestCase):
    def test_a_follow_up_pr_doesnt_reopen_a_finished_task(self):
        data = {
            "project": "d",
            "repo": "o/d",
            "phases": [{"id": "P", "name": "n", "goal": "g", "tasks": [{"id": "a", "name": "A", "status": "done"}]}],
        }
        prs = [pr(1, "worktree-a"), pr(2, "worktree-a", "OPEN", merged="")]
        road = apply_live(from_data(data), Live(prs=prs))
        task = road.task("a")
        self.assertEqual((task.status, task.pr.number), ("done", 1))
        self.assertEqual([t.id for t in derive.pipeline(road)], ["a"])
        self.assertEqual(
            derive.phase_dates(road.phases[0])[1] - derive.phase_dates(road.phases[0])[0], timedelta(days=1)
        )


class FreshnessTests(unittest.TestCase):
    def test_a_failed_source_says_how_old_its_data_is(self):
        old = Snapshot(live=Live(), git_at=1000.0, github_at=1000.0)
        kept = keep_last_good(Snapshot(live=Live(), github_ok=False, git_at=2000.0), old)
        self.assertEqual((kept.git_at, kept.github_at), (2000.0, 1000.0))
        html = render.problems(roadmap(), kept)
        self.assertIn("Showing PRs from", html)
        self.assertNotIn("Showing commits", html)

    def test_a_healthy_page_shows_no_such_note(self):
        self.assertEqual(render.problems(roadmap(), Snapshot(live=Live(), github_at=1000.0, git_at=1000.0)), "")


class RefreshTests(unittest.TestCase):
    def dashboard(self, tmp):
        docs = Path(tmp) / "docs"
        docs.mkdir()
        (docs / "ROADMAP.yaml").write_text("project: d\nrepo: o/d\nphases: []\n")
        return Dashboard(Path(tmp))

    def test_refresh_collects_once_then_drops_itself_from_the_address(self):
        with TemporaryDirectory() as tmp:
            board = self.dashboard(tmp)
            with mock.patch("tools.pm.live.collect", return_value=Snapshot(live=Live(), taken_at=4e9)) as call:
                self.assertEqual(
                    board.handle("/board", {"refresh": ["1"], "phase": ["P1"]})[::2], (303, "/board?phase=P1")
                )
                self.assertEqual(board.handle("/", {"refresh": ["1"]})[::2], (303, "/"))
                self.assertEqual(call.call_count, 2)
                self.assertEqual(board.handle("/", {})[0], 200)
                self.assertEqual(call.call_count, 2)

    def test_a_slow_refresh_doesnt_hold_up_other_pages(self):
        collector = Collector(Path("."), "o/d", ttl=30)
        release, entered = threading.Event(), threading.Event()
        old = Snapshot(live=Live(), taken_at=9e12)

        def slow(*_):
            entered.set()
            release.wait(5)
            return Snapshot(live=Live(), taken_at=9e12)

        with mock.patch("tools.pm.live.collect", return_value=old):
            collector.get()
        with mock.patch("tools.pm.live.collect", side_effect=slow):
            forced = threading.Thread(target=collector.get, kwargs={"force": True})
            forced.start()
            entered.wait(5)
            self.assertIs(collector.get(), old)  # answers while the refresh is held
            release.set()
            forced.join(5)

    def test_an_older_collection_cant_overwrite_a_newer_one(self):
        collector = Collector(Path("."), "o/d", ttl=30)
        release, entered = threading.Event(), threading.Event()
        older, newer = Snapshot(live=Live(), taken_at=9e12), Snapshot(live=Live(), taken_at=9e12)
        results = iter([older, newer])

        def run(*_):
            result = next(results)
            if result is older:
                entered.set()
                release.wait(5)
            return result

        with mock.patch("tools.pm.live.collect", side_effect=run):
            slow = threading.Thread(target=collector.get, kwargs={"force": True})
            slow.start()
            entered.wait(5)
            self.assertIs(collector.get(force=True), newer)
            release.set()
            slow.join(5)
            self.assertIs(collector.get(), newer)


class LastGoodTests(unittest.TestCase):
    def old(self):
        live = Live(prs=[pr(1, "worktree-a")], branches_ahead={"worktree-a": 2})
        return Snapshot(live=live, commits=[Commit("a", "s", "2026-10-01T10:00:00Z", "x")], lines=10, tests=2)

    def test_a_failed_source_keeps_its_data_and_stays_red(self):
        kept = keep_last_good(Snapshot(live=Live(warnings=["w"]), git_ok=False, github_ok=False), self.old())
        self.assertEqual(
            (len(kept.live.prs), len(kept.commits), kept.lines, kept.tests, kept.live.branches_ahead),
            (1, 1, 10, 2, {"worktree-a": 2}),
        )
        self.assertEqual((kept.git_ok, kept.github_ok, kept.live.warnings), (False, False, ["w"]))

    def test_a_source_that_answered_replaces_it_even_with_nothing(self):
        kept = keep_last_good(Snapshot(live=Live()), self.old())
        self.assertEqual((kept.live.prs, kept.commits, kept.lines), ([], [], 0))

    def test_one_failing_keeps_only_its_own(self):
        kept = keep_last_good(Snapshot(live=Live(), github_ok=False), self.old())
        self.assertEqual((len(kept.live.prs), kept.commits), (1, []))


class CollectorTests(unittest.TestCase):
    def test_a_stale_snapshot_is_served_at_once_while_it_refreshes_behind(self):
        release, refreshed = threading.Event(), threading.Event()
        first = Snapshot(live=Live(), taken_at=1.0)
        second = Snapshot(live=Live(), taken_at=9e12)  # far ahead, so it never goes stale here

        def slow(*_):
            release.wait(5)
            refreshed.set()
            return second

        collector = Collector(Path("."), "o/d", ttl=30)
        with mock.patch("tools.pm.live.collect", return_value=first):
            self.assertIs(collector.get(), first)
        with mock.patch("tools.pm.live.collect", side_effect=slow) as call:
            self.assertIs(collector.get(), first)  # stale, and returned while the refresh is held
            self.assertIs(collector.get(), first)  # a second page doesn't start a second refresh
            release.set()
            refreshed.wait(5)
            for _ in range(100):
                if collector.get() is second:
                    break
                threading.Event().wait(0.01)
            self.assertIs(collector.get(), second)
            self.assertEqual(call.call_count, 1)

    def test_an_asked_for_refresh_waits_for_the_new_data(self):
        collector = Collector(Path("."), "o/d", ttl=30)
        fresh = Snapshot(live=Live(), taken_at=9e12)
        with mock.patch("tools.pm.live.collect", return_value=fresh):
            self.assertIs(collector.get(force=True), fresh)


class OverviewTests(unittest.TestCase):
    def html(self, *prs, **kw):
        return render.overview(roadmap(prs), Snapshot(live=Live(prs=list(prs)), **kw), NOW)

    def test_the_strip_of_numbers(self):
        html = self.html(pr(1, "worktree-a"), pr(2, "worktree-c", "OPEN", merged=""), lines=1234, tests=56)
        for text in ("1 of 3 tasks done", "1 merged, 2 total", "1,234 <small>lines</small>", "56 tests defined"):
            self.assertIn(text, html)
        self.assertIn('<span class="now">now</span>', html)

    def test_bugs_are_counted_apart_and_folded_away(self):
        html = self.html()
        self.assertIn("<details", html)
        self.assertIn("Open bugs · 1", html)
        self.assertIn("0 of 3 tasks done", html)  # the bug isn't a task of the roadmap's

    def test_a_merged_task_is_at_the_last_stage_with_its_size(self):
        html = self.html(pr(1, "worktree-a", additions=1200, deletions=3))
        self.assertIn('class="dot done at" title="Merged"', html)
        self.assertIn("+1,200 −3", html)

    def test_titles_are_escaped_in_the_feed(self):
        evil = PullRequest(
            9, "<script>x</script>", "OPEN", "worktree-c", "https://example.com/9", created_at="2026-10-31T10:00:00Z"
        )
        self.assertNotIn("<script>x", self.html(evil))
        quote = PullRequest(9, 'a" onclick="x', "OPEN", "worktree-c", "u", created_at="2026-10-31T10:00:00Z")
        self.assertNotIn('" onclick="x', self.html(quote))

    def test_a_source_that_never_answered_shows_no_false_numbers(self):
        road = roadmap()
        html = render.overview(road, Snapshot(live=Live(), git_ok=False, github_ok=False), NOW)
        for false in (
            "0 merged",
            "0 total",
            "No open PRs",
            "Nothing in flight",
            "not started",
            "Nothing yet",
            "tests defined",
        ):
            self.assertNotIn(false, html)
        self.assertIn("GitHub hasn't answered", html)
        self.assertIn("unknown", html)

    def test_a_phase_done_without_prs_doesnt_say_not_started(self):
        data = {
            "project": "d",
            "repo": "o/d",
            "phases": [{"id": "P", "name": "n", "goal": "g", "tasks": [{"id": "a", "name": "A", "status": "done"}]}],
        }
        html = render.overview(apply_live(from_data(data), Live()), Snapshot(live=Live()), NOW)
        self.assertIn("no PRs", html)
        self.assertNotIn("not started", html)

    def test_an_empty_roadmap_still_renders(self):
        empty = apply_live(from_data({"project": "d", "repo": "o/d", "phases": []}), Live())
        html = render.overview(empty, Snapshot(live=Live()), NOW)
        self.assertIn("0 of 0 tasks done", html)
        self.assertIn("Nothing yet.", html)


if __name__ == "__main__":
    unittest.main()
