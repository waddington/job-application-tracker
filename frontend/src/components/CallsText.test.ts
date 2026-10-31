import { describe, expect, it } from "vitest";

import { callLabel } from "../utils/calls";

// Calls' text comes from locales/en/calls.ts (i18n-calls). A call's name must match label() in
// api/meetings.py exactly, for every way of meeting.
describe("a call's name", () => {
  const name = (kind: string, title: string | null = null) =>
    callLabel({ kind, title, contact_name: "Alex Morgan" });

  it("says how and who with", () => {
    expect(name("call")).toBe("Call with Alex Morgan");
    expect(name("video")).toBe("Video call with Alex Morgan");
    expect(name("in_person")).toBe("Meeting with Alex Morgan");
  });

  it("adds what it's about, and an empty one is none", () => {
    expect(name("call", "Market catch-up")).toBe("Call with Alex Morgan: Market catch-up");
    expect(name("call", "")).toBe("Call with Alex Morgan");
  });

  it("keeps a kind it doesn't know", () => {
    expect(name("carrier_pigeon")).toBe("carrier_pigeon with Alex Morgan");
  });

  it("shows your words as written", () => {
    expect(name("call", "Q&A <panel> {{x}}")).toBe("Call with Alex Morgan: Q&A <panel> {{x}}");
  });
});
