import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { meeting, mockApi, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const alex = {
  id: "c1",
  name: "Alex Morgan",
  title: "Recruiter",
  agency_id: "ag1",
  company_id: null,
  details: [],
  awaiting_reply_since: null,
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

const PERSON = {
  "/api/v1/workflow": WORKFLOW,
  "/api/v1/contacts/c1/summary": {
    contact: alex,
    agency_name: "Northwind Talent",
    company_name: null,
    applications: [],
    interviews: [],
  },
  "/api/v1/notes": [],
  "/api/v1/links": [],
  "/api/v1/attachments": [],
  "/api/v1/contacts": [alex],
  "/api/v1/applications": [],
  "/api/v1/health": {},
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("calls and meetings", () => {
  it("books a call with someone from their page", async () => {
    const calls = mockApi({
      ...PERSON,
      "GET /api/v1/meetings": [],
      "POST /api/v1/meetings": meeting(),
    });
    renderAt("/people/c1");
    expect(await screen.findByText(/No calls with Alex Morgan yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Book a call" }));
    const dialog = await screen.findByRole("dialog", { name: "Book a call" });
    fireEvent.change(within(dialog).getByLabelText("About"), { target: { value: "Market catch-up" } });
    fireEvent.change(within(dialog).getByLabelText("Agenda"), { target: { value: "Ask about rates" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Book call" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.path === "/api/v1/meetings")).toBe(true),
    );
    const body = calls.find((c) => c.method === "POST")!.body as Record<string, unknown>;
    expect(body).toMatchObject({
      contact_id: "c1",
      kind: "call",
      title: "Market catch-up",
      status: "scheduled",
      agenda: "Ask about rates",
      notes: null,
      application_id: null,
    });
    expect(typeof body.starts_at).toBe("string");
  });

  it("lists past calls with how they went, and asks about ones still booked", async () => {
    const calls = mockApi({
      ...PERSON,
      "GET /api/v1/meetings": [
        meeting({
          id: "m0",
          starts_at: "2026-09-20T10:00:00Z",
          status: "done",
          notes: "Three roles to look at",
        }),
        meeting({
          id: "m2",
          title: "Follow-up",
          label: "Call with Alex Morgan: Follow-up",
          starts_at: "2026-09-29T10:00:00Z",
        }),
      ],
      "PATCH /api/v1/meetings/m2": meeting({ id: "m2", status: "cancelled" }),
    });
    renderAt("/people/c1");
    expect(await screen.findByText("Three roles to look at")).toBeInTheDocument();
    // The done one's badge, and the button on the one still booked.
    expect(screen.getAllByText("Happened")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /^Happened/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Didn't happen/ }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ status: "cancelled" }),
    );
  });

  it("shows calls in Next actions", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/next-actions": {
        follow_ups: [],
        stale: [],
        upcoming: [],
        awaiting_outcome: [],
        offer_deadlines: [],
        waiting: [],
        waiting_people: [],
        meetings: [meeting()],
        meetings_to_close: [
          meeting({ id: "m0", label: "Call with Alex Morgan: Intro", starts_at: "2026-09-29T10:00:00Z" }),
        ],
        today: "2026-10-02",
      },
      "/api/v1/health": {},
    });
    renderAt("/next-actions");
    const coming = (await screen.findByRole("heading", { name: "Coming up" })).closest(".mantine-Card-root")!;
    expect(
      within(coming as HTMLElement).getByText("Call with Alex Morgan: Market catch-up"),
    ).toBeInTheDocument();
    const outcome = screen.getByRole("heading", { name: "How did it go?" }).closest(".mantine-Card-root")!;
    expect(within(outcome as HTMLElement).getByText("Call with Alex Morgan: Intro")).toBeInTheDocument();
    expect(within(outcome as HTMLElement).getByRole("button", { name: /^Happened/ })).toBeInTheDocument();
  });
});
