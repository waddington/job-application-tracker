import json
import subprocess
import unittest
from pathlib import Path
from unittest import mock

from tools.pm import live as live_module
from tools.pm.live import (
    SEP,
    Snapshot,
    collect,
    keep_last_good,
    parse_branch_roadmap,
    parse_branches,
    parse_commits,
    parse_prs,
    parse_worktrees,
    unfetched_prs,
)
from tools.pm.roadmap import BranchRoadmap, Live, Phase, PullRequest, Task

MAIN_FILE = "phases:\n  - id: P\n    tasks:\n      - {id: old, name: Old}\n"
BRANCH_FILE = MAIN_FILE + "      - {id: new, name: New}\n"


class BranchRoadmapTests(unittest.TestCase):
    def fake_git(self, calls, ahead="1\n", show=BRANCH_FILE, branches="worktree-new\n"):
        def run(args, cwd, timeout=15):
            calls.append(args)
            if "for-each-ref" in args:
                return branches
            if "rev-list" in args:
                return ahead
            if "show" in args:
                return MAIN_FILE if args[-1].startswith("base") else show
            if "merge-base" in args:
                return "base\n"
            return "tip1\n" if "rev-parse" in args and args[-1] != "origin/main" else ""

        return run

    def collect(self, calls=None, **kw):
        with (
            mock.patch("tools.pm.live._run", side_effect=self.fake_git([] if calls is None else calls, **kw)),
            mock.patch.dict(live_module._branch_seen, clear=True),
        ):
            return collect(Path("."), "owner/demo")

    def test_only_tasks_the_branch_added_are_taken(self):
        found = parse_branch_roadmap("worktree-new", "sha", BRANCH_FILE, MAIN_FILE)
        self.assertEqual([t.id for p in found.phases for t in p.tasks], ["new"])
        self.assertEqual(found.errors, [])

    def test_a_phase_with_nothing_new_is_left_out(self):
        self.assertEqual(parse_branch_roadmap("b", "sha", MAIN_FILE, MAIN_FILE).phases, [])

    def test_bad_files_become_errors_not_exceptions(self):
        for text in ("phases: [unclosed\n  : :\n", "- just\n- a list\n", "phases: 5\n"):
            found = parse_branch_roadmap("b", "sha", text, MAIN_FILE)
            self.assertEqual(found.phases, [], text)
            self.assertTrue(found.errors, text)

    def test_a_commit_with_no_roadmap_has_nothing_to_say(self):
        found = parse_branch_roadmap("b", "sha", "", MAIN_FILE)
        self.assertEqual((found.phases, found.errors), ([], []))

    def test_collect_reads_a_branch_once_per_commit(self):
        calls = []
        with (
            mock.patch("tools.pm.live._run", side_effect=self.fake_git(calls)),
            mock.patch.dict(live_module._branch_seen, clear=True),
        ):
            first = collect(Path("."), "owner/demo")
            shows = sum("show" in c for c in calls)
            collect(Path("."), "owner/demo")
        self.assertEqual(sum("show" in c for c in calls), shows)
        self.assertEqual(shows, 2)  # the branch's file and the one it left main with
        self.assertEqual(first.live.branch_roadmaps["worktree-new"].phases[0].tasks[0].id, "new")

    def test_agent_branches_and_branches_with_nothing_ahead_arent_read(self):
        calls = []
        self.assertEqual(self.collect(calls, branches="worktree-agent-abc\n").live.branch_roadmaps, {})
        self.assertFalse(any("show" in c for c in calls))
        self.assertEqual(self.collect(ahead="0\n").live.branch_roadmaps, {})

    def test_a_branch_that_cant_be_read_turns_git_red_without_stopping_the_rest(self):
        real = self.fake_git([])

        def run(args, cwd, timeout=15):
            if "merge-base" in args:
                raise OSError("failed")
            return real(args, cwd, timeout)

        with mock.patch("tools.pm.live._run", side_effect=run), mock.patch.dict(live_module._branch_seen, clear=True):
            snapshot = collect(Path("."), "owner/demo")
        self.assertFalse(snapshot.git_ok)
        self.assertIn("couldn't read the roadmap on worktree-new", " ".join(snapshot.live.warnings))
        self.assertEqual(snapshot.live.branch_roadmaps, {})

    def test_an_open_pr_not_up_to_date_here_is_warned_about(self):
        read = BranchRoadmap("worktree-a", "local")
        prs = [
            PullRequest(1, "t", "OPEN", "worktree-a", "u", head_sha="newer"),
            PullRequest(2, "t", "OPEN", "worktree-b", "u", head_sha="absent"),
            PullRequest(3, "t", "OPEN", "worktree-agent-x", "u", head_sha="absent"),
            PullRequest(4, "t", "MERGED", "worktree-c", "u", head_sha="absent"),
            PullRequest(5, "t", "OPEN", "worktree-d", "u", head_sha="local"),
            PullRequest(6, "t", "OPEN", "worktree-e", "u", head_sha="contained"),
        ]
        live = Live(prs=prs, branch_roadmaps={"worktree-a": read, "worktree-d": BranchRoadmap("worktree-d", "local")})

        def run(args, cwd, timeout=15):
            if args[-2] != "contained":
                raise subprocess.CalledProcessError(1, args)
            return ""

        with mock.patch("tools.pm.live._run", side_effect=run):
            warnings = unfetched_prs(Path("."), "origin/main", live)
        self.assertEqual([w.split(":")[0] for w in warnings], ["PR #1", "PR #2"])
        self.assertIn("git fetch", warnings[0])

    def test_github_never_answering_stays_unknown_and_once_answered_stays_known(self):
        down = Snapshot(live=Live(prs_known=False), github_ok=False)
        self.assertFalse(keep_last_good(down, Snapshot(live=Live(prs_known=False), github_ok=False)).live.prs_known)
        down = Snapshot(live=Live(prs_known=False), github_ok=False)
        self.assertTrue(keep_last_good(down, Snapshot(live=Live())).live.prs_known)

    def test_a_failing_gh_marks_prs_unknown(self):
        with mock.patch("tools.pm.live._run", side_effect=OSError("no tool")):
            self.assertFalse(collect(Path("."), "owner/demo").live.prs_known)

    def branch_snapshot(self, branch, git_ok=True):
        return Snapshot(live=Live(branch_roadmaps={branch.branch: branch} if branch else {}), git_ok=git_ok)

    def test_a_failed_git_keeps_the_last_branch_tasks(self):
        old = self.branch_snapshot(BranchRoadmap("worktree-new", phases=[Phase("P", "P")]))
        kept = keep_last_good(self.branch_snapshot(None, git_ok=False), old)
        self.assertIn("worktree-new", kept.live.branch_roadmaps)

    def test_a_gone_branch_goes_when_git_answered(self):
        old = self.branch_snapshot(BranchRoadmap("worktree-new", phases=[Phase("P", "P")]))
        self.assertEqual(keep_last_good(self.branch_snapshot(None), old).live.branch_roadmaps, {})

    def test_a_roadmap_gone_bad_keeps_its_last_tasks_and_says_so(self):
        phases = [Phase("P", "P", "", [Task("new", "New", "P")])]
        old = self.branch_snapshot(BranchRoadmap("worktree-new", "one", phases))
        new = self.branch_snapshot(BranchRoadmap("worktree-new", "two", errors=["its roadmap can't be read"]))
        kept = keep_last_good(new, old).live.branch_roadmaps["worktree-new"]
        self.assertEqual((kept.phases, kept.errors), (phases, ["its roadmap can't be read"]))


