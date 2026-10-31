// Errors the API sends with a code, and the toast that shows them (api/notifyError.ts).
import type { ErrorCode } from "../../api/client";

type Codes<C extends ErrorCode> = C;
/** Codes whose text depends on `count`, as `Codes<"a" | "b">`: these have _one and _other keys instead of one key. */
type PluralCode = Codes<"document_sent" | "file_too_large" | "version_sent">;

// One line per ErrorCode in src/jat/api/errors.py. A code with no text, or text for a code that's
// gone, fails the type check. This English matches the API's `detail` today; if they drift, the app
// shows this text and nothing breaks.
const codes = {
  attachment_file_missing: "{{name}} is missing from files/",
  attachment_is_version_file: "This is the file of version {{quoted_label}}; delete that version instead.",
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
  cv_file_applications_invalid: "application_ids: only applications this file counts for.",
  cv_file_document_required: "Pick a document to add it to, or name a new one.",
  cv_file_missing: "{{name}} is missing from your data folder.",
  cv_file_not_found: "No CV file like that among your attachments (or it's all recorded already).",
  document_sent_one:
    "A version of this document was sent with {{count}} application(s); remove it from them first.",
  document_sent_other:
    "A version of this document was sent with {{count}} application(s); remove it from them first.",
  document_version_not_found: "document_version_id: {{id}} not found",
  file_is_symlink: "{{path}} is a symlink",
  file_outside_files: "{{path}} isn't under files/",
  file_too_large_one: "files can be up to {{count}} MB",
  file_too_large_other: "files can be up to {{count}} MB",
  note_changed: "This note changed since you opened it (maybe in another editor). Reload it first.",
  note_link_agency_not_found: "links: agency {{id}} not found",
  note_link_application_not_found: "links: application {{id}} not found",
  note_link_company_not_found: "links: company {{id}} not found",
  note_link_contact_not_found: "links: contact {{id}} not found",
  note_link_document_not_found: "links: document {{id}} not found",
  note_link_interview_not_found: "links: interview {{id}} not found",
  note_link_invalid: "links: {{quoted_link}} should look like 'application:<id>' ({{kinds}})",
  note_link_role_not_found: "links: role {{id}} not found",
  note_not_found: "Note {{id}} not found",
  note_path_invalid: "{{path}} isn't a note under notes/",
  note_unreadable: "Note {{id}} can't be read: {{reason}}",
  todo_text_required: "text: say what needs doing",
  version_already_sent: "That version is already recorded for this application.",
  version_label_required: "label: give the version a name, e.g. v3 (fintech)",
  version_sent_one: "This version was sent with {{count}} application(s); remove it from them first.",
  version_sent_other: "This version was sent with {{count}} application(s); remove it from them first.",
} as const satisfies Record<Exclude<ErrorCode, PluralCode>, string> &
  Record<`${PluralCode}_${"one" | "other"}`, string>;

export default {
  title: "That didn't work",
  somethingWrong: "Something went wrong",
  deleteFileFailed: "Couldn't delete the file",
  deleteNoteFailed: "Couldn't delete the note",
  uploadFileFailed: "{{name}}: {{reason}}",
  uploadFailedSeparator: "; ",
  codes,
} as const;
