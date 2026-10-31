import { MantineProvider } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, errorMessage, unwrap, type ErrorCode } from "../api/client";
import { errorText, notifyError } from "../api/notifyError";
import { i18n } from "../i18n";
import { ApplicationLoadError } from "./ApplicationDrawer";

// Errors from the API (i18n-errors-setup). The demo can't make these fail, so the snapshot can't see them.

afterEach(() => {
  vi.restoreAllMocks();
});

const coded = (code: ErrorCode, params: Record<string, string | number> = {}) =>
  new ApiError({ detail: "the API's English", code, params });

// Keyed by code, so a code with no row fails the type check.
const TEXT: Record<ErrorCode, [Record<string, string | number>, string]> = {
  agency_id_not_found: [{ id: "x1" }, "agency_id: Agency x1 not found"],
  agency_needs_agency_route: [{}, "Only applications through a recruiter can have an agency."],
  agency_not_found: [{ id: "x1" }, "Agency x1 not found"],
  agency_route_needs_agency: [{}, "An agency application needs an agency or a recruiter."],
  application_contact_not_found: [{ id: "x1" }, "ApplicationContact x1 not found"],
  application_id_not_found: [{ id: "x1" }, "application_id: Application x1 not found"],
  application_not_found: [{ id: "x1" }, "Application x1 not found"],
  call_ends_before_start: [{}, "ends_at: can't be before starts_at"],
  company_has_applications: [
    { name: "Contoso", count: 2 },
    "Contoso has 2 applications. Delete them first, or archive them instead.",
  ],
  company_id_not_found: [{ id: "x1" }, "company_id: Company x1 not found"],
  company_not_found: [{ id: "x1" }, "Company x1 not found"],
  contact_detail_taken: [
    { name: "Sam Example", value: "sam@example.com" },
    "Sam Example already has sam@example.com. One person per email address and LinkedIn profile: open Sam Example instead, or merge the two.",
  ],
  contact_id_not_found: [{ id: "x1" }, "contact_id: Contact x1 not found"],
  contact_not_found: [{ id: "x1" }, "Contact x1 not found"],
  data_conflict: [
    { reason: "UNIQUE constraint failed" },
    "conflicts with existing data: UNIQUE constraint failed",
  ],
  direct_has_agency: [{}, "A direct application can't have an agency; change the route first."],
  direct_recruiter_has_agency: [
    { name: "Sam Example" },
    "Sam Example works for an agency, so this isn't a direct application; change the route.",
  ],
  interview_not_found: [{ id: "x1" }, "Interview x1 not found"],
  interviewer_not_found: [{ id: "x1" }, "interviewer_ids: Contact x1 not found"],
  entity_agency_not_found: [{ id: "x1" }, "entity_id: agency x1 not found"],
  entity_application_not_found: [{ id: "x1" }, "entity_id: application x1 not found"],
  entity_company_not_found: [{ id: "x1" }, "entity_id: company x1 not found"],
  entity_contact_not_found: [{ id: "x1" }, "entity_id: contact x1 not found"],
  entity_document_not_found: [{ id: "x1" }, "entity_id: document x1 not found"],
  entity_interview_not_found: [{ id: "x1" }, "entity_id: interview x1 not found"],
  link_not_found: [{ id: "x1" }, "Link x1 not found"],
  entity_role_not_found: [{ id: "x1" }, "entity_id: role x1 not found"],
  meeting_id_not_found: [{ id: "x1" }, "meeting_id: Meeting x1 not found"],
  meeting_not_found: [{ id: "x1" }, "Meeting x1 not found"],
  merge_same_person: [{}, "Pick someone else to merge in: that's the same person."],
  move_not_allowed: [
    { from_stage: "'applied'", to_stage: "'offer'", allowed: "screen, rejected" },
    "can't move from 'applied' to 'offer' (allowed: screen, rejected)",
  ],
  move_not_allowed_none: [
    { from_stage: "'rejected'", to_stage: "'offer'" },
    "can't move from 'rejected' to 'offer' (allowed: none)",
  ],
  offer_not_found: [{ id: "x1" }, "Offer x1 not found"],
  recruiter_id_not_found: [{ id: "x1" }, "recruiter_id: Contact x1 not found"],
  recruiter_other_agency: [{}, "The recruiter works for a different agency than the one given."],
  referral_has_recruiter: [{}, "A referral can't have a recruiter; link the referrer as a person instead."],
  role_call_other_person: [{}, "meeting_id: that call was with someone else"],
  role_has_applications: [
    { name: "Engineer", count: 2 },
    "Engineer has 2 applications. Delete them first, or archive them instead.",
  ],
  role_id_not_found: [{ id: "x1" }, "role_id: Role x1 not found"],
  role_not_found: [{ id: "x1" }, "Role x1 not found"],
  stage_unknown: [{ stage: "'nope'" }, "unknown stage 'nope'"],
  todo_not_found: [{ id: "x1" }, "Todo x1 not found"],
  undo_inconsistent: [
    { to_stage: "'offer'", stage: "'applied'" },
    "history is inconsistent: last move went to 'offer', stage is 'applied'",
  ],
  undo_nothing: [{}, "nothing to undo"],
  workflow_invalid: [
    { problem: "stage ids must be unique" },
    "invalid workflow in config.toml: stage ids must be unique",
  ],
  backup_add_failed: [{ reason: "denied" }, "git add failed: denied"],
  backup_commit_failed: [{ reason: "denied" }, "git commit failed: denied"],
  backup_detached_head: [
    {},
    "The data repo is on a detached HEAD; check out a branch so snapshots aren't lost.",
  ],
  backup_git_timeout: [{ command: "push", seconds: "120" }, "git push timed out after 120s"],
  backup_git_unavailable: [{ reason: "no such file" }, "couldn't run git: no such file"],
  backup_lock_failed: [{ path: "/x/y.lock", reason: "denied" }, "couldn't lock /x/y.lock: denied"],
  backup_mid_rebase: [{}, "The data repo is mid-rebase/merge; finish it and snapshots will resume."],
  backup_no_remote: [{}, "The data repo has no remote to push to. Add one with `git remote add origin ...`."],
  backup_not_a_repo: [{}, "The data directory isn't a git repo."],
  backup_push_failed: [{ reason: "denied" }, "git push failed: denied"],
  backup_shut_down: [{}, "snapshots are shut down"],
  backup_snapshot_failed: [{ reason: "disk full" }, "snapshot failed: disk full"],
  backup_snapshots_off: [{}, "The data directory isn't a git repo, so snapshots are off."],
  todo_text_required: [{}, "text: say what needs doing"],
};

