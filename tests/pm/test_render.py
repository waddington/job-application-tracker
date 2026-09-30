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


if __name__ == "__main__":
    unittest.main()
