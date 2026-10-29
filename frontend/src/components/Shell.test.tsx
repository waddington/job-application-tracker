import { MantineProvider } from "@mantine/core";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import { EditNameModal } from "./EditNameModal";

// The app's frame and shared bits read their text from locales/en/common.ts (i18n-shell).
// These pin the English they show, so a slip in the text file shows up here. CreatableSelect's
// "+ Add" option is checked in a real browser instead: jsdom won't type into its search box.

const HEALTH = { status: "ok", version: "1.1.3", schema: "0014", schema_head: "0014", git_repo: true };

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("the frame", () => {
  it("shows the header, menu and footer", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");

    expect(await screen.findByRole("heading", { name: "Job Application Tracker" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Job Application Tracker: today" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Toggle navigation" })).toBeInTheDocument();
    const search = screen.getByRole("textbox", { name: "Search everything" });
    expect(search).toHaveAttribute("placeholder", "Search everything");
    expect(screen.getAllByRole("button", { name: "New application" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "How it works" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Switch to dark mode" })).toBeInTheDocument();

    const menu = screen.getByRole("navigation", { name: "Main navigation" });
    for (const page of [
      "Today",
      "Roles",
      "Applications",
      "Interviews",
      "Offers",
      "Recruiters",
      "Companies",
      "Documents",
      "Notes",
      "Insights",
      "Timeline",
    ]) {
      expect(within(menu).getByRole("link", { name: page })).toBeInTheDocument();
    }
    for (const heading of ["Your applications", "People and companies", "Files and notes", "Review"]) {
      expect(within(menu).getByRole("group", { name: heading })).toHaveTextContent(heading);
    }
    expect(within(menu).getByText("Local-first · your data stays on this machine")).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: "Download a backup" })).toHaveAttribute(
      "href",
      "/api/v1/backup/archive",
    );
    expect(await within(menu).findByText("Connected")).toBeInTheDocument();
  });

  it("says when the API is offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    renderAt("/no-such-page");
    expect(await screen.findByText("API offline", {}, { timeout: 4000 })).toBeInTheDocument();
  });

  it("shows Not found for an unknown address", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("There's nothing at this address.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute("href", "/");
  });
});

describe("shared pieces", () => {
  it("the rename dialog's labels, buttons and checks", async () => {
    const onSave = vi.fn();
    render(
      <MantineProvider>
        <EditNameModal
          opened
          onClose={() => {}}
          title="Edit company"
          name=""
          website="nope"
          saving={false}
          onSave={onSave}
        />
      </MantineProvider>,
    );
    expect(await screen.findByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Website")).toHaveAttribute("placeholder", "https://…");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("It needs a name")).toBeInTheDocument();
    expect(screen.getByText("Like https://contoso.example.com")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("the duplicate warning says how and when you applied", async () => {
    const twin = (overrides: Record<string, unknown>) => ({
      ...row({ id: "d1", company_name: "Contoso", role_title: "Backend Engineer" }),
      match: "same_role",
      ...overrides,
    });
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/health": HEALTH,
      "/api/v1/contacts": [],
      "/api/v1/roles": [],
      "GET /api/v1/applications/a1": {
        ...row(),
        events: [],
        contacts: [],
        allowed_next: [],
        suggested_next: [],
        can_undo: false,
        documents: [],
        duplicates: [
          twin({
            id: "d1",
            route: "agency",
            agency_name: "Northwind Talent",
            applied_on: "2026-03-05",
            stage_name: "Applied",
          }),
          twin({
            id: "d2",
            route: "agency",
            agency_name: null,
            recruiter_name: null,
            applied_on: null,
            stage_name: "Screen",
          }),
          twin({ id: "d3", route: "referral", applied_on: null, stage_name: "Offer", archived: true }),
          twin({
            id: "d4",
            route: "direct",
            applied_on: null,
            stage_name: "Applied",
            match: "similar_title",
          }),
        ],
      },
    });
    renderAt("/applications/a1");
    const items = await screen.findAllByRole("link", { name: "Backend Engineer at Contoso" });
    expect(items).toHaveLength(4);
    const text = (i: number) => items[i]!.closest("li")!.textContent;
    expect(text(0)).toContain(
      `via Northwind Talent on ${new Date("2026-03-05T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })} · now Applied`,
    );
    expect(text(1)).toContain("via a recruiter · now Screen");
    expect(text(2)).toContain("by referral · now Offer · archived");
    expect(text(3)).toContain("directly · now Applied · similar title");
  });
});
