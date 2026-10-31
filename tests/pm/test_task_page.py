import os
import subprocess
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import mock

from tools.pm import render, task_page
from tools.pm.live import Snapshot, TaskEvidence, parse_diff, parse_prs, task_evidence
from tools.pm.roadmap import Live, PullRequest, apply_live, from_data
from tools.pm.server import Dashboard


def pr(state="MERGED", merge_commit="abc", **kw):
    return PullRequest(
        7,
        "A <title>",
        state,
        "worktree-a",
        "https://example.com/7",
        created_at="2026-10-01T10:00:00+00:00",
        merged_at="2026-10-02T10:00:00+00:00" if state == "MERGED" else "",
        merge_commit=merge_commit,
        additions=120,
        deletions=4,
        **kw,
    )


def road(prs=(), **task):
    data = {
        "project": "d",
        "repo": "o/d",
        "phases": [
            {
                "id": "P",
                "name": "n",
                "goal": "g",
                "tasks": [
                    {"id": "first", "name": "First"},
                    {"id": "a", "name": "A <b>", "depends": ["first", "gone"], "prd": "docs/x.md", **task},
                    {"id": "later", "name": "Later", "depends": ["a"]},
                ],
            }
        ],
    }
    return apply_live(from_data(data), Live(prs=list(prs)))


class DiffTests(unittest.TestCase):
    def test_lines_and_tests_from_source_files_only(self):
        diff = (
            "diff --git a/src/a.py b/src/a.py\n--- a/src/a.py\n+++ b/src/a.py\n@@ -1 +1,2 @@\n-old\n+new\n+more\n"
            "diff --git a/tests/t.py b/tests/t.py\n--- /dev/null\n+++ b/tests/t.py\n@@ -0,0 +1,2 @@\n"
            "+def test_one():\n+    pass\n"
            "diff --git a/e2e/a.spec.ts b/e2e/a.spec.ts\n--- a/e2e/a.spec.ts\n+++ b/e2e/a.spec.ts\n@@ -1 +1 @@\n"
            '+test("x", () => {});\n'
            "diff --git a/uv.lock b/uv.lock\n--- a/uv.lock\n+++ b/uv.lock\n@@ -1 +1 @@\n-a\n+b\n"
            "diff --git a/f/schema.d.ts b/f/schema.d.ts\n--- a/f/schema.d.ts\n+++ b/f/schema.d.ts\n@@ -1 +1 @@\n+x\n"
        )
        self.assertEqual(parse_diff(diff), (5, 1, 2))

    def test_a_deleted_file_counts_its_lines(self):
        diff = "diff --git a/a.py b/a.py\n--- a/a.py\n+++ /dev/null\n@@ -1,2 +0,0 @@\n-one\n-two\n"
        self.assertEqual(parse_diff(diff), (0, 2, 0))

    def test_a_line_of_code_that_looks_like_a_header_is_just_a_line(self):
        diff = "diff --git a/a.py b/a.py\n--- a/a.py\n+++ b/a.py\n@@ -1 +1 @@\n--- a/other\n+++ b/other.lock\n"
        self.assertEqual(parse_diff(diff), (1, 1, 0))


class PathTests(unittest.TestCase):
    def test_a_path_with_spaces_ends_in_a_tab_and_still_counts(self):
        diff = "diff --git a/a b.py b/a b.py\n--- a/a b.py\t\n+++ b/a b.py\t\n@@ -1 +1 @@\n-x\n+y\n"
        self.assertEqual(parse_diff(diff), (1, 1, 0))

    def test_a_merged_pr_with_no_commit_reads_nothing(self):
        with mock.patch("tools.pm.live._run", side_effect=AssertionError("shouldn't read")):
            self.assertEqual(task_evidence(Path("."), "b", pr(merge_commit="")).source, "")


class ParseTests(unittest.TestCase):
    def test_the_merge_commit_is_read_and_may_be_missing(self):
        raw = '[{"number":1,"mergeCommit":{"oid":"abc"}},{"number":2,"mergeCommit":null}]'
        self.assertEqual([p.merge_commit for p in parse_prs(raw)], ["abc", ""])


