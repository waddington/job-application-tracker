import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Interview } from "../api/interviewHooks";
import { mockApi } from "../test/mockApi";
import { InterviewOutcome } from "./OutcomeNotes";

const round = {
  id: "i1",
  round: 2,
  title: "System design test",
  kind: "system_design",
  label: "Round 2 · System design test",
  company_name: "Contoso",
  role_title: "Senior Backend Engineer",
  debrief: null,
  questions: "How would you shard it?",
} as unknown as Interview;

function renderOutcome() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <InterviewOutcome interview={round} />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("how did it go", () => {
  it("shows what's already written, and keeps it when saving", async () => {
    const calls = mockApi({ "PATCH /api/v1/interviews/i1": { ...round, status: "done" } });
    renderOutcome();
    fireEvent.click(screen.getByRole("button", { name: "Done: Round 2 · System design test" }));
    expect(await screen.findByLabelText("Questions asked")).toHaveValue("How would you shard it?");
    fireEvent.click(screen.getByRole("button", { name: "Mark as done" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        status: "done",
        debrief: null,
        questions: "How would you shard it?",
      }),
    );
  });

  it("saves what happened with Didn't happen", async () => {
    const calls = mockApi({ "PATCH /api/v1/interviews/i1": { ...round, status: "cancelled" } });
    renderOutcome();
    fireEvent.click(screen.getByRole("button", { name: "Didn't happen: Round 2 · System design test" }));
    fireEvent.change(await screen.findByLabelText("What happened?"), {
      target: { value: "They rescheduled" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Mark as didn't happen" }));
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({
        status: "cancelled",
        debrief: "They rescheduled",
      }),
    );
  });
});
