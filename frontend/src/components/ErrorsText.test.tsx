import { notifications } from "@mantine/notifications";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError, errorMessage, unwrap, type ErrorCode } from "../api/client";
import { errorText, notifyError } from "../api/notifyError";
import { i18n } from "../i18n";

// Errors from the API (i18n-errors-setup). The demo can't make these fail, so the snapshot can't see them.

afterEach(() => {
  vi.restoreAllMocks();
});

const coded = (code: ErrorCode, params: Record<string, string | number> = {}) =>
  new ApiError({ detail: "the API's English", code, params });

const TEXT: [ErrorCode, Record<string, string | number>, string][] = [
  ["backup_add_failed", { reason: "denied" }, "git add failed: denied"],
  ["backup_commit_failed", { reason: "denied" }, "git commit failed: denied"],
  [
    "backup_detached_head",
    {},
    "The data repo is on a detached HEAD; check out a branch so snapshots aren't lost.",
  ],
  ["backup_git_timeout", { command: "push", seconds: "120" }, "git push timed out after 120s"],
  ["backup_git_unavailable", { reason: "no such file" }, "couldn't run git: no such file"],
  ["backup_lock_failed", { path: "/x/y.lock", reason: "denied" }, "couldn't lock /x/y.lock: denied"],
  ["backup_mid_rebase", {}, "The data repo is mid-rebase/merge; finish it and snapshots will resume."],
  [
    "backup_no_remote",
    {},
    "The data repo has no remote to push to. Add one with `git remote add origin ...`.",
  ],
  ["backup_not_a_repo", {}, "The data directory isn't a git repo."],
  ["backup_push_failed", { reason: "denied" }, "git push failed: denied"],
  ["backup_shut_down", {}, "snapshots are shut down"],
  ["backup_snapshot_failed", { reason: "disk full" }, "snapshot failed: disk full"],
  ["backup_snapshots_off", {}, "The data directory isn't a git repo, so snapshots are off."],
  ["todo_text_required", {}, "text: say what needs doing"],
];

describe("an error with a code", () => {
  it.each(TEXT)("%s has its exact English", (code, params, english) => {
    expect(errorText(coded(code, params))).toBe(english);
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
});
