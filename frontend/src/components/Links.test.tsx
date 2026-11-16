import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi, mockApiAnswering } from "../test/mockApi";
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

  it("the X cancels a rename, by mouse or after tabbing to it, without saving", async () => {
    const calls = mockApi({ "GET /api/v1/links": [link()] });
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Rename Take-home brief" }));
    const box = screen.getByLabelText("Link title");
    fireEvent.change(box, { target: { value: "Changed" } });
    const cancel = screen.getByRole("button", { name: "Cancel" });
    // A mouse press keeps focus in the box, so the box doesn't blur and save first.
    expect(fireEvent.mouseDown(cancel)).toBe(false);
    // Tabbing from the box to the X doesn't save either.
    fireEvent.blur(box, { relatedTarget: cancel });
    fireEvent.focus(cancel);
    fireEvent.click(cancel);
    expect(screen.queryByLabelText("Link title")).not.toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Take-home brief" })).toBeInTheDocument();
    await new Promise((done) => setTimeout(done, 50)); // a save would have been sent by now
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
  });

  it("leaving the rename for somewhere else saves it", async () => {
    const calls = mockApi({
      "GET /api/v1/links": [link()],
      "PATCH /api/v1/links/l1": link({ title: "Brief v2" }),
    });
    renderCard();
    fireEvent.click(await screen.findByRole("button", { name: "Rename Take-home brief" }));
    const box = screen.getByLabelText("Link title");
    fireEvent.change(box, { target: { value: "Brief v2" } });
    fireEvent.blur(box, { relatedTarget: null });
    await waitFor(() => expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(1));
  });
});

describe("links: loading and failed", () => {
  const empty = "Job ads, Google Docs, repos: anything with a URL.";

  it("shows a skeleton while loading, not the empty text", async () => {
    mockApiAnswering({}, "/api/v1/links", () => "hang");
    renderCard();
    expect(await screen.findByTestId("query-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(empty)).toBeNull();
  });

  it("says a failed load failed, not that there are none, and Retry loads it", async () => {
    let how: "fail" | "ok" = "fail";
    mockApiAnswering({ "GET /api/v1/links": [link()] }, "/api/v1/links", () => how);
    renderCard();
    expect(await screen.findByText("Couldn't load this.")).toBeInTheDocument();
    expect(screen.queryByText(empty)).toBeNull();
    how = "ok";
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("link", { name: "Take-home brief" })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
  });
});
