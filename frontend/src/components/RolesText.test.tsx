import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import type { RoleSummary } from "../api/roleHooks";
import { roleBadge } from "../api/roleHooks";
import { makeRouter } from "../router";
import { meeting, mockApi, roleSummary, row, WORKFLOW } from "../test/mockApi";
import { pay } from "./Roles";

// Roles' text comes from locales/en/roles.ts (i18n-roles). A before/after snapshot of every
// page and the roles dialogs showed no change; these pin the strings that snapshot couldn't
// reach (other pay, sources and decisions than the demo data has).

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const role = (overrides: Record<string, unknown> = {}) => roleSummary(overrides) as unknown as RoleSummary;

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("what a role pays", () => {
  it("says a day rate, with IR35 when known", () => {
    expect(pay(role({ day_rate: 600, ir35: "outside" }))).toBe("£600 a day, outside IR35");
    expect(pay(role({ day_rate: 550, ir35: "inside" }))).toBe("£550 a day, inside IR35");
    expect(pay(role({ day_rate: 500, ir35: "unknown" }))).toBe("£500 a day");
    expect(pay(role({ day_rate: 500 }))).toBe("£500 a day");
  });

  it("says a salary range, or one end of it", () => {
    expect(pay(role({ salary_min: 80000, salary_max: 95000 }))).toBe("£80k–£95k");
    expect(pay(role({ salary_max: 70000 }))).toBe("£70k");
    expect(pay(role())).toBeNull();
  });
});

describe("a role's badge", () => {
  it("names each status, and how a closed one ended", () => {
    expect(
      ["to_decide", "interested", "applied", "passed", "closed"].map(
        (status) => roleBadge(role({ status })).label,
      ),
    ).toEqual(["To decide", "Interested", "Applied", "Passed", "Closed"]);
    expect(roleBadge(role({ status: "closed", closed_as: "Withdrawn" })).label).toBe("Withdrawn");
  });
});

describe("a role's page", () => {
  const page = (overrides: Record<string, unknown>, applications: unknown[] = []) => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries/r1": roleSummary(overrides),
      "GET /api/v1/applications": applications,
      "GET /api/v1/attachments": [],
      "GET /api/v1/todos": [],
      "GET /api/v1/links": [],
      "GET /api/v1/notes": [],
      "/api/v1/health": {},
    });
    renderAt("/roles/r1");
  };
  /** A fact's text, e.g. "From" → "Alex Morgan at Northwind Talent". */
  const fact = async (label: string) =>
    (await screen.findByText(label, { selector: "p" })).nextElementSibling?.textContent;

  it("says who it came from, at which agency and on which call", async () => {
    page({
      contact_id: "c1",
      contact_name: "Alex Morgan",
      agency_id: "ag1",
      agency_name: "Northwind Talent",
      meeting_label: "Intro call",
    });
    expect(await fact("From")).toBe("Alex Morgan at Northwind Talent · on Intro call");
  });

  it("shows a call's name as typed, even with a < in it", async () => {
    page({ contact_id: "c1", contact_name: "Riley Chen", meeting_label: "Intro <platform> chat" });
    expect(await fact("From")).toBe("Riley Chen · on Intro <platform> chat");
  });

  it("says who it came from without an agency or a call", async () => {
    page({ contact_id: "c1", contact_name: "Riley Chen" });
    expect(await fact("From")).toBe("Riley Chen");
  });

  it("says who it came from, on a call, without an agency", async () => {
    page({ contact_id: "c1", contact_name: "Riley Chen", meeting_label: "Coffee chat" });
    expect(await fact("From")).toBe("Riley Chen · on Coffee chat");
  });

  it("names the terms, in office", async () => {
    page({ employment_type: "fixed_term", work_mode: "office" });
    expect(await fact("Terms")).toBe("Fixed term · In office");
  });

  it("says when and why you passed", async () => {
    page({ status: "passed", decided_on: "2026-10-20", decision_reason: "Too junior" });
    expect(await fact("Passed")).toBe("20 Oct 2026: Too junior");
  });

  it("says you passed when it doesn't know when", async () => {
    page({ status: "passed", decision_reason: "Rate too low" });
    expect(await fact("Passed")).toBe("Yes: Rate too low");
  });

  it("says you passed, with no reason", async () => {
    page({ status: "passed" });
    expect(await fact("Passed")).toBe("Yes");
  });

  it("asks for what they said, and lists its applications", async () => {
    page({ status: "applied", application_ids: ["a1", "a2"] }, [
      row({
        id: "a1",
        role_id: "r1",
        route: "direct",
        recruiter_id: null,
        recruiter_name: null,
        applied_on: null,
      }),
      row({ id: "a2", role_id: "r1", route: "direct", recruiter_id: null, recruiter_name: null }),
      row({ id: "a3", role_id: "r1", applied_on: null }),
      row({ id: "a4", role_id: "r1" }),
    ]);
    expect(
      await screen.findByText("Edit adds what they said about it: team, stack, why it's open."),
    ).toBeInTheDocument();
    const card = screen
      .getByRole("heading", { name: "Applications" })
      .closest(".mantine-Card-root") as HTMLElement;
    const lines = within(card)
      .getAllByText(/Direct|via/)
      .map((el) => el.textContent);
    expect(lines).toEqual([
      "Direct",
      "Direct · applied 20 Sep 2026",
      "via Alex Recruiter",
      "via Alex Recruiter · applied 20 Sep 2026",
    ]);
  });

  it("says it couldn't load the role", async () => {
    mockApi({ "/api/v1/workflow": WORKFLOW, "/api/v1/health": {} });
    renderAt("/roles/r1");
    expect(await screen.findByText("Couldn't load this role. It may have been deleted.")).toBeInTheDocument();
  });
});

