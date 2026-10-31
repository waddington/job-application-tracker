import { notifications } from "@mantine/notifications";
import { afterEach, describe, expect, it, vi } from "vitest";

import { uploadFiles } from "../api/attachmentHooks";
import { ApiError, errorMessage, unwrap, type ErrorCode } from "../api/client";
import { errorText, notifyError } from "../api/notifyError";
import { i18n } from "../i18n";

// Errors from the API (i18n-errors-setup). The demo can't make these fail, so the snapshot can't see them.

afterEach(() => {
  vi.restoreAllMocks();
});

const coded = (code: ErrorCode, params: Record<string, string | number> = {}) =>
  new ApiError({ detail: "the API's English", code, params });

// Keyed by code, so a code with no row fails the type check.
const TEXT: Record<ErrorCode, [Record<string, string | number>, string]> = {
  attachment_file_missing: [{ name: "brief.pdf" }, "brief.pdf is missing from files/"],
  attachment_is_version_file: [
    { label: "v3", quoted_label: "'v3'" },
    "This is the file of version 'v3'; delete that version instead.",
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
  cv_file_applications_invalid: [{}, "application_ids: only applications this file counts for."],
  cv_file_document_required: [{}, "Pick a document to add it to, or name a new one."],
  cv_file_missing: [{ name: "cv.pdf" }, "cv.pdf is missing from your data folder."],
  cv_file_not_found: [{}, "No CV file like that among your attachments (or it's all recorded already)."],
  document_sent: [
    { count: 1 },
    "A version of this document was sent with 1 application(s); remove it from them first.",
  ],
  document_version_not_found: [{ id: "abc" }, "document_version_id: abc not found"],
  file_is_symlink: [{ path: "2026/10/x.pdf" }, "2026/10/x.pdf is a symlink"],
  file_outside_files: [{ path: "../x.pdf" }, "../x.pdf isn't under files/"],
  file_too_large: [{ count: 50 }, "files can be up to 50 MB"],
  note_changed: [{}, "This note changed since you opened it (maybe in another editor). Reload it first."],
  note_link_agency_not_found: [{ id: "x1" }, "links: agency x1 not found"],
  note_link_application_not_found: [{ id: "x1" }, "links: application x1 not found"],
  note_link_company_not_found: [{ id: "x1" }, "links: company x1 not found"],
  note_link_contact_not_found: [{ id: "x1" }, "links: contact x1 not found"],
  note_link_document_not_found: [{ id: "x1" }, "links: document x1 not found"],
  note_link_interview_not_found: [{ id: "x1" }, "links: interview x1 not found"],
  note_link_invalid: [
    { link: "nope", quoted_link: "'nope'", kinds: "application, company" },
    "links: 'nope' should look like 'application:<id>' (application, company)",
  ],
  note_link_role_not_found: [{ id: "x1" }, "links: role x1 not found"],
  note_not_found: [{ id: "abc" }, "Note abc not found"],
  note_path_invalid: [{ path: "x.txt" }, "x.txt isn't a note under notes/"],
  note_unreadable: [{ id: "abc", reason: "denied" }, "Note abc can't be read: denied"],
  todo_text_required: [{}, "text: say what needs doing"],
  version_already_sent: [{}, "That version is already recorded for this application."],
  version_label_required: [{}, "label: give the version a name, e.g. v3 (fintech)"],
  version_sent: [{ count: 1 }, "This version was sent with 1 application(s); remove it from them first."],
};

describe("an error with a code", () => {
  it.each(Object.entries(TEXT) as [ErrorCode, (typeof TEXT)[ErrorCode]][])(
    "%s has its exact English",
    (code, [params, english]) => {
      expect(errorText(coded(code, params))).toBe(english);
    },
  );

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

describe("counts and sizes", () => {
  it.each([
    [
      "document_sent",
      2,
      "A version of this document was sent with 2 application(s); remove it from them first.",
    ],
    ["version_sent", 2, "This version was sent with 2 application(s); remove it from them first."],
    ["file_too_large", 1, "files can be up to 1 MB"],
  ] as [ErrorCode, number, string][])("%s with %i", (code, count, english) => {
    expect(errorText(coded(code, { count }))).toBe(english);
  });
});

describe("the hooks' own text", () => {
  const files = [new File(["a"], "a.pdf"), new File(["b"], "b.pdf"), new File(["c"], "c.pdf")];
  const reply = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  it("lists each file that failed, with its reason, in the old words", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        reply(413, { detail: "the API's English", code: "file_too_large", params: { count: 50 } }),
      )
      .mockResolvedValueOnce(reply(201, {}))
      .mockResolvedValueOnce(reply(422, { detail: "Plain reason" }));
    await expect(uploadFiles(files, "role", "r1")).rejects.toThrow(
      new Error("a.pdf: files can be up to 50 MB; c.pdf: Plain reason"),
    );
  });

  it("says something went wrong when a failed upload's body isn't JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("oops", { status: 500 }));
    await expect(uploadFiles(files.slice(0, 1), "role", "r1")).rejects.toThrow(
      new Error("a.pdf: Something went wrong"),
    );
  });

  it("has the delete failures' fixed text", () => {
    expect(i18n.t("errors:deleteFileFailed")).toBe("Couldn't delete the file");
    expect(i18n.t("errors:deleteNoteFailed")).toBe("Couldn't delete the note");
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
