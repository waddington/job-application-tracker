import unittest
from pathlib import Path

from tools.pm.roadmap import BranchRoadmap, Live, Phase, PullRequest, Task, apply_live, from_data, load

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
        live = Live(
            prs=[PullRequest(1, "a", "MERGED", "worktree-a", "u"), PullRequest(5, "a2", "OPEN", "worktree-a", "u")]
        )
        self.assertEqual(apply_live(sample(), live).task("a").status, "review")

    def test_a_draft_pr_is_building_and_a_ready_one_is_review(self):
        draft = PullRequest(2, "c", "OPEN", "worktree-b", "u", is_draft=True)
        task = apply_live(sample(), Live(prs=[draft])).task("b")
        self.assertEqual((task.status, task.status_source), ("building", "PR #2 open as a draft"))
        ready = PullRequest(2, "c", "OPEN", "worktree-b", "u")
        self.assertEqual(apply_live(sample(), Live(prs=[ready])).task("b").status, "review")

    def test_a_task_marked_done_on_a_draft_isnt_done_yet(self):
        roadmap = from_data({"phases": [{"id": "P", "tasks": [{"id": "x", "status": "done"}]}]})
        draft = PullRequest(2, "c", "OPEN", "worktree-x", "u", is_draft=True)
        self.assertEqual(apply_live(roadmap, Live(prs=[draft])).task("x").status, "building")

    def test_next_up_and_summary(self):
        roadmap = apply_live(sample(), Live(prs=[PullRequest(1, "a", "MERGED", "worktree-a", "u")]))
        self.assertEqual([t.id for t in roadmap.next_up()], ["b"])
        self.assertEqual(roadmap.waiting(roadmap.task("d")), ["b"])
        summary = roadmap.summary()
        self.assertEqual(summary["done_h"], 2)
        self.assertEqual(summary["estimate_h"], 10)
        self.assertEqual(summary["percent"], 20)
        self.assertEqual(roadmap.phases[0].done_h, 2)


def on_branch(branch, *task_ids, phase="P0", status="planned", errors=()):
    tasks = [Task(i, f"{i} on {branch}", phase, planned_status=status, status=status) for i in task_ids]
    return BranchRoadmap(branch, "sha", [Phase(phase, "Branch phase", "goal", tasks)], list(errors))


class BranchTaskTests(unittest.TestCase):
    def test_a_task_only_on_a_branch_shows_with_live_status(self):
        live = Live(
            branches_ahead={"worktree-new": 2},
            prs=[PullRequest(9, "n", "OPEN", "worktree-new", "u", is_draft=True)],
            branch_roadmaps={"worktree-new": on_branch("worktree-new", "new")},
        )
        roadmap = apply_live(sample(), live)
        task = roadmap.task("new")
        self.assertEqual((task.on_branch, task.status, task.phase), ("worktree-new", "building", "P0"))
        self.assertEqual(roadmap.phases[0].tasks[-1].id, "new")

    def test_a_task_on_both_uses_mains_definition_with_live_status(self):
        live = Live(
            prs=[PullRequest(9, "n", "OPEN", "worktree-b", "u")],
            branch_roadmaps={"worktree-b": on_branch("worktree-b", "b")},
        )
        roadmap = apply_live(sample(), live)
        self.assertEqual([t.id for t in roadmap.tasks].count("b"), 1)
        task = roadmap.task("b")
        self.assertEqual((task.name, task.on_branch, task.status), ("b", None, "review"))

    def test_a_merged_or_closed_branch_adds_nothing(self):
        for state in ("MERGED", "CLOSED"):
            live = Live(
                prs=[PullRequest(9, "n", state, "worktree-new", "u")],
                branch_roadmaps={"worktree-new": on_branch("worktree-new", "new", errors=["bad"])},
            )
            roadmap = apply_live(sample(), live)
            self.assertIsNone(roadmap.task("new"), state)
            self.assertEqual(roadmap.errors, [], state)

    def test_a_phase_only_on_the_branch_is_added(self):
        live = Live(branch_roadmaps={"worktree-new": on_branch("worktree-new", "new", phase="P9")})
        phase = apply_live(sample(), live).phases[-1]
        self.assertEqual((phase.id, phase.name, [t.id for t in phase.tasks]), ("P9", "Branch phase", ["new"]))

    def test_nothing_on_a_branch_is_done_until_it_merges(self):
        live = Live(branch_roadmaps={"worktree-y": on_branch("worktree-y", "sibling", status="done")})
        self.assertEqual(apply_live(sample(), live).task("sibling").status, "building")

    def test_a_tasks_own_branch_wins_when_two_add_it(self):
        live = Live(
            branch_roadmaps={
                "worktree-a-other": on_branch("worktree-a-other", "z"),
                "worktree-z": on_branch("worktree-z", "z"),
                "worktree-zz": on_branch("worktree-zz", "z"),
            }
        )
        roadmap = apply_live(sample(), live)
        self.assertEqual(roadmap.task("z").on_branch, "worktree-z")
        self.assertEqual([t.id for t in roadmap.tasks].count("z"), 1)

    def test_a_requests_status_doesnt_leak_into_the_shared_branch_data(self):
        branch = on_branch("worktree-new", "new")
        apply_live(sample(), Live(branches_ahead={"worktree-new": 1}, branch_roadmaps={"worktree-new": branch}))
        self.assertEqual((branch.phases[0].tasks[0].status, branch.phases[0].tasks[0].on_branch), ("planned", None))

    def test_a_branchs_errors_are_named_and_turn_the_roadmap_light_red(self):
        live = Live(branch_roadmaps={"worktree-new": BranchRoadmap("worktree-new", errors=["can't be read"])})
        self.assertEqual(apply_live(sample(), live).errors, ["worktree-new: can't be read"])


if __name__ == "__main__":
    unittest.main()
