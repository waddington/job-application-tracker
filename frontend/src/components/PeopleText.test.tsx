import { describe, expect, it } from "vitest";

import { relationLabel, relationOptions } from "../api/peopleHooks";
import { i18n } from "../i18n";
import type { Contact } from "../api/client";
import { likelyDuplicates } from "./MergePerson";

// People's text comes from locales/en/people.ts (i18n-people). A before/after snapshot of the
// pages and dialogs showed no change; these pin what the snapshot couldn't reach.

const person = (id: string, name: string, details: { kind: string; value: string }[] = []) =>
  ({ id, name, details }) as unknown as Contact;

describe("how someone is linked to an application", () => {
  it("offers every relation, in order", () => {
    expect(relationOptions().map((o) => o.label)).toEqual([
      "Recruiter (agency)",
      "Internal recruiter / talent",
      "Hiring manager",
      "Interviewer",
      "Referrer",
      "Other",
    ]);
  });

  it("shows one the app doesn't know as saved", () => {
    expect(relationLabel("interviewer")).toBe("Interviewer");
    expect(relationLabel("mentor")).toBe("mentor");
    expect(relationLabel("constructor")).toBe("constructor");
  });
});

describe("why two people look the same", () => {
  const me = person("1", "Riley Stone", [{ kind: "email", value: "riley@example.com" }]);

  it("says the reason, the strongest first", () => {
    const others = [
      person("2", "R Stone", [{ kind: "email", value: "RILEY@example.com" }]),
      person("3", "Riley  stone"),
      person("4", "Someone Else"),
    ];
    expect(likelyDuplicates(me, others).map((d) => [d.contact.id, d.why])).toEqual([
      ["2", "email"],
      ["3", "name"],
    ]);
  });
});

describe("words the demo data doesn't reach", () => {
  const t = (key: string, values: object) =>
    (i18n.t as unknown as (k: string, v: object) => string).call(i18n, key, values);

  it.each([
    ["people:merge.reasons.email", { option: "Riley" }, "Riley (same email)"],
    ["people:merge.reasons.linkedin", { option: "Riley" }, "Riley (same LinkedIn)"],
    ["people:merge.reasons.name", { option: "Riley" }, "Riley (same name)"],
    ["people:recruiters.nameFavourite", { name: "Riley" }, "Riley (favourite)"],
    ["people:recruiters.nameGhosted", { name: "Riley" }, "Riley (ghosted)"],
    ["people:recruiters.nameFavouriteGhosted", { name: "Riley" }, "Riley (favourite) (ghosted)"],
    ["people:recruiters.count", { count: 1 }, "1 person, A to Z"],
    ["people:recruiters.count", { count: 2 }, "2 people, A to Z"],
    ["people:recruiters.countFavourites", { count: 1 }, "1 person, favourites first, then A to Z"],
    ["people:recruiters.agencyLabel", { name: "Firm", count: 1 }, "Firm: 1 person"],
    [
      "people:recruiters.agencyLabelActive",
      { name: "Firm", count: 2, active: 1 },
      "Firm: 2 people, 1 in progress",
    ],
    [
      "people:company.blocked",
      { name: "Co", count: 1 },
      "Co still has an application. Delete it first, or archive it instead.",
    ],
    [
      "people:company.blocked",
      { name: "Co", count: 2 },
      "Co still has 2 applications. Delete them first, or archive them instead.",
    ],
    [
      "people:person.deleteConfirmShort",
      { name: "Riley" },
      "Delete Riley? They come off the applications and interviews they're on, and their calls are deleted; the applications themselves stay.",
    ],
  ] as const)("%s %j", (key, values, text) => {
    expect(t(key, values)).toBe(text);
  });
});
