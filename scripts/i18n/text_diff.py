"""Diff two text snapshots from text_snapshot.py: python3 text_diff.py before.json after.json

Prints each page or dialog whose text or labels changed, and exits 1 if any did.
"""

import difflib
import json
import sys
from pathlib import Path

before = json.loads(Path(sys.argv[1]).read_text())
after = json.loads(Path(sys.argv[2]).read_text())
views = sorted(set(before) | set(after))
changed = 0
for view in views:
    for part in ("text", "attrs"):
        a = before.get(view, {}).get(part, [])
        b = after.get(view, {}).get(part, [])
        a_lines = a.splitlines() if isinstance(a, str) else a
        b_lines = b.splitlines() if isinstance(b, str) else b
        if a_lines != b_lines:
            changed += 1
            print(f"=== {view} [{part}]")
            for line in difflib.unified_diff(a_lines, b_lines, lineterm="", n=1):
                if not line.startswith(("---", "+++")):
                    print(line)
print(f"\n{changed} view parts differ out of {len(views) * 2}")
sys.exit(1 if changed else 0)
