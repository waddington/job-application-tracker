import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderApplications() {
  const router = makeRouter(createMemoryHistory({ initialEntries: ["/applications"] }));
  render(<App router={router} />);
}

const detail = {
  ...row(),
  events: [
    {
      id: "e1",
      application_id: "a1",
      kind: "stage_change",
      occurred_at: "2026-09-19T10:00:00Z",
      from_stage: null,
      to_stage: "interested",
      summary: "Application created",
      data: {},
      created_at: "2026-09-19T10:00:00Z",
    },
    {
      id: "e2",
      application_id: "a1",
      kind: "stage_change",
      occurred_at: "2026-09-20T10:00:00Z",
      from_stage: "interested",
      to_stage: "applied",
      summary: null,
      data: {},
      created_at: "2026-09-20T10:00:00Z",
    },
  ],
  contacts: [],
  allowed_next: ["screen", "rejected"],
  suggested_next: ["screen", "rejected"],
  can_undo: true,
  documents: [],
  duplicates: [],
};

afterEach(() => vi.unstubAllGlobals());
beforeEach(() => localStorage.clear()); // the chosen view is remembered in localStorage

describe("applications page", () => {
  it("lists applications with stage, route and staleness", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [],
      "/api/v1/applications": [
        row(),
        row({
          id: "a2",
          company_name: "Fabrikam",
          route: "direct",
          stale: false,
          days_since_activity: 1,
          agency_name: null,
          recruiter_name: null,
        }),
      ],
      "/api/v1/health": { status: "ok", version: "0", schema: "0002", git_repo: true },
    });
    renderApplications();
    expect(await screen.findByText("Contoso")).toBeInTheDocument();
    expect(screen.getByText("Fabrikam")).toBeInTheDocument();
    expect(screen.getByText("Alex Recruiter · Northwind Talent")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Direct")).toBeInTheDocument();
    expect(screen.getByText("needs chasing")).toBeInTheDocument();
    expect(screen.getByText("yesterday")).toBeInTheDocument();
  });

  it("shows an empty state with a call to action", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    renderApplications();
    expect(await screen.findByText("No applications yet")).toBeInTheDocument();
  });

  it("sends filters to the API", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    renderApplications();
    await screen.findByText("No applications yet");
    fireEvent.click(screen.getByLabelText("Needs chasing"));
    await waitFor(() => expect(calls.some((c) => c.path.includes("stale=true"))).toBe(true));
  });

  it("opens the drawer and moves the stage", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [],
      "/api/v1/applications": [row()],
      "GET /api/v1/applications/a1": detail,
      "POST /api/v1/applications/a1/move": { ...detail, stage: "screen", stage_name: "Screen" },
      "/api/v1/health": {},
    });
    renderApplications();
    fireEvent.click(await screen.findByText("Contoso"));
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByText("Interested → Applied")).toBeInTheDocument();
    fireEvent.click(within(drawer).getByRole("button", { name: /Move to/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Screen" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST" && c.path.endsWith("/move"))?.body).toEqual({
        to_stage: "screen",
        note: null,
      }),
    );
  });

  it("disables undo when there's nothing to undo", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [],
      "/api/v1/applications": [row()],
      "GET /api/v1/applications/a1": { ...detail, can_undo: false },
      "/api/v1/health": {},
    });
    renderApplications();
    fireEvent.click(await screen.findByText("Contoso"));
    const drawer = await screen.findByRole("dialog");
    expect(await within(drawer).findByRole("button", { name: /Undo last move/ })).toBeDisabled();
  });

  it("warns about a possible duplicate while adding, but still saves", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [],
      "/api/v1/companies": [{ id: "co1", name: "Contoso" }],
      "/api/v1/contacts": [],
      "/api/v1/applications": [],
      "/api/v1/applications/duplicates": [
        { ...row({ route: "direct", agency_name: null, recruiter_name: null }), match: "similar_title" },
      ],
      "POST /api/v1/applications/quick": detail,
      "GET /api/v1/applications/a1": detail,
      "/api/v1/health": {},
    });
    renderApplications();
    fireEvent.click((await screen.findAllByRole("button", { name: /New application/ }))[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Company"), { target: { value: "Contoso" } });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "Senior Backend Engineer" } });
    expect(await within(dialog).findByText("You may have applied for this already")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Backend Engineer at Contoso" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    expect(within(dialog).getByText(/directly on .+ · now Applied · similar title/)).toBeInTheDocument();
    const lookup = calls.filter((c) => c.path.startsWith("/api/v1/applications/duplicates")).at(-1)!;
    const params = new URL(lookup.path, "http://localhost").searchParams;
    expect(params.get("company_id")).toBe("co1");
    expect(params.get("role_title")).toBe("Senior Backend Engineer");

    fireEvent.click(within(dialog).getByRole("button", { name: "Add application" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/v1/applications/quick")).toBe(true));
  });

  it("creates an application with one quick-create request", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [{ id: "ag1", name: "Northwind Talent" }],
      "/api/v1/companies": [{ id: "co1", name: "Contoso" }],
      "/api/v1/contacts": [{ id: "c1", name: "Alex Recruiter", agency_id: "ag1", details: [] }],
      "/api/v1/applications": [],
      "POST /api/v1/applications/quick": detail,
      "GET /api/v1/applications/a1": detail,
      "/api/v1/health": {},
    });
    renderApplications();
    fireEvent.click((await screen.findAllByRole("button", { name: /New application/ }))[0]!);
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Company"), { target: { value: "contoso" } });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "Platform Engineer" } });
    fireEvent.click(within(dialog).getByText("Through a recruiter"));
    fireEvent.change(await within(dialog).findByLabelText("Agency"), {
      target: { value: "Northwind Talent" },
    });
    fireEvent.change(within(dialog).getByLabelText("Recruiter"), { target: { value: "Alex Recruiter" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add application" }));
    await waitFor(() => expect(calls.some((c) => c.path === "/api/v1/applications/quick")).toBe(true));
    const quick = calls.find((c) => c.path === "/api/v1/applications/quick")!;
    expect(quick.body).toMatchObject({
      company_id: "co1",
      company_name: null,
      role_title: "Platform Engineer",
      route: "agency",
      agency_id: "ag1",
      recruiter_id: "c1",
      stage: "interested",
    });
    // Nothing else was written: no separate company/role/agency/contact requests.
    expect(calls.filter((c) => c.method === "POST").map((c) => c.path)).toEqual([
      "/api/v1/applications/quick",
    ]);
  });

  it("switches to the board and shows stage columns", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [],
      "/api/v1/applications": [row(), row({ id: "a2", company_name: "Fabrikam", stage: "screen" })],
      "/api/v1/health": {},
    });
    renderApplications();
    await screen.findByText("Contoso");
    fireEvent.click(screen.getByText("Board"));
    expect(await screen.findByLabelText("Applied column")).toHaveTextContent("Contoso");
    expect(screen.getByLabelText("Screen column")).toHaveTextContent("Fabrikam");
    expect(screen.queryByLabelText("Rejected column")).not.toBeInTheDocument();
  });

  it("opens a board card with Enter", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": [],
      "/api/v1/applications": [row()],
      "GET /api/v1/applications/a1": detail,
      "/api/v1/health": {},
    });
    localStorage.setItem("jat.applications.view", JSON.stringify("board"));
    renderApplications();
    const card = await screen.findByLabelText("Contoso: Backend Engineer");
    fireEvent.keyDown(card, { key: "Enter", code: "Enter" });
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
