"""Is a version-bump file main's copy with only its own version line changed? For tools/dev/scope.sh.

usage: git show <base>:<file> | python3 tools/dev/version_only.py <file> <old version> <new version>
Exit 0 when <file> equals main's copy with exactly its version line's old version swapped for the new one (or
unchanged); 1 otherwise. Only the one line bump.py writes in each file may change, never a dependency that happens
to share the version number.
"""

import re
import sys

# The line bump.py writes in each file, which must appear exactly once; only its quoted version may change.
LINES = {
    "src/jat/__init__.py": r'^__version__ = "{v}"$',
    "pyproject.toml": r'^version = "{v}"$',
    "frontend/package.json": r'^  "version": "{v}",$',
    "website/package.json": r'^  "version": "{v}",$',
    "website/src/components/SiteHead.astro": r'^ *softwareVersion: "{v}",$',
    "frontend/openapi.json": r'^    "version": "{v}"$',
    "uv.lock": r'^name = "job-application-tracker"\nversion = "{v}"$',
    "frontend/src/api/schema.d.ts": None,  # no version in it: it may not change at all
}


SEMVER = re.compile(r"[0-9]+\.[0-9]+\.[0-9]+")


def expected(path: str, base: str, old: str, new: str) -> str | None:
    if path not in LINES or not SEMVER.fullmatch(old) or not SEMVER.fullmatch(new):
        return None
    if old == new or LINES[path] is None:
        return base
    pattern = re.compile(LINES[path].format(v=re.escape(old)), re.M)
    if len(pattern.findall(base)) != 1:
        return None
    return pattern.sub(lambda m: m.group(0).replace(f'"{old}"', f'"{new}"'), base)


def main() -> int:
    path, old, new = sys.argv[1:]
    base = sys.stdin.read()
    want = expected(path, base, old, new)
    try:
        with open(path, encoding="utf-8", newline="") as f:
            have = f.read()
    except OSError:
        return 1
    return 0 if want is not None and have == want else 1


if __name__ == "__main__":
    sys.exit(main())
