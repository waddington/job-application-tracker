import { afterEach, describe, expect, it } from "vitest";

import type { TimelineItem } from "../api/timelineHooks";
import { i18n } from "../i18n";
import { PSEUDO } from "../i18n/language";
import cases from "./timelineTitles.cases.json";
import { timelineTitle } from "./timelineTitle";

// tests/test_timeline_titles.py makes the real API send each of these same cases, with this `title`, so
// the frontend's English and the API's can't drift apart.

const API_TITLE = "the API's title";

type Case = (typeof cases)[number] & {
  person?: string | null;
  role?: string | null;
  company?: string | null;
  agency?: string | null;
};

const itemOf = (c: Partial<Case>, title = API_TITLE) =>
  ({
    kind: c.kind,
    title,
    people: c.person == null ? [] : [{ id: "p", name: c.person }],
    role_title: c.role ?? null,
    company_name: c.company ?? null,
    agency_name: c.agency ?? null,
  }) as TimelineItem;

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("a title built here", () => {
  it.each(cases as Case[])("reads as the API wrote it: $title", (c) => {
    expect(timelineTitle(itemOf(c))).toBe(c.title);
  });

  it("goes through the translation files", async () => {
    await i18n.changeLanguage(PSEUDO);
    for (const c of cases as Case[]) expect(timelineTitle(itemOf(c))).not.toBe(c.title);
  });
});

describe("the API's title shows", () => {
  it.each([
    "stage-event",
    "other-event",
    "interview",
    "offer-reply",
    "meeting",
    "contact-closed",
    "note",
  ] as const)("for %s, which has no text yet", (kind) => {
    const item = itemOf({ kind, person: "Sam Sample", role: "Engineer", company: "Contoso" });
    expect(timelineTitle(item)).toBe(API_TITLE);
  });

  it("from an older server, which sends no kind", () => {
    const item = itemOf({ person: "Sam Sample", role: "Engineer", company: "Contoso" });
    expect(item.kind).toBeUndefined();
    expect(timelineTitle(item)).toBe(API_TITLE);
  });

  it.each([
    "role",
    "role-added",
    "role-passed",
    "company",
    "agency",
    "contact",
    "contact-waiting",
    "contact-chased",
    "contact-to-read",
  ])("for %s when the name its sentence needs is missing", (kind) => {
    expect(timelineTitle(itemOf({ kind }))).toBe(API_TITLE);
  });

  it("for a pitched role with a person but no role title", () => {
    const item = itemOf({ kind: "role", person: "Sam Sample", company: "Contoso" });
    expect(timelineTitle(item)).toBe(API_TITLE);
  });
});
