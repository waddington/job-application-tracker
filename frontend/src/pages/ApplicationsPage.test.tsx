import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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
};

afterEach(() => vi.unstubAllGlobals());

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
});
