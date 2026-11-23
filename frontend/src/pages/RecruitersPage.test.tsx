import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, roleSummary, row, WORKFLOW } from "../test/mockApi";

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
// Alex usually gets back to you within two working days.
Object.assign(contacts[0]!, { replies: 3, usual_reply_days: 2 });

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("recruiters", () => {
  it("shows everyone A to Z, with their agency as a chip and clickable details", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": contacts,
      "/api/v1/companies": [],
      "/api/v1/role-summaries": [],
      "/api/v1/applications": [row({ agency_id: "ag1" })],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    const tiles = await screen.findAllByRole("link", { name: /^(Alex Morgan|Jo Freelance|Sam Patel)$/ });
    expect(tiles.map((t) => t.textContent)).toEqual(["Alex Morgan", "Jo Freelance", "Sam Patel"]);
    expect(tiles[0]).toHaveAttribute("href", "/people/c1");
    expect(screen.getByText("Usually replies within 2 working days")).toBeInTheDocument();
    // Alex's tile: the agency chip, and every way to reach them.
    const alex = tiles[0]!.closest(".mantine-Card-root") as HTMLElement;
    expect(within(alex).getByRole("link", { name: "Northwind Talent" })).toHaveAttribute(
      "href",
      "/agencies/ag1",
    );
    expect(within(alex).getByRole("link", { name: "alex@northwind.example.com" })).toHaveAttribute(
      "href",
      "mailto:alex@northwind.example.com",
    );
    expect(within(alex).getByRole("link", { name: "+44 7700 900001" })).toHaveAttribute(
      "href",
      "tel:+447700900001",
    );
    // Every agency, with how many people and applications in progress.
    expect(screen.getByRole("link", { name: "Northwind Talent: 1 person, 1 in progress" })).toHaveAttribute(
      "href",
      "/agencies/ag1",
    );
    expect(screen.getByRole("link", { name: "Blue Yonder Recruitment: 1 person" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search recruiters"), { target: { value: "sam" } });
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
    expect(screen.getByText("Sam Patel")).toBeInTheDocument();
  });

  it("stars favourites, lists them first, and filters to them", async () => {
    const calls = mockApi({
      "PATCH /api/v1/contacts/c2": { ...contacts[1], favourite: false },
      "PATCH /api/v1/contacts/c3": { ...contacts[2], favourite: true },
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": [contacts[0], { ...contacts[1], favourite: true }, contacts[2]],
      "/api/v1/companies": [],
      "/api/v1/role-summaries": [],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    const tiles = await screen.findAllByRole("link", {
      name: /^(Favourite)?(Alex Morgan|Jo Freelance|Sam Patel)$/,
    });
    expect(tiles.map((t) => t.textContent)).toEqual(["Sam Patel", "Alex Morgan", "Jo Freelance"]);
    expect(within(tiles[0]!).getByRole("img", { name: "Favourite" })).toBeInTheDocument();

    fireEvent.click(screen.getByText("Favourites · 1"));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Alex Morgan" })).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Favourite: Sam Patel" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH" && c.path === "/api/v1/contacts/c2")?.body).toEqual({
        favourite: false,
      }),
    );
    fireEvent.click(screen.getByText("All"));
    fireEvent.click(await screen.findByRole("button", { name: "Favourite: Jo Freelance" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH" && c.path === "/api/v1/contacts/c3")?.body).toEqual({
        favourite: true,
      }),
    );
  });

  it("filters to the people you have something in progress with, and counts it on their cards", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": contacts,
      "/api/v1/companies": [],
      // Alex: two open applications (Interested counts) and one closed; Sam: only a rejected one.
      "/api/v1/applications": [
        row({ id: "a1", recruiter_id: "c1", stage: "applied" }),
        row({ id: "a2", recruiter_id: "c1", stage: "interested", stage_name: "Interested" }),
        row({ id: "a3", recruiter_id: "c1", stage: "rejected", stage_kind: "closed" }),
        row({ id: "a4", recruiter_id: "c2", stage: "rejected", stage_kind: "closed" }),
      ],
      // Jo pitched two roles still to decide. Alex pitched the role behind a2, which is
      // "interested" because it has that application: counted once, as the application. Sam's
      // pitched role was passed.
      "/api/v1/role-summaries": [
        roleSummary({ id: "r1", contact_id: "c3", status: "to_decide" }),
        roleSummary({ id: "r2", contact_id: "c3", status: "to_decide" }),
        roleSummary({ id: "r4", contact_id: "c1", status: "interested", application_ids: ["a2"] }),
        roleSummary({ id: "r3", contact_id: "c2", status: "passed" }),
      ],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    const card = async (name: string) =>
      (await screen.findByRole("link", { name })).closest(".mantine-Card-root") as HTMLElement;
    expect(
      await within(await card("Alex Morgan")).findByText("2 applications in progress"),
    ).toBeInTheDocument();
    expect(within(await card("Alex Morgan")).queryByText(/to decide/)).not.toBeInTheDocument();
    expect(within(await card("Jo Freelance")).getByText("2 roles to decide")).toBeInTheDocument();
    expect(within(await card("Sam Patel")).queryByText(/in progress|to decide/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("In progress · 2"));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Sam Patel" })).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Alex Morgan" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Jo Freelance" })).toBeInTheDocument();
  });

  it("puts a ghost before the name of someone who ghosted you", async () => {
    const calls = mockApi({
      "PATCH /api/v1/contacts/c2": { ...contacts[1], closed_as: null },
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": [
        contacts[0],
        { ...contacts[1], closed_as: "ghosted", closed_on: "2026-10-01" },
        { ...contacts[2], closed_as: "not_interested", closed_on: "2026-10-01" },
      ],
      "/api/v1/companies": [],
      "/api/v1/role-summaries": [],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    const sam = await screen.findByRole("link", { name: /Sam Patel/ });
    expect(within(sam).getByRole("img", { name: "Ghosted" })).toBeInTheDocument();
    expect(screen.getAllByRole("img", { name: "Ghosted" })).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Jo Freelance" })).toBeInTheDocument();

    // Ghosted shows only them; the chip's cross takes Ghosted off, however long ago it was set.
    fireEvent.click(screen.getByText("Ghosted · 1"));
    await waitFor(() => expect(screen.queryByRole("link", { name: "Alex Morgan" })).not.toBeInTheDocument());
    expect(screen.queryByRole("link", { name: "Jo Freelance" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Take Ghosted off Sam Patel" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH" && c.path === "/api/v1/contacts/c2")?.body).toEqual({
        closed_as: null,
      }),
    );
  });

  it("filters to company contacts, searches by agency name and says when nothing matches", async () => {
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
      "/api/v1/role-summaries": [],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    expect(await screen.findByRole("link", { name: "Fabrikam" })).toHaveAttribute("href", "/companies/co1");
    expect(screen.getByRole("link", { name: "+44 20 7946 0000 ext. 12" })).toHaveAttribute(
      "href",
      "tel:+442079460000",
    );

    fireEvent.click(screen.getByRole("radio", { name: "Companies" }));
    expect(screen.getByText("Riley Chen")).toBeInTheDocument();
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "All" }));

    const search = screen.getByLabelText("Search recruiters");
    fireEvent.change(search, { target: { value: "northwind" } });
    expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
    expect(screen.queryByText("Sam Patel")).not.toBeInTheDocument();

    fireEvent.change(search, { target: { value: "zzz" } });
    expect(screen.getByText("No matches.")).toBeInTheDocument();
  });

  it("finds a name with accents typed without them, and the other way round", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/agencies": agencies,
      "/api/v1/contacts": [...contacts, person("c5", "José Álvarez", null)],
      "/api/v1/companies": [],
      "/api/v1/role-summaries": [],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    renderAt("/recruiters");
    const search = await screen.findByLabelText("Search recruiters");
    fireEvent.change(search, { target: { value: "jose alv" } });
    expect(await screen.findByText("José Álvarez")).toBeInTheDocument();
    expect(screen.queryByText("Alex Morgan")).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: "SÁM" } });
    expect(screen.getByText("Sam Patel")).toBeInTheDocument();
    expect(screen.queryByText("José Álvarez")).not.toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "Timeline for Northwind Talent" })).toHaveAttribute(
      "href",
      "/timeline?about=agency%3Aag1&period=all",
    );
  });
});
