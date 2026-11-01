import json
import re
import unittest
from datetime import datetime
from itertools import product
from pathlib import Path
from tempfile import TemporaryDirectory

from tools.pm import charts, derive, render, task_page
from tools.pm.live import Commit, Snapshot, TaskEvidence, parse_branch_roadmap
from tools.pm.roadmap import BranchRoadmap, Live, Phase, PullRequest, Task, apply_live, from_data, load
from tools.pm.yamlish import parse


class SecondReviewTests(unittest.TestCase):
    def sibling(self, *prs, ahead=None, status="planned", kind="task"):
        main = from_data({"phases": [{"id": "P", "tasks": [{"id": "own"}]}]})
        extra = from_data({"phases": [{"id": "P", "tasks": [{"id": "sib", "status": status, "type": kind}]}]}).phases
        live = Live(
            branches_ahead={"worktree-own": 2, **(ahead or {})},
            prs=list(prs),
            branch_roadmaps={"worktree-own": BranchRoadmap("worktree-own", "s", extra)},
        )
        roadmap = apply_live(main, live)
        return roadmap.task("sib"), roadmap

    HOST = PullRequest(9, "Host", "OPEN", "worktree-own", "https://example.com/9")
    CLOSED = PullRequest(5, "Old", "CLOSED", "worktree-sib", "https://example.com/5")

    def why(self, task):
        return task_page.stage_why(task)

    def test_a_sibling_with_its_own_closed_pr_shows_the_hosts_open_one(self):
        task, _ = self.sibling(self.CLOSED, self.HOST)
        self.assertEqual(task.pr.number, 9)
        self.assertIn("in PR #9, open.", self.why(task))

    def test_a_sibling_with_its_own_closed_pr_and_no_host_pr_says_so(self):
        task, _ = self.sibling(self.CLOSED)
        self.assertEqual(task.pr.number, 5)
        self.assertIn("PR #5 is closed.", self.why(task))
        self.assertNotIn("no PR", self.why(task))

    def test_a_sibling_whose_own_branch_is_level_with_main_keeps_the_hosts_pr(self):
        task, _ = self.sibling(self.HOST, ahead={"worktree-sib": 0})
        self.assertEqual((task.work_branch, task.pr.number), ("worktree-own", 9))
        self.assertIn("in PR #9, open.", self.why(task))

    def test_a_sibling_with_no_pr_anywhere_says_its_branch_has_none(self):
        task, _ = self.sibling()
        self.assertIn("which has no PR yet", self.why(task))

    def test_a_sibling_bug_in_an_open_pr_doesnt_say_no_fix_started(self):
        task, _ = self.sibling(self.HOST, status="bug", kind="bug")
        self.assertIn("in PR #9, open.", self.why(task))
        self.assertNotIn("No fix", self.why(task))

    def test_a_bug_whose_pr_closed_says_so(self):
        roadmap = from_data({"phases": [{"id": "B", "tasks": [{"id": "fix", "type": "bug", "severity": "low"}]}]})
        closed = PullRequest(5, "t", "CLOSED", "worktree-fix", "u")
        self.assertIn("PR #5 closed", self.why(apply_live(roadmap, Live(prs=[closed])).task("fix")))

    def test_done_in_a_branchs_file_says_where_the_status_is_from(self):
        task, roadmap = self.sibling(self.HOST, status="done")
        self.assertEqual(task.status, "building")
        self.assertEqual(task.status_source, "roadmap on worktree-own says done, not merged yet")
        self.assertIn("That file says done, which it isn't until it merges.", self.why(task))
        self.assertIn("says done, not merged yet", render.roadmap_page(roadmap, Snapshot(live=Live())))

    def test_a_huge_estimate_is_listed_and_every_page_still_renders(self):
        for value in (1e308, -1, 10_001):
            roadmap = from_data(
                {"phases": [{"id": "P", "tasks": [{"id": "x", "estimate_h": value, "status": "done"}]}]}
            )
            self.assertEqual(roadmap.task("x").estimate_h, 0, value)
            self.assertIn("estimate_h must be a number", roadmap.errors[0])
            snapshot = Snapshot(live=Live())
            apply_live(roadmap, snapshot.live)
            render.roadmap_page(roadmap, snapshot)
            render.as_json(roadmap, snapshot)

    def test_a_file_cant_claim_unknown(self):
        roadmap = from_data({"phases": [{"id": "P", "tasks": [{"id": "x", "status": "unknown"}]}]})
        self.assertEqual(roadmap.task("x").planned_status, "planned")
        self.assertIn("x: unknown status 'unknown'", roadmap.errors)

    def test_a_non_utf8_roadmap_is_a_problem_on_main_and_on_a_branch(self):
        with TemporaryDirectory() as folder:
            path = Path(folder) / "ROADMAP.yaml"
            path.write_bytes(b"project: caf\xe9\n")
            self.assertIn("ROADMAP.yaml", load(path).errors[0])
        found = parse_branch_roadmap("b", "sha", b"project: caf\xe9\n".decode(errors="replace"), "")
        self.assertEqual((found.phases, found.errors), ([], ["its roadmap can't be read: it isn't valid UTF-8"]))


