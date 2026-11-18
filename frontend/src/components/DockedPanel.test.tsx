import { MantineProvider, Modal } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DockContext, DockedPanel, PHONE_QUERY } from "./DockedPanel";

// A page with two openers and a panel, and a stand-in for Layout's dock, which says whether it's docked.
function Page({ withModal = false }: { withModal?: boolean }) {
  const [id, setId] = useState<string | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [docked, setDocked] = useState(false);
  return (
    <MantineProvider>
      <DockContext.Provider value={{ target, setDocked }}>
        <button onClick={() => setId("a")}>Open A</button>
        <button onClick={() => setId("b")}>Open B</button>
        <DockedPanel
          opened={!!id}
          onClose={() => setId(null)}
          title="Application"
          closeLabel="Close"
          contentKey={id}
        >
          <p>Showing {id}</p>
          <button>Inside</button>
          <Modal opened={withModal} onClose={() => {}} title="Asking">
            <button>In the modal</button>
          </Modal>
        </DockedPanel>
      </DockContext.Provider>
      <div data-testid="dock" data-docked={docked ? "yes" : "no"} ref={setTarget} />
    </MantineProvider>
  );
}

const realMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = realMatchMedia;
});

describe("DockedPanel", () => {
  it("opens in the dock as a labelled, non-modal dialog, with focus on its heading", () => {
    render(<Page />);
    expect(screen.getByTestId("dock")).toHaveAttribute("data-docked", "no");
    const opener = screen.getByRole("button", { name: "Open A" });
    opener.focus();
    fireEvent.click(opener);
    const panel = screen.getByRole("dialog", { name: "Application" });
    expect(panel).toHaveAttribute("aria-modal", "false");
    expect(screen.getByTestId("dock")).toContainElement(panel);
    expect(screen.getByTestId("dock")).toHaveAttribute("data-docked", "yes");
    expect(screen.getByRole("heading", { name: "Application" })).toHaveFocus();
    expect(panel).toHaveTextContent("Showing a");
  });

  it("swaps what it shows, then Escape closes it and focus goes back to what opened it", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    const other = screen.getByRole("button", { name: "Open B" });
    other.focus();
    fireEvent.click(other);
    expect(screen.getByRole("dialog")).toHaveTextContent("Showing b");
    expect(screen.getByRole("heading", { name: "Application" })).toHaveFocus();

    fireEvent.keyDown(screen.getByRole("button", { name: "Inside" }), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByTestId("dock")).toHaveAttribute("data-docked", "no");
    expect(other).toHaveFocus();
  });

  it("closes from its close button", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves Escape in a dialog opened from it to that dialog", () => {
    render(<Page withModal />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "In the modal" }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Application" })).toBeInTheDocument();
  });

  it("is a full-screen overlay on a phone, with nothing docked", async () => {
    window.matchMedia = ((query: string) => ({
      ...realMatchMedia(query),
      matches: query === PHONE_QUERY,
    })) as typeof window.matchMedia;
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    const panel = await screen.findByRole("dialog", { name: "Application" }); // after its transition
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("dock")).toBeEmptyDOMElement();
    expect(screen.getByTestId("dock")).toHaveAttribute("data-docked", "no");
  });
});
