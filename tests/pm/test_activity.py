import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest import mock

from tools.pm import activity
from tools.pm.live import Commit, Snapshot, area_of, collect, keep_last_good
from tools.pm.roadmap import Live, PullRequest

NOW = datetime(2026, 10, 31, 12, 0).astimezone()


def ago(days, hours=0):
    return (NOW - timedelta(days=days, hours=hours)).isoformat()


def commit(subject, days=0, hours=0):
    return Commit("abc", subject, ago(days, hours), "x")


def pr(number, state="MERGED", opened=3, merged=2, additions=10, deletions=5):
    return PullRequest(
        number,
        f"T{number}",
        state,
        f"worktree-{number}",
        "https://example.com",
        created_at=ago(opened),
        merged_at=ago(merged) if state == "MERGED" else "",
        additions=additions,
        deletions=deletions,
    )


class KindTests(unittest.TestCase):
    def test_types_and_scopes(self):
        for subject, expected in (
            ("feat(pm): a thing", ("feat", "pm")),
            ("fix: a thing", ("fix", None)),
            ("feat(api)!: breaking", ("feat", "api")),
            ("Initial commit", ("other", None)),
            ("wip: not one of ours", ("other", None)),
            ("build: unusual type", ("other", None)),
        ):
            self.assertEqual(activity.commit_kind(subject), expected, subject)


class CommitBarTests(unittest.TestCase):
    def test_a_bar_per_day_by_type_without_merges(self):
        snapshot = Snapshot(
            live=Live(),
            commits=[
                commit("feat: a", 2),
                commit("feat: b", 2),
                commit("fix: c", 0),
                commit("Merge pull request #1", 0),
            ],
        )
        bars = activity.commits_over_time(snapshot, NOW)
        self.assertEqual(len(bars.starts), 3)
        self.assertEqual(bars.days_each, 1)
        self.assertEqual(bars.series["feat"], [2, 0, 0])
        self.assertEqual(bars.series["fix"], [0, 0, 1])

    def test_a_long_history_gets_a_bar_per_week(self):
        snapshot = Snapshot(live=Live(), commits=[commit("feat: old", 200), commit("feat: new", 0)])
        bars = activity.commits_over_time(snapshot, NOW)
        self.assertEqual(bars.days_each, 7)
        self.assertEqual(sum(bars.series["feat"]), 2)

    def test_no_commits_is_fine(self):
        bars = activity.commits_over_time(Snapshot(live=Live()), NOW)
        self.assertIn("0 commits", activity.commits_chart(bars))


class ThroughputTests(unittest.TestCase):
    def test_it_climbs_to_the_totals_and_runs_to_now(self):
        prs = [pr(1, opened=5, merged=4), pr(2, opened=3, merged=2), pr(3, "OPEN", opened=1)]
        opened, merged = activity.throughput(prs, NOW)
        self.assertEqual((opened[-1], merged[-1]), ((NOW, 3), (NOW, 2)))
        self.assertEqual([n for _, n in merged], [0, 1, 2, 2])

    def test_no_prs(self):
        self.assertEqual(activity.throughput([], NOW), ([], []))
        self.assertIn("0 PRs opened", activity.throughput_chart([], [], NOW))


class SizeTests(unittest.TestCase):
    def test_the_latest_oldest_first_without_abandoned_ones(self):
        prs = [pr(5), pr(3), pr(4, "CLOSED"), pr(6, "OPEN")]
        self.assertEqual([p.number for p in activity.pr_sizes(prs)], [3, 5, 6])
        self.assertEqual([p.number for p in activity.pr_sizes(prs, limit=1)], [6])

    def test_the_note_counts_those_over_the_limit(self):
        note = activity.size_note([pr(1, additions=900, deletions=200), pr(2, additions=100, deletions=0)])
        self.assertIn("over 1,000", note)
        self.assertIn("1 over", note)
        self.assertIn("typically 600", note)

    def test_the_chart_labels_hold_both_ends(self):
        html = activity.size_chart([pr(3), pr(9)])
        self.assertIn("#3", html)
        self.assertIn("#9", html)


class AreaTests(unittest.TestCase):
    def test_a_file_lands_in_the_most_specific_area(self):
        for name, area in (
            ("frontend/e2e/a.spec.ts", "Browser tests"),
            ("frontend/src/a.tsx", "Frontend"),
            ("tests/pm/test_a.py", "PM dashboard"),
            ("tests/test_a.py", "Backend"),
            ("src/jat/a.py", "Backend"),
            ("tools/pm/a.py", "PM dashboard"),
            ("README.py", "Other"),
        ):
            self.assertEqual(area_of(name), area, name)


