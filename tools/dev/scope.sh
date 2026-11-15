#!/bin/bash
# May this branch skip part of the checks? checks.sh runs it for --website and --no-e2e; it never runs a check itself.
# usage: tools/dev/scope.sh --website | --no-e2e   (from the checkout's root)
# Fails closed (exit 2, naming each file that isn't allowed): every file changed since the merge base with
# origin/main, committed or not, must be on the mode's list in CLAUDE.md (Git), or be a version-bump file that equals
# main's copy with only bump.py's version line changed (tools/dev/version_only.py), a regular file keeping its mode.
#   --website: website/, docs/, the changelog, CLAUDE.md, .gitignore, the website's workflow, maintainer tooling.
#   --no-e2e:  the browser-test skip list: a draft language's text (frontend/src/locales/<code>/ for a code in
#              DRAFT_LANGUAGES, read from main's frontend/src/i18n/language.ts; its glossary is under docs/),
#              scripts/i18n/, scripts/demo_gif/, scripts/social_preview/, .claude/workflows/, .claude/settings.json,
#              tools/dev/, tests/, and docs (docs/ and the Markdown files at the top: README, CHANGELOG, ...).
source "$(dirname "$0")/env.sh"
mode=$1
case "$*" in
  --website)
    ok='^(website/|docs/|CHANGELOG\.md$|CLAUDE\.md$|\.gitignore$|\.github/workflows/website\.yml$|tools/dev/|tests/dev/|tools/pm/|tests/pm/)'
    off="isn't a website-only file"
    ;;
  --no-e2e)
    ok='^(docs/|[^/]+\.md$|scripts/i18n/|scripts/demo_gif/|scripts/social_preview/|\.claude/workflows/|\.claude/settings\.json$|tools/dev/|tests/)'
    off="isn't on CLAUDE.md's browser-test skip list"
    ;;
  *) echo "usage: scope.sh --website | --no-e2e" >&2; exit 2 ;;
esac
need_root
command -v python3 >/dev/null || { echo "$mode: needs python3" >&2; exit 2; }
git fetch -q origin main || echo "$mode: couldn't fetch origin/main; checking against the last fetched one"
base=$(git merge-base HEAD origin/main) && [ -n "$base" ] || { echo "$mode: no merge base with origin/main" >&2; exit 2; }
ver() { sed -n 's/^__version__ = "\(.*\)"$/\1/p'; }
old=$(git show "$base:src/jat/__init__.py" | ver)
new=$(ver < src/jat/__init__.py)
semver='^[0-9]+\.[0-9]+\.[0-9]+$'
[[ "$old" =~ $semver && "$new" =~ $semver ]] || { echo "$mode: can't read the version" >&2; exit 2; }
if [ "$mode" = "--no-e2e" ]; then
  # The list on origin/main, not the merge base, so a draft main has since shipped no longer counts; a changed
  # language.ts is itself refused. Codes are checked to be plain language tags before they go into the pattern; if
  # the list can't be read, no draft folder is allowed.
  drafts=$(git show "origin/main:frontend/src/i18n/language.ts" 2>/dev/null | python3 -c '
import re, sys
m = re.search(r"export const DRAFT_LANGUAGES\b[^=]*=\s*\{(.*?)\}", sys.stdin.read(), re.S)
codes = re.findall(r"(?:^|,)\s*[\"\x27]?([A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*)[\"\x27]?\s*:", m.group(1)) if m else []
print("|".join(codes))
')
  [ -n "$drafts" ] && ok="$ok|^frontend/src/locales/($drafts)/"
fi
# Only bump.py's version line may change in these (version_only.py has the line for each).
bump='^(pyproject\.toml|uv\.lock|src/jat/__init__\.py|frontend/package\.json|frontend/openapi\.json|frontend/src/api/schema\.d\.ts|website/package\.json|website/src/components/SiteHead\.astro)$'
# Out of scope: gitignored files (e.g. a local .env), which no PR can carry anyway.
names=$(mktemp)
trap 'rm -f "$names"' EXIT
{ git diff --name-only -z --no-renames "$base" && git ls-files -z --others --exclude-standard; } > "$names" ||
  { echo "$mode: couldn't list the changed files" >&2; exit 2; }
bad=0
while IFS= read -r -d '' f; do
  if [[ "$f" =~ $ok ]]; then continue; fi
  if [[ "$f" =~ $bump ]]; then
    if [ -f "$f" ] && [ ! -L "$f" ] && ! git diff --summary "$base" -- "$f" | grep -q "mode change" &&
      git show "$base:$f" 2>/dev/null | python3 "$DEV/version_only.py" "$f" "$old" "$new"; then
      continue
    fi
    echo "$mode: $f changes more than its version line ($old → $new)"
  else
    echo "$mode: $f $off"
  fi
  bad=1
done < "$names"
if [ $bad = 1 ]; then
  [ "$mode" = "--website" ] && echo "Run the full checks instead." >&2 || echo "Run checks.sh without --no-e2e." >&2
  exit 2
fi
