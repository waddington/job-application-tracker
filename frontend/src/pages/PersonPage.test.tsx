import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const riley = {
  id: "c9",
  name: "Riley Chen",
  title: "Head of Talent",
  agency_id: null,
  company_id: "co1",
  details: [{ id: "d1", kind: "email", value: "riley@contoso.example.com", label: "work", position: 0 }],
  created_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("people", () => {
  it("shows a person's page: who they are, their applications and interviews", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/contacts/c9/summary": {
        contact: riley,
        agency_name: null,
        company_name: "Contoso",
        applications: [
          { ...row({ route: "direct", agency_id: null }), relations: ["source", "hiring_manager"] },
        ],
        interviews: [],
      },
      "/api/v1/notes": [],
      "/api/v1/links": [],
      "/api/v1/attachments": [],
      "/api/v1/contacts": [riley],
      "/api/v1/health": {},
    });
    renderAt("/people/c9");
    expect(await screen.findByRole("heading", { name: "Riley Chen" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contoso" })).toHaveAttribute("href", "/companies/co1");
    expect(screen.getByText(/riley@contoso.example.com/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contoso · Backend Engineer" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    expect(screen.getByText("Brought it to you, Hiring manager")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Notes" })).toBeInTheDocument();
  });

  it("renames a company", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/companies/co1/summary": {
        company: {
          id: "co1",
          name: "Unknown`",
          website: null,
          description: null,
          created_at: "",
          updated_at: "u",
        },
        roles: [],
        applications: [],
        contacts: [],
      },
      "PATCH /api/v1/companies/co1": { id: "co1", name: "Develop RC", website: null, description: null },
      "/api/v1/health": {},
    });
    renderAt("/companies/co1");
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Develop RC" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    await waitFor(() => {
      const patch = calls.find((c) => c.method === "PATCH");
      expect(patch?.body).toEqual({ name: "Develop RC", website: null });
    });
  });

  it("adds a person from a company page", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/companies/co1/summary": {
        company: {
          id: "co1",
          name: "Contoso",
          website: null,
          description: null,
          created_at: "",
          updated_at: "u",
        },
        roles: [],
        applications: [],
        contacts: [],
      },
      "/api/v1/companies": [{ id: "co1", name: "Contoso", website: null, description: null }],
      "/api/v1/agencies": [],
      "POST /api/v1/contacts": riley,
      "/api/v1/health": {},
    });
    renderAt("/companies/co1");
    fireEvent.click(await screen.findByRole("button", { name: "Add person" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Riley Chen" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add person" }));
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/contacts");
      expect(post?.body).toMatchObject({ name: "Riley Chen", company_id: "co1", agency_id: null });
    });
  });

  it("creates a new person from an application and links them in the chosen role", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": {
        ...row({ company_id: "co1" }),
        events: [],
        contacts: [],
        allowed_next: [],
        suggested_next: [],
        can_undo: false,
        documents: [],
        duplicates: [],
      },
      "/api/v1/contacts": [],
      "/api/v1/companies": [{ id: "co1", name: "Contoso", website: null, description: null }],
      "/api/v1/agencies": [],
      "/api/v1/roles": [],
      "POST /api/v1/contacts": riley,
      "POST /api/v1/applications/a1/contacts": {
        id: "l1",
        application_id: "a1",
        contact_id: "c9",
        relation: "interviewer",
      },
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    fireEvent.click(await screen.findByRole("button", { name: "New person" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Riley Chen" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add person" }));
    await waitFor(() => {
      const created = calls.find((c) => c.method === "POST" && c.path === "/api/v1/contacts");
      expect(created?.body).toMatchObject({ name: "Riley Chen", company_id: "co1" });
      const linked = calls.find((c) => c.method === "POST" && c.path === "/api/v1/applications/a1/contacts");
      expect(linked?.body).toEqual({ contact_id: "c9", relation: "interviewer" });
    });
  });
});
