import unittest
from pathlib import Path

from tools.pm.yamlish import YamlishError, parse, parse_scalar

ROOT = Path(__file__).resolve().parents[2]


class ScalarTests(unittest.TestCase):
    def test_plain_types(self):
        self.assertEqual(parse_scalar("42"), 42)
        self.assertEqual(parse_scalar("0.5"), 0.5)
        self.assertIs(parse_scalar("true"), True)
        self.assertIsNone(parse_scalar("null"))
        self.assertEqual(parse_scalar("2026-09-30"), "2026-09-30")
        self.assertEqual(parse_scalar("docs/prd/tracker.md"), "docs/prd/tracker.md")

    def test_quoted(self):
        self.assertEqual(parse_scalar('"a, b: c"'), "a, b: c")
        self.assertEqual(parse_scalar("'it''s'"), "it's")
        self.assertEqual(parse_scalar('"say \\"hi\\""'), 'say "hi"')

    def test_flow(self):
        self.assertEqual(parse_scalar("[]"), [])
        self.assertEqual(parse_scalar("[a, b, 3]"), ["a", "b", 3])
        self.assertEqual(
            parse_scalar('{id: x, name: "A, B", depends: [y, z], n: 1.5}'),
            {"id": "x", "name": "A, B", "depends": ["y", "z"], "n": 1.5},
        )

    def test_flow_errors(self):
        with self.assertRaises(YamlishError):
            parse_scalar("[a, b")
        with self.assertRaises(YamlishError):
            parse_scalar("{a: 1, a: 2}")


class BlockTests(unittest.TestCase):
    def test_nested(self):
        text = """
# comment
project: demo  # trailing comment
phases:
  - id: P0
    name: "Start # not a comment"
    tasks:
      - {id: a, depends: []}
      - id: b
        depends: [a]
  - id: P1
    tasks: []
list_same_indent:
- x
- y
"""
        self.assertEqual(
            parse(text),
            {
                "project": "demo",
                "phases": [
                    {
                        "id": "P0",
                        "name": "Start # not a comment",
                        "tasks": [{"id": "a", "depends": []}, {"id": "b", "depends": ["a"]}],
                    },
                    {"id": "P1", "tasks": []},
                ],
                "list_same_indent": ["x", "y"],
            },
        )

    def test_empty(self):
        self.assertIsNone(parse("# nothing\n\n"))

    def test_bad_indent(self):
        with self.assertRaises(YamlishError):
            parse("a: 1\n    b: 2\n")

    def test_duplicate_key(self):
        with self.assertRaises(YamlishError):
            parse("a: 1\na: 2\n")

    def test_repo_roadmap_parses(self):
        data = parse((ROOT / "docs" / "ROADMAP.yaml").read_text())
        self.assertEqual(data["project"], "job-application-tracker")
        self.assertTrue(data["phases"])


if __name__ == "__main__":
    unittest.main()