class HeatTests(unittest.TestCase):
    def test_two_weeks_ending_today(self):
        snapshot = Snapshot(live=Live(), commits=[commit("feat: a", 0, 1), commit("Merge x", 0, 1)])
        days, counts = activity.heatmap(snapshot, NOW)
        self.assertEqual((len(days), days[-1]), (14, NOW.date()))
        self.assertEqual(counts[(NOW.date(), 11)], 1)
        self.assertEqual(activity.heatmap_grid(days, counts).count('class="on" style'), 1)


class ScopeTests(unittest.TestCase):
    def test_most_used_first(self):
        snapshot = Snapshot(live=Live(), commits=[commit("feat(pm): a"), commit("fix(pm): b"), commit("fix(api): c")])
        self.assertEqual(activity.scopes(snapshot), [("pm", 2), ("api", 1)])


class LongHistoryTests(unittest.TestCase):
    def test_weekly_bars_say_they_are_weeks(self):
        snapshot = Snapshot(live=Live(), commits=[commit("feat: old", 200), commit("feat: new", 0)])
        html = activity.activity_page(snapshot, NOW)
        self.assertIn("a bar per week", html)
        self.assertIn("<title>Week of ", html)

    def test_daily_bars_say_so(self):
        html = activity.activity_page(Snapshot(live=Live(), commits=[commit("feat: new", 0)]), NOW)
        self.assertIn("a bar per day", html)
        self.assertNotIn("Week of", html)

    def test_reaching_the_commit_limit_warns(self):
        line = "abc\x1ffeat: a\x1f2026-10-01T10:00:00+00:00\x1fx\n"

        def run(args, cwd, timeout=15):
            return line * 3 if "-n" in args else ""

        with mock.patch("tools.pm.live._run", side_effect=run), mock.patch("tools.pm.live.COMMIT_LIMIT", 3):
            self.assertIn("only the latest 3 commits", " ".join(collect(Path("."), "o/d").live.warnings))


class PartialFailureTests(unittest.TestCase):
    def test_areas_that_never_answered_say_so_though_commits_did(self):
        snapshot = Snapshot(live=Live(), commits=[commit("feat: a")], git_ok=False)
        html = activity.activity_page(snapshot, NOW)
        self.assertEqual(html.count("git hasn't answered"), 2)  # lines and tests, nothing else

    def test_a_failed_source_keeps_its_areas(self):
        old = Snapshot(live=Live(), areas={"Backend": (1, 1)})
        self.assertEqual(keep_last_good(Snapshot(live=Live(), git_ok=False), old).areas, old.areas)


class EdgeTests(unittest.TestCase):
    def test_an_old_commit_stays_off_the_heatmap(self):
        days, counts = activity.heatmap(Snapshot(live=Live(), commits=[commit("feat: a", 20)]), NOW)
        self.assertNotIn('class="on"', activity.heatmap_grid(days, counts))

    def test_a_pr_of_no_lines_draws(self):
        self.assertIn("#1: +0 −0", activity.size_chart([pr(1, additions=0, deletions=0)]))


class PageTests(unittest.TestCase):
    def test_every_section_shows_and_can_collapse(self):
        snapshot = Snapshot(
            live=Live(prs=[pr(1)]), commits=[commit("feat(<b>): a")], areas={"Backend": (100, 4), "Other": (5, 0)}
        )
        html = activity.activity_page(snapshot, NOW)
        for key in ("commits", "throughput", "prsize", "lines", "tests", "heat", "scope"):
            self.assertIn(f'<details id="section-{key}" class="panel" open>', html)
        self.assertEqual(html.count("<details"), html.count("</details>"))
        self.assertIn("100 lines", html)
        self.assertIn("4 tests", html)
        self.assertNotIn("0 tests", html)  # an area with none is left out
        self.assertNotIn("<b>", html)  # a scope can't inject markup

    def test_sources_that_never_answered_show_no_false_charts(self):
        html = activity.activity_page(Snapshot(live=Live(), git_ok=False, github_ok=False), NOW)
        self.assertIn("git hasn't answered", html)
        self.assertIn("GitHub hasn't answered", html)
        self.assertNotIn("<svg", html)
        self.assertNotIn("No PRs yet", html)

    def test_kept_data_is_still_drawn_after_a_later_failure(self):
        snapshot = Snapshot(live=Live(prs=[pr(1)]), commits=[commit("feat: a")], git_ok=False, github_ok=False)
        self.assertEqual(activity.activity_page(snapshot, NOW).count("<svg"), 3)


if __name__ == "__main__":
    unittest.main()
