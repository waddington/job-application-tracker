import unittest

from tools.pm import render
from tools.pm.live import Commit, Snapshot
from tools.pm.roadmap import Live, PullRequest, apply_live, from_data


def state():
    roadmap = from_data(
        {
            "project": "demo",
            "repo": "owner/demo",
            "phases": [
                {
                    "id": "P0",
                    "name": "Start",
                    "goal": "Go",
                    "tasks": [
                        {"id": "a", "name": "<script>alert(1)</script>", "estimate_h": 2, "prd": "docs/prd/x.md"},
                        {"id": "b", "name": "Second", "estimate_h": 2, "depends": ["a"]},
                        {"id": "c", "name": "Gate", "owner": "kai", "status": "blocked", "depends": ["b"]},
                    ],
                }
            ],
        }
    )
    live = Live(prs=[PullRequest(7, "PR title", "OPEN", "worktree-a", "https://example.com/7")])
    snapshot = Snapshot(live=live, commits=[Commit("abc123", "feat: thing", "2026-09-30T10:00:00+01:00", "x")])
    return apply_live(roadmap, live), snapshot


class RenderTests(unittest.TestCase):
    def test_pages_render_and_escape(self):
        roadmap, snapshot = state()
        for body in (
            render.overview(roadmap, snapshot),
            render.board(roadmap, snapshot),
            render.roadmap_page(roadmap, snapshot),
        ):
            html = render.page("T", "/", body, roadmap, snapshot)
            self.assertNotIn("<script>alert", html)
            self.assertIn("&lt;script&gt;", html)
        overview = render.overview(roadmap, snapshot)
        self.assertIn("PR #7", overview)
        self.assertIn("abc123", overview)
        self.assertIn("https://github.com/owner/demo/blob/main/docs/prd/x.md", overview)

    def test_board_phase_filter(self):
        roadmap, snapshot = state()
        self.assertIn("Second", render.board(roadmap, snapshot, "P0"))
        self.assertNotIn("Second", render.board(roadmap, snapshot, "P9"))

    def test_json(self):
        roadmap, snapshot = state()
        data = render.as_json(roadmap, snapshot)
        self.assertEqual(data["phases"][0]["tasks"][0]["status"], "review")
        self.assertEqual(data["next_up"], [])


class LookTests(unittest.TestCase):
    def html(self, active="/board", **flags):
        roadmap, snapshot = state()
        for name, value in flags.items():
            setattr(snapshot, name, value)
        return render.page("T", active, "body", roadmap, snapshot)

    def test_the_current_tab_is_marked(self):
        html = self.html()
        self.assertIn('<a href="/board" class="tab active" aria-current="page">Board</a>', html)
        self.assertIn('<a href="/" class="tab">Overview</a>', html)
        self.assertEqual(html.count("aria-current"), 1)

    def test_every_source_is_lit_when_all_answer(self):
        html = self.html()
        for name in ("git", "GitHub", "roadmap"):
            self.assertIn(f"<i></i>{name}</span>", html)
        self.assertNotIn('class="src bad"', html)
        self.assertNotIn('class="live down"', html)

    def test_a_source_that_fails_shows_red(self):
        for flag, name in (("git_ok", "git"), ("github_ok", "GitHub")):
            html = self.html(**{flag: False})
            self.assertIn(f'<span class="src bad" title="{name}: not available">', html)
            self.assertIn('class="live down"', html)

    def test_a_broken_roadmap_shows_red(self):
        roadmap, snapshot = state()
        roadmap.errors.append("bad file")
        html = render.page("T", "/", "body", roadmap, snapshot)
        self.assertIn('<span class="src bad" title="roadmap: not available">', html)

    def test_the_theme_is_set_before_the_page_paints_and_can_be_switched(self):
        html = self.html()
        self.assertLess(html.index('setAttribute("data-theme",t)'), html.index("<style>"))
        self.assertIn('id="theme"', html)

    def test_it_loads_nothing_from_the_web(self):
        html = self.html()
        self.assertNotIn("https://", html)
        self.assertNotIn("http://", html)


