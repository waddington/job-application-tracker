import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { meeting, mockApi, roleSummary, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  const router = makeRouter(createMemoryHistory({ initialEntries: [path] }));
  render(<App router={router} />);
  return router;
}

const pitched = roleSummary({
  id: "r2",
  title: "Platform Engineer",
  company_id: "co2",
  company_name: "Fabrikam",
  employment_type: "contract",
  day_rate: 600,
  ir35: "outside",
  contact_id: "c1",
  contact_name: "Alex Morgan",
  agency_id: "ag1",
  agency_name: "Northwind Talent",
  meeting_id: "m0",
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("roles to decide", () => {
  it("lists roles to decide, and applies through the recruiter who pitched it", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [pitched],
      "POST /api/v1/applications": { id: "a9" },
      "/api/v1/health": {},
    });
    const router = renderAt("/roles");
    expect(await screen.findByText("Platform Engineer")).toBeInTheDocument();
    expect(
      screen.getByText(/£600 a day, outside IR35 · from Alex Morgan \(Northwind Talent\)/),
    ).toBeInTheDocument();
    expect(calls.find((c) => c.path.startsWith("/api/v1/role-summaries"))!.path).toContain(
      "status=to_decide",
    );

    fireEvent.click(screen.getByRole("button", { name: "Apply: Platform Engineer" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Through Northwind Talent (Alex Morgan).")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Create application" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/applications/a9"));
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({
      role_id: "r2",
      route: "agency",
      agency_id: "ag1",
      recruiter_id: "c1",
      stage: "applied",
    });
  });

  it("passes on a role with a reason", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [pitched],
      "PATCH /api/v1/roles/r2": { ...pitched, decision: "passed" },
      "/api/v1/health": {},
    });
    renderAt("/roles");
    fireEvent.click(await screen.findByRole("button", { name: "Pass: Platform Engineer" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Why? (optional)"), { target: { value: "Rate too low" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Pass" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        decision: "passed",
        decision_reason: "Rate too low",
      }),
    );
  });

  it("adds roles from a call on the person's page", async () => {
    const alex = {
      id: "c1",
      name: "Alex Morgan",
      title: null,
      agency_id: "ag1",
      company_id: null,
      details: [],
      awaiting_reply_since: null,
      created_at: "",
      updated_at: "",
    };
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/contacts/c1/summary": {
        contact: alex,
        agency_name: "Northwind Talent",
        company_name: null,
        applications: [],
        interviews: [],
      },
      "GET /api/v1/meetings": [
        meeting({ id: "m0", status: "done", starts_at: "2026-09-30T10:00:00Z", notes: "Two roles" }),
      ],
      "GET /api/v1/role-summaries": [pitched],
      "POST /api/v1/roles": pitched,
      "/api/v1/companies": [{ id: "co2", name: "Fabrikam" }],
      "/api/v1/contacts": [alex],
      "/api/v1/applications": [],
      "/api/v1/notes": [],
      "/api/v1/links": [],
      "/api/v1/attachments": [],
      "/api/v1/health": {},
    });
    renderAt("/people/c1");
    // Under the call: the role that came up in it.
    expect(await screen.findByText("Two roles")).toBeInTheDocument();
    expect((await screen.findAllByText("Platform Engineer")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Add roles from this call" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a role to decide on" });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "Data Engineer" } });
    fireEvent.click(within(dialog).getByLabelText("Company"));
    fireEvent.click(await screen.findByRole("option", { name: "Fabrikam", hidden: true }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Add role" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.path === "/api/v1/roles")).toBe(true),
    );
    expect(calls.find((c) => c.method === "POST")!.body).toMatchObject({
      company_id: "co2",
      title: "Data Engineer",
      contact_id: "c1",
      meeting_id: "m0",
    });
  });

  it("asks for a decision in Next actions", async () => {
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
        meetings: [],
        meetings_to_close: [],
        roles_to_decide: [pitched],
        today: "2026-10-02",
      },
      "/api/v1/health": {},
    });
    renderAt("/next-actions");
    const section = (await screen.findByRole("heading", { name: "Roles to decide" })).closest(
      ".mantine-Card-root",
    )!;
    expect(within(section as HTMLElement).getByText("Platform Engineer")).toBeInTheDocument();
    expect(
      within(section as HTMLElement).getByRole("button", { name: "Apply: Platform Engineer" }),
    ).toBeInTheDocument();
  });
});
