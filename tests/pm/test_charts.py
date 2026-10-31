import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest import mock

from tools.pm import charts, derive, render
from tools.pm.live import Snapshot, collect, count_scope, keep_last_good
from tools.pm.roadmap import Live, PullRequest, apply_live, from_data
from tools.pm.style import CSS

NOW = datetime(2026, 10, 31, 12, 0).astimezone()


def ago(days):
    return (NOW - timedelta(days=days)).isoformat()


def merged(number, branch, days):
    return PullRequest(
        number, f"T{number}", "MERGED", branch, "https://example.com", created_at=ago(days + 1), merged_at=ago(days)
    )


def road(prs=(), extra=()):
    data = {
        "project": "demo",
        "repo": "o/d",
        "start": "2026-10-01",
        "phases": [
            {
                "id": "B",
                "name": "Bugs",
                "goal": "g",
                "tasks": [{"id": "fix", "name": "Bug", "type": "bug", "severity": "low"}],
            },
            {
                "id": "P0",
                "name": "<Zero>",
                "goal": "g",
                "tasks": [{"id": "a", "name": "A <b>"}, {"id": "b", "name": "B"}, *extra],
            },
            {"id": "P1", "name": "One", "goal": "g", "tasks": [{"id": "c", "name": "C"}]},
        ],
    }
    return apply_live(from_data(data), Live(prs=list(prs)))


class ScopeTests(unittest.TestCase):
    def test_tasks_are_counted_without_bugs_or_phases(self):
        text = (
            "phases:\n  - id: P0\n    tasks:\n      - {id: a, name: A}\n      - {id: b, name: B}\n"
            "      - {id: fix, name: F, type: bug, severity: low}\n"
        )
        self.assertEqual(count_scope(text), 2)

    def test_history_is_read_oldest_first_and_each_version_only_once(self):
        calls = []

        def run(args, cwd, timeout=15):
            calls.append(args)
            if "--first-parent" in args:
                return "s1\x1f2026-10-01T10:00:00+00:00\ns2\x1f2026-10-02T10:00:00+00:00\n"
            if "show" in args:
                return "      - {id: a, name: A}\n" * (1 if "s1:" in args[2] else 3)
            return ""

        with mock.patch("tools.pm.live._run", side_effect=run), mock.patch("tools.pm.live._scope_seen", {}):
            first = collect(Path("."), "o/d").scope
            shows = sum("show" in c for c in calls)
            second = collect(Path("."), "o/d").scope
        self.assertEqual([n for _, n in first], [1, 3])
        self.assertEqual(second, first)
        self.assertEqual(shows, 2)
        self.assertEqual(sum("show" in c for c in calls), 2)

    def test_a_failed_source_keeps_its_scope(self):
        old = Snapshot(live=Live(), scope=[("2026-10-01T10:00:00Z", 5)])
        self.assertEqual(keep_last_good(Snapshot(live=Live(), git_ok=False), old).scope, old.scope)


class BurnupTests(unittest.TestCase):
    def test_merged_climbs_to_the_total_done_and_leaves_bugs_out(self):
        b = derive.burnup(road([merged(1, "worktree-a", 20), merged(2, "worktree-b", 5)]), Snapshot(live=Live()), NOW)
        self.assertEqual([n for _, n in b.merged], [0, 1, 2, 2])
        self.assertEqual((b.done, b.total), (2, 3))
        self.assertEqual(b.merged[-1][0], NOW)

    def test_scope_follows_the_roadmaps_history_and_ends_at_todays_size(self):
        snapshot = Snapshot(live=Live(), scope=[(ago(20), 1), (ago(10), 2)])
        self.assertEqual([n for _, n in derive.burnup(road(), snapshot, NOW).scope], [1, 1, 2, 3])

    def test_without_history_scope_is_flat(self):
        self.assertEqual({n for _, n in derive.burnup(road(), Snapshot(live=Live()), NOW).scope}, {3})

    def test_the_forecast_comes_from_the_last_two_weeks_pace(self):
        prs = [merged(1, "worktree-a", 20), merged(2, "worktree-b", 7)]
        b = derive.burnup(road(prs), Snapshot(live=Live()), NOW)
        self.assertEqual(b.recent, 1)  # 1 task in 14 days, 1 left
        self.assertEqual(b.forecast, NOW + timedelta(days=14))

    def test_no_recent_merges_or_nothing_left_means_no_forecast(self):
        self.assertIsNone(derive.burnup(road([merged(1, "worktree-a", 30)]), Snapshot(live=Live()), NOW).forecast)
        prs = [merged(1, "worktree-a", 1), merged(2, "worktree-b", 1), merged(3, "worktree-c", 1)]
        self.assertIsNone(derive.burnup(road(prs), Snapshot(live=Live()), NOW).forecast)

    def test_done_without_a_pr_counts_from_the_start(self):
        b = derive.burnup(road(extra=[{"id": "d", "name": "D", "status": "done"}]), Snapshot(live=Live()), NOW)
        self.assertEqual((b.undated, b.merged[0][1]), (1, 1))

    def test_an_empty_roadmap_is_fine(self):
        empty = apply_live(from_data({"project": "d", "repo": "o/d", "phases": []}), Live())
        html = charts.burnup_panel(empty, Snapshot(live=Live()), NOW)
        self.assertIn("0 of 0 tasks merged", html)
        self.assertIn("Everything on the roadmap is done", html)


