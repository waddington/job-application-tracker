import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { LinksCard } from "./Links";

const link = (overrides: Record<string, unknown> = {}) => ({
  id: "l1",
  entity_type: "company",
  entity_id: "co1",
  url: "https://docs.google.com/document/d/abc/edit",
  title: "Take-home brief",
  kind: "google_doc",
  created_at: "2026-09-30T10:00:00Z",
  ...overrides,
});

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <LinksCard entityType="company" entityId="co1" />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("links", () => {
  it("lists, adds and renames links", async () => {
    const calls = mockApi({
      "GET /api/v1/links": [link()],
      "POST /api/v1/links": link({ id: "l2", url: "https://jobs.example.com/1", title: "jobs.example.com" }),
      "PATCH /api/v1/links/l1": link({ title: "Brief v2" }),
    });
    renderCard();
    const anchor = await screen.findByRole("link", { name: "Take-home brief" });
    expect(anchor).toHaveAttribute("href", "https://docs.google.com/document/d/abc/edit");
    expect(anchor).toHaveAttribute("target", "_blank");
    expect(screen.getByText("docs.google.com")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Link URL"), { target: { value: "not a link" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Paste a link starting with https://")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Link URL"), {
      target: { value: " https://jobs.example.com/1 " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST")?.body).toEqual({
        entity_type: "company",
        entity_id: "co1",
        url: "https://jobs.example.com/1",
        title: null,
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Rename Take-home brief" }));
    fireEvent.change(screen.getByLabelText("Link title"), { target: { value: "Brief v2" } });
    fireEvent.keyDown(screen.getByLabelText("Link title"), { key: "Enter" });
    await waitFor(() => expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ title: "Brief v2" }));
  });
});
