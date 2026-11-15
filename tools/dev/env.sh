# Sourced by the tools/dev shell scripts: PATH with Node and uv, and where things are.
# NODE_BIN overrides the Node folder (Node >= 22.12 for the app, >= 22.23.4 for the website; see CLAUDE.md, Code).
DEV="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "$NODE_BIN" ]; then
  PATH="$NODE_BIN:$PATH"
elif [ -d "$HOME/.nvm/versions/node/v22.23.5/bin" ]; then
  PATH="$HOME/.nvm/versions/node/v22.23.5/bin:$PATH"
fi
export PATH="$PATH:$HOME/.local/bin"
# The main checkout is the first entry of `git worktree list`.
MAIN="$(git worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')"

# Stop unless we're at the root of a checkout (worktree or main).
need_root() {
  local top
  top="$(git rev-parse --show-toplevel 2>/dev/null)"
  if [ -z "$top" ] || [ "$top" != "$(pwd -P)" ]; then
    echo "Run this from the root of a checkout (now in $(pwd))." >&2
    exit 2
  fi
}

# Drop JAT_* and GIT_* so tests use their own data folders and git.
clean_env() {
  local key
  for key in $(env | grep -E '^(JAT_|GIT_)' | cut -d= -f1); do unset "$key"; done
}
