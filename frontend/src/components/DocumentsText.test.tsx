import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { documentKind } from "../api/documentHooks";
import { makeRouter } from "../router";
import { mockApi, WORKFLOW } from "../test/mockApi";

// Documents' text comes from locales/en/documents.ts (i18n-documents). The demo data has no CV
// files or empty documents, so the snapshot can't reach those: this pins their words.

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

describe("the Documents page's own states", () => {
  const version = {
    id: "v1",
    label: "v2",
    notes: null,
    created_at: "2026-10-02T12:00:00",
    used_in: 2,
    file: { url: "/f", inline: true, original_name: "cv.pdf", size: 2048 },
  };

  it("says when there's nothing yet", async () => {
    renderCard([]);
    expect(
      await screen.findByText(
        "Add your CV and cover letters here, with a new version each time you tailor one. Then record which version you sent from each application.",
      ),
    ).toBeInTheDocument();
  });

  it("shows a version's file and where it was sent, or that it wasn't", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/cv-files": [],
      "/api/v1/documents": [
        { id: "d1", kind: "cv", name: "Backend CV", versions: [version] },
        { id: "d2", kind: "other", name: "Empty one", versions: [] },
      ],
      "/api/v1/documents/d1": {
        used_in: [
          {
            link_id: "l1",
            application_id: "a1",
            company_name: "Contoso",
            role_title: "Engineer",
            version_label: "v2",
            sent_on: "2026-10-03",
            stage_name: "Applied",
          },
        ],
      },
      "/api/v1/documents/d2": { used_in: [] },
      "/api/v1/health": {},
    });
    render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/documents"] }))} />);
    expect(await screen.findByRole("link", { name: /^cv\.pdf \(/ })).toBeInTheDocument();
    expect(screen.getByText("sent 2×")).toBeInTheDocument();
    expect(screen.getByText("No versions yet. Add the file you send.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Where it was used (2)" }));
    expect(await screen.findByText("v2 · 3 Oct 2026 · Applied")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Where it was used (0)" }));
    expect(await screen.findByText("Not sent with any application yet.")).toBeInTheDocument();
  });

  it("explains why a sent version can't be deleted", async () => {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/cv-files": [],
      "/api/v1/documents": [{ id: "d1", kind: "cv", name: "Backend CV", versions: [version] }],
      "/api/v1/health": {},
    });
    render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/documents"] }))} />);
    fireEvent.mouseEnter(await screen.findByRole("button", { name: "Delete v2" }));
    expect(await screen.findByText("Sent with applications: remove it from them first")).toBeInTheDocument();
  });
});

describe("the adopt dialog", () => {
  const two = [
    { id: "a1", company_name: "Contoso", role_title: "Engineer", has_it: false },
    { id: "a2", company_name: "Fabrikam", role_title: "Lead", has_it: false },
  ];

  function open(over: Record<string, unknown>, recorded: number) {
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/documents": [],
      "/api/v1/cv-files": [file({ applications: two, ...over })],
      "POST /api/v1/cv-files/adopt": { document_id: "d1", version_id: "v1", recorded },
      "/api/v1/health": {},
    });
    render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/documents"] }))} />);
  }

  it("makes a file a version, with its words and toast", async () => {
    open({}, 2);
    fireEvent.click(await screen.findByRole("button", { name: "Make it a version" }));
    const dialog = await screen.findByRole("dialog", { name: "Make CV <final>.pdf a CV version" });
    for (const text of [
      "What sets it apart, e.g. v3 (fintech)",
      "Sent with",
      "The applications it went out with. Untick any that got a different CV.",
      "The file stays where you attached it too.",
    ]) {
      expect(within(dialog).getByText(text)).toBeInTheDocument();
    }
    expect(within(dialog).getByLabelText("Name of the new CV")).toHaveValue("CV");
    fireEvent.click(within(dialog).getByRole("button", { name: "Make it a version" }));
    expect(
      await screen.findByText("CV <final> is a version now, recorded as sent with 2 applications."),
    ).toBeInTheDocument();
  });

  it("records a version on one application, with the one form", async () => {
    open({ version: { id: "v1", label: "v3", document_id: "d1", document_name: "Backend CV" } }, 1);
    expect(await screen.findByText(/^Not yet recorded on 2 applications:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Record as sent" }));
    const dialog = await screen.findByRole("dialog", { name: "Record Backend CV · v3 as sent" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Record as sent" }));
    expect(await screen.findByText("Recorded as sent with 1 application.")).toBeInTheDocument();
  });

  it("explains itself, and offers back what you hid", async () => {
    localStorage.setItem("jat.notACv", JSON.stringify(["a", "b"]));
    mockApi({
      "/api/v1/workflow": WORKFLOW,
      "/api/v1/documents": [],
      "/api/v1/cv-files": [
        file(),
        file({ sha256: "b" }),
        file({ sha256: "c", name: "c.pdf", applications: [] }),
      ],
      "/api/v1/health": {},
    });
    render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/documents"] }))} />);
    expect(await screen.findByText("Show 2 you said aren't CVs")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Files that look like a CV (named like one, or the same file in several places) attached to applications, roles or people, like a CV you sent a recruiter. Make each a version so Insights can compare how they do; the same file counts as the same version.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Make it a version" }));
    expect(
      await screen.findByText(
        "No applications without a CV yet. Make it a version anyway: it comes back when there are some to record it on.",
      ),
    ).toBeInTheDocument();
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
