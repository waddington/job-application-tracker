import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, roleSummary, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const jd = {
  id: "f1",
  entity_type: "role",
  entity_id: "r2",
  original_name: "Platform Engineer JD.pdf",
  content_type: "application/pdf",
  size: 2048,
  sha256: "x",
  path: "2026/10/f1-jd.pdf",
  created_at: "2026-10-05T10:00:00Z",
  url: "/api/v1/attachments/f1/file",
  inline: true,
  meta: {},
};

const role = roleSummary({
  id: "r2",
  title: "Platform Engineer",
  company_id: "co2",
  company_name: "Fabrikam",
  employment_type: "contract",
  day_rate: 600,
  ir35: "outside",
  work_mode: "remote",
  contact_id: "c1",
  contact_name: "Alex Morgan",
  agency_id: "ag1",
  agency_name: "Northwind Talent",
  meeting_label: "Call with Alex Morgan: Market catch-up",
  description: "Small platform team, Kubernetes and Go.",
  status: "applied",
  application_ids: ["a1"],
});

/** Files by what they're on: the role's job description, nothing on the application itself. */
const files = (url: URL) => (url.searchParams.get("entity_type") === "role" ? [jd] : []);

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("a role's page", () => {
  it("shows the role, where it came from, its application and its files", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries/r2": role,
      "GET /api/v1/applications": [
        row({ id: "a1", role_id: "r2", company_name: "Fabrikam", role_title: "Platform Engineer" }),
        row({ id: "a2", role_id: "r9", company_name: "Contoso" }),
      ],
      "GET /api/v1/attachments": files,
      "GET /api/v1/todos": [],
      "GET /api/v1/links": [],
      "GET /api/v1/notes": [],
      "/api/v1/health": {},
    });
    renderAt("/roles/r2");
    expect(await screen.findByRole("heading", { name: "Platform Engineer", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fabrikam" })).toHaveAttribute("href", "/companies/co2");
    expect(screen.getByText("£600 a day, outside IR35")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Alex Morgan" })).toHaveAttribute("href", "/people/c1");
    expect(screen.getByText(/on Call with Alex Morgan: Market catch-up/)).toBeInTheDocument();
    expect(screen.getByText("Small platform team, Kubernetes and Go.")).toBeInTheDocument();
    // Its application, and only its.
    const apps = screen
      .getByRole("heading", { name: "Your application" })
      .closest(".mantine-Card-root") as HTMLElement;
    expect(within(apps).getByRole("link", { name: "Fabrikam · Platform Engineer" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );
    expect(within(apps).queryByText(/Contoso/)).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Platform Engineer JD.pdf" })).toHaveAttribute(
      "href",
      "/api/v1/attachments/f1/file",
    );
    expect(screen.getByRole("heading", { name: "To-dos" })).toBeInTheDocument();
  });

  it("opens from a role's row, which counts its files", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [
        roleSummary({ id: "r2", title: "Platform Engineer", company_name: "Fabrikam" }),
      ],
      "GET /api/v1/attachments": files,
      "/api/v1/health": {},
    });
    renderAt("/roles");
    expect(await screen.findByRole("link", { name: "Platform Engineer" })).toHaveAttribute(
      "href",
      "/roles/r2",
    );
    expect(await screen.findByRole("link", { name: "1 file on Platform Engineer" })).toHaveAttribute(
      "href",
      "/roles/r2",
    );
  });

  it("shows the role's files on its application", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": {
        ...row({ id: "a1", role_id: "r2", company_name: "Fabrikam", role_title: "Platform Engineer" }),
        events: [],
        contacts: [],
        allowed_next: [],
        suggested_next: [],
        can_undo: false,
        documents: [],
        duplicates: [],
      },
      "GET /api/v1/attachments": files,
      "/api/v1/contacts": [],
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    const card = (await screen.findByRole("heading", { name: "Files" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(await within(card).findByText("From the role")).toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "Platform Engineer JD.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Platform Engineer" })).toHaveAttribute("href", "/roles/r2");
  });

  it("adds a role with its job description", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [],
      "GET /api/v1/attachments": [],
      "GET /api/v1/companies": [{ id: "co2", name: "Fabrikam", website: null, description: null }],
      "GET /api/v1/contacts": [],
      "POST /api/v1/roles": roleSummary({ id: "r5", title: "SRE", company_id: "co2" }),
      "POST /api/v1/attachments": jd,
      "/api/v1/health": {},
    });
    renderAt("/roles");
    fireEvent.click(await screen.findByRole("button", { name: "Add role" }));
    const dialog = await screen.findByRole("dialog", { name: "Add a role to decide on" });
    fireEvent.change(within(dialog).getByLabelText("Role"), { target: { value: "SRE" } });
    fireEvent.click(within(dialog).getByLabelText("Company"));
    fireEvent.click(await screen.findByRole("option", { name: "Fabrikam", hidden: true }));
    const pdf = new File(["%PDF-1.4"], "SRE JD.pdf", { type: "application/pdf" });
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [pdf] } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add role" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "POST" && c.path === "/api/v1/attachments")).toBe(true),
    );
    expect(calls.findIndex((c) => c.path === "/api/v1/roles")).toBeLessThan(
      calls.findIndex((c) => c.path === "/api/v1/attachments" && c.method === "POST"),
    );
  });
});
