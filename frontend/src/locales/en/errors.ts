// Errors the API sends with a code, and the toast that shows them (api/notifyError.ts).
import type { ErrorCode } from "../../api/client";

type Codes<C extends ErrorCode> = C;
/** Codes whose text depends on `count`, as `Codes<"a" | "b">`: these have _one and _other keys instead of one key. */
type PluralCode = Codes<never>;

// One line per ErrorCode in src/jat/api/errors.py. A code with no text, or text for a code that's
// gone, fails the type check. This English matches the API's `detail` today; if they drift, the app
// shows this text and nothing breaks.
const codes = {
  backup_add_failed: "git add failed: {{reason}}",
  backup_commit_failed: "git commit failed: {{reason}}",
  backup_detached_head: "The data repo is on a detached HEAD; check out a branch so snapshots aren't lost.",
  backup_git_timeout: "git {{command}} timed out after {{seconds}}s",
  backup_git_unavailable: "couldn't run git: {{reason}}",
  backup_lock_failed: "couldn't lock {{path}}: {{reason}}",
  backup_mid_rebase: "The data repo is mid-rebase/merge; finish it and snapshots will resume.",
  backup_no_remote: "The data repo has no remote to push to. Add one with `git remote add origin ...`.",
  backup_not_a_repo: "The data directory isn't a git repo.",
  backup_push_failed: "git push failed: {{reason}}",
  backup_shut_down: "snapshots are shut down",
  backup_snapshot_failed: "snapshot failed: {{reason}}",
  backup_snapshots_off: "The data directory isn't a git repo, so snapshots are off.",
  todo_text_required: "text: say what needs doing",
} as const satisfies Record<Exclude<ErrorCode, PluralCode>, string> &
  Record<`${PluralCode}_${"one" | "other"}`, string>;

export default {
  title: "That didn't work",
  somethingWrong: "Something went wrong",
  codes,
} as const;
