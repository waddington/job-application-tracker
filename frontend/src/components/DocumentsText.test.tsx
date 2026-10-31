import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { documentKind } from "../api/documentHooks";
import { makeRouter } from "../router";
import { mockApi, WORKFLOW } from "../test/mockApi";

// Documents' text comes from locales/en/documents.ts (i18n-documents). The demo data has no CV
// files waiting, so the snapshot can't reach that card: this pins its words for each state.

const file = (over: Record<string, unknown> = {}) => ({
  sha256: "a",
  name: "CV <final>.pdf",
  size: 2048,
  version: null,
  sources: [],
  applications: [{ id: "a1", company_name: "Contoso", role_title: "Engineer", has_it: false }],
  ...over,
});

function renderCard(files: unknown[]) {
  mockApi({
    "/api/v1/workflow": WORKFLOW,
    "/api/v1/documents": [],
    "/api/v1/cv-files": files,
    "/api/v1/health": {},
  });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/documents"] }))} />);
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("a document's kind", () => {
  it("reads each kind, and keeps one it doesn't know", () => {
    expect(documentKind("cv")).toBe("CV");
    expect(documentKind("cover_letter")).toBe("Cover letter");
    expect(documentKind("other")).toBe("Other");
    expect(documentKind("portfolio")).toBe("portfolio");
  });
});

describe("the CV files card", () => {
  it("counts applications, and sizes each file", async () => {
    renderCard([
      file(),
      file({
        sha256: "b",
        name: "b.pdf",
        size: 500,
        applications: [
          { id: "a1", company_name: "Contoso", role_title: "Engineer", has_it: false },
          { id: "a2", company_name: "Fabrikam", role_title: "Lead", has_it: false },
        ],
      }),
      file({ sha256: "c", name: "c.pdf", size: 3 * 1048576, applications: [] }),
    ]);
    expect(await screen.findByText("CV files you've attached")).toBeInTheDocument();
    expect(screen.getByText("2 KB")).toBeInTheDocument();
    expect(screen.getByText("500 B")).toBeInTheDocument();
    expect(screen.getByText("3.0 MB")).toBeInTheDocument();
    expect(screen.getByText(/^For 1 application:/)).toBeInTheDocument();
    expect(screen.getByText(/^For 2 applications:/)).toBeInTheDocument();
    expect(screen.getByText("No applications without a CV yet.")).toBeInTheDocument();
  });

  it("says what a file already is, and where else it's attached", async () => {
    renderCard([
      file({
        version: { id: "v1", label: "v3 <x>", document_id: "d1", document_name: "Backend CV" },
        sources: [
          { kind: "role", id: "r1", name: "Platform <lead>" },
          { kind: "contact", id: "c1", name: "Alex Morgan" },
        ],
      }),
    ]);
    expect(await screen.findByText("This is Backend CV · v3 <x>.")).toBeInTheDocument();
    expect(screen.getByText(/^Not yet recorded on 1 application:/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Platform <lead>" }).parentElement).toHaveTextContent(
      "On role Platform <lead>",
    );
    expect(screen.getByRole("link", { name: "Alex Morgan" }).parentElement).toHaveTextContent(
      "Sent to Alex Morgan",
    );
  });
});
