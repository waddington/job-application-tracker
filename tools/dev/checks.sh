#!/bin/bash
# Every check CLAUDE.md (Git) lists, on the current commit, printing PASS or FAIL for each.
# usage: tools/dev/checks.sh [--no-e2e | --website]   (from the checkout's root; --no-e2e when every changed
# file is on CLAUDE.md's browser-test skip list; --website for a website-only PR, see CLAUDE.md). Takes about
# 10 minutes with e2e: run it in the background.
source "$(dirname "$0")/env.sh"
case "$*" in
  "" | --no-e2e | --website) ;;
  *) echo "usage: checks.sh [--no-e2e | --website]" >&2; exit 2 ;;
esac
need_root
clean_env
if [ "$1" = "--website" ]; then
  # Only for a PR that changes the website and nothing the app is built from (Kai, 2026-11-12). Refuse
  # otherwise (fail closed): every changed file, committed or not, must be under website/, docs/, the
  # changelog, CLAUDE.md, .gitignore, the website's workflow or maintainer tooling; a version-bump file must
  # equal main's copy with only its own version line changed (tools/dev/version_only.py), be a regular file and
  # keep its mode.
  command -v python3 >/dev/null || { echo "--website: needs python3" >&2; exit 2; }
  git fetch -q origin main || echo "--website: couldn't fetch origin/main; checking against the last fetched one"
  base=$(git merge-base HEAD origin/main) && [ -n "$base" ] || { echo "--website: no merge base with origin/main" >&2; exit 2; }
  ver() { sed -n 's/^__version__ = "\(.*\)"$/\1/p'; }
  old=$(git show "$base:src/jat/__init__.py" | ver)
  new=$(ver < src/jat/__init__.py)
  semver='^[0-9]+\.[0-9]+\.[0-9]+$'
  [[ "$old" =~ $semver && "$new" =~ $semver ]] || { echo "--website: can't read the version" >&2; exit 2; }
  # Out of scope: gitignored files (e.g. a local .env), which no PR can carry anyway.
  bump='^(pyproject\.toml|uv\.lock|src/jat/__init__\.py|frontend/package\.json|frontend/openapi\.json|frontend/src/api/schema\.d\.ts)$'
  ok='^(website/|docs/|CHANGELOG\.md$|CLAUDE\.md$|\.gitignore$|\.github/workflows/website\.yml$|tools/dev/|tests/dev/|tools/pm/|tests/pm/)'
  names=$(mktemp)
  trap 'rm -f "$names"' EXIT
  { git diff --name-only -z --no-renames "$base" && git ls-files -z --others --exclude-standard; } > "$names" ||
    { echo "--website: couldn't list the changed files" >&2; exit 2; }
  bad=0
  while IFS= read -r -d '' f; do
    if [[ "$f" =~ $ok ]]; then continue; fi
    if [[ "$f" =~ $bump ]]; then
      if [ -f "$f" ] && [ ! -L "$f" ] && ! git diff --summary "$base" -- "$f" | grep -q "mode change" &&
        git show "$base:$f" 2>/dev/null | python3 "$DEV/version_only.py" "$f" "$old" "$new"; then
        continue
      fi
      echo "--website: $f changes more than its version line ($old → $new)"
    else
      echo "--website: $f isn't a website-only file"
    fi
    bad=1
  done < "$names"
  rm -f "$names"
  [ $bad = 0 ] || { echo "Run the full checks instead." >&2; exit 2; }
fi
# One heavy run at a time across worktrees, at the lowest CPU and disk priority.
# Without flock or ionice (macOS), it runs anyway: pnpm test and pnpm e2e still take their own lock.
if [ -z "$HEAVY_TESTS_LOCKED" ]; then
  export HEAVY_TESTS_LOCKED=1
  wrap=(nice -n 19)
  command -v ionice >/dev/null && wrap+=(ionice -c 3)
  command -v flock >/dev/null && wrap=(flock /tmp/jat-heavy-tests.lock "${wrap[@]}")
  exec "${wrap[@]}" bash "$0" "$@"
fi
echo "commit $(git rev-parse --short HEAD), dirty files: $(git status --short | wc -l)"
fail=0
check() {
  local name=$1 out
  shift
  if out=$("$@" 2>&1); then
    echo "PASS $name: $(echo "$out" | tail -1 | cut -c1-100)"
  else
    echo "FAIL $name"
    echo "$out" | tail -25
    fail=1
  fi
}
if [ "$1" = "--website" ]; then
  pnpm --dir website install --frozen-lockfile --silent
  check pm-and-dev-tests uv run pytest -q tests/pm tests/dev
  check ruff uv run ruff check tools tests/dev tests/pm
  check website-format pnpm --dir website format:check
  check website-check pnpm --dir website check
  check website-build pnpm --dir website build
  echo "SKIP pytest, frontend checks, unit and e2e (--website: only website, docs, tooling and version lines changed)"
  echo "ALL DONE fail=$fail"
  exit $fail
fi
pnpm --dir frontend install --frozen-lockfile --silent
check pytest uv run pytest -q
check ruff uv run ruff check src tests scripts tools
check format pnpm --dir frontend format:check
check lint pnpm --dir frontend lint
check typecheck pnpm --dir frontend typecheck
check unit pnpm --dir frontend test
if [ "$1" = "--no-e2e" ]; then
  echo "SKIP e2e (--no-e2e)"
else
  check e2e pnpm --dir frontend e2e
fi
echo "ALL DONE fail=$fail"
exit $fail