class BurnupChartTests(unittest.TestCase):
    def panel(self, prs):
        return charts.burnup_panel(road(prs), Snapshot(live=Live()), NOW)

    def test_it_says_a_forecast_is_a_forecast(self):
        html = self.panel([merged(1, "worktree-a", 3)])
        self.assertIn("a forecast, as the roadmap holds no planned dates", html)
        self.assertIn('class="ln-forecast"', html)

    def test_without_a_forecast_it_says_why_and_draws_none(self):
        html = self.panel([merged(1, "worktree-a", 30)])
        self.assertIn("Nothing merged in the last 14 days", html)
        self.assertNotIn('class="ln-forecast"', html)

    def test_a_far_forecast_doesnt_squash_the_chart(self):
        prs = [merged(1, "worktree-a", 13)]
        data = road(prs, extra=[{"id": f"x{n}", "name": "X"} for n in range(50)])
        b = derive.burnup(data, Snapshot(live=Live()), NOW)
        svg = charts.burnup_svg(b)
        self.assertGreater(b.forecast, NOW + timedelta(days=100))
        self.assertNotIn(charts.day(b.forecast), svg)
        self.assertIn(charts.day(NOW + (NOW - b.start) / 2), svg)


class FailedSourceTests(unittest.TestCase):
    def test_github_never_answering_states_no_false_merges(self):
        html = charts.burnup_panel(road(), Snapshot(live=Live(), github_ok=False), NOW)
        self.assertIn("merges over time aren't known", html)
        self.assertNotIn("ln-merged", html)
        self.assertNotIn("Nothing merged", html)
        self.assertNotIn("done with no merged PR", html)
        self.assertNotIn("key-merged", html)

    def test_git_never_answering_draws_no_false_scope(self):
        html = charts.burnup_panel(road(), Snapshot(live=Live(), git_ok=False), NOW)
        self.assertIn("scope over time isn't known", html)
        self.assertNotIn("ln-scope", html)
        self.assertNotIn("key-scope", html)

    def test_kept_data_is_still_drawn_when_a_source_fails_later(self):
        prs = [merged(1, "worktree-a", 3)]
        snapshot = Snapshot(live=Live(prs=prs), github_ok=False, git_ok=False, scope=[(ago(9), 2)])
        html = charts.burnup_panel(road(prs), snapshot, NOW)
        self.assertIn("ln-merged", html)
        self.assertIn("ln-scope", html)

    def test_the_forecast_legend_shows_only_with_a_forecast(self):
        self.assertNotIn("key-forecast", charts.burnup_panel(road(), Snapshot(live=Live()), NOW))
        with_one = charts.burnup_panel(road([merged(1, "worktree-a", 3)]), Snapshot(live=Live()), NOW)
        self.assertIn("key-forecast", with_one)


class FoldTests(unittest.TestCase):
    def test_folds_have_ids_so_they_survive_the_auto_reload(self):
        roadmap = road()
        snapshot = Snapshot(live=Live())
        self.assertIn('id="phase-P0"', render.roadmap_page(roadmap, snapshot, NOW))
        self.assertIn('id="open-bugs"', render.overview(roadmap, snapshot, NOW))
        self.assertIn("details[id]", render.page("T", "/", "", roadmap, snapshot))


class TimelineTests(unittest.TestCase):
    def test_a_phase_with_prs_gets_a_bar_ticks_and_every_row_the_today_line(self):
        html = charts.timeline_html(road([merged(1, "worktree-a", 10)]), NOW)
        self.assertEqual(html.count('class="span"'), 1)
        self.assertEqual(html.count('class="tick"'), 1)
        self.assertEqual(html.count('class="today"'), 3)
        self.assertIn("1 of 2 tasks done", html)

    def test_the_range_runs_from_the_start_past_today(self):
        t = derive.timeline(road(), NOW)
        self.assertEqual(t.start.date().isoformat(), "2026-10-01")
        self.assertGreater(t.end, NOW)

    def test_positions_stay_in_range(self):
        start, end = NOW - timedelta(days=1), NOW
        self.assertEqual(charts._at(NOW + timedelta(days=9), start, end), 100.0)
        self.assertEqual(charts._at(NOW - timedelta(days=9), start, end), 0.0)
        self.assertEqual(charts._at(NOW, NOW, NOW), 0.0)

    def test_names_are_escaped(self):
        html = charts.timeline_html(road([merged(1, "worktree-a", 10)]), NOW) + charts.status_table(road())
        self.assertNotIn("<Zero>", html)
        self.assertNotIn("A <b>", html)


class StatusTableTests(unittest.TestCase):
    def test_counts_by_status_with_hours_and_percent(self):
        html = charts.status_table(road([merged(1, "worktree-a", 10)]))
        self.assertIn("50%", html)
        self.assertIn('<th class="num">Bugs</th>', html)

    def test_an_empty_phase_doesnt_divide_by_zero(self):
        data = {"project": "d", "repo": "o/d", "phases": [{"id": "P", "name": "n", "goal": "g", "tasks": []}]}
        self.assertIn("0%", charts.status_table(apply_live(from_data(data), Live())))


class PageTests(unittest.TestCase):
    def test_no_style_of_the_charts_clashes_with_the_logo(self):
        self.assertIn(".mark{width:15px", CSS)
        self.assertEqual(CSS.count(".mark{"), 1)

    def test_the_page_opens_with_the_charts_and_only_the_current_phase_unfolded(self):
        html = render.roadmap_page(road([merged(1, "worktree-a", 10)]), Snapshot(live=Live()), NOW)
        self.assertLess(html.index("Phase status"), html.index('id="phase-B"'))
        for section in ("timeline", "burnup", "status"):  # each can be collapsed, and starts open
            self.assertIn(f'<details id="section-{section}" class="panel" open>', html)
        self.assertIn("Burn-up", html)
        self.assertIn("Phase status", html)
        self.assertEqual(html.count('id="phase-'), 3)
        self.assertEqual(html.count('class="panel gap" open>'), 1)


if __name__ == "__main__":
    unittest.main()
