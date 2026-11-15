"""Turn a review (or re-review) workflow's result into fixes, a list of what changed, and the PR's table.

Usage: uv run python scripts/i18n/translate/apply_review.py <lang> <ns> [review | rereview-1 | rereview-2 …]

Reads var/i18n/<lang>/<ns>/<name>.json (default review.json; save the workflow's result there). Writes,
beside it: <name>-fixes.json (key -> final text, for assemble.py), changed.json (what the next
re-review checks) and <name>-table.md (every finding decided, who raised it, and why). Prints a summary.
"""

import sys
from collections import Counter

from common import read_json, work_dir, write_json


def judged_areas(result: dict) -> list[dict]:
    """The review workflow has a judge per area ("judged"); the re-review has at most one ("judge")."""
    if "judged" in result:
        return result["judged"]
    return [result["judge"]] if result.get("judge") else []


def findings(result: dict) -> list[tuple[str, dict]]:
    """(model, finding) for every reviewer in either shape."""
    reviewers = result.get("text", []) + result.get("screens", []) if "judged" in result else result.get("reviews", [])
    return [(r["model"], f) for r in reviewers for f in r.get("findings") or []]


def decisions(result: dict, ns: str, keys: set[str]) -> tuple[list[dict], list[str]]:
    """One decision per key (the first judge to decide it wins), and keys the reviewers got wrong."""
    seen: set[str] = set()
    out, unknown = [], []
    for area in judged_areas(result):
        for d in area.get("decisions") or []:
            key = d["key"].removeprefix(f"{ns}:").removeprefix(f"{ns}.")
            if key not in keys:
                unknown.append(d["key"])
            elif key not in seen:
                seen.add(key)
                out.append({**d, "key": key})
    return out, unknown


def cell(text: str, limit: int = 300) -> str:
    text = (text or "").replace("|", "/").replace("\n", " ")
    return text if len(text) <= limit else text[: limit - 1] + "…"


def who(d: dict) -> str:
    if d.get("agreed"):
        return "both"
    return cell(d.get("disagreement") or d.get("raised_by") or "")


def table(decided: list[dict]) -> str:
    if not decided:
        return "No findings.\n"
    rows = [
        f"| `{d['key']}` | {d.get('severity', '')} | {'changed' if d['verdict'] == 'change' else 'kept'}: "
        f"{cell(d['final'])} | {who(d)} | {cell(d['why'])} |"
        for d in decided
    ]
    head = "| Key | Severity | Decision | Who raised it / disagreement | Why |\n|---|---|---|---|---|\n"
    return head + "\n".join(rows) + "\n"


def main(lang: str, ns: str, name: str = "review") -> None:
    work = work_dir(lang, ns)
    result = read_json(work / f"{name}.json")
    english = read_json(work / "flat.json")
    decided, unknown = decisions(result, ns, set(english))
    changes = [d for d in decided if d["verdict"] == "change"]
    write_json(work / f"{name}-fixes.json", {d["key"]: d["final"] for d in changes})
    write_json(
        work / "changed.json",
        [{"key": d["key"], "en": english[d["key"]], "now": d["final"], "why_changed": d["why"]} for d in changes],
    )
    (work / f"{name}-table.md").write_text(table(decided), encoding="utf-8")
    print("findings by model and severity:", dict(Counter((m, f["severity"]) for m, f in findings(result))))
    for d in decided:
        print(f"  {d['verdict']:6} {d.get('severity', ''):10} {who(d)[:12]:12} {d['key']} => {d['final']}")
    for area in judged_areas(result):
        for g in area.get("glossary_changes") or []:
            print("  glossary:", g)
    if unknown:
        print("keys not in this file (check by hand):", unknown)
    by_severity = dict(Counter(d.get("severity") for d in changes))
    print(f"{len(changes)} changed ({by_severity}), {len(decided) - len(changes)} kept")
    print(f"next: assemble.py {lang} {ns} with every *-fixes.json so far, oldest first")


if __name__ == "__main__":
    main(*sys.argv[1:4])