class GitHubUnknownChartTests(unittest.TestCase):
    def setUp(self):
        tasks = [{"id": "a"}, {"id": "b"}, {"id": "c", "status": "done"}]
        self.live = Live(branches_ahead={"worktree-a": 1, "worktree-b": 1}, prs_known=False)
        self.roadmap = apply_live(from_data({"phases": [{"id": "P", "name": "n", "tasks": tasks}]}), self.live)
        self.now = datetime(2026, 11, 1, 12).astimezone()

    def test_phase_status_counts_every_task(self):
        html = charts.status_table(self.roadmap)
        self.assertIn(">Unknown</th>", html)
        self.assertEqual(re.findall(r'<td class="num">([^<]*)</td>', html)[:2], ["1", "·"])
        self.assertIn('<td class="num">2</td>', html)

    def test_no_unknown_column_when_github_answered(self):
        roadmap = apply_live(from_data({"phases": [{"id": "P", "tasks": [{"id": "a"}]}]}), Live())
        self.assertNotIn("Unknown", charts.status_table(roadmap))

    def test_the_burn_up_says_its_count_is_partial(self):
        html = charts.burnup_panel(self.roadmap, Snapshot(live=self.live, github_ok=False), self.now)
        self.assertIn("at least 1 of 3 tasks done", html)
        self.assertIn("At least 1 of 3 tasks are done", html)
        self.assertNotIn("1 of 3 tasks merged", html)

    def test_unknown_work_makes_its_phase_the_current_one(self):
        self.assertEqual(derive.current_phase(self.roadmap).id, "P")
        tasks = [{"id": "z", "status": "planned"}]
        data = {"phases": [{"id": "Q", "tasks": tasks}, {"id": "P", "tasks": [{"id": "a"}]}]}
        roadmap = apply_live(from_data(data), Live(branches_ahead={"worktree-a": 1}, prs_known=False))
        self.assertEqual(derive.current_phase(roadmap).id, "P")


class BadBranchFieldTests(unittest.TestCase):
    """Whatever a branch's file holds, every page renders, the bad value is listed and the rest still show."""

    FIELDS = ("name", "owner", "type", "status", "severity", "detail", "estimate_h", "depends", "prd", "rfc")
    VALUES = ("7", "true", "[1, 2]", "{a: 1}", '"nan"', '"inf"', "null", '""')

    def render_all(self, line):
        base = "phases:\n  - id: P\n    name: n\n    tasks:\n      - {id: a, name: A}\n"
        text = f"{base}      - {{id: good, name: Good}}\n      - {line}\n"
        branch = parse_branch_roadmap("worktree-new", "sha", text, base)
        main = from_data(parse(base))
        main.repo = "o/d"
        live = Live(branches_ahead={"worktree-new": 1}, branch_roadmaps={"worktree-new": branch})
        roadmap = apply_live(main, live)
        snapshot = Snapshot(live=live)
        render.overview(roadmap, snapshot)
        render.board(roadmap, snapshot)
        render.roadmap_page(roadmap, snapshot)
        json.dumps(render.as_json(roadmap, snapshot))
        for task in roadmap.tasks:
            task_page.task_page(task, roadmap, TaskEvidence())
        return roadmap

    def test_any_value_in_any_field(self):
        for name, value in product(self.FIELDS, self.VALUES):
            with self.subTest(field=name, value=value):
                roadmap = self.render_all(f"{{id: odd, {name}: {value}}}")
                self.assertIsNotNone(roadmap.task("good"))

    def test_bad_documents_and_estimates_are_listed(self):
        for line, words in (
            ("{id: odd, prd: 7}", "odd: prd must be a path"),
            ("{id: odd, rfc: true}", "odd: rfc must be a path"),
            ('{id: odd, estimate_h: "nan"}', "odd: estimate_h must be a number from 0 to 10000"),
        ):
            with self.subTest(line=line):
                roadmap = self.render_all(line)
                self.assertEqual(roadmap.errors, [f"worktree-new: {words}"])
                self.assertIsNotNone(roadmap.task("odd"))

    def test_a_phase_with_a_bad_shape_leaves_the_others(self):
        base = "phases:\n  - id: P\n    tasks:\n      - {id: a}\n"
        text = f"{base}      - {{id: good}}\n  - id: Q\n    tasks: 5\n"
        branch = parse_branch_roadmap("b", "sha", text, base)
        self.assertEqual([t.id for p in branch.phases for t in p.tasks], ["good"])
        self.assertEqual(branch.errors, ["Q: tasks must be a list"])