describe("role lines", () => {
  const list = (roles: unknown[], view?: string) => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": roles,
      "GET /api/v1/attachments": [],
      "GET /api/v1/todos": [],
      "/api/v1/contacts": [],
      "/api/v1/health": {},
    });
    renderAt("/roles");
    if (view) fireEvent.click(screen.getByText(view, { selector: "label" }));
  };

  it("lists what a role pays, how it's worked, where, and who pitched it", async () => {
    list([
      roleSummary({
        salary_min: 80000,
        salary_max: 95000,
        work_mode: "office",
        location: "London",
        contact_id: "c1",
        contact_name: "Alex Morgan",
        agency_name: "Northwind Talent",
      }),
      roleSummary({ id: "r2", title: "Platform Engineer", contact_id: "c2", contact_name: "Riley Chen" }),
    ]);
    expect(
      await screen.findByText("£80k–£95k · in office · London · from Alex Morgan (Northwind Talent)"),
    ).toBeInTheDocument();
    expect(screen.getByText("from Riley Chen")).toBeInTheDocument();
  });

  it("says why you passed, and offers to reconsider", async () => {
    list([roleSummary({ status: "passed", decision_reason: "Office five days a week" })]);
    expect(await screen.findByText("passed: Office five days a week")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reconsider: Backend Engineer" })).toHaveTextContent(
      "Reconsider",
    );
  });

  it("counts several files", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [roleSummary()],
      "GET /api/v1/attachments": [
        { id: "f1", entity_type: "role", entity_id: "r1", original_name: "a.pdf" },
        { id: "f2", entity_type: "role", entity_id: "r1", original_name: "b.pdf" },
      ],
      "GET /api/v1/todos": [],
      "/api/v1/health": {},
    });
    renderAt("/roles");
    expect(await screen.findByRole("img", { name: "2 files on Backend Engineer" })).toBeInTheDocument();
  });

  it("says each view is empty in its own words", async () => {
    list([]);
    expect(
      await screen.findByText(
        "Nothing to decide. After a call with a recruiter, add the roles they mentioned here (or from the call on their page), then apply or pass on each.",
      ),
    ).toBeInTheDocument();
    for (const [view, text] of [
      [
        "Interested",
        "No roles you're interested in but haven't applied for yet. Press Interested on a role to track it.",
      ],
      ["Applied", "No roles applied for from here yet."],
      ["Closed", "No roles closed before you applied (withdrawn while only interested, say)."],
      ["Passed", "You haven't passed on any roles."],
      ["All", "No roles yet."],
    ]) {
      fireEvent.click(screen.getByRole("radio", { name: view }));
      expect(await screen.findByText(text!)).toBeInTheDocument();
    }
  });
});

