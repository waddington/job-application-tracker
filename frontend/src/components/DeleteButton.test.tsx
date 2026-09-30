import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  const router = makeRouter(createMemoryHistory({ initialEntries: [path] }));
  render(<App router={router} />);
  return router;
}

const detail = {
  ...row(),
  events: [],
  contacts: [],
  allowed_next: [],
  suggested_next: [],
  can_undo: false,
  documents: [],
  duplicates: [],
};

const summary = (applications: unknown[]) => ({
  company: { id: "co1", name: "Contoso", website: null, description: null, created_at: "", updated_at: "u" },
  roles: [{ id: "r1", title: "Backend Engineer", work_mode: null, url: null }],
  applications,
  contacts: [],
});

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("deleting", () => {
  it("deletes an application after confirming, then goes back to the list", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail,
      "DELETE /api/v1/applications/a1": {},
      "/api/v1/applications": [],
      "/api/v1/contacts": [],
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    const router = renderAt("/applications/a1");
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(confirm.mock.calls[0]![0]).toMatch(
      /Delete your application to Contoso \(Backend Engineer\)\?.*archive it/,
    );
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v1/applications/a1")).toBe(true),
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/applications"));
  });

  it("does nothing if you cancel", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail,
      "/api/v1/contacts": [],
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("explains why a company with applications can't be deleted yet", async () => {
    const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirm = vi.spyOn(window, "confirm");
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/companies/co1/summary": summary([row(), row({ id: "a2" })]),
      "/api/v1/health": {},
    });
    renderAt("/companies/co1");
    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(alert).toHaveBeenCalledWith(
      "Contoso still has 2 applications. Delete them first, or archive them instead.",
    );
    expect(confirm).not.toHaveBeenCalled();
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
  });

  it("deletes an empty company and a role", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/companies/co1/summary": summary([]),
      "DELETE /api/v1/roles/r1": {},
      "DELETE /api/v1/companies/co1": {},
      "/api/v1/companies": [],
      "/api/v1/applications": [],
      "/api/v1/health": {},
    });
    const router = renderAt("/companies/co1");
    fireEvent.click(await screen.findByRole("button", { name: "Delete Backend Engineer" }));
    await waitFor(() =>
      expect(calls.some((c) => c.method === "DELETE" && c.path === "/api/v1/roles/r1")).toBe(true),
    );
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/companies"));
  });
});