class SiblingTests(unittest.TestCase):
    """A task added by another task's branch, which has a draft PR."""

    def setUp(self):
        main = from_data({"phases": [{"id": "P", "tasks": [{"id": "own"}]}]})
        sibling = Task("sib", "Sibling", "P")
        self.draft = PullRequest(901, "PR", "OPEN", "worktree-own", "https://example.com/901", is_draft=True)
        live = Live(
            branches_ahead={"worktree-own": 2},
            prs=[self.draft],
            branch_roadmaps={"worktree-own": BranchRoadmap("worktree-own", "s", [Phase("P", "n", "", [sibling])])},
        )
        self.roadmap = apply_live(main, live)
        self.task = self.roadmap.task("sib")

    def test_it_uses_the_branch_and_pr_it_lives_on(self):
        self.assertEqual(
            (self.task.work_branch, self.task.pr, self.task.commits_ahead), ("worktree-own", self.draft, 2)
        )

    def test_its_page_says_only_what_is_true(self):
        evidence = TaskEvidence("branch", ahead=2, behind=0)
        html = task_page.task_page(self.task, self.roadmap, evidence, [self.draft])
        self.assertIn("in PR #901, open as a draft", html)
        self.assertIn("<code>worktree-own</code>", html)
        for false in ("no open PR says otherwise", "worktree-sib", "not started", "None yet", "No branch yet"):
            self.assertNotIn(false, html)

    def test_its_own_branch_takes_over_once_it_has_one(self):
        main = from_data({"phases": [{"id": "P", "tasks": [{"id": "own"}]}]})
        branch = BranchRoadmap("worktree-own", "s", [Phase("P", "n", "", [Task("sib", "S", "P")])])
        live = Live(branches_ahead={"worktree-sib": 1}, branch_roadmaps={"worktree-own": branch})
        task = apply_live(main, live).task("sib")
        self.assertEqual((task.work_branch, task.status), ("worktree-sib", "building"))


class GitHubNeverAnsweredTests(unittest.TestCase):
    def setUp(self):
        main = from_data({"phases": [{"id": "P", "tasks": [{"id": "a"}, {"id": "b"}, {"id": "c", "status": "done"}]}]})
        extra = BranchRoadmap("worktree-new", "s", [Phase("P", "n", "", [Task("new", "New", "P")])])
        self.live = Live(
            branches_ahead={"worktree-a": 1, "worktree-new": 3},
            branch_roadmaps={"worktree-new": extra},
            prs_known=False,
        )
        self.roadmap = apply_live(main, self.live)
        self.snapshot = Snapshot(live=self.live, github_ok=False)

    def test_commits_dont_claim_building(self):
        task = self.roadmap.task("a")
        self.assertEqual(task.status, "unknown")
        self.assertIn("1 commit on worktree-a; its PR is unknown", task.status_source)

    def test_branch_tasks_are_held_out_of_the_totals_and_that_is_said(self):
        self.assertIsNone(self.roadmap.task("new"))
        self.assertEqual(self.roadmap.summary()["tasks"], 3)
        self.assertIn("held back", render.problems(self.roadmap, self.snapshot))

    def test_the_task_page_claims_nothing_about_prs(self):
        for task_id, unlike in (("a", "None yet"), ("b", "no open PR says otherwise"), ("c", "with no PR or branch")):
            html = task_page.task_page(self.roadmap.task(task_id), self.roadmap, TaskEvidence())
            self.assertIn("GitHub hasn't answered", html, task_id)
            self.assertNotIn(unlike, html, task_id)
            self.assertNotIn("not started", html, task_id)

    def test_the_board_shows_an_unknown_column_only_when_needed(self):
        self.assertIn('pill unknown">unknown', render.board(self.roadmap, self.snapshot))
        known = apply_live(from_data({"phases": [{"id": "P", "tasks": [{"id": "a"}]}]}), Live())
        self.assertNotIn('pill unknown">unknown', render.board(known, Snapshot(live=Live())))

    def test_one_commit_and_many(self):
        known = apply_live(
            from_data({"phases": [{"id": "P", "tasks": [{"id": "a"}]}]}), Live(branches_ahead={"worktree-a": 1})
        )
        self.assertEqual(known.task("a").status_source, "1 commit on worktree-a")


