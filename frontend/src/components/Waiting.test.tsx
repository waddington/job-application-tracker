import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const daysAgo = (n: number) => dayjs().subtract(n, "day").format("YYYY-MM-DD");

const detail = (overrides: Record<string, unknown> = {}) => ({
  ...row(overrides),
  events: [],
  contacts: [],
  allowed_next: [],
  suggested_next: [],
  can_undo: false,
  documents: [],
  duplicates: [],
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("waiting to hear back", () => {
  it("marks an application as waiting from its page", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail(),
      "PATCH /api/v1/applications/a1": detail({ awaiting_reply_since: dayjs().format("YYYY-MM-DD") }),
      "/api/v1/contacts": [],
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    fireEvent.click(await screen.findByRole("button", { name: "I've replied, waiting" }));
    await waitFor(() => {
      const patch = calls.find((c) => c.method === "PATCH");
      expect(patch?.body).toEqual({ awaiting_reply_since: dayjs().format("YYYY-MM-DD") });
    });
  });

  it("lists applications and people you're waiting on, flagging ones to chase", async () => {
    const calls = mockApi({
      "/api/v1/next-actions": {
        follow_ups: [],
        stale: [],
        upcoming: [],
        awaiting_outcome: [],
        offer_deadlines: [],
        // Applied allows 7 days: 9 days of waiting is time to chase, 2 isn't.
        waiting: [
          row({ id: "a1", awaiting_reply_since: daysAgo(9) }),
          row({ id: "a2", company_name: "Fabrikam", awaiting_reply_since: daysAgo(2), stale: false }),
        ],
        waiting_people: [
          {
            id: "c1",
            name: "Alex Recruiter",
            title: "Senior Consultant",
            agency_id: "ag1",
            company_id: null,
            details: [],
            awaiting_reply_since: daysAgo(3),
            created_at: "",
            updated_at: "",
          },
        ],
        today: dayjs().format("YYYY-MM-DD"),
      },
      "PATCH /api/v1/contacts/c1": {},
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/health": {},
    });
    renderAt("/");
    const section = (await screen.findByRole("heading", { name: "Waiting to hear back" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(within(section).getByText("Waiting 9 days · time to chase")).toHaveStyle({
      color: "var(--mantine-color-red-text)",
    });
    expect(within(section).getByText("Waiting 2 days")).toBeInTheDocument();
    expect(within(section).getByRole("link", { name: "Alex Recruiter" })).toHaveAttribute(
      "href",
      "/people/c1",
    );
    expect(within(section).getByText("Waiting 3 days")).toBeInTheDocument();

    fireEvent.click(within(section).getByRole("button", { name: "Heard back from Alex Recruiter" }));
    await waitFor(() => {
      const patch = calls.find((c) => c.method === "PATCH" && c.path === "/api/v1/contacts/c1");
      expect(patch?.body).toEqual({ awaiting_reply_since: null });
    });
  });
});
