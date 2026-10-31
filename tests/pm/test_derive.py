import unittest
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory

from tools.pm import derive, render
from tools.pm.live import Commit, Snapshot, count_code, parse_prs
from tools.pm.roadmap import Live, PullRequest, apply_live, from_data

NOW = datetime(2026, 10, 31, 12, 0, tzinfo=UTC).astimezone()


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
        self.assertEqual((start.day, end.day), (1, 9))

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

    def test_a_blocked_or_planned_task_stays_out(self):
        self.assertEqual(derive.pipeline(roadmap()), [])


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
                Commit("a", "feat: now", "2026-10-31T11:30:00+00:00", "x"),
                Commit("b", "fix: earlier", "2026-10-31T09:00:00+00:00", "x"),
                Commit("c", "Merge pull request", "2026-10-31T11:40:00+00:00", "x"),
                Commit("d", "fix: yesterday", "2026-10-30T11:00:00+00:00", "x"),
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

    def test_an_empty_roadmap_still_renders(self):
        empty = apply_live(from_data({"project": "d", "repo": "o/d", "phases": []}), Live())
        html = render.overview(empty, Snapshot(live=Live()), NOW)
        self.assertIn("0 of 0 tasks done", html)
        self.assertIn("Nothing yet.", html)


if __name__ == "__main__":
    unittest.main()
