import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { AttachmentsCard, humanSize } from "./Attachments";
import { LinksCard } from "./Links";

// Files' and links' text comes from locales/en/files.ts (i18n-attachments-links). The demo data
// has no attachments or links, so the snapshot can't reach their rows: these pin their words.

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider>{node}</MantineProvider>
    </QueryClientProvider>,
  );

const attachment = (over: Record<string, unknown> = {}) => ({
  id: "f1",
  url: "/f",
  inline: true,
  original_name: "Brief <v2>.pdf",
  content_type: "application/pdf",
  size: 2048,
  created_at: "2026-10-02T12:00:00",
  meta: {},
  ...over,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a file's size", () => {
  it("picks its unit", () => {
    expect(humanSize(500)).toBe("500 B");
    expect(humanSize(2048)).toBe("2 KB");
    expect(humanSize(3 * 1048576)).toBe("3.0 MB");
  });
});

describe("the Files card", () => {
  it("offers to upload when it's empty, or says what you pass it", async () => {
    mockApi({ "/api/v1/attachments": [] });
    const { unmount } = wrap(<AttachmentsCard entityType="application" entityId="a1" />);
    expect(
      await screen.findByText(
        "Drop files here: the CV you sent, a brief, an exported email. Up to 50 MB each, kept in your data folder.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Files" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload" })).toBeInTheDocument();
    unmount();
    wrap(<AttachmentsCard entityType="role" entityId="r1" empty="Your own words" />);
    expect(await screen.findByText("Your own words")).toBeInTheDocument();
  });

  it("shows a file's size and date, an email's subject, and confirms a delete", async () => {
    mockApi({
      "/api/v1/attachments": [
        attachment(),
        attachment({
          id: "f2",
          original_name: "m.eml",
          meta: { email: true, from: ["Alex Morgan"], snippet: "Hello" },
        }),
      ],
    });
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    wrap(<AttachmentsCard entityType="application" entityId="a1" />);
    expect(await screen.findByRole("link", { name: "Brief <v2>.pdf" })).toBeInTheDocument();
    expect(screen.getByText("2 KB · 2 Oct 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "(no subject)" })).toBeInTheDocument();
    expect(screen.getByText("Alex Morgan · 2 KB")).toBeInTheDocument();
    const remove = screen.getByRole("button", { name: "Delete Brief <v2>.pdf" });
    fireEvent.mouseEnter(remove);
    expect(await screen.findByText("Delete file")).toBeInTheDocument();
    fireEvent.click(remove);
    expect(confirm).toHaveBeenCalledWith(
      "Delete Brief <v2>.pdf? (It stays in your data repo's git history.)",
    );
  });
});

describe("the Links card", () => {
  const link = { id: "l1", kind: "other", url: "https://www.example.com/a", title: "The <ad>" };

  it("says what it's for, and refuses what isn't a link", async () => {
    mockApi({ "/api/v1/links": [] });
    wrap(<LinksCard entityType="application" entityId="a1" />);
    expect(await screen.findByText("Job ads, Google Docs, repos: anything with a URL.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Links" })).toBeInTheDocument();
    expect(screen.getByLabelText("Link URL")).toHaveAttribute("placeholder", "https://docs.google.com/…");
    expect(screen.getByLabelText("Link title (optional)")).toHaveAttribute("placeholder", "Title (optional)");
    fireEvent.change(screen.getByLabelText("Link URL"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    expect(await screen.findByText("Paste a link starting with https://")).toBeInTheDocument();
  });

  it("names a link's actions, and its rename form", async () => {
    mockApi({ "/api/v1/links": [link] });
    wrap(<LinksCard entityType="application" entityId="a1" />);
    expect(await screen.findByRole("link", { name: "The <ad>" })).toBeInTheDocument();
    expect(screen.getByText("example.com")).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "Remove The <ad>" }));
    expect(await screen.findByText("Remove")).toBeInTheDocument();
    const rename = screen.getByRole("button", { name: "Rename The <ad>" });
    fireEvent.mouseEnter(rename);
    expect(await screen.findByText("Rename")).toBeInTheDocument();
    fireEvent.click(rename);
    expect(screen.getByLabelText("Link title")).toHaveAttribute("placeholder", "Leave empty for a default");
    expect(screen.getByRole("button", { name: "Save title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });
});
