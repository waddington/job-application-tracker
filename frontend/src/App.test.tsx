import { MantineProvider } from "@mantine/core";
import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { NAV, NAV_GROUPS } from "./nav";
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
    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    // The menu is grouped, and the wordmark goes home.
    for (const group of NAV_GROUPS) {
      expect(within(nav).getByRole("group", { name: group })).toBeInTheDocument();
    }
    expect(within(nav).getByRole("group", { name: "Today" })).toHaveTextContent(
      "OverviewNext actionsTimeline",
    );
    expect(screen.getByRole("link", { name: "Job Application Tracker: overview" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(screen.getAllByRole("button", { name: "New application" }).length).toBeGreaterThan(0);
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

  it("explains how it works from the help button", async () => {
    renderAt("/");
    fireEvent.click(await screen.findByRole("button", { name: "How it works" }));
    const dialog = await screen.findByRole("dialog", { name: "How it works" });
    expect(within(dialog).getByText("Add an application")).toBeInTheDocument();
    expect(within(dialog).getByText(/Anything new is created for you/)).toBeInTheDocument();
  });

  it("shows not found for unknown paths", async () => {
    renderAt("/nope");
    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
  });
});
