#!/bin/bash
# Before-and-after screenshots for a PR that changes the UI (CLAUDE.md, Git): the views given, on main's build and
# then this branch's, both on one fresh demo folder; the images go on the pr-shots branch and the Item / Before /
# After table is printed, ready for the PR body. Main's build is the main checkout's frontend/dist (ship.sh
# rebuilds it after every merge); this branch's is built here first.
# usage: tools/dev/pr_shots.sh [--setup <script.py>] "<label>=<path>[@375][@full][@light][@sel=<css>][@click=<text>]" ...
#   (from the branch's worktree root; tools/dev/pr_shots.py says what each part of a view means)
# --setup runs `uv run python <script.py> <api base url>` against main's server before any shot, to add demo data
# that shows the change (e.g. a round with no time). It must only use what main's API already has.
# PR_SHOTS_PORT picks the port (8887). The table is also saved as var/pr-shots/table.md.
source "$(dirname "$0")/env.sh"
need_root
clean_env
SETUP=""
if [ "$1" = "--setup" ]; then SETUP=$(realpath "$2"); shift 2; fi
[ $# -gt 0 ] || { sed -n '2,9p' "$0"; exit 2; }
WT=$(pwd -P)
BRANCH=$(git branch --show-current)
[ "$WT" != "$MAIN" ] || { echo "Run this from a PR's worktree, not the main checkout." >&2; exit 2; }
[ -f "$MAIN/frontend/dist/index.html" ] || { echo "Main has no frontend build: pnpm --dir $MAIN/frontend build" >&2; exit 2; }
PORT=${PR_SHOTS_PORT:-8887}
OUT="$WT/var/pr-shots"
DIR=$(mktemp -d /tmp/jat-prshots-XXXXXX)
rm -rf "$OUT" && mkdir -p "$OUT"
echo "Building this branch's frontend..."
pnpm --dir frontend build >/dev/null 2>&1 || { echo "pnpm build failed here" >&2; exit 1; }
uv run python scripts/seed_demo.py "$DIR/demo" >/dev/null 2>&1
take() { # <checkout to serve from> <side>
  cd "$1" || exit 1
  setsid uv run jat --data-dir "$DIR/demo" serve --host 127.0.0.1 --port "$PORT" >/dev/null 2>&1 &
  local pid=$!
  for _ in $(seq 1 100); do curl -sf "http://127.0.0.1:$PORT/api/v1/health" >/dev/null && break; sleep 0.1; done
  if [ "$2" = before ] && [ -n "$SETUP" ]; then (cd "$WT" && uv run python "$SETUP" "http://127.0.0.1:$PORT/api/v1"); fi
  (cd "$WT" && uv run --with playwright python tools/dev/pr_shots.py shoot "http://127.0.0.1:$PORT" "$OUT/$2" "${VIEWS[@]}")
  kill -- -"$pid" 2>/dev/null
  sleep 1
}
VIEWS=("$@")
take "$MAIN" before
take "$WT" after
rm -rf "$DIR"
cd "$WT" && uv run python tools/dev/pr_shots.py upload "$OUT" "$BRANCH" "${VIEWS[@]}" | tee "$OUT/table.md"