class DraftAndBranchTests(unittest.TestCase):
    def setUp(self):
        roadmap = from_data({"repo": "o/d", "phases": [{"id": "P", "name": "n", "tasks": [{"id": "a", "name": "A"}]}]})
        extra = Task("new", "New <task>", "P", prd="docs/x.md")
        draft = PullRequest(
            7, "PR", "OPEN", "worktree-a", "https://example.com/7", is_draft=True, created_at="2026-10-01T10:00:00Z"
        )
        self.live = Live(
            prs=[draft],
            branch_roadmaps={"worktree-new": BranchRoadmap("worktree-new", "s", [Phase("P", "n", "", [extra])])},
        )
        self.roadmap = apply_live(roadmap, self.live)
        self.snapshot = Snapshot(live=self.live)

    def column(self, status):
        """The Board's column for a status."""
        html = render.board(self.roadmap, self.snapshot)
        return next(c for c in html.split('<div class="col">') if f'pill {status}">{status}' in c)

    def test_a_draft_sits_in_the_building_column_not_review(self):
        self.assertIn("/task/a", self.column("building"))
        self.assertNotIn("/task/a", self.column("review"))

    def test_the_overview_counts_a_draft_as_building_and_labels_it(self):
        self.assertEqual(self.roadmap.summary()["counts"]["building"], 1)
        self.assertEqual(self.roadmap.summary()["counts"]["review"], 0)
        html = render.overview(self.roadmap, self.snapshot)
        self.assertIn("· draft", html)
        self.assertIn("PR #7 opened as a draft", html)

    def test_a_branch_task_is_marked_wherever_it_shows(self):
        pages = (render.board(self.roadmap, self.snapshot), render.roadmap_page(self.roadmap, self.snapshot))
        for html in pages:
            self.assertIn("on its branch", html)
            self.assertIn("New &lt;task&gt;", html)
        tasks = render.as_json(self.roadmap, self.snapshot)["phases"][0]["tasks"]
        self.assertEqual(tasks[1]["on_branch"], "worktree-new")

    def test_a_branch_task_links_its_documents_on_the_branch(self):
        self.assertIn("/blob/worktree-new/docs/x.md", render.task_links(self.roadmap, self.roadmap.task("new")))
        self.assertIn("/blob/main/", render.repo_link(self.roadmap, "docs/y.md", "Y"))

    def test_the_task_page_says_where_it_lives_and_why(self):
        task = self.roadmap.task("new")
        html = task_page.task_page(task, self.roadmap, TaskEvidence())
        self.assertIn("Only on <code>worktree-new</code> so far, not on main", html)
        self.assertIn("Only on the roadmap of <code>worktree-new</code> so far, which has no PR yet.", html)
        self.assertNotIn("docs/ROADMAP.yaml", html)

    def test_a_draft_task_page_gives_the_draft_as_the_reason(self):
        html = task_page.task_page(self.roadmap.task("a"), self.roadmap, TaskEvidence())
        self.assertIn("PR #7 open as a draft.", html)
        self.assertIn('pill building">building', html)

    def test_a_task_on_main_has_no_mark(self):
        self.assertEqual(render.task_tags(self.roadmap.task("a")), "")


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
            self.assertIn(f'<span class="src bad" title="{name}: has problems, listed below">', html)
            self.assertIn('class="live down"', html)

    def test_a_broken_roadmap_shows_red(self):
        roadmap, snapshot = state()
        roadmap.errors.append("bad file")
        html = render.page("T", "/", "body", roadmap, snapshot)
        self.assertIn('<span class="src bad" title="roadmap: has problems, listed below">', html)

    def test_the_theme_is_set_before_the_page_paints_and_can_be_switched(self):
        html = self.html()
        self.assertLess(html.index('setAttribute("data-theme",t)'), html.index("<style>"))
        self.assertIn('id="theme"', html)

    def test_it_loads_nothing_from_the_web(self):
        roadmap, snapshot = state()
        # Links to GitHub are fine; nothing may be fetched as the page loads.
        for body in (
            render.overview(roadmap, snapshot),
            render.board(roadmap, snapshot),
            render.roadmap_page(roadmap, snapshot),
        ):
            html = render.page("T", "/", body, roadmap, snapshot)
            for word in (" src=", "url(", "@import"):
                self.assertNotIn(word, html)
            self.assertEqual(html.count("<link"), html.count('<link rel="icon" href="data:,">'))


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
