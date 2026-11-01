import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApi } from "../test/mockApi";
import { RescheduleButton, RescheduleModal } from "./Reschedule";

const round = {
  id: "i1",
  round: 2,
  title: "System design test",
  kind: "system_design",
  status: "scheduled",
  starts_at: "2030-03-14T10:00:00Z",
  company_name: "Contoso",
  role_title: "Senior Backend Engineer",
};

function renderIn(node: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={qc}>{node}</QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("the Reschedule button", () => {
  it("shows for a booked round and opens the dialog with who and why", async () => {
    mockApi({});
    renderIn(<RescheduleButton interview={round} />);
    fireEvent.click(screen.getByRole("button", { name: "Reschedule Round 2 · System design test" }));
    await screen.findByRole("dialog", { name: "Reschedule Round 2 · System design test" });
    expect(screen.getAllByLabelText(/Who needed the change\?/)[0]).toBeInTheDocument();
    expect(screen.getByLabelText("Why? (optional)")).toBeInTheDocument();
  });

  it.each([
    ["not booked yet", { ...round, starts_at: null }],
    ["done", { ...round, status: "done" }],
    ["cancelled", { ...round, status: "cancelled" }],
  ])("isn't there for a round that's %s", (_name, interview) => {
    mockApi({});
    renderIn(<RescheduleButton interview={interview} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("the dialog", () => {
  it("offers each choice in plain words", async () => {
    mockApi({});
    renderIn(<RescheduleModal interview={round} onClose={() => {}} />);
    for (const name of ["Me", "Them", "Both of us", "Neither of us"]) {
      expect(await screen.findByRole("option", { name, hidden: true })).toBeInTheDocument();
    }
  });

  // jsdom can't drive the date picker: moving the time, and what's then sent, is in e2e/reschedule.spec.ts.
  it("can't save until the time has moved", async () => {
    const calls = mockApi({});
    renderIn(<RescheduleModal interview={round} onClose={() => {}} />);
    expect(await screen.findByRole("button", { name: "Reschedule" })).toBeDisabled();
    expect(calls.filter((c) => c.method === "PATCH")).toEqual([]);
  });
});
