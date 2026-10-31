import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import type { SearchHit } from "../api/searchHooks";
import { hitTitle } from "../pages/SearchPage";
import { makeRouter } from "../router";
import { mockApi, WORKFLOW } from "../test/mockApi";

// Notes' and search's text comes from locales/en/notes.ts (i18n-notes-search). A before/after
// snapshot of the pages showed no change; these pin what the demo data can't reach.

const hit = (over: Partial<SearchHit>) =>
  ({
    kind: "interview",
    id: "x",
    title: "the API's English",
    subtitle: null,
    link: "/x",
    snippet: null,
    updated: null,
    archived: false,
    ...over,
  }) as SearchHit;

function renderAt(path: string, routes: Record<string, unknown> = {}) {
  mockApi({ "/api/v1/workflow": WORKFLOW, "/api/v1/health": {}, ...routes });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: [path] }))} />);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("a search hit's title matches domain/search.py", () => {
  it("names a round only with a description", () => {
    expect(hitTitle(hit({ round: 2, own_title: "Pairing <x>", subkind: "pairing" }))).toBe(
      "Round 2 · Pairing <x>",
    );
    expect(hitTitle(hit({ own_title: "Chat", subkind: "other" }))).toBe("Chat");
  });

  it("goes by the kind without one, in its own capitals", () => {
    expect(hitTitle(hit({ round: 2, subkind: "hiring_manager" }))).toBe("Hiring Manager");
    expect(hitTitle(hit({ subkind: "coding_task" }))).toBe("Coding Task");
    expect(hitTitle(hit({ subkind: "other" }))).toBe("Other");
  });

  it("names a call by how it happens", () => {
    const call = (subkind: string, own_title: string | null = null) =>
      hitTitle(hit({ kind: "meeting", subkind, own_title }));
    expect(call("call")).toBe("Call");
    expect(call("video", "Catch-up")).toBe("Video call: Catch-up");
    expect(call("in_person")).toBe("Meeting");
  });

  it("names an offer, and keeps the API's title otherwise", () => {
    expect(hitTitle(hit({ kind: "offer" }))).toBe("Offer");
    expect(hitTitle(hit({ subkind: "constructor" }))).toBe("the API's English");
    expect(hitTitle(hit({}))).toBe("the API's English"); // an older server
    expect(hitTitle(hit({ kind: "company", title: "Contoso" }))).toBe("Contoso");
  });
});

describe("the search page", () => {
  it("explains itself with no words", async () => {
    renderAt("/search");
    expect(await screen.findByRole("heading", { name: "Search" })).toBeInTheDocument();
    const intro = screen.getByText(/^Type in the search box/);
    expect(intro).toHaveTextContent(
      "Type in the search box at the top (or press /) to search applications, people, notes, interview debriefs, calls, offers, emails, files and links.",
    );
    expect(intro.querySelector("b")).toHaveTextContent("/");
  });

  it("says when nothing matches, or searching failed", async () => {
    renderAt("/search?q=zzz", { "/api/v1/search": [] });
    expect(await screen.findByRole("heading", { name: "Results for “zzz”" })).toBeInTheDocument();
    expect(
      await screen.findByText("Nothing matches every word of “zzz”. Try fewer or shorter words."),
    ).toBeInTheDocument();
  });

  it("counts results, marks what's archived and what's done", async () => {
    renderAt("/search?q=a", {
      "/api/v1/search": [
        hit({
          kind: "todo",
          title: "Prep",
          subtitle: "Done",
          done: true,
          archived: true,
        }),
      ],
    });
    expect(await screen.findByText("1 result")).toBeInTheDocument();
    expect(screen.getByText("To-do")).toBeInTheDocument();
    expect(screen.getByText("Archived")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
  });

  it("says when it's showing only the first 50, or how many", async () => {
    const many = (n: number) =>
      Array.from({ length: n }, (_, i) => hit({ kind: "company", id: `c${i}`, title: `Co ${i}` }));
    renderAt("/search?q=a", { "/api/v1/search": many(50) });
    expect(await screen.findByText("The first 50 results")).toBeInTheDocument();
  });

  it("counts more than one", async () => {
    renderAt("/search?q=a", {
      "/api/v1/search": [
        hit({ kind: "company", id: "a", title: "A" }),
        hit({ kind: "company", id: "b", title: "B" }),
      ],
    });
    expect(await screen.findByText("2 results")).toBeInTheDocument();
  });
});

describe("notes", () => {
  const note = {
    id: "n1",
    title: "Call <prep>",
    excerpt: null,
    updated_at: "2026-10-02T12:00:00",
    links: [],
    body: "",
  };

  it("says when a search finds nothing, and a note's empty", async () => {
    renderAt("/notes", { "/api/v1/notes": [note], "/api/v1/notes/n1": note });
    fireEvent.click(await screen.findByRole("button", { name: /Call <prep>/, expanded: false }));
    expect(await screen.findByText("(empty)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit Call <prep>" })).toBeInTheDocument();
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);
    fireEvent.click(screen.getByRole("button", { name: "Delete Call <prep>" }));
    expect(confirm).toHaveBeenCalledWith(
      'Delete "Call <prep>"? The file is removed too (it stays in git history).',
    );
  });

  it("offers the editor's words", async () => {
    renderAt("/notes", { "/api/v1/notes": [], "/api/v1/contacts": [], "/api/v1/companies": [] });
    expect(
      await screen.findByText(
        "No notes yet. Notes are Markdown files in your data folder's notes/ directory.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "New note" }));
    expect(await screen.findByLabelText("Note")).toHaveAttribute(
      "placeholder",
      "Markdown works: **bold**, - lists, [links](https://example.com), | tables |",
    );
    expect(screen.getByText("Leave empty for a general note")).toBeInTheDocument();
  });
});
