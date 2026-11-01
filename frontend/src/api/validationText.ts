import { i18n } from "../i18n";
import type { Schemas } from "./client";

type Issue = Partial<Schemas["ValidationIssue"]>;

// A URL's `ctx.error` is the parser's own English, so each one this API's forms can meet is a whole
// sentence of its own. Any other shows Pydantic's English.
const URL_REASONS: Record<string, string> = {
  "empty host": "url_parsing_empty_host",
  "invalid international domain name": "url_parsing_bad_domain",
  "invalid IPv4 address": "url_parsing_bad_ipv4",
  "invalid IPv6 address": "url_parsing_bad_ipv6",
  "invalid port number": "url_parsing_bad_port",
  "relative URL without a base": "url_parsing_relative",
};

// The value in `ctx` that picks a plural form.
const COUNTED: Record<string, string> = { string_too_long: "max_length", string_too_short: "min_length" };

function textOr(key: string, fallback: string, params?: Record<string, unknown>): string {
  // The key is only known at run time, so the cast stops t() wanting every placeholder of every key.
  return i18n.exists(key, params) ? i18n.t(key as "errors:title", params) : fallback;
}

function fieldName(name: string): string {
  return textOr(`errors:fields.${name}`, name);
}

function issueMessage({ type = "", msg = "", ctx }: Issue): string {
  const params: Record<string, unknown> = { ...ctx };
  const countedBy = COUNTED[type];
  if (countedBy) params.count = params[countedBy];
  if (type === "not_null" && typeof params.fields === "string") {
    params.fields = params.fields.split(", ").map(fieldName).join(i18n.t("errors:validation.fieldSeparator"));
  }
  const key = type === "url_parsing" ? URL_REASONS[String(params.error)] : type;
  return key ? textOr(`errors:validation.${key}`, msg, params) : msg;
}

/** A 422's problems in your language. In English this is exactly `errorMessage`'s text, and a type with no text here shows Pydantic's `msg`. */
export function validationText(issues: Issue[]): string {
  return issues
    .map((issue) => {
      const field = (issue.loc ?? [])
        .slice(1)
        .map((part) => (typeof part === "string" ? fieldName(part) : part))
        .join(".");
      return i18n.t("errors:validation.issue", { field, message: issueMessage(issue) });
    })
    .join(i18n.t("errors:validation.separator"));
}