describe("an error with a code", () => {
  it.each(Object.entries(TEXT) as [ErrorCode, (typeof TEXT)[ErrorCode]][])(
    "%s has its exact English",
    (code, [params, english]) => {
      expect(errorText(coded(code, params))).toBe(english);
    },
  );

  it.each([
    ["company_has_applications", "Contoso has an application. Delete it first, or archive it instead."],
    ["role_has_applications", "Contoso has an application. Delete it first, or archive it instead."],
  ] as [ErrorCode, string][])("%s has its own sentence for one", (code, english) => {
    expect(errorText(coded(code, { name: "Contoso", count: 1 }))).toBe(english);
  });

  it("matches the API's English for a stage id with an apostrophe", () => {
    expect(errorText(coded("stage_unknown", { stage: `"it's"` }))).toBe(`unknown stage "it's"`);
  });

  it("keeps values as written, with nothing escaped", () => {
    expect(errorText(coded("backup_push_failed", { reason: "<a> & 'b'" }))).toBe(
      "git push failed: <a> & 'b'",
    );
  });

  it("shows the API's English for a code this build doesn't know", () => {
    const newer = new ApiError({ detail: "From a newer server", code: "not_a_code_yet", params: {} });
    expect(errorText(newer)).toBe("From a newer server");
  });
});

describe("the app's own words for a failed request", () => {
  it.each([
    ["errors:own.deleteCall", "Couldn't delete the call"],
    ["errors:own.deleteInterview", "Couldn't delete the interview"],
    ["errors:own.deleteIt", "Couldn't delete it"],
    ["errors:own.deleteOffer", "Couldn't delete the offer"],
    ["errors:own.deleteTodo", "Couldn't delete the to-do"],
    ["errors:own.removeContact", "Couldn't remove that contact"],
    ["errors:own.removeLink", "Couldn't remove the link"],
  ] as const)("%s has its exact English", (key, english) => {
    expect(i18n.t(key)).toBe(english);
  });
});

