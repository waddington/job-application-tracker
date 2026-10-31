import json
import unittest
from pathlib import Path
from unittest import mock

from tools.pm.live import SEP, collect, parse_branches, parse_commits, parse_prs, parse_worktrees


class SourceTests(unittest.TestCase):
    def test_a_tool_that_fails_is_marked_and_warned_about(self):
        with mock.patch("tools.pm.live._run", side_effect=OSError("no tool")):
            snapshot = collect(Path("."), "owner/demo")
        self.assertEqual((snapshot.git_ok, snapshot.github_ok), (False, False))
        self.assertEqual(len(snapshot.live.warnings), 2)

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
                    "isDraft": False,
                    "updatedAt": "2026-09-30T10:00:00Z",
                },
            ]
        )
        (pr,) = parse_prs(out)
        self.assertEqual((pr.number, pr.state, pr.branch), (3, "MERGED", "worktree-a"))
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
        self.assertEqual([t.branch for t in trees], ["main", "worktree-x"])


if __name__ == "__main__":
    unittest.main()
