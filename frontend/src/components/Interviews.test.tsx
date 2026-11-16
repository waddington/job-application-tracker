import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { mockApiAnswering } from "../test/mockApi";
import { InterviewsCard } from "./Interviews";

const round = {
  id: "i1",
  application_id: "a1",
  round: 1,
  title: "Recruiter screen",
  kind: "screen",
  status: "done",
  label: "Round 1 · Recruiter screen",
  starts_at: "2026-09-29T10:00:00Z",
  ends_at: null,
  deadline_at: null,
  format: "video",
  location: null,
  meeting_url: null,
  prep: null,
  debrief: null,
  questions: null,
  task_instructions: null,
  task_repo_url: null,
  interviewer_ids: [],
  created_at: "2026-09-25T10:00:00Z",
  updated_at: "2026-09-25T10:00:00Z",
};

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MantineProvider>
      <QueryClientProvider client={qc}>
        <InterviewsCard applicationId="a1" />
      </QueryClientProvider>
    </MantineProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("interview rounds: loading and failed", () => {
  const empty = /^No interviews yet\./;

  it("shows a skeleton while loading, not the empty text", async () => {
    mockApiAnswering({ "/api/v1/contacts": [] }, "/api/v1/interviews", () => "hang");
    renderCard();
    expect(await screen.findByTestId("query-loading")).toHaveAttribute("aria-busy", "true");
    expect(screen.queryByText(empty)).toBeNull();
  });

  it("says a failed load failed, not that there are none, and Retry loads it", async () => {
    let how: "fail" | "ok" = "fail";
    mockApiAnswering(
      { "/api/v1/contacts": [], "/api/v1/interviews": [round] },
      "/api/v1/interviews",
      () => how,
    );
    renderCard();
    expect(await screen.findByText("Couldn't load this.")).toBeInTheDocument();
    expect(screen.queryByText(empty)).toBeNull();
    how = "ok";
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText(/Recruiter screen/)).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
  });

  it("says there are none only when they loaded empty", async () => {
    mockApiAnswering({ "/api/v1/contacts": [], "/api/v1/interviews": [] }, "/api/v1/interviews", () => "ok");
    renderCard();
    expect(await screen.findByText(empty)).toBeInTheDocument();
    expect(screen.queryByTestId("query-loading")).toBeNull();
  });
});
