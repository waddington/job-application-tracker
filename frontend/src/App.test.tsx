import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { NAV } from "./nav";
import { makeRouter } from "./router";

function renderAt(path: string) {
  const router = makeRouter(createMemoryHistory({ initialEntries: [path] }));
  render(<App router={router} />);
}

describe("app shell", () => {
  it("shows every navigation item and the home page", async () => {
    renderAt("/");
    const nav = await screen.findByRole("navigation", { name: "Main navigation" });
    for (const item of NAV) {
      expect(nav).toHaveTextContent(item.label);
    }
    expect(await screen.findByRole("heading", { name: "Next actions" })).toBeInTheDocument();
  });

  it("renders a placeholder for each page", async () => {
    renderAt("/documents");
    expect(await screen.findByRole("heading", { name: "Documents" })).toBeInTheDocument();
    expect(screen.getByText("documents")).toBeInTheDocument();
  });

  it("shows not found for unknown paths", async () => {
    renderAt("/nope");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
