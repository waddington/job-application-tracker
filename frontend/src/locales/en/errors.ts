// Errors the API sends with a code, and the toast that shows them (api/notifyError.ts).
import type { ErrorCode } from "../../api/client";

type Codes<C extends ErrorCode> = C;
/** Codes whose text depends on `count`, as `Codes<"a" | "b">`: these have _one and _other keys instead of one key. */
type PluralCode = Codes<
  "company_has_applications" | "document_sent" | "file_too_large" | "role_has_applications" | "version_sent"
>;

// One line per ErrorCode in src/jat/api/errors.py. A code with no text, or text for a code that's
// gone, fails the type check. This English matches the API's `detail` today; if they drift, the app
// shows this text and nothing breaks.
const codes = {
  application_document_not_found: "ApplicationDocument {{id}} not found",
  attachment_file_missing: "{{name}} is missing from files/",
  attachment_not_found: "Attachment {{id}} not found",
  document_not_found: "Document {{id}} not found",
  document_version_not_found: "DocumentVersion {{id}} not found",
  attachment_is_version_file: "This is the file of version {{quoted_label}}; delete that version instead.",
  agency_id_not_found: "agency_id: Agency {{id}} not found",
  agency_needs_agency_route: "Only applications through a recruiter can have an agency.",
  agency_not_found: "Agency {{id}} not found",
  agency_route_needs_agency: "An agency application needs an agency or a recruiter.",
  application_contact_not_found: "ApplicationContact {{id}} not found",
  application_id_not_found: "application_id: Application {{id}} not found",
  application_not_found: "Application {{id}} not found",
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
  document_version_id_not_found: "document_version_id: {{id}} not found",
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
  version_already_sent: "That version is already recorded for this application.",
  version_label_required: "label: give the version a name, e.g. v3 (fintech)",
  version_sent_one: "This version was sent with {{count}} application(s); remove it from them first.",
  version_sent_other: "This version was sent with {{count}} application(s); remove it from them first.",
  call_ends_before_start: "ends_at: can't be before starts_at",
  company_has_applications_one: "{{name}} has an application. Delete it first, or archive it instead.",
  company_has_applications_other:
    "{{name}} has {{count}} applications. Delete them first, or archive them instead.",
  company_id_not_found: "company_id: Company {{id}} not found",
  company_not_found: "Company {{id}} not found",
  contact_detail_taken:
    "{{name}} already has {{value}}. One person per email address and LinkedIn profile: open {{name}} instead, or merge the two.",
  contact_id_not_found: "contact_id: Contact {{id}} not found",
  contact_not_found: "Contact {{id}} not found",
  data_conflict: "conflicts with existing data: {{reason}}",
  direct_has_agency: "A direct application can't have an agency; change the route first.",
  direct_recruiter_has_agency:
    "{{name}} works for an agency, so this isn't a direct application; change the route.",
  interview_not_found: "Interview {{id}} not found",
  interviewer_not_found: "interviewer_ids: Contact {{id}} not found",
  entity_agency_not_found: "entity_id: agency {{id}} not found",
  entity_application_not_found: "entity_id: application {{id}} not found",
  entity_company_not_found: "entity_id: company {{id}} not found",
  entity_contact_not_found: "entity_id: contact {{id}} not found",
  entity_document_not_found: "entity_id: document {{id}} not found",
  entity_interview_not_found: "entity_id: interview {{id}} not found",
  link_not_found: "Link {{id}} not found",
  entity_role_not_found: "entity_id: role {{id}} not found",
  meeting_id_not_found: "meeting_id: Meeting {{id}} not found",
  meeting_not_found: "Meeting {{id}} not found",
  merge_same_person: "Pick someone else to merge in: that's the same person.",
  // Stage ids come as Python writes them, with their quotes: 'applied', or "it's".
  move_not_allowed: "can't move from {{from_stage}} to {{to_stage}} (allowed: {{allowed}})",
  move_not_allowed_none: "can't move from {{from_stage}} to {{to_stage}} (allowed: none)",
  offer_not_found: "Offer {{id}} not found",
  recruiter_id_not_found: "recruiter_id: Contact {{id}} not found",
  recruiter_other_agency: "The recruiter works for a different agency than the one given.",
  referral_has_recruiter: "A referral can't have a recruiter; link the referrer as a person instead.",
  role_call_other_person: "meeting_id: that call was with someone else",
  role_has_applications_one: "{{name}} has an application. Delete it first, or archive it instead.",
  role_has_applications_other:
    "{{name}} has {{count}} applications. Delete them first, or archive them instead.",
  role_id_not_found: "role_id: Role {{id}} not found",
  role_not_found: "Role {{id}} not found",
  stage_unknown: "unknown stage {{stage}}",
  todo_not_found: "Todo {{id}} not found",
  todo_text_required: "text: say what needs doing",
  undo_inconsistent: "history is inconsistent: last move went to {{to_stage}}, stage is {{stage}}",
  undo_nothing: "nothing to undo",
  workflow_invalid: "invalid workflow in config.toml: {{problem}}",
} as const satisfies Record<Exclude<ErrorCode, PluralCode>, string> &
  Record<`${PluralCode}_${"one" | "other"}`, string>;

export default {
  title: "That didn't work",
  somethingWrong: "Something went wrong",
  uploadFileFailed: "{{name}}: {{reason}}",
  uploadFailedSeparator: "; ",
  // The app's own words for a request that failed: these ignore why, as they always have.
  own: {
    deleteCall: "Couldn't delete the call",
    deleteFile: "Couldn't delete the file",
    deleteNote: "Couldn't delete the note",
    deleteInterview: "Couldn't delete the interview",
    deleteIt: "Couldn't delete it",
    deleteOffer: "Couldn't delete the offer",
    deleteTodo: "Couldn't delete the to-do",
    removeContact: "Couldn't remove that contact",
    removeLink: "Couldn't remove the link",
  },
  codes,
} as const;
