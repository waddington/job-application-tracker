import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const offer = (overrides: Record<string, unknown> = {}) => ({
  id: "o1",
  application_id: "a1",
  status: "pending",
  received_on: "2026-09-28",
  respond_by: "2026-10-05",
  start_on: null,
  employment_type: "permanent",
  currency: "GBP",
  salary: 85000,
  bonus: 8000,
  equity: null,
  equity_value: null,
  pension_percent: 6,
  holiday_days: 27,
  day_rate: null,
  ir35: null,
  contract_months: null,
  benefits: "Private health",
  notes: null,
  annual_value: 98100,
  value_basis: "salary",
  company_name: "Contoso",
  role_title: "Backend Engineer",
  stage: "offer",
  created_at: "2026-09-28T10:00:00Z",
  updated_at: "2026-09-28T10:00:00Z",
  ...overrides,
});

const contract = offer({
  id: "o2",
  application_id: "a2",
  employment_type: "contract",
  salary: null,
  bonus: null,
  pension_percent: null,
  holiday_days: null,
  day_rate: 650,
  ir35: "outside",
  contract_months: 6,
  benefits: null,
  annual_value: 143000,
  value_basis: "day rate",
  company_name: "Fabrikam",
  role_title: "Platform Contractor",
});

const declined = offer({
  id: "o3",
  application_id: "a3",
  status: "declined",
  company_name: "Northwind Traders",
});

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("offers", () => {
  it("compares offers side by side, highest first", async () => {
    mockApi({ "/api/v1/offers": [offer(), contract, declined], "/api/v1/health": {} });
    renderAt("/offers");
    const table = await screen.findByRole("table");
    const header = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(header).toEqual(["Detail", "FabrikamPlatform Contractor", "ContosoBackend Engineer"]);
    const rowText = (label: string) =>
      within(table).getByRole("rowheader", { name: label }).closest("tr")!.textContent;
    expect(rowText("Worth a year")).toBe("Worth a year£143,000Highest£98,100");
    expect(rowText("Pay")).toBe("Pay£650 a day£85,000 a year");
    expect(rowText("IR35")).toBe("IR35outside—");

    fireEvent.click(screen.getByLabelText("Show declined and withdrawn"));
    expect(await screen.findByText("Northwind Traders")).toBeInTheDocument();
  });

  it("adds an offer from the application page", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": {
        ...row({ stage: "screen", stage_name: "Screen" }),
        events: [],
        contacts: [],
        allowed_next: [],
        suggested_next: [],
        can_undo: false,
        documents: [],
        duplicates: [],
      },
      "GET /api/v1/offers": [],
      "POST /api/v1/applications/a1/offers": offer(),
      "/api/v1/interviews": [],
      "/api/v1/contacts": [],
      "/api/v1/roles": [{ id: "r1", employment_type: "contract", title: "Backend Engineer" }],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    const card = (await screen.findByRole("heading", { name: "Offer" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(within(card).getByText(/No offer yet/)).toBeInTheDocument();
    fireEvent.click(within(card).getByRole("button", { name: "Add offer" }));
    const dialog = await screen.findByRole("dialog");
    // The role is a contract, so the offer starts as one: a day rate, not a salary.
    fireEvent.change(within(dialog).getByLabelText("Day rate"), { target: { value: "650" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Add offer" }));
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST" && c.path === "/api/v1/applications/a1/offers");
      expect(post?.body).toMatchObject({
        status: "pending",
        employment_type: "contract",
        currency: "GBP",
        day_rate: 650,
        salary: null,
      });
    });
  });

  it("lists offers to answer in Next actions", async () => {
    mockApi({
      "/api/v1/next-actions": {
        follow_ups: [],
        stale: [],
        upcoming: [],
        awaiting_outcome: [],
        offer_deadlines: [offer({ respond_by: "2026-09-29" })],
        today: "2026-09-30",
      },
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/health": {},
    });
    renderAt("/");
    const section = (await screen.findByRole("heading", { name: "Offers to answer" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(within(section).getByText("£85,000 a year")).toBeInTheDocument();
    expect(within(section).getByText(/Reply was due/)).toBeInTheDocument();
  });
});