describe("the application page's load error", () => {
  it("shows the code's text, in the language shown", () => {
    i18n.addResourceBundle("xx", "errors", { codes: { application_not_found: "Keine {{id}}" } });
    const was = i18n.language;
    void i18n.changeLanguage("xx");
    render(
      <MantineProvider>
        <ApplicationLoadError error={coded("application_not_found", { id: "x1" })} />
      </MantineProvider>,
    );
    expect(screen.getByText("Keine x1")).toBeInTheDocument();
    void i18n.changeLanguage(was);
    i18n.removeResourceBundle("xx", "errors");
  });
});

describe("an error without a code", () => {
  it("shows the API's detail", () => {
    expect(errorText(new ApiError({ detail: "Todo nope not found" }))).toBe("Todo nope not found");
  });

  it("shows any other error's message", () => {
    expect(errorText(new Error("Couldn't delete the file"))).toBe("Couldn't delete the file");
  });
});

describe("ApiError", () => {
  it("keeps the detail as its message, with the code and values", () => {
    const error = new ApiError({
      detail: "git push failed: x",
      code: "backup_push_failed",
      params: { reason: "x" },
    });
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("git push failed: x");
    expect(error.code).toBe("backup_push_failed");
    expect(error.params).toEqual({ reason: "x" });
  });

  it("reads a validation error's list as before, with no code", () => {
    const error = new ApiError({ detail: [{ loc: ["body", "name"], msg: "Field required" }] });
    expect(error.message).toBe("name: Field required");
    expect(error.code).toBeUndefined();
  });

  it.each([undefined, null, "oops", {}])("falls back to the same words for a body of %j", (body) => {
    expect(new ApiError(body).message).toBe("Something went wrong");
    expect(errorMessage(body)).toBe("Something went wrong");
  });

  it("is what unwrap throws", () => {
    expect(() => unwrap({ error: { detail: "No", code: "todo_text_required", params: {} } })).toThrow(
      ApiError,
    );
    expect(unwrap({ data: 1 })).toBe(1);
  });
});

describe("the toast", () => {
  it("has the title and the code's text", () => {
    const show = vi.spyOn(notifications, "show").mockReturnValue("id");
    notifyError(coded("todo_text_required"));
    expect(show).toHaveBeenCalledWith({
      color: "red",
      title: "That didn't work",
      message: "text: say what needs doing",
    });
  });

  it("has the title and the message when there's no code", () => {
    const show = vi.spyOn(notifications, "show").mockReturnValue("id");
    notifyError(new Error("Couldn't remove the link"));
    expect(show).toHaveBeenCalledWith({
      color: "red",
      title: "That didn't work",
      message: "Couldn't remove the link",
    });
  });

  it("follows the language, not the API's English", () => {
    i18n.addResourceBundle("xx", "errors", { title: "Nope", codes: { todo_text_required: "Say it" } });
    const was = i18n.language;
    void i18n.changeLanguage("xx");
    expect(errorText(coded("todo_text_required"))).toBe("Say it");
    expect(i18n.t("errors:title")).toBe("Nope");
    void i18n.changeLanguage(was);
    i18n.removeResourceBundle("xx", "errors");
  });

  it("picks a plural form by the count, and shows the API's English without one", () => {
    i18n.addResourceBundle("de", "errors", {
      codes: { many_one: "{{count}} Sache", many_other: "{{count}} Sachen" },
    });
    const was = i18n.language;
    void i18n.changeLanguage("de");
    const plural = (params: object) => new ApiError({ detail: "the API's English", code: "many", params });
    expect(errorText(plural({ count: 1 }))).toBe("1 Sache");
    expect(errorText(plural({ count: 3 }))).toBe("3 Sachen");
    expect(errorText(plural({}))).toBe("the API's English");
    void i18n.changeLanguage(was);
    i18n.removeResourceBundle("de", "errors");
  });
});
