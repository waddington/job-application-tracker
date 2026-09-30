import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const detail = {
  ...row(),
  events: [],
  contacts: [{ id: "l1", application_id: "a1", contact_id: "c1", relation: "recruiter" }],
  allowed_next: ["screen"],
  can_undo: false,
  duplicates: [],
};
const contacts = [
  {
    id: "c1",
    name: "Alex Recruiter",
    title: null,
    agency_id: "ag1",
    company_id: null,
    details: [{ id: "d1", kind: "email", value: "alex@example.com", label: "work", position: 0 }],
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
  },
];

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("application page", () => {
  it("shows the application with its people and saves details", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail,
      "PATCH /api/v1/applications/a1": { ...detail, tags: ["python", "remote"] },
      "/api/v1/contacts": contacts,
      "/api/v1/roles": [
        { id: "r1", title: "Backend Engineer", url: "https://jobs.example.com/1", work_mode: "hybrid" },
      ],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    expect(await screen.findByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    expect((await screen.findAllByText("Alex Recruiter")).length).toBeGreaterThan(0);
    expect(screen.getByText(/alex@example.com/)).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Job ad" })).toHaveAttribute(
      "href",
      "https://jobs.example.com/1",
    );

    // Nothing to save until something changes.
    expect(screen.getByRole("button", { name: "Save details" })).toBeDisabled();
    // Archiving saves straight away.
    fireEvent.click(screen.getByLabelText("Archived"));
    await waitFor(() => {
      const patch = calls.find((c) => c.method === "PATCH");
      expect(patch?.body).toEqual({ archived: true });
    });
  });
});

describe("companies", () => {
  it("notes other applications for the same job", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": {
        ...detail,
        duplicates: [
          {
            ...row({ id: "a2", route: "direct", agency_name: null, recruiter_name: null, archived: true }),
            match: "same_role",
          },
        ],
      },
      "/api/v1/contacts": contacts,
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    expect(await screen.findByText("Also applied for this job")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Backend Engineer at Contoso" })).toHaveAttribute(
      "href",
      "/applications/a2",
    );
    expect(screen.getByText(/directly on 20 Sep 2026 · now Applied · archived/)).toBeInTheDocument();
  });

  it("lists companies with application counts and opens one", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/companies": [
        { id: "co1", name: "Contoso", website: "https://contoso.example.com/", description: null },
        { id: "co2", name: "Fabrikam", website: null, description: null },
      ],
      "/api/v1/applications": [row(), row({ id: "a2", stage_kind: "closed", stale: false })],
      "GET /api/v1/companies/co1/summary": {
        company: {
          id: "co1",
          name: "Contoso",
          website: null,
          description: "Payments",
          created_at: "",
          updated_at: "u",
        },
        roles: [{ id: "r1", title: "Backend Engineer", work_mode: "hybrid", url: null }],
        applications: [row()],
        contacts,
      },
      "/api/v1/health": {},
    });
    renderAt("/companies");
    const contoso = await screen.findByRole("row", { name: "Open Contoso" });
    expect(within(contoso).getByText("2")).toBeInTheDocument();
    expect(within(contoso).getByText("1 to chase")).toBeInTheDocument();
    fireEvent.click(contoso);
    expect(await screen.findByRole("heading", { name: "Contoso" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("Payments")).toBeInTheDocument();
    expect(screen.getAllByText("Backend Engineer").length).toBeGreaterThan(0);
  });
});
