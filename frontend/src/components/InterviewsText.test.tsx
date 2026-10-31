import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { describe, expect, it, vi } from "vitest";

import { roundLabel } from "../utils/rounds";
import { roundStatus } from "./Interviews";
import { RescheduledBadge } from "./Reschedule";

// Interviews' text comes from locales/en/interviews.ts (i18n-interviews). A before/after snapshot
// of the pages and dialogs showed no change; these pin what the demo data can't reach.

const round = (over: Partial<Parameters<typeof roundLabel>[0]> = {}) => ({
  round: 2,
  title: null,
  kind: "technical",
  ...over,
});

describe("a round's name matches label() in domain/interviews.py", () => {
  it("is the round and your description", () => {
    expect(roundLabel(round({ title: "System design test" }))).toBe("Round 2 · System design test");
  });

  it("falls back to its kind, where other reads Interview", () => {
    expect(roundLabel(round())).toBe("Round 2 · Technical");
    expect(roundLabel(round({ kind: "hiring_manager" }))).toBe("Round 2 · Hiring manager");
    expect(roundLabel(round({ kind: "other" }))).toBe("Round 2 · Interview");
  });

  it("drops Round with no round number", () => {
    expect(roundLabel(round({ round: null }))).toBe("Technical");
    expect(roundLabel(round({ round: null, title: "Chat" }))).toBe("Chat");
  });

  it("treats an empty description as none, and keeps a kind it doesn't know", () => {
    expect(roundLabel(round({ title: "" }))).toBe("Round 2 · Technical");
    expect(roundLabel(round({ kind: "constructor" }))).toBe("Round 2 · constructor");
  });

  it("shows your words as written", () => {
    expect(roundLabel(round({ title: "Q&A <panel> {{x}}" }))).toBe("Round 2 · Q&A <panel> {{x}}");
  });
});

describe("a round's status", () => {
  const at = (status: string, starts_at: string | null, deadline_at: string | null = null) =>
    roundStatus({ status, starts_at, deadline_at });

  it("reads each state", () => {
    vi.useFakeTimers({ now: new Date("2026-10-31T12:00:00Z") });
    expect(at("scheduled", "2026-11-01T12:00:00Z")).toEqual({ label: "Coming up", color: "blue" });
    expect(at("scheduled", "2026-10-30T12:00:00Z")).toEqual({ label: "Awaiting outcome", color: "orange" });
    expect(at("scheduled", null, "2026-10-30T12:00:00Z").label).toBe("Awaiting outcome");
    expect(at("done", "2026-10-30T12:00:00Z")).toEqual({ label: "Done", color: "teal" });
    expect(at("cancelled", null)).toEqual({ label: "Cancelled", color: "gray" });
    vi.useRealTimers();
  });
});

describe("the Rescheduled badge", () => {
  const badge = (rescheduled_count: number) =>
    render(
      <MantineProvider>
        <RescheduledBadge interview={{ rescheduled_count, rescheduled_from: null }} />
      </MantineProvider>,
    );

  it("counts from the second move, and hides with none", () => {
    badge(0);
    expect(screen.queryByText(/Rescheduled/)).toBeNull();
    badge(1);
    expect(screen.getByText("Rescheduled")).toBeTruthy();
    badge(3);
    expect(screen.getByText("Rescheduled ×3")).toBeTruthy();
  });
});