class RealGitTests(unittest.TestCase):
    def setUp(self):
        tmp = TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.root = Path(tmp.name)
        env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
        patch = mock.patch.dict(os.environ, env, clear=True)
        patch.start()
        self.addCleanup(patch.stop)
        self.git("init", "-q", "-b", "main")
        self.commit("base.py", "x\n", "first")
        self.git("checkout", "-q", "-b", "worktree-a")
        self.commit("a.py", "one\ndef test_a():\n    pass\n", "feat: on the branch")
        self.git("checkout", "-q", "main")
        self.commit("other.py", "y\n", "chore: main moves on")

    def git(self, *args):
        identity = ["-c", "user.name=T", "-c", "user.email=t@example.com"]
        done = subprocess.run(["git", *identity, *args], cwd=self.root, check=True, capture_output=True, text=True)
        return done.stdout.strip()

    def commit(self, name, text, message):
        (self.root / name).write_text(text)
        self.git("add", "-A")
        self.git("commit", "-qm", message)

    def test_a_branch_in_flight(self):
        found = task_evidence(self.root, "worktree-a", None)
        self.assertEqual((found.source, found.ahead, found.behind), ("branch", 1, 1))
        self.assertEqual((found.added, found.removed, found.tests), (3, 0, 1))  # main's own commit isn't counted
        self.assertEqual(found.last_subject, "feat: on the branch")

    def test_a_merged_pr_reads_its_merge_and_is_remembered(self):
        self.git("merge", "-q", "--no-ff", "-m", "Merge", "worktree-a")
        sha = self.git("rev-parse", "HEAD")
        self.git("branch", "-qD", "worktree-a")
        found = task_evidence(self.root, "worktree-a", pr(merge_commit=sha))
        self.assertEqual((found.source, found.ahead), ("merged", None))
        self.assertEqual((found.added, found.tests), (3, 1))
        self.assertEqual(found.last_subject, "feat: on the branch")
        with mock.patch("tools.pm.live._run", side_effect=OSError("no git")):
            self.assertIs(task_evidence(self.root, "worktree-a", pr(merge_commit=sha)), found)

    def test_a_squash_merge_has_one_parent_and_still_reads(self):
        self.git("merge", "-q", "--squash", "worktree-a")
        self.git("commit", "-qm", "feat: squashed")
        found = task_evidence(self.root, "worktree-a", pr(merge_commit=self.git("rev-parse", "HEAD")))
        self.assertEqual((found.source, found.added, found.unreadable), ("merged", 3, False))
        self.assertEqual(found.last_subject, "feat: squashed")

    def test_a_merge_of_main_into_the_branch_doesnt_inflate_it(self):
        self.git("checkout", "-q", "worktree-a")
        self.git("merge", "-q", "--no-ff", "-m", "Merge main in", "main")
        self.git("checkout", "-q", "main")
        self.git("merge", "-q", "--no-ff", "-m", "Merge", "worktree-a")
        found = task_evidence(self.root, "worktree-a", pr(merge_commit=self.git("rev-parse", "HEAD")))
        self.assertEqual(found.added, 3)

    def test_no_branch_and_no_pr(self):
        self.assertEqual(task_evidence(self.root, "worktree-none", None).source, "")

    def test_git_failing_is_marked(self):
        with mock.patch("tools.pm.live._run", side_effect=OSError("no git")):
            self.assertTrue(task_evidence(self.root, "worktree-a", pr("OPEN")).unreadable)


class PageTests(unittest.TestCase):
    def page(self, evidence=None, prs=(), **task):
        roadmap = road(prs, **task)
        return task_page.task_page(roadmap.task("a"), roadmap, evidence or TaskEvidence())

    def test_a_merged_task(self):
        evidence = TaskEvidence(
            "merged",
            added=10,
            removed=2,
            tests=3,
            last_sha="abc",
            last_subject="feat: <x>",
            last_when="2026-10-02T10:00:00+00:00",
        )
        html = self.page(evidence, [pr()])
        self.assertIn("PR #7 merged.", html)
        self.assertIn('class="dot done at"', html)
        self.assertIn("+10 −2", html)
        self.assertIn("+120 −4", html)
        self.assertIn("<dt>Tests added</dt><dd>3</dd>", html)
        self.assertIn("feat: &lt;x&gt;", html)
        self.assertIn("(merged)", html)
        self.assertNotIn("Against main", html)

    def test_a_branch_in_flight_shows_ahead_and_behind(self):
        html = self.page(TaskEvidence("branch", ahead=2, behind=5), [pr("OPEN", merge_commit="")])
        self.assertIn("2 ahead, 5 behind", html)
        self.assertNotIn("(merged)", html)
        self.assertIn("PR #7 open.", html)
        self.assertIn('class="dot review at"', html)

    def test_a_task_not_started(self):
        html = self.page()
        self.assertIn("(not started)", html)
        self.assertIn("No branch yet", html)
        self.assertIn("None yet", html)
        self.assertIn("docs/ROADMAP.yaml", html)
        self.assertIn("Waiting on first, gone", html)

    def test_marked_done_with_nothing_to_read_says_so(self):
        self.assertIn("Marked done on the roadmap", self.page(status="done"))

    def test_a_branch_gone_without_merging_says_so(self):
        closed = pr("CLOSED", merge_commit="")
        self.assertIn("never merged", self.page(prs=[closed]))

    def test_git_failing_says_so(self):
        self.assertIn("couldn't read", self.page(TaskEvidence(unreadable=True)))

    def test_dependencies_link_both_ways_and_a_missing_one_says_so(self):
        html = self.page()
        self.assertIn('href="/task/first"', html)
        self.assertIn('href="/task/later"', html)
        self.assertIn("<code>gone</code> (not on the roadmap)", html)

    def test_a_blocked_task_has_no_track(self):
        self.assertNotIn('class="track"', self.page(status="blocked"))

    def test_text_is_escaped(self):
        html = self.page(prs=[pr()], detail="<i>detail</i>")
        for raw in ("A <b>", "<i>detail", "A <title>"):
            self.assertNotIn(raw, html)
        self.assertEqual(html.count("<div"), html.count("</div>"))


