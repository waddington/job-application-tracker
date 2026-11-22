# Notes for the agent that maintains this repo

The Claude Code session that builds this repo keeps what it must not forget here, in files, rather than in a long
compaction prompt. `CLAUDE.md` (loaded at every start) holds the repo's rules and wins on any conflict; these files hold
the rest. Everything here is public: no job-search data (no real companies, people, salaries or notes).

## Read after every start or compaction

After a compaction, `tools/dev/after_compact.sh` (a SessionStart hook on `compact`, set in `.claude/settings.json`)
tells the session to read these by full path; in a fresh session, `CLAUDE.md` says so. Read them before doing anything:

| File | What's in it |
|---|---|
| [now.md](now.md) | The current state and the live plan: what's in flight, what's next, what waits on Kai. Refreshed before each compaction. |
| [working-with-kai.md](working-with-kai.md) | Kai's standing instructions beyond CLAUDE.md, how Kai works, the running apps and paths. |
| [gotchas.md](gotchas.md) | Mistakes already made once: harness refusals, tests, i18n, git, the scripts. |
| [decisions.md](decisions.md) | Product decisions already made. Don't re-litigate them. |

## Read when the task needs it

| For | Read |
|---|---|
| Any PR | `CLAUDE.md` *Git* and *Versions and releases*, `tools/dev/README.md` (checks, merge, bump, release) |
| The roadmap and the PM dashboard | `docs/ROADMAP.yaml` (the header says each field), `tools/pm/` |
| A feature | `docs/guide/using-the-app.md`, the module docstrings in `src/jat/domain/` and `src/jat/api/`, `CHANGELOG.md` (feature → PR) |
| The product's intent | `docs/prd/tracker.md`, `docs/rfc/stack.md`, `docs/IDEAS.md` |
| UI text and translations | `CONTRIBUTING.md` *Text in the UI*, `docs/rfc/i18n.md` (incl. "Learned so far"), `docs/guide/adding-a-language.md` |
| The Chinese translation | `docs/rfc/zh-cn.md`, the glossary `docs/i18n/zh-CN.md`, `scripts/i18n/translate/README.md`, `.claude/workflows/i18n-*.js` |
| Browser tests | `frontend/e2e/fixtures.ts`, a neighbouring spec, [gotchas.md](gotchas.md) *Browser tests* |
| A redesign or layout PR, or why one ran slow | `docs/rfc/app-redesign.md` (its "As built" notes), `docs/retros/` |
| A bug fix by a subagent | `tools/dev/briefs/bug-fix.md` |
| A PR from an outside contributor | [contributor-prs.md](contributor-prs.md): security first, two reviews and the plan, the Windows VM, author or carry or backlog, carrying, the note before merging |
| Testing on real Windows | Kai's Windows 11 VM, `ssh winvm`. Its own README, in Kai's `windows-vm` project (not in this repo; Kai's user-level `CLAUDE.md` names it), covers starting and stopping it, resetting it to its clean snapshot and PowerShell's quirks: read it first. How this repo runs there: [gotchas.md](gotchas.md) *Windows VM* |
| Plans waiting on Kai | `docs/rfc/mcp.md` (§14), `docs/rfc/windows.md`, `docs/rfc/docker.md` |
| What a PR did and why | `gh pr view N`, `gh pr diff N`, `git log --oneline main` |
| Anything said before a compaction | the session transcript (`~/.claude/projects/<project>/<session>.jsonl`): `grep` it for a quote, PR number or file name; never read it whole |

## Keeping these files true

- Something that must outlive a compaction goes in the file it belongs to, in the same PR that makes it true: a standing
  instruction in working-with-kai.md (or CLAUDE.md if it's a repo rule), a decision in decisions.md, a lesson in
  gotchas.md, state in now.md. What's built goes in the guide, README, `llms.txt`, `CHANGELOG.md` and the roadmap.
- These files may quote Kai (as the roadmap may); PR bodies and comments may not (CLAUDE.md *Git*).
- Before each compaction, refresh now.md in a small docs PR (internal: no bump, no release, no browser tests).
- Keep them short. If a file passes about 2,000 words, move detail to where it belongs (the guide, an RFC, CONTRIBUTING)
  and leave a pointer.
