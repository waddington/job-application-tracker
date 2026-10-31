import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ApplicationRow, Contact } from "../api/client";
import type { Interview } from "../api/interviewHooks";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import { ChaseActions } from "./ChaseActions";
import { HowItWorks } from "./HowItWorks";
import { InterviewOutcome } from "./OutcomeNotes";
import { closedLabel, waitingOrChased } from "./PersonChase";
import { ReplyHabit } from "./ReplyHabit";
import { dueLabel } from "./Todos";
import { ApplicationWaiting, repliedLabel, waitingLabel } from "./Waiting";

// Today's text comes from locales/en/{today,people,todos}.ts (i18n-today). A before/after
// snapshot of every page showed no change; these pin the strings that snapshot couldn't reach
// (dialogs it didn't open, states the demo data doesn't have).

function wrap(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MantineProvider>
      <Notifications />
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </MantineProvider>,
  );
}

const daysAgo = (n: number) => dayjs().subtract(n, "day").format("YYYY-MM-DD");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("How did it go?", () => {
  const round = {
    id: "i1",
    round: 2,
    title: "System design test",
    kind: "system_design",
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
    expect(dueLabel("2026-03-04", today).label).toBe("Overdue · 4 Mar 2026");
    expect(dueLabel("2026-03-05", today)).toEqual({ label: "Today", color: "orange" });
    expect(dueLabel("2026-03-06", today)).toEqual({ label: "Tomorrow", color: "yellow" });
    expect(dueLabel("2026-03-20", today).label).toBe("By 20 Mar 2026");
  });
});

describe("chasing an application", () => {
  // A workflow with a Ghosted stage and any-to-any moves, so Mark as Ghosted shows.
  const workflow = {
    ...WORKFLOW,
    transitions: "any",
    stages: [
      ...WORKFLOW.stages,
      { ...WORKFLOW.stages.at(-1)!, id: "ghosted", name: "Ghosted", allowed_next: [] },
    ],
  };
  const app = row({ id: "a1", company_name: "Contoso", stage: "applied" }) as unknown as ApplicationRow;

  it.each([
    ["Follow up on Contoso", "In 3 days", "Contoso: follow up in 3 days"],
    ["Follow up on Contoso", "Tomorrow", "Contoso: follow up tomorrow"],
    ["Snooze Contoso", "1 week", "Contoso: snoozed for 1 week"],
    ["Snooze Contoso", "2 weeks", "Contoso: snoozed for 2 weeks"],
  ])("%s → %s says %s", async (button, item, toast) => {
    mockApi({ "/api/v1/workflow": workflow, "PATCH /api/v1/applications/a1": app });
    wrap(<ChaseActions row={app} />);
    fireEvent.click(screen.getByRole("button", { name: button }));
    fireEvent.click(await screen.findByRole("menuitem", { name: item }));
    expect(await screen.findByText(toast)).toBeInTheDocument();
  });

  it("the menus' headings", async () => {
    mockApi({ "/api/v1/workflow": workflow });
    wrap(<ChaseActions row={app} />);
    fireEvent.click(screen.getByRole("button", { name: "Follow up on Contoso" }));
    expect(await screen.findByText("Remind me to follow up")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Next week", hidden: true })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Snooze Contoso" }));
    expect(await screen.findByText("Snooze for")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "3 days", hidden: true })).toBeInTheDocument();
  });

  it("asks before marking it Ghosted, naming your stage", async () => {
    mockApi({ "/api/v1/workflow": workflow });
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    wrap(<ChaseActions row={app} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mark Contoso as Ghosted" }));
    expect(confirm).toHaveBeenCalledWith("Mark Contoso as Ghosted? (You can undo it from the application.)");
  });
});

describe("a reply habit, and waiting longer than usual", () => {
  const habit = (late: number) => ({
    replies: 3,
    usual_reply_days: 1,
    // Monday-to-Friday counting: start far enough back for `late` extra working days.
    awaiting_reply_since: (() => {
      let d = dayjs();
      let working = 0;
      while (working < 1 + late) {
        d = d.subtract(1, "day");
        if (d.day() !== 0 && d.day() !== 6) working++;
      }
      return d.format("YYYY-MM-DD");
    })(),
  });

  it.each([
    [1, "Usually replies within 1 working day · waiting 1 working day longer than usual"],
    [3, "Usually replies within 1 working day · waiting 3 working days longer than usual"],
  ])("%s day(s) late", (late, text) => {
    vi.useFakeTimers({ now: new Date("2026-10-28T12:00:00"), toFake: ["Date"] });
    try {
      const { container } = wrap(<ReplyHabit contact={habit(late)} />);
      expect(container.querySelector("p")!.textContent).toBe(text);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("How it works", () => {
  it("reads as one sentence per step, with the names in bold", () => {
    wrap(<HowItWorks />);
    const step = (title: string) => screen.getByText(title).nextElementSibling!;
    expect(step("Start from Today").textContent).toBe(
      "Your move is what to do now (replies to read, follow-ups due, your to-dos), Coming up is what's booked, and Waiting on them is who to chase.",
    );
    expect(within(step("Start from Today") as HTMLElement).getByText("Coming up").tagName).toBe("B");
    expect(step("Add an application").textContent).toBe(
      "Press New application (top right, on any page). Type the company and role. If a recruiter brought it to you, choose Through a recruiter and type the agency and their name. Anything new is created for you, so there's no need to set up companies or recruiters first.",
    );
    expect(within(step("Add an application") as HTMLElement).getByText("Through a recruiter").tagName).toBe(
      "I",
    );
  });
});
