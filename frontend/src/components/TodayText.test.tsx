import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import type { Contact } from "../api/client";
import type { Interview } from "../api/interviewHooks";
import { InterviewOutcome } from "./OutcomeNotes";
import { closedLabel, waitingOrChased } from "./PersonChase";
import { dueLabel } from "./Todos";
import { ApplicationWaiting, repliedLabel, waitingLabel } from "./Waiting";

// Today's text comes from locales/en/{today,people,todos}.ts (i18n-today). A before/after
// snapshot of every page showed no change; these pin the strings that snapshot couldn't reach
// (dialogs it didn't open, states the demo data doesn't have).

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </MantineProvider>,
  );
}

const daysAgo = (n: number) => dayjs().subtract(n, "day").format("YYYY-MM-DD");

describe("How did it go?", () => {
  const round = {
    id: "i1",
    label: "Round 2 · System design test",
    company_name: "Contoso",
    role_title: "Senior Backend Engineer",
    debrief: null,
    questions: null,
  } as unknown as Interview;

  it("asks for the debrief and the questions when it's done", async () => {
    wrap(<InterviewOutcome interview={round} />);
    fireEvent.click(screen.getByRole("button", { name: "Done: Round 2 · System design test" }));
    expect(await screen.findByText("How did Round 2 · System design test go?")).toBeInTheDocument();
    expect(screen.getByText("Contoso · Senior Backend Engineer")).toBeInTheDocument();
    expect(screen.getByLabelText("Debrief")).toHaveAttribute(
      "placeholder",
      "How it went, who you met, what's next",
    );
    expect(screen.getByLabelText("Questions asked")).toHaveAttribute(
      "placeholder",
      "So you can prepare for the next one",
    );
    expect(screen.getByRole("button", { name: "Mark as done" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("asks what happened when it didn't", async () => {
    wrap(<InterviewOutcome interview={round} />);
    fireEvent.click(screen.getByRole("button", { name: "Didn't happen: Round 2 · System design test" }));
    expect(await screen.findByText("Round 2 · System design test didn't happen")).toBeInTheDocument();
    expect(screen.getByLabelText("What happened?")).toHaveAttribute(
      "placeholder",
      "They rescheduled, you withdrew, nobody turned up…",
    );
    expect(screen.getByRole("button", { name: "Mark as didn't happen" })).toBeInTheDocument();
  });
});

describe("where a conversation stands", () => {
  it("waiting and replied, by how long", () => {
    expect(waitingLabel(daysAgo(0))).toBe("Waiting since today");
    expect(waitingLabel(daysAgo(1))).toBe("Waiting 1 day");
    expect(waitingLabel(daysAgo(5))).toBe("Waiting 5 days");
    expect(repliedLabel(daysAgo(0))).toBe("Replied today");
    expect(repliedLabel(daysAgo(1))).toBe("Replied yesterday");
    expect(repliedLabel(daysAgo(3))).toBe("Replied 3 days ago");
  });

  it.each([
    [0, "Reply to read · today"],
    [1, "Reply to read · yesterday"],
    [4, "Reply to read · 4 days ago"],
  ])("the badge for a reply %s days old", (days, badge) => {
    wrap(<ApplicationWaiting id="a1" since={null} toRead={daysAgo(days)} />);
    expect(screen.getByText(badge)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Read it" })).toBeInTheDocument();
  });

  it("the buttons, and their labels for screen readers", () => {
    wrap(<ApplicationWaiting id="a1" since={daysAgo(2)} who="Contoso" />);
    expect(screen.getByText("Waiting 2 days")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Heard back from Contoso" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "They've replied: Contoso" })).toHaveAttribute(
      "title",
      "Their reply needs reading: it goes to the top of Today",
    );
  });

  it("nothing yet: I've replied, or they have", () => {
    wrap(<ApplicationWaiting id="a1" since={null} />);
    expect(screen.getByRole("button", { name: "I've replied, waiting" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "They've replied" })).toBeInTheDocument();
  });

  it("chased or waiting, and how someone was closed", () => {
    const person = (since: string, chased: string | null) =>
      ({ awaiting_reply_since: since, chased_on: chased }) as unknown as Contact;
    expect(waitingOrChased(person(daysAgo(0), daysAgo(0)), waitingLabel)).toBe("Chased today");
    expect(waitingOrChased(person(daysAgo(1), daysAgo(1)), waitingLabel)).toBe("Chased yesterday");
    expect(waitingOrChased(person(daysAgo(6), daysAgo(6)), waitingLabel)).toBe("Chased 6 days ago");
    expect(waitingOrChased(person(daysAgo(6), null), waitingLabel)).toBe("Waiting 6 days");
    expect(closedLabel("ghosted")).toBe("Ghosted");
    expect(closedLabel("not_interested")).toBe("Not interested");
    expect(closedLabel("something_else")).toBe("something_else");
  });
});

describe("to-do dates", () => {
  const today = "2026-03-05";
  it("overdue, today, tomorrow, or by a date", () => {
    expect(dueLabel("2026-03-04", today).label).toMatch(/^Overdue · /);
    expect(dueLabel("2026-03-05", today)).toEqual({ label: "Today", color: "orange" });
    expect(dueLabel("2026-03-06", today)).toEqual({ label: "Tomorrow", color: "yellow" });
    expect(dueLabel("2026-03-20", today).label).toMatch(/^By /);
  });
});
