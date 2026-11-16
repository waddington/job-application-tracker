import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApiAnswering } from "../test/mockApi";
import { AttachmentsCard, humanSize } from "./Attachments";

const att = (overrides: Record<string, unknown> = {}) => ({
  id: "f1",
  entity_type: "company",
  entity_id: "co1",
  original_name: "CV v3.pdf",
  content_type: "application/pdf",
  size: 184_320,
  sha256: "abc",
  path: "2026/09/f1-CV-v3.pdf",
  created_at: "2026-09-30T10:00:00Z",
  url: "/api/v1/attachments/f1/file",
  inline: true,
  meta: {},
  ...overrides,
});

type Answer = "hang" | "fail" | "ok";

function renderCard(inherited?: { entityType: string; entityId: string; label: string }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <AttachmentsCard entityType="company" entityId="co1" inherited={inherited} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("attachments", () => {
  it("formats sizes", () => {
    expect(humanSize(900)).toBe("900 B");
    expect(humanSize(184_320)).toBe("180 KB");
    expect(humanSize(3_500_000)).toBe("3.3 MB");
  });

  it("lists files and uploads dropped ones", async () => {
    const posted: FormData[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const request = input instanceof Request ? input : null;
        const method = (request?.method ?? init?.method ?? "GET").toUpperCase();
        if (method === "POST") {
          posted.push(init?.body as FormData);
          return new Response(JSON.stringify(att({ id: "f2" })), { status: 201 });
        }
        const list = [
          att(),
          att({
            id: "f4",
            original_name: "next steps.eml",
            content_type: "message/rfc822",
            inline: false,
            meta: {
              email: true,
              subject: "Contoso - next steps",
              from: ["Alex Morgan <alex.morgan@northwind.example.com>"],
              date: "2026-09-29T13:05:07Z",
              snippet: "Contoso would like to book a system design round.",
            },
          }),
          att({ id: "f3", original_name: "notes.html", content_type: "text/html", inline: false }),
        ];
        return new Response(JSON.stringify(list), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    renderCard();
    const pdf = await screen.findByRole("link", { name: "CV v3.pdf" });
    expect(pdf).toHaveAttribute("href", "/api/v1/attachments/f1/file");
    expect(pdf).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "notes.html" })).toHaveAttribute("download", "notes.html");
    expect(screen.getAllByText(/180 KB/)).toHaveLength(3);
    // An exported email shows its subject, sender and a snippet.
    expect(screen.getByRole("link", { name: "Contoso - next steps" })).toHaveAttribute(
      "download",
      "next steps.eml",
    );
    expect(screen.getByText(/^Alex Morgan <alex.morgan@northwind.example.com> · /)).toBeInTheDocument();
    expect(screen.getByText("Contoso would like to book a system design round.")).toBeInTheDocument();

    const file = new File(["%PDF"], "brief.pdf", { type: "application/pdf" });
    const card = screen.getByRole("heading", { name: "Files" }).closest(".mantine-Card-root")!;
    fireEvent.drop(card, { dataTransfer: { files: [file] } });
    await waitFor(() => expect(posted).toHaveLength(1));
    expect((posted[0]!.get("file") as File).name).toBe("brief.pdf");
    expect(posted[0]!.get("entity_type")).toBe("company");
    expect(posted[0]!.get("entity_id")).toBe("co1");
  });
});

describe("attachments: loading and failed", () => {
  const empty = /^Drop files here/;
  const fromAgency = { entityType: "agency", entityId: "ag1", label: "From the agency" };
  /** The company's files and the agency's answer as `own` and `theirs` say when each is asked for. */
  const answering = (answers: { own: () => Answer; theirs: () => Answer }) =>
    mockApiAnswering(
      {
        "GET /api/v1/attachments": (url: URL) =>
          url.searchParams.get("entity_id") === "co1"
            ? [att()]
            : [att({ id: "f9", entity_type: "agency", entity_id: "ag1", original_name: "Agency terms.pdf" })],
      },
      "/api/v1/attachments",
      (sent) => (sent.includes("entity_id=co1") ? answers.own() : answers.theirs()),
    );

  it("shows a skeleton until both its files and the inherited ones load, not the empty text", async () => {
    answering({ own: () => "ok", theirs: () => "hang" });
    renderCard(fromAgency);
    expect(await screen.findByTestId("query-loading")).toHaveAttribute("aria-busy", "true");
    await new Promise((done) => setTimeout(done, 50)); // its own files have loaded by now
    expect(screen.getByTestId("query-loading")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "CV v3.pdf" })).toBeNull();
    expect(screen.queryByText(empty)).toBeNull();
  });

  it("says a failed load failed when either list fails, and Retry loads it", async () => {
    let theirs: Answer = "fail";
    answering({ own: () => "ok", theirs: () => theirs });
    renderCard(fromAgency);
    expect(await screen.findByText("Couldn't load this.")).toBeInTheDocument();
    expect(screen.queryByText(empty)).toBeNull();
    expect(screen.queryByRole("link", { name: "CV v3.pdf" })).toBeNull();
    theirs = "ok";
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Agency terms.pdf" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "CV v3.pdf" })).toBeInTheDocument();
    expect(screen.getByText("From the agency")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
  });

  it("says a failed load of its own files failed, with nothing inherited", async () => {
    answering({ own: () => "fail", theirs: () => "ok" });
    renderCard();
    expect(await screen.findByText("Couldn't load this.")).toBeInTheDocument();
    expect(screen.queryByText(empty)).toBeNull();
  });
});
