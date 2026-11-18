import { MantineProvider, Menu, Modal } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { DockContext, DockedPanel, OVERLAY_QUERY } from "./DockedPanel";

interface PageProps {
  withModal?: boolean;
  withMenu?: boolean;
  /** A Move button in the panel replaces the opener with a new element, as a move does a board card. */
  openerRemounts?: boolean;
}

// A page with two openers and a panel, and a stand-in for Layout's dock, which says whether it's docked.
function Page({ withModal = false, withMenu = false, openerRemounts = false }: PageProps) {
  const [id, setId] = useState<string | null>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [docked, setDocked] = useState(false);
  const [moves, setMoves] = useState(0);
  return (
    <MantineProvider>
      <DockContext.Provider value={{ target, setDocked }}>
        <main>
          <h2>The page</h2>
          <button key={moves} data-panel-opener="a" onClick={() => setId("a")}>
            Open A
          </button>
          <button data-panel-opener="b" onClick={() => setId("b")}>
            Open B
          </button>
        </main>
        <Panel id={id} onClose={() => setId(null)}>
          {openerRemounts && <button onClick={() => setMoves((n) => n + 1)}>Move</button>}
          {withMenu && (
            <Menu>
              <Menu.Target>
                <button>Actions</button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item>Do it</Menu.Item>
              </Menu.Dropdown>
            </Menu>
          )}
          <Modal opened={withModal} onClose={() => {}} title="Asking">
            <button>In the modal</button>
          </Modal>
        </Panel>
      </DockContext.Provider>
      <div data-testid="dock" data-docked={docked ? "yes" : "no"} ref={setTarget} />
    </MantineProvider>
  );
}

function Panel({ id, onClose, children }: { id: string | null; onClose: () => void; children?: ReactNode }) {
  return (
    <DockedPanel opened={!!id} onClose={onClose} title="Application" closeLabel="Close" contentKey={id}>
      <p>Showing {id}</p>
      <button>Inside</button>
      {children}
    </DockedPanel>
  );
}

const realMatchMedia = window.matchMedia;
afterEach(() => {
  window.matchMedia = realMatchMedia;
});
const narrowWindow = () => {
  window.matchMedia = ((query: string) => ({
    ...realMatchMedia(query),
    matches: query === OVERLAY_QUERY,
  })) as typeof window.matchMedia;
};

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

  it("gives focus to what stands for the opener now, when the opener itself has gone", () => {
    render(<Page openerRemounts />);
    const opener = screen.getByRole("button", { name: "Open A" });
    opener.focus();
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "Move" }));
    expect(opener).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    const again = screen.getByRole("button", { name: "Open A" });
    expect(again).not.toBe(opener);
    expect(again).toHaveFocus();
  });

  it("closes from its close button", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes on Escape when focus is nowhere (as after a button that had it was disabled)", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    (document.activeElement as HTMLElement).blur();
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("leaves an Escape on the page itself alone", () => {
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Open B" }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Application" })).toBeInTheDocument();
  });

  it("leaves Escape in a dialog opened from it to that dialog", () => {
    render(<Page withModal />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "In the modal" }), { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Application" })).toBeInTheDocument();
  });

  it("leaves Escape in a menu opened from it to that menu", async () => {
    render(<Page withMenu />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    const item = await screen.findByRole("menuitem", { name: "Do it", hidden: true });
    expect(screen.getByRole("dialog", { name: "Application" })).not.toContainElement(item); // rendered elsewhere
    fireEvent.keyDown(item, { key: "Escape" });
    expect(screen.getByRole("dialog", { name: "Application" })).toBeInTheDocument();
  });

  it("covers the screen below 992 px, a modal with nothing docked", () => {
    narrowWindow();
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Open A" }));
    const panel = screen.getByRole("dialog", { name: "Application" });
    expect(panel).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("dock")).toBeEmptyDOMElement();
    expect(screen.getByTestId("dock")).toHaveAttribute("data-docked", "no");
    expect(screen.getByRole("heading", { name: "Application" })).toHaveFocus();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("covers the screen outside the app's Layout", () => {
    render(
      <MantineProvider>
        <Panel id="a" onClose={() => {}} />
      </MantineProvider>,
    );
    expect(screen.getByRole("dialog", { name: "Application" })).toHaveAttribute("aria-modal", "true");
  });
});
