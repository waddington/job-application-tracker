import { afterEach, describe, expect, it } from "vitest";

import { ApiError, errorMessage } from "../api/client";
import { errorText } from "../api/notifyError";
import { validationText } from "../api/validationText";
import cases from "../api/validationIssues.cases.json";
import { i18n } from "../i18n";

// tests/test_validation_text.py has the real API refuse each of these same requests with this same text.

const issue = (loc: (string | number)[], type: string, msg: string, ctx?: Record<string, unknown>) => ({
  loc: ["body", ...loc],
  type,
  msg,
  ctx,
});

afterEach(() => {
  void i18n.changeLanguage("en");
  i18n.removeResourceBundle("xx", "errors");
});

describe("validation text", () => {
  it.each(cases.map((c) => [c.shown, c.detail] as const))("in English shows %s", (shown, detail) => {
    expect(errorMessage({ detail })).toBe(shown);
    // Worded from its type and values alone, not by falling back to the API's English.
    const noEnglish = detail.map((problem) => ({ ...problem, msg: "from the API" }));
    expect(errorText(new ApiError({ detail: noEnglish }))).toBe(shown);
  });

  it("joins problems and keeps list positions", () => {
    const detail = [
      issue(["company_id"], "missing", "Field required"),
      issue(["links", 0], "string_pattern_mismatch", "String should match pattern '^a:\\S+$'", {
        pattern: "^a:\\S+$",
      }),
    ];
    const shown = "company_id: Field required; links.0: String should match pattern '^a:\\S+$'";
    expect(errorMessage({ detail })).toBe(shown);
    expect(validationText(detail)).toBe(shown);
  });

  it("shows Pydantic's English for a type or URL reason it has no text for", () => {
    const detail = [
      issue(
        ["due_on"],
        "date_from_datetime_parsing",
        "Input should be a valid date or datetime, input is too short",
        {
          error: "input is too short",
        },
      ),
      issue(["url"], "url_parsing", "Input should be a valid URL, something new", { error: "something new" }),
      issue(["x"], "value_error", "Value error, from an older server", { error: {} }),
    ];
    expect(validationText(detail)).toBe(errorMessage({ detail }));
  });

  it("copes with a problem that has only a message, or nothing", () => {
    expect(validationText([{ loc: ["body", "name"], msg: "Field required" }])).toBe("name: Field required");
    expect(validationText([{}])).toBe(": ");
  });

  it("shows a field it doesn't know as sent", () => {
    expect(validationText([{ loc: ["query", "constructor"], msg: "No" }])).toBe("constructor: No");
    expect(validationText([{ loc: ["query", "a.b"], msg: "No" }])).toBe("a.b: No");
  });

  it("follows the language: the sentence, its plural form, the field and the joins", () => {
    i18n.addResourceBundle("xx", "errors", {
      fields: { name: "Name-xx", company_id: "Firma-xx", title: "Titel-xx" },
      validation: {
        issue: "{{field}} = {{message}}",
        separator: " | ",
        fieldSeparator: " + ",
        missing: "Fehlt",
        check_not_null: "Nicht leer: {{fields}}",
        string_too_short_one: "Mindestens {{count}} Zeichen (one)",
        string_too_short_other: "Mindestens {{count}} Zeichen (other)",
        url_parsing_empty_host: "Kein Host",
      },
    });
    void i18n.changeLanguage("xx");
    const detail = [
      issue(["name"], "missing", "Field required"),
      issue(["name"], "string_too_short", "x", { min_length: 1 }),
      issue(["name"], "string_too_short", "x", { min_length: 3 }),
      issue(["website"], "url_parsing", "x", { error: "empty host" }),
      issue([], "value_error", "x", { error: {}, check: "not_null", fields: "company_id, title" }),
    ];
    expect(validationText(detail)).toBe(
      "Name-xx = Fehlt | Name-xx = Mindestens 1 Zeichen (one) | Name-xx = Mindestens 3 Zeichen (other) | website = Kein Host |  = Nicht leer: Firma-xx + Titel-xx",
    );
  });

  it("says something went wrong in the language shown", () => {
    i18n.addResourceBundle("xx", "errors", { somethingWrong: "Schief" });
    void i18n.changeLanguage("xx");
    expect(new ApiError(undefined).message).toBe("Schief");
    expect(errorText(new ApiError("oops"))).toBe("Schief");
  });
});
