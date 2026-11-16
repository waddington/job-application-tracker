import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { bothQueries, QueryState, type QueryLike } from "./QueryState";

type Query = {
  data: string[] | undefined;
  isError: boolean;
  isFetching: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
  refetch: () => Promise<never>;
};

function renderState(query: Query, select?: (d: string[]) => string[]) {
  return render(
    <MantineProvider>
      <div data-testid="where">
        <QueryState query={query} select={select} empty="Nothing here yet." rows={4}>
          {(list) => list.map((x) => <p key={x}>{x}</p>)}
        </QueryState>
      </div>
    </MantineProvider>,
  );
}

const query = (q: Partial<Query>): Query => ({
  data: undefined,
  isError: false,
  isFetching: true,
  fetchStatus: "fetching",
  refetch: vi.fn(),
  ...q,
});

describe("QueryState", () => {
  it("shows skeleton lines while loading, not the empty text", () => {
    renderState(query({}));
    const loading = screen.getByTestId("query-loading");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(loading.children).toHaveLength(4);
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
  });

  it("shows nothing for a query that never started (disabled)", () => {
    renderState(query({ isFetching: false, fetchStatus: "idle" }));
    expect(screen.getByTestId("where")).toBeEmptyDOMElement();
  });

  it("says a failed load failed, and Retry refetches", () => {
    const q = query({ isError: true, isFetching: false, fetchStatus: "idle" });
    renderState(q);
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't load this.");
    expect(screen.queryByText("Nothing here yet.")).toBeNull();
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).not.toHaveAttribute("data-loading");
    fireEvent.click(retry);
    expect(q.refetch).toHaveBeenCalledTimes(1);
  });

  it("shows Retry loading while it refetches after a failure", () => {
    renderState(query({ isError: true, isFetching: true, fetchStatus: "fetching" }));
    expect(screen.getByText("Couldn't load this.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toHaveAttribute("data-loading", "true");
  });

  it("shows the empty text only for a list that loaded empty", () => {
    renderState(query({ data: [] }));
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
    expect(screen.queryByTestId("query-loading")).toBeNull();
  });

  it("shows the list, and keeps it through a failed refetch", () => {
    renderState(query({ data: ["Contoso", "Fabrikam"], isError: true }));
    expect(screen.getByText("Contoso")).toBeInTheDocument();
    expect(screen.getByText("Fabrikam")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
  });

  it("decides it's empty on the selected list", () => {
    renderState(query({ data: ["Contoso"] }), (d) => d.filter((x) => x !== "Contoso"));
    expect(screen.getByText("Nothing here yet.")).toBeInTheDocument();
  });

  it("draws a skeleton of its own shape in place of the lines, if given one", () => {
    render(
      <MantineProvider>
        <QueryState query={query({})} empty="Nothing here yet." skeleton={<p>A chart-shaped skeleton</p>}>
          {(list: string[]) => list.join()}
        </QueryState>
      </MantineProvider>,
    );
    const loading = screen.getByTestId("query-loading");
    expect(loading).toHaveAttribute("aria-busy", "true");
    expect(loading.children).toHaveLength(1);
    expect(loading).toHaveTextContent("A chart-shaped skeleton");
  });
});

describe("bothQueries", () => {
  const query = <T,>(over: Partial<QueryLike<T>>): QueryLike<T> => ({
    data: undefined,
    isError: false,
    isFetching: false,
    fetchStatus: "idle",
    refetch: vi.fn(),
    ...over,
  });

  it("is loaded once both are, as a pair", () => {
    const both = bothQueries(query({ data: [1] }), query({ data: ["a"] }));
    expect(both.data).toEqual([[1], ["a"]]);
    expect(both.isError).toBe(false);
  });

  it("fails when one fails, and Retry neither spins for nor retries the one still loading", () => {
    const failed = query<number[]>({ isError: true });
    const loading = query<number[]>({ isFetching: true, fetchStatus: "fetching" });
    const both = bothQueries(failed, loading);
    expect(both.data).toBeUndefined();
    expect(both.isError).toBe(true);
    expect(both.isFetching).toBe(false);
    void both.refetch();
    expect(failed.refetch).toHaveBeenCalledTimes(1);
    expect(loading.refetch).not.toHaveBeenCalled();
    expect(bothQueries(query({ isError: true, isFetching: true }), loading).isFetching).toBe(true);
  });
});
