import createClient from "openapi-fetch";

import { i18n } from "../i18n";
import type { components, paths } from "./schema";

/** Typed client for the local API. Types are generated from openapi.json (`pnpm gen:api`). */
export const api = createClient<paths>({
  // Same origin as the page (FastAPI serves both); absolute so Request() works outside browsers too.
  baseUrl: globalThis.location?.origin ?? "",
  // Look fetch up per call rather than capturing it once, so it can be swapped (tests, polyfills).
  fetch: (request) => globalThis.fetch(request),
});

export type Schemas = components["schemas"];
export type ApplicationRow = Schemas["ApplicationRow"];
export type ApplicationDetail = Schemas["ApplicationDetail"];
export type Duplicate = Schemas["DuplicateOut"];
export type Company = Schemas["CompanyOut"];
export type Agency = Schemas["AgencyOut"];
export type Contact = Schemas["ContactOut"];
export type Role = Schemas["RoleOut"];
export type ApiEvent = Schemas["EventOut"];
export type ErrorCode = NonNullable<Schemas["ErrorOut"]["code"]>;

/** Turn an openapi-fetch error body into a readable message. */
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d: { loc?: unknown[]; msg?: string }) => `${(d.loc ?? []).slice(1).join(".")}: ${d.msg ?? ""}`)
        .join("; ");
    }
  }
  return i18n.t("errors:somethingWrong");
}

/** A failed API call. `message` is the API's English detail; a code, when there is one, has text in `errors`. */
export class ApiError extends Error {
  readonly code?: ErrorCode;
  readonly params?: Record<string, string | number>;
  /** A validation error's problems (a 422 with a list), which `errorText` words in your language. */
  readonly issues?: Partial<Schemas["ValidationIssue"]>[];

  constructor(body: unknown) {
    super(errorMessage(body));
    this.name = "ApiError";
    if (body && typeof body === "object") {
      const { code, params, detail } = body as Partial<Schemas["ErrorOut"]>;
      if (typeof code === "string") this.code = code;
      if (params && typeof params === "object") this.params = params;
      if (Array.isArray(detail)) this.issues = detail;
    }
  }
}

/** Unwrap an openapi-fetch result or throw with a readable message (for TanStack Query). */
export function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined || result.data === undefined) {
    throw new ApiError(result.error);
  }
  return result.data;
}
