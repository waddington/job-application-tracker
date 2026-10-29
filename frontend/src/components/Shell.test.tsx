import { MantineProvider } from "@mantine/core";
import { createMemoryHistory } from "@tanstack/react-router";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { i18n } from "../i18n";
import { PSEUDO, STORAGE_KEY } from "../i18n/language";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";
import { EditNameModal } from "./EditNameModal";

// The app's frame and shared bits read their text from locales/en/common.ts (i18n-shell).
// These pin the English they show, so a slip in the text file shows up here. CreatableSelect's
// "+ Add" option was checked in a real browser instead (PR #112): jsdom won't type into
// Mantine's search box.

const HEALTH = { status: "ok", version: "1.1.3", schema: "0014", schema_head: "0014", git_repo: true };

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

afterEach(async () => {
  cleanup(); // unmount before the language changes back, not after (hooks run in reverse)
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  localStorage.clear();
  await i18n.changeLanguage("en");
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

  it("the connection tooltip: version and schema, backups on or not", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    fireEvent.mouseEnter((await screen.findByText("Connected")).parentElement!);
    expect(await screen.findByText("v1.1.3 · schema 0014 · backups on")).toBeInTheDocument();
  });

  it("the connection tooltip without git, and an unknown schema", async () => {
    mockApi({ "/api/v1/health": { ...HEALTH, git_repo: false, schema: null } });
    renderAt("/no-such-page");
    fireEvent.mouseEnter((await screen.findByText("Connected")).parentElement!);
    expect(await screen.findByText("v1.1.3 · schema ? · data dir isn't a git repo")).toBeInTheDocument();
  });

  it("says it's connecting while the first check is out", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderAt("/no-such-page");
    fireEvent.mouseEnter((await screen.findByText("Connecting…")).parentElement!);
    expect(await screen.findByText("Checking the local API")).toBeInTheDocument();
  });

  it("the theme button says what it switches to", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    fireEvent.click(await screen.findByRole("button", { name: "Switch to dark mode" }));
    expect(await screen.findByRole("button", { name: "Switch to light mode" })).toBeInTheDocument();
  });

  it("the backup link's tooltip", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    fireEvent.mouseEnter(await screen.findByRole("link", { name: "Download a backup" }));
    expect(
      await screen.findByText(
        "Everything in one zip: your data, notes and files. Unzip it and run `jat init` on the folder (it rebuilds everything).",
      ),
    ).toBeInTheDocument();
  });

  it("says when the API is offline", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 503 })),
    );
    renderAt("/no-such-page");
    const offline = await screen.findByText("API offline", {}, { timeout: 4000 });
    fireEvent.mouseEnter(offline.parentElement!);
    expect(await screen.findByText("Start it with `uv run jat serve`")).toBeInTheDocument();
  });

  it("shows Not found for an unknown address", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByText("There's nothing at this address.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Today" })).toHaveAttribute("href", "/");
  });
});

describe("the language switch", () => {
  it("lists English, ticked, and Coming soon! greyed out", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    fireEvent.click(await screen.findByRole("button", { name: "Language" }));
    const english = await screen.findByRole("menuitem", { name: "English", hidden: true });
    expect(english).toHaveAttribute("aria-current", "true");
    expect(english).toHaveAttribute("lang", "en");
    expect(screen.getByRole("menuitem", { name: "Coming soon!", hidden: true })).toBeDisabled();
  });

  it("the button says it opens a menu, and whether it's open", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    const button = await screen.findByRole("button", { name: "Language" });
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(button).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("switching to English remembers it in this browser and moves <html lang> to it", async () => {
    await i18n.changeLanguage(PSEUDO);
    expect(document.documentElement.getAttribute("lang")).toBe(PSEUDO);
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    fireEvent.click(await screen.findByRole("button", { name: /Ļàñĝûàĝé/ }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "English", hidden: true }));
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("lang")).toBe("en");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("en");
  });

  it("offers the pseudo-language only in dev", async () => {
    vi.stubEnv("DEV", false);
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    fireEvent.click(await screen.findByRole("button", { name: "Language" }));
    expect(await screen.findByRole("menuitem", { name: "English", hidden: true })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Pseudo-language (dev)", hidden: true })).toBeNull();
  });

  it("in dev, switches to the pseudo-language without remembering it", async () => {
    mockApi({ "/api/v1/health": HEALTH });
    renderAt("/no-such-page");
    fireEvent.click(await screen.findByRole("button", { name: "Language" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Pseudo-language (dev)", hidden: true }));
    expect(await screen.findByRole("heading", { name: /^\[Þàĝé ñöţ ƒöûñð/ })).toBeInTheDocument();
    expect(document.documentElement.getAttribute("lang")).toBe(PSEUDO);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
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
          twin({
            id: "d5",
            route: "agency",
            agency_name: null,
            recruiter_name: "Riley Chen",
            applied_on: null,
            stage_name: "Screen",
          }),
          twin({
            id: "d6",
            route: "direct",
            applied_on: "2026-12-25",
            stage_name: "Rejected",
            archived: true,
            match: "similar_title",
          }),
        ],
      },
    });
    renderAt("/applications/a1");
    const items = await screen.findAllByRole("link", { name: "Backend Engineer at Contoso" });
    expect(items).toHaveLength(6);
    const text = (i: number) => items[i]!.closest("li")!.textContent;
    // English dates are day, month, year (utils/time formatDate).
    const day = (iso: string) => ({ "2026-03-05": "5 Mar 2026", "2026-12-25": "25 Dec 2026" })[iso];
    expect(text(0)).toContain(`via Northwind Talent on ${day("2026-03-05")} · now Applied`);
    expect(text(1)).toContain("via a recruiter · now Screen");
    expect(text(2)).toContain("by referral · now Offer · archived");
    expect(text(3)).toContain("directly · now Applied · similar title");
    expect(text(4)).toContain("via Riley Chen · now Screen");
    expect(text(5)).toContain(`directly on ${day("2026-12-25")} · now Rejected · archived · similar title`);
  });
});