class BugTests(unittest.TestCase):
    def roadmap(self, **live):
        data = {
            "project": "demo",
            "repo": "owner/demo",
            "phases": [
                {
                    "id": "B",
                    "name": "Bugs",
                    "goal": "Fix them",
                    "tasks": [
                        {"id": "low-one", "name": "Small bug", "type": "bug", "severity": "low"},
                        {"id": "high-one", "name": "Bad bug", "type": "bug", "severity": "high", "estimate_h": 1},
                        {"id": "fixed-one", "name": "Old bug", "type": "bug", "severity": "medium", "status": "done"},
                        {"id": "plain", "name": "A task"},
                    ],
                }
            ],
        }
        return apply_live(from_data(data), Live(**live))

    def test_a_bug_starts_in_the_bug_status(self):
        roadmap = self.roadmap()
        self.assertEqual(roadmap.task("high-one").status, "bug")
        self.assertEqual(roadmap.task("plain").status, "planned")
        self.assertEqual(roadmap.errors, [])

    def test_a_fix_moves_it_along_and_it_stays_a_bug(self):
        pr = PullRequest(9, "Fix", "OPEN", "worktree-high-one", "https://example.com/9")
        task = self.roadmap(prs=[pr]).task("high-one")
        self.assertEqual((task.status, task.type), ("review", "bug"))
        merged = PullRequest(9, "Fix", "MERGED", "worktree-high-one", "https://example.com/9")
        self.assertEqual(self.roadmap(prs=[merged]).task("high-one").status, "done")

    def test_open_bugs_are_worst_first_and_leave_out_fixed_ones(self):
        self.assertEqual([t.id for t in self.roadmap().open_bugs()], ["high-one", "low-one"])

    def test_a_bug_needs_a_severity_and_known_values(self):
        data = {
            "project": "demo",
            "repo": "owner/demo",
            "phases": [
                {
                    "id": "B",
                    "name": "Bugs",
                    "goal": "g",
                    "tasks": [
                        {"id": "no-severity", "name": "x", "type": "bug"},
                        {"id": "bad-severity", "name": "x", "type": "bug", "severity": "awful"},
                        {"id": "bad-type", "name": "x", "type": "epic"},
                        {"id": "not-a-bug", "name": "x", "type": "task", "status": "bug"},
                    ],
                }
            ],
        }
        errors = " ".join(from_data(data).errors)
        for text in ("no-severity", "bad-severity", "bad-type", "not-a-bug"):
            self.assertIn(text, errors)

    def test_the_board_has_a_bug_column_first_and_tags_a_bug_being_fixed(self):
        pr = PullRequest(9, "Fix", "OPEN", "worktree-high-one", "https://example.com/9")
        roadmap = self.roadmap(prs=[pr])
        html = render.board(roadmap, Snapshot(live=Live()))
        self.assertLess(html.index('pill bug">bug'), html.index('pill planned">planned'))
        self.assertIn("BUG · high", html)

    def test_details_show_and_are_escaped(self):
        data = {
            "project": "demo",
            "repo": "owner/demo",
            "phases": [
                {
                    "id": "B",
                    "name": "Bugs",
                    "goal": "g",
                    "tasks": [
                        {"id": "d", "name": "Short", "type": "bug", "severity": "low", "detail": "<b>Longer</b>"}
                    ],
                }
            ],
        }
        roadmap = apply_live(from_data(data), Live())
        for html in (render.board(roadmap, Snapshot(live=Live())), render.roadmap_page(roadmap, Snapshot(live=Live()))):
            self.assertIn("&lt;b&gt;Longer&lt;/b&gt;", html)

    def test_the_home_page_lists_open_bugs(self):
        html = render.overview(self.roadmap(), Snapshot(live=Live()))
        self.assertIn("Open bugs · 2", html)
        self.assertIn("BUG · high", html)
        self.assertIn("Bad bug", html)
        self.assertLess(html.index("Bad bug"), html.index("Small bug"))


if __name__ == "__main__":
    unittest.main()
