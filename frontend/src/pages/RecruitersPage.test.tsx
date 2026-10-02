import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const agencies = [
  { id: "ag1", name: "Northwind Talent", website: null, created_at: "", updated_at: "" },
  { id: "ag2", name: "Blue Yonder Recruitment", website: null, created_at: "", updated_at: "" },
];
const person = (id: string, name: string, agency_id: string | null, details: unknown[] = []) => ({
  id,
  name,
  title: null,
  agency_id,
  company_id: null,
  details,
  created_at: "",
  updated_at: "",
});
const contacts = [
  person("c1", "Alex Morgan", "ag1", [
    { id: "d1", kind: "email", value: "alex@northwind.example.com", label: "work", position: 0 },
    { id: "d2", kind: "phone", value: "+44 7700 900001", label: "mobile", position: 1 },
  ]),
  person("c2", "Sam Patel", "ag2"),
  person("c3", "Jo Freelance", null),
];

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("recruiters", () => {
  it("groups people by agency with clickable contact details", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": contacts,
      "/api/v1/applications": [row({ agency_id: "ag1" })],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    expect(await screen.findByRole("link", { name: "Northwind Talent" })).toHaveAttribute(
      "href",
      "/agencies/ag1",
    );
    expect(screen.getByText("1 in progress")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "alex@northwind.example.com" })).toHaveAttribute(
      "href",
      "mailto:alex@northwind.example.com",
    );
    expect(screen.getByRole("link", { name: "+44 7700 900001" })).toHaveAttribute(
      "href",
      "tel:+447700900001",
    );
    expect(screen.getByText("Independent")).toBeInTheDocument();
    expect(screen.getByText("Jo Freelance")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search recruiters"), { target: { value: "sam" } });
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
    expect(screen.getByText("Sam Patel")).toBeInTheDocument();
  });

  it("shows company contacts, searches by agency name and says when nothing matches", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": [
        ...contacts,
        {
          ...person("c4", "Riley Chen", null, [
            { id: "d4", kind: "phone", value: "+44 20 7946 0000 ext. 12", label: null, position: 0 },
          ]),
          company_id: "co1",
        },
      ],
      "/api/v1/companies": [{ id: "co1", name: "Fabrikam", website: null, created_at: "", updated_at: "" }],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    expect(await screen.findByRole("link", { name: "Fabrikam" })).toHaveAttribute("href", "/companies/co1");
    expect(screen.getByRole("link", { name: "+44 20 7946 0000 ext. 12" })).toHaveAttribute(
      "href",
      "tel:+442079460000",
    );

    const search = screen.getByLabelText("Search recruiters");
    fireEvent.change(search, { target: { value: "northwind" } });
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.queryByText("Sam Patel")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });

  it("adds a contact with several details", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": contacts,
      "/api/v1/companies": [],
      "/api/v1/applications": [],
      "POST /api/v1/contacts": person("c9", "New Person", "ag1"),
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    fireEvent.click(await screen.findByRole("button", { name: "New person" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "New Person" } });
    fireEvent.change(within(dialog).getAllByLabelText("Value")[0]!, { target: { value: "new@example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add a detail" }));
    fireEvent.change(within(dialog).getAllByLabelText("Value")[1]!, { target: { value: "+44 7700 900009" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add person" }));
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/contacts");
      expect(post?.body).toMatchObject({
        name: "New Person",
        details: [
          { kind: "email", value: "new@example.com", label: null },
          { kind: "phone", value: "+44 7700 900009", label: null },
        ],
      });
    });
  });

  it("rejects a malformed email", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": contacts,
      "/api/v1/companies": [],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    fireEvent.click(await screen.findByRole("button", { name: "New person" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "X" } });
    fireEvent.change(within(dialog).getAllByLabelText("Value")[0]!, { target: { value: "not-an-email" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add person" }));
    expect(await within(dialog).findByText("That doesn't look like an email address")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  it("shows an agency's recruiters and applications", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/agencies/ag1/summary": {
        agency: agencies[0],
        recruiters: [contacts[0]],
        applications: [row({ archived: true })],
      },
      "/api/v1/agencies": agencies,
      "/api/v1/companies": [],
      "/api/v1/health": {},
    });
    renderAt("/agencies/ag1");
    expect(await screen.findByRole("heading", { name: "Northwind Talent" })).toBeInTheDocument();
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.getByText("Contoso")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });
});
