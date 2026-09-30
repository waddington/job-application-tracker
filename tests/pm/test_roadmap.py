import unittest
from pathlib import Path

from tools.pm.roadmap import Live, PullRequest, apply_live, from_data, load

ROOT = Path(__file__).resolve().parents[2]


def sample():
    return from_data(
        {
            "project": "demo",
            "phases": [
                {
                    "id": "P0",
                    "name": "Start",
                    "tasks": [
                        {"id": "a", "estimate_h": 2, "depends": []},
                        {"id": "b", "estimate_h": 3, "depends": ["a"]},
                        {"id": "c", "estimate_h": 1, "depends": ["a"], "status": "blocked"},
                    ],
                },
                {"id": "P1", "tasks": [{"id": "d", "estimate_h": 4, "depends": ["b"]}]},
            ],
        }
    )


class LoadTests(unittest.TestCase):
    def test_repo_roadmap_is_valid(self):
        roadmap = load(ROOT / "docs" / "ROADMAP.yaml")
        self.assertEqual(roadmap.errors, [])
        self.assertGreater(len(roadmap.tasks), 10)

    def test_validation_errors(self):
        roadmap = from_data(
            {
                "phases": [
                    {
                        "id": "P0",
                        "tasks": [
                            {"id": "x", "depends": ["y"]},
                            {"id": "y", "depends": ["x"]},
                            {"id": "z", "depends": ["nope"], "status": "weird"},
                            {"id": "z"},
                        ],
                    }
                ]
            }
        )
        text = "\n".join(roadmap.errors)
        self.assertIn("duplicate task id 'z'", text)
        self.assertIn("unknown task 'nope'", text)
        self.assertIn("unknown status 'weird'", text)
        self.assertIn("dependency cycle", text)

    def test_missing_file(self):
        self.assertTrue(load(ROOT / "nope.yaml").errors)


class LiveTests(unittest.TestCase):
    def test_statuses_from_evidence(self):
        live = Live(
            branches_ahead={"worktree-b": 3},
            prs=[
                PullRequest(1, "a", "MERGED", "worktree-a", "u1"),
                PullRequest(2, "c", "OPEN", "worktree-c", "u2"),
            ],
        )
        roadmap = apply_live(sample(), live)
        status = {t.id: t.status for t in roadmap.tasks}
        self.assertEqual(status, {"a": "done", "b": "building", "c": "blocked", "d": "planned"})
        self.assertEqual(roadmap.task("b").commits_ahead, 3)

    def test_open_pr_beats_older_merged(self):
        live = Live(prs=[PullRequest(1, "a", "MERGED", "worktree-a", "u"),
                         PullRequest(5, "a2", "OPEN", "worktree-a", "u")])
        self.assertEqual(apply_live(sample(), live).task("a").status, "review")

    def test_next_up_and_summary(self):
        roadmap = apply_live(sample(), Live(prs=[PullRequest(1, "a", "MERGED", "worktree-a", "u")]))
        self.assertEqual([t.id for t in roadmap.next_up()], ["b"])
        self.assertEqual(roadmap.waiting(roadmap.task("d")), ["b"])
        summary = roadmap.summary()
        self.assertEqual(summary["done_h"], 2)
        self.assertEqual(summary["estimate_h"], 10)
        self.assertEqual(summary["percent"], 20)
        self.assertEqual(roadmap.phases[0].done_h, 2)


if __name__ == "__main__":
    unittest.main()
