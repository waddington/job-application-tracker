#!/bin/bash
# Before-and-after screenshots for a PR that changes the UI (CLAUDE.md, Git): the views given, on main's build and
# then this branch's, both on one fresh demo folder; the images go on the pr-shots branch and the Item / Before /
# After table is printed, ready for the PR body. Main's side is the main checkout as it is (its frontend/dist,
# which ship.sh rebuilds after every merge); merge main into the branch first, or "before" shows older work.
# usage: tools/dev/pr_shots.sh [--setup <script.py>] "<label>=<path>[@375][@full][@light][@sel=<css>][@click=<text>]" ...
#   (from the branch's worktree root; tools/dev/pr_shots.py says what each part of a view means)
# --setup runs `uv run python <script.py> <api base url>` against main's server before any shot, to add demo data
# that shows the change (e.g. a round with no time). It must only use what main's API already has.
# PR_SHOTS_PORT picks the port (8887; never 8770, Kai's tracker). The table is also saved as var/pr-shots/table.md.
set -o pipefail
source "$(dirname "$0")/env.sh"
need_root
clean_env
die() { echo "pr_shots: $*" >&2; exit 1; }
SETUP=""
if [ "$1" = "--setup" ]; then
  [ -f "$2" ] || die "--setup needs a script file"
  SETUP=$(realpath "$2")
  shift 2
fi
[ $# -gt 0 ] || { sed -n '2,10p' "$0"; exit 2; }
uv run python tools/dev/pr_shots.py check "$@" >/dev/null || exit 2
WT=$(pwd -P)
BRANCH=$(git branch --show-current)
[ -n "$BRANCH" ] || die "not on a branch"
[ "$WT" != "$MAIN" ] || die "run this from a PR's worktree, not the main checkout"
[ -f "$MAIN/frontend/dist/index.html" ] || die "main has no frontend build: pnpm --dir $MAIN/frontend build"
git merge-base --is-ancestor "$(git -C "$MAIN" rev-parse HEAD)" HEAD ||
  echo "pr_shots: warning: this branch doesn't have main's latest commit, so 'before' may show work that isn't here" >&2
PORT=${PR_SHOTS_PORT:-8887}
[ "$PORT" != 8770 ] || die "8770 is Kai's tracker"
curl -s -o /dev/null "http://127.0.0.1:$PORT/" && die "something already answers on port $PORT (PR_SHOTS_PORT picks another)"
OUT="$WT/var/pr-shots"
DIR=$(mktemp -d /tmp/jat-prshots-XXXXXX)
PID=""
cleanup() {
  [ -n "$PID" ] && kill -- -"$PID" 2>/dev/null
  rm -rf "$DIR"
}
trap cleanup EXIT
rm -rf "$OUT" && mkdir -p "$OUT"
echo "Building this branch's frontend..."
pnpm --dir frontend build >/dev/null 2>&1 || die "pnpm build failed here"
uv run python scripts/seed_demo.py "$DIR/demo" >/dev/null 2>&1 || die "seeding the demo data failed"
take() { # <checkout to serve from> <side>
  cd "$1" || exit 1
  setsid uv run jat --data-dir "$DIR/demo" serve --host 127.0.0.1 --port "$PORT" >"$DIR/$2.log" 2>&1 &
  PID=$!
  for _ in $(seq 1 600); do
    kill -0 "$PID" 2>/dev/null || die "the $2 server stopped: $(tail -3 "$DIR/$2.log")"
    curl -sf "http://127.0.0.1:$PORT/api/v1/health" >/dev/null && break
    sleep 0.1
  done
  curl -sf "http://127.0.0.1:$PORT/api/v1/health" >/dev/null || die "the $2 server didn't start in 60 s"
  if [ "$2" = before ] && [ -n "$SETUP" ]; then
    (cd "$WT" && uv run python "$SETUP" "http://127.0.0.1:$PORT/api/v1") || die "the --setup script failed"
  fi
  (cd "$WT" && uv run --with playwright python tools/dev/pr_shots.py shoot "http://127.0.0.1:$PORT" "$OUT/$2" "$2" \
    "${VIEWS[@]}") || die "the $2 shots failed"
  kill -- -"$PID" 2>/dev/null
  PID=""
  sleep 1
}
VIEWS=("$@")
take "$MAIN" before
take "$WT" after
cd "$WT" && uv run python tools/dev/pr_shots.py upload "$OUT" "$BRANCH" "${VIEWS[@]}" | tee "$OUT/table.md" ||
  die "the upload failed"
