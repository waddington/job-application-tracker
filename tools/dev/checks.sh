#!/bin/bash
# Every check CLAUDE.md (Git) lists, on the current commit, printing PASS or FAIL for each.
# usage: tools/dev/checks.sh [--no-e2e | --website]   (from the checkout's root; --no-e2e when every changed
# file is on CLAUDE.md's browser-test skip list, or is a version bump's own line; --website for a website-only PR,
# see CLAUDE.md; both refuse otherwise). Takes about 11 minutes with e2e: run it in the background.
source "$(dirname "$0")/env.sh"
case "$*" in
  "" | --no-e2e | --website) ;;
  *) echo "usage: checks.sh [--no-e2e | --website]" >&2; exit 2 ;;
esac
need_root
clean_env
# --website and --no-e2e skip checks, so first make sure nothing they skip could be affected (fail closed):
# tools/dev/scope.sh checks every changed file against CLAUDE.md's list for the mode.
if [ -n "$1" ]; then
  bash "$DEV/scope.sh" "$1" || exit 2
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
