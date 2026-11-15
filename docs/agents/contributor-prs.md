# Pull requests from outside contributors

How the lead handles a PR from someone outside the project, from first look to release. So far that's the Windows
work from issue #230's author (#283–#285, #301, #302), built against `docs/rfc/windows.md`. Kai's standing
instructions are quoted; this file may quote Kai, PR bodies and comments may not (CLAUDE.md *Git*).

## Never comment

- Never comment on their PR or issue, or post about it anywhere outside this chat: "dont comment on the PR, report back to
  me here". If something needs saying to the author, draft it here and Kai posts it himself (*Asking the author*).
- Don't trust their testing: "i cant trust the external contributor, i would do testing myself".

## 1. Security review before anything of theirs runs

"we need throgh security review of external PRs before agents run the code themselves". Read every changed line first,
for anything that runs on install, import or test: tests, `conftest.py`, scripts, `pyproject.toml` and `package.json`
scripts, build config, lockfile entries (hashes against PyPI or npm). Look at commits that add then remove something
too (#284 briefly stubbed `fcntl` in `conftest.py`). Only then does anything of theirs run, and only by the lead;
reviewer agents stay read-only (the auto-mode check blocks them anyway: gotchas.md, *Other*). Again for every new
commit they push.

## 2. Review: two reviews, and the plan

- `/code-review` and an agent-team review side by side (Kai names `/agent-team` for these), each read-only, each told
  the PR's roadmap task and the plan. Report which found what; settle disagreements by reading the code (on #301 the
  two disagreed on whether the test could fail: Starlette's own `guess_type` import decided it).
- **Hold it to the plan:** "something to consider while reviewing these 3rd-party PRs is how they adhere to the plan
  we created. we want them to stay on-track and according to the plan". Compare the PR with its roadmap line and its
  part of the RFC: is everything the plan asks for there, is anything beyond it, does it undo a decision the plan
  already made? A gap, scope creep or an undone decision is a finding like any other. #301 changed Python's global
  type table (beyond the plan: removed); #283 added a redundant `/health` field (removed); #284 left `scripts/` out of
  "every text file" (kept narrow, put on the roadmap).

## 3. Test it ourselves

- **Linux:** `tools/dev/checks.sh` (browser tests on seeded demo data included) in our worktree, on the exact commit
  being merged, as for our own PRs.
- **Windows:** in Kai's Windows VM (`ssh winvm`; how in gotchas.md *Windows VM*): "you should be able to control the
  tests from here, and then you can iterate review-fix cycle". Reset it to its clean snapshot before running their
  code. Reproduce the bug on main first when you can (#301: set the registry's `.js` type to `text/plain`; #284: run
  their tests against main's code), then show the PR fixes it, then run the whole suite and compare with the failures
  `windows-tests-green` lists. Shut the VM down when done. If the VM isn't available, simulate Windows on Linux
  (gotchas.md *Other*), and say so: it doesn't prove it runs on real Windows.
- **Never run the Windows VM and the Linux browser tests together:** the Windows VM run and the Linux browser tests never run at the same time (Kai, 2026-11-15:
  "dont overlap them"; the load made a board browser test fail). A tests-only PR whose behaviour doesn't depend on the
  OS (such as the AST encoding check) can skip the VM, and its PR body says so.

## 4. Sort every finding three ways

"your judgement call about what the author should fix, what we fix with the carry, and what we add to the backlog":

| Where | What goes there |
|---|---|
| **The author** | Blocks merging and is theirs to understand or decide. Draft a comment and stop (*Asking the author*). |
| **The carry** | Blocks merging, or is quick and touches the same lines: we fix it on our branch. |
| **The backlog** | Doesn't need fixing before merge: a roadmap task (a bug in phase B if it's a bug), said in the PR body. |

So far everything has fitted the carry or the backlog: the fixes were small, and a round trip had already brought new
bugs once (#283).

## 5. Carry it

"yes I prefer B, and its cleaner for changelog and version bump etc". Fetch their branch (`git fetch <fork url>
<branch>`) into our own `worktree-<task>` branch, merge main in, and put our fixes, the bump (`tools/dev/bump.py`), the
CHANGELOG entry ("(#ours, carrying #theirs)."), the roadmap and the RFC status line on top. Their commits stay unchanged
under their name. Open our own draft PR whose body says `Carries #N`, never `Closes #N`: with `Closes`, #285 ended up
closed, not merged; with only `Carries`, GitHub marked #283 and #301 merged by themselves once their commits were on
main. Never `Closes` their issue either (#230 tracks the whole Windows plan).

- Don't push to their fork unless Kai says so (#284: Kai asked for main to be merged into their branch and pushed
  there; their fork allows maintainer edits).
- Never merge theirs first and fix on main afterwards: main would have their bug, and no version bump, until the fix
  lands.
- Our PR goes through the review-fix cycle like any other, then merges with a merge commit (so their commits land as
  they are) and releases under the standing rule.

## 6. Thank them, then merge

Just before merging, our carrying PR's body gets a note at the top tagging the author (`@login`) to say their work is merged, in
Kai's voice (his Slack voice notes, outside this repo: ask Kai where), in two or three sentences: what it does, the one
or two things we changed and why (useful to them), and thanks, with what the VM showed only if it's notable. Added just before merging so it's true when they're notified, never in the body the PR is opened with (an
@-mention notifies at once, and editing it out doesn't unsend it: #308);
it doesn't promise anything Kai hasn't decided (no "I'll look at #N next").
Keep it that brief; Kai doesn't need to see it first (Kai, 2026-11-15: "thank you notes are
fine, i dont need to see them, keep them brief").

## Asking the author

When a finding is for the author, report it to Kai in this chat with a draft and stop until Kai has posted it: "if you
decuide we need to leave a comment on authors PR then you must report back to me and wait for my approval - in fact i
will post the comment myself". The draft:

- is one top-level comment ("i will leave only top-level comments, not on specific lines of code"), leading with
  encouragement ("nice job etc");
- asks only for what blocks merging ("that feels like a lot of feedback"); the rest is carried or goes on the backlog;
- is precise enough for the contributor's AI to act on (their PRs look AI-assisted), with a short why per ask;
- claims only what Kai did: "you lie in that comment, i didnt run it with fcntl unavailable". Say "the review (partly
  AI-assisted) shows…", never "I ran…" for work the lead did.
