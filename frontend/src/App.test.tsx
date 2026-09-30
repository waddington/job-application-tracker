import { MantineProvider } from "@mantine/core";
import { createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { NAV } from "./nav";
import { Placeholder } from "./pages/Placeholder";
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
    expect(screen.getByRole("link", { name: "Download a backup" })).toHaveAttribute(
      "href",
      "/api/v1/backup/archive",
    );
  });

  it("renders a placeholder for a page that isn't built", () => {
    // Every page is built now; the placeholder stays for pages added to NAV ahead of their task.
    render(
      <MantineProvider>
        <Placeholder item={{ ...NAV[0]!, label: "Offers", task: "offers" }} />
      </MantineProvider>,
    );
    expect(screen.getByRole("heading", { name: "Offers" })).toBeInTheDocument();
    expect(screen.getByText("offers")).toBeInTheDocument();
  });

  it("shows not found for unknown paths", async () => {
    renderAt("/nope");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
