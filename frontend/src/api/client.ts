import createClient from "openapi-fetch";

import type { components, paths } from "./schema";

/** Typed client for the local API. Types are generated from openapi.json (`pnpm gen:api`). */
export const api = createClient<paths>({ baseUrl: "" });

export type Schemas = components["schemas"];
export type ApplicationRow = Schemas["ApplicationRow"];
export type ApplicationDetail = Schemas["ApplicationDetail"];
export type Company = Schemas["CompanyOut"];
export type Agency = Schemas["AgencyOut"];
export type Contact = Schemas["ContactOut"];
export type Role = Schemas["RoleOut"];
export type ApiEvent = Schemas["EventOut"];

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
  return "Something went wrong";
}

/** Unwrap an openapi-fetch result or throw with a readable message (for TanStack Query). */
export function unwrap<T>(result: { data?: T; error?: unknown }): T {
  if (result.error !== undefined || result.data === undefined) {
    throw new Error(errorMessage(result.error));
  }
  return result.data;
}
