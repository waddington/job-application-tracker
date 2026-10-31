import { describe, expect, it } from "vitest";

import { relationLabel, relationOptions } from "../api/peopleHooks";
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