describe("applying for a role", () => {
  const open = async (overrides: Record<string, unknown>, button = "Apply: Backend Engineer") => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [roleSummary(overrides)],
      "GET /api/v1/attachments": [],
      "GET /api/v1/todos": [],
      "/api/v1/contacts": [],
      "/api/v1/health": {},
    });
    renderAt("/roles");
    fireEvent.click(await screen.findByRole("button", { name: button }));
    return screen.findByRole("dialog");
  };

  it("says it goes directly when no one pitched it", async () => {
    const dialog = await open({});
    expect(within(dialog).getByText("Directly.")).toBeInTheDocument();
    expect(screen.getByText("Apply: Backend Engineer at Contoso")).toBeInTheDocument();
  });

  it("names your contact at the company", async () => {
    const dialog = await open({ contact_id: "c1", contact_name: "Riley Chen" });
    expect(within(dialog).getByText("Directly, with Riley Chen as your contact.")).toBeInTheDocument();
  });

  it("names the agency alone", async () => {
    const dialog = await open({ agency_id: "ag1", agency_name: "Northwind Talent" });
    expect(within(dialog).getByText("Through Northwind Talent.")).toBeInTheDocument();
  });

  it("names the Interested dialog", async () => {
    await open({}, "Interested: Backend Engineer");
    expect(screen.getByText("Interested: Backend Engineer at Contoso")).toBeInTheDocument();
  });

  it("stars a favourite recruiter", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [roleSummary({ contact_id: "c1", contact_name: "Riley Chen" })],
      "GET /api/v1/attachments": [],
      "GET /api/v1/todos": [],
      "/api/v1/contacts": [{ id: "c1", name: "Riley Chen", closed_as: null, favourite: true, details: [] }],
      "/api/v1/health": {},
    });
    renderAt("/roles");
    expect(await screen.findByText("from Riley Chen ★")).toBeInTheDocument();
  });

  it("marks a ghosted recruiter", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [
        roleSummary({
          contact_id: "c1",
          contact_name: "Sam Patel",
          agency_id: "ag1",
          agency_name: "Blue Yonder",
        }),
      ],
      "GET /api/v1/attachments": [],
      "GET /api/v1/todos": [],
      "/api/v1/contacts": [
        { id: "c1", name: "Sam Patel", closed_as: "ghosted", favourite: true, details: [] },
      ],
      "/api/v1/health": {},
    });
    renderAt("/roles");
    expect(await screen.findByText("from Sam Patel ★ (ghosted) (Blue Yonder)")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Apply: Backend Engineer" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Through Blue Yonder (Sam Patel ★ (ghosted)).")).toBeInTheDocument();
  });
});

describe("the role form", () => {
  it("names each call by its date, and checks the link", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/role-summaries": [roleSummary({ contact_id: "c1", contact_name: "Alex Morgan" })],
      "GET /api/v1/attachments": [],
      "GET /api/v1/todos": [],
      "/api/v1/companies": [{ id: "co1", name: "Contoso" }],
      "/api/v1/contacts": [{ id: "c1", name: "Alex Morgan", details: [] }],
      "GET /api/v1/meetings": [meeting({ starts_at: "2026-10-14T10:00:00Z", title: "Intro call" })],
      "/api/v1/health": {},
    });
    renderAt("/roles");
    fireEvent.click(await screen.findByRole("button", { name: "Edit Backend Engineer" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByPlaceholderText("Not from a call"));
    expect(
      await screen.findByRole("option", { name: "Intro call · 14 Oct", hidden: true }),
    ).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText("Job ad link"), { target: { value: "jobs.example.com" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(await within(dialog).findByText("Links start with http:// or https://")).toBeInTheDocument();
  });
});