class SourceTests(unittest.TestCase):
    def test_a_tool_that_fails_is_marked_and_warned_about(self):
        with mock.patch("tools.pm.live._run", side_effect=OSError("no tool")):
            snapshot = collect(Path("."), "owner/demo")
        self.assertEqual((snapshot.git_ok, snapshot.github_ok), (False, False))
        warnings = " ".join(snapshot.live.warnings)
        self.assertIn("git failed", warnings)
        self.assertIn("GitHub PRs unavailable", warnings)

    def collect_failing(self, *words):
        """Collect with every command containing one of `words` failing."""

        def run(args, cwd, timeout=15):
            if any(word in args for word in words):
                raise OSError("failed")
            return "worktree-a\n" if "for-each-ref" in args else "1\n" if "rev-list" in args else ""

        with mock.patch("tools.pm.live._run", side_effect=run):
            return collect(Path("."), "owner/demo")

    def test_a_later_git_call_failing_turns_git_red(self):
        for word in ("log", "worktree"):
            snapshot = self.collect_failing(word)
            self.assertFalse(snapshot.git_ok, word)
            self.assertTrue(snapshot.github_ok, word)

    def test_github_failing_leaves_git_green(self):
        snapshot = self.collect_failing("gh")
        self.assertEqual((snapshot.git_ok, snapshot.github_ok), (True, False))

    def test_a_branch_that_cant_be_compared_turns_git_red(self):
        snapshot = self.collect_failing("rev-list")
        self.assertFalse(snapshot.git_ok)
        self.assertIn("worktree-a", " ".join(snapshot.live.warnings))

    def test_no_main_branch_turns_git_red(self):
        snapshot = self.collect_failing("rev-parse")
        self.assertFalse(snapshot.git_ok)
        self.assertIn("no main branch", " ".join(snapshot.live.warnings))

    def test_tools_that_answer_are_ok(self):
        with mock.patch("tools.pm.live._run", return_value=""):
            snapshot = collect(Path("."), "owner/demo")
        self.assertEqual((snapshot.git_ok, snapshot.github_ok), (True, True))


class ParseTests(unittest.TestCase):
    def test_branches(self):
        out = "main\nworktree-a\norigin/HEAD\norigin/worktree-a\norigin/worktree-b\nfeature\n"
        self.assertEqual(parse_branches(out), ["worktree-a", "worktree-b"])

    def test_prs(self):
        out = json.dumps(
            [
                {
                    "number": 3,
                    "title": "t",
                    "state": "MERGED",
                    "headRefName": "worktree-a",
                    "url": "https://example.com/3",
                    "isDraft": True,
                    "updatedAt": "2026-09-30T10:00:00Z",
                },
            ]
        )
        (pr,) = parse_prs(out)
        self.assertEqual((pr.number, pr.state, pr.branch, pr.is_draft), (3, "MERGED", "worktree-a", True))
        self.assertEqual(parse_prs(""), [])

    def test_commits(self):
        out = f"abc{SEP}feat: x{SEP}2026-09-30T10:00:00+01:00{SEP}Someone\nbad line\n"
        (commit,) = parse_commits(out)
        self.assertEqual((commit.sha, commit.subject), ("abc", "feat: x"))

    def test_worktrees(self):
        out = (
            "worktree /repo\nHEAD 1\nbranch refs/heads/main\n\n"
            "worktree /repo/.claude/worktrees/x\nHEAD 2\nbranch refs/heads/worktree-x\n\n"
            "worktree /tmp/detached\nHEAD 3\ndetached\n"
        )
        trees = parse_worktrees(out)
        self.assertEqual([t.branch for t in trees], ["main", "worktree-x", "(detached)"])


if __name__ == "__main__":
    unittest.main()