class BranchNoteTests(unittest.TestCase):
    def note(self, evidence=None, prs=(), **task):
        return task_page.branch_note(road(prs, **task).task("a"), evidence or TaskEvidence())

    def test_each_case_says_only_what_is_known(self):
        self.assertEqual(self.note(), " (not started)")
        self.assertEqual(self.note(status="done"), " (none: marked done on the roadmap)")
        self.assertEqual(self.note(TaskEvidence("branch"), [pr("OPEN")]), "")
        self.assertEqual(self.note(TaskEvidence("merged"), [pr()]), " (merged)")
        self.assertEqual(self.note(prs=[pr("CLOSED")]), " (not found)")

    def test_a_git_failure_claims_nothing_about_the_branch(self):
        self.assertEqual(self.note(TaskEvidence(unreadable=True), [pr()]), "")


class EmptyCodeTests(unittest.TestCase):
    def code(self, *prs):
        roadmap = road(prs)
        return task_page.task_page(roadmap.task("a"), roadmap, TaskEvidence())

    def test_merged_with_no_commit_doesnt_say_it_never_merged(self):
        html = self.code(pr(merge_commit=""))
        self.assertIn("no merge commit", html)
        self.assertNotIn("never merged", html)

    def test_open_with_no_branch_here_suggests_a_fetch(self):
        html = self.code(pr("OPEN", merge_commit=""))
        self.assertIn("git fetch", html)
        self.assertNotIn("never merged", html)

    def test_no_source_changes_says_so(self):
        roadmap = road([pr()])
        html = task_page.task_page(roadmap.task("a"), roadmap, TaskEvidence("merged"))
        self.assertIn("No source changes", html)

    def test_other_prs_on_the_branch_are_listed(self):
        first, second = pr(), pr()
        first.number = 3
        roadmap = road([first, second])
        html = task_page.task_page(roadmap.task("a"), roadmap, TaskEvidence("merged"), [first, second])
        self.assertIn("Other PRs", html)
        self.assertIn("#3", html)


class WhyTests(unittest.TestCase):
    def test_a_merged_pr_is_the_evidence_even_when_the_roadmap_also_says_done(self):
        task = road([pr()], status="done").task("a")
        self.assertEqual(task_page.stage_why(task), "PR #7 merged.")

    def test_done_with_no_pr_rests_on_the_roadmap(self):
        self.assertIn("says done", task_page.stage_why(road(status="done").task("a")))

    def test_a_bug_not_started_says_so(self):
        task = road(type="bug", severity="low").task("a")
        self.assertIn("No fix has started", task_page.stage_why(task))

    def test_a_bug_being_fixed_shows_its_pr(self):
        task = road([pr("OPEN", merge_commit="")], type="bug", severity="low").task("a")
        self.assertEqual(task_page.stage_why(task), "PR #7 open.")


class LinkTests(unittest.TestCase):
    def test_every_list_links_to_the_task(self):
        roadmap = road([pr("OPEN", merge_commit="")])
        snapshot = Snapshot(live=Live())
        for html in (
            render.overview(roadmap, snapshot),
            render.board(roadmap, snapshot),
            render.roadmap_page(roadmap, snapshot),
        ):
            self.assertIn('href="/task/a"', html)

    def test_an_odd_id_is_encoded_and_escaped(self):
        self.assertEqual(render.task_link('a"/b'), '<a href="/task/a%22%2Fb"><code>a&quot;/b</code></a>')


class ServerTests(unittest.TestCase):
    def test_the_route(self):
        with TemporaryDirectory() as tmp:
            docs = Path(tmp) / "docs"
            docs.mkdir()
            (docs / "ROADMAP.yaml").write_text(
                "project: d\nrepo: o/d\nphases:\n  - id: P\n    name: n\n    goal: g\n    tasks:\n"
                "      - {id: a-b, name: A}\n"
            )
            board = Dashboard(Path(tmp))
            fresh = Snapshot(live=Live(), taken_at=4e9)
            with (
                mock.patch("tools.pm.live.collect", return_value=fresh),
                mock.patch("tools.pm.server.task_evidence", return_value=TaskEvidence()) as read,
            ):
                self.assertEqual(board.handle("/task/a-b", {})[0], 200)
                read.assert_called_once()
                status, _, body = board.handle("/task/nope", {})
                self.assertEqual(status, 404)
                self.assertIn("No such task", body)


if __name__ == "__main__":
    unittest.main()
