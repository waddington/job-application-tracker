import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, row, WORKFLOW } from "../test/mockApi";

function renderAt(path: string) {
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

const file = {
  id: "f1",
  entity_type: "document",
  entity_id: "d1",
  original_name: "backend-cv-v3.pdf",
  content_type: "application/pdf",
  size: 120_000,
  sha256: "x",
  path: "2026/09/f1-backend-cv-v3.pdf",
  created_at: "2026-09-20T10:00:00Z",
  url: "/api/v1/attachments/f1/file",
  inline: true,
  meta: {},
};
const cv = {
  id: "d1",
  kind: "cv",
  name: "Backend CV",
  created_at: "2026-09-01T10:00:00Z",
  updated_at: "2026-09-20T10:00:00Z",
  versions: [
    {
      id: "v3",
      document_id: "d1",
      label: "v3 (fintech)",
      notes: "Payments first",
      created_at: "2026-09-20T10:00:00Z",
      file,
      used_in: 1,
    },
    {
      id: "v2",
      document_id: "d1",
      label: "v2",
      notes: null,
      created_at: "2026-09-05T10:00:00Z",
      file: null,
      used_in: 0,
    },
  ],
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("documents", () => {
  it("lists documents with versions and where they were used", async () => {
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/documents": [cv],
      "GET /api/v1/documents/d1": {
        ...cv,
        used_in: [
          {
            link_id: "l1",
            application_id: "a1",
            company_name: "Contoso",
            role_title: "Backend Engineer",
            stage_name: "Applied",
            version_id: "v3",
            version_label: "v3 (fintech)",
            sent_on: "2026-09-21",
          },
        ],
      },
      "POST /api/v1/documents": { ...cv, id: "d2", kind: "cover_letter", name: "Cover letter", versions: [] },
      "/api/v1/health": {},
    });
    renderAt("/documents");
    expect(await screen.findByRole("heading", { name: "Backend CV" })).toBeInTheDocument();
    expect(screen.getByText("sent 1×")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /backend-cv-v3.pdf/ })).toHaveAttribute("href", file.url);
    // A version that was sent can't be deleted.
    expect(screen.getByRole("button", { name: "Delete v3 (fintech)" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Delete v2" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: /Where it was used \(1\)/ }));
    expect(await screen.findByRole("link", { name: "Contoso · Backend Engineer" })).toHaveAttribute(
      "href",
      "/applications/a1",
    );

    fireEvent.click(screen.getByRole("button", { name: "New document" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByText("Cover letter"));
    fireEvent.change(within(dialog).getByLabelText("Name"), { target: { value: "Cover letter" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Create" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({
        kind: "cover_letter",
        name: "Cover letter",
      }),
    );
  });

  it("records which version was sent with an application", async () => {
    const detail = {
      ...row(),
      events: [],
      contacts: [],
      allowed_next: [],
      suggested_next: [],
      can_undo: false,
      duplicates: [],
      documents: [
        {
          id: "l1",
          document_id: "d9",
          document_name: "Cover letter",
          kind: "cover_letter",
          version_id: "c1",
          version_label: "v1",
          sent_on: "2026-09-21",
          file_url: null,
        },
      ],
    };
    const calls = mockApi({
      "/api/v1/workflow": WORKFLOW,
      "GET /api/v1/applications/a1": detail,
      "GET /api/v1/documents": [cv],
      "POST /api/v1/applications/a1/documents": detail.documents[0],
      "/api/v1/contacts": [],
      "/api/v1/roles": [],
      "/api/v1/health": {},
    });
    renderAt("/applications/a1");
    const card = (await screen.findByRole("heading", { name: "Documents sent" })).closest(
      ".mantine-Card-root",
    ) as HTMLElement;
    expect(within(card).getByText("Cover letter")).toBeInTheDocument();
    expect(within(card).getByText(/^Cover letter · sent /)).toBeInTheDocument();

    fireEvent.click(within(card).getByLabelText("Version"));
    fireEvent.click(await screen.findByText("Backend CV · v3 (fintech)"));
    fireEvent.click(within(card).getByRole("button", { name: "Add" }));
    await waitFor(() => {
      const post = calls.find((c) => c.method === "POST");
      expect(post?.body).toMatchObject({ document_version_id: "v3" });
    });
  });
});
