import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

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

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <AttachmentsCard entityType="company" entityId="co1" />
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
    expect(screen.getAllByText(/180 KB/)).toHaveLength(2);
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
