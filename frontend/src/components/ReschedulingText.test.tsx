import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Rescheduling } from "../api/insightHooks";
import { daysMoved, RoundDaysMoved } from "./Reschedule";
import { ReschedulingCard } from "./Rescheduling";

// What the Rescheduling block and a round's days moved say, word for word.

const stats = (over: Partial<Rescheduling> = {}): Rescheduling => ({
  booked_rounds: 0,
  moved_rounds: 0,
  moves: 0,
  by_me: 0,
  by_them: 0,
  by_mutual: 0,
  by_neither: 0,
  not_recorded: 0,
  min_rounds_listed: 3,
  companies: [],
  recruiters: [],
  ...over,
});

const NOT_RECORDED =
  "Not recorded means the app doesn't know who: the move was made on the round's Edit form, or before the app asked.";
const LIST_HINT =
  "Only companies and recruiters with at least 3 moved rounds show here, as plain counts: fewer could look like a pattern when it isn't one.";

async function block(data: Rescheduling) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } }),
    ),
  );
  const view = render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MantineProvider>
        <ReschedulingCard />
      </MantineProvider>
    </QueryClientProvider>,
  );
  await vi.waitFor(() => expect(view.container.querySelector(".mantine-Loader-root")).toBeNull());
  return view;
}

const rows = (name: string) =>
  within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map((row) => Array.from(row.querySelectorAll("th, td")).map((c) => c.textContent));

afterEach(() => vi.unstubAllGlobals());

describe("the Rescheduling block", () => {
  it("says what it counts", async () => {
    await block(stats());
    expect(screen.getByRole("heading", { name: "Rescheduling" })).toBeTruthy();
    expect(
      screen.getByText(
        "Rounds on applications added in this period, whenever they moved. A booked round is one that's had a time.",
      ),
    ).toBeTruthy();
  });

  it("at zero, says nothing was booked and shows no table", async () => {
    await block(stats());
    expect(screen.getByText("No rounds booked in this period.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("with nothing moved, says so in the singular and the plural", async () => {
    const one = await block(stats({ booked_rounds: 1 }));
    expect(screen.getByText("Your 1 booked round hasn't moved.")).toBeTruthy();
    one.unmount();
    await block(stats({ booked_rounds: 4 }));
    expect(screen.getByText("None of your 4 booked rounds has moved.")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("tells rounds from moves", async () => {
    const one = await block(stats({ booked_rounds: 1, moved_rounds: 1, moves: 1, by_me: 1 }));
    expect(screen.getByText("Of 1 booked round, 1 moved. That's 1 move.")).toBeTruthy();
    one.unmount();
    await block(stats({ booked_rounds: 5, moved_rounds: 1, moves: 2, by_them: 2 }));
    expect(
      screen.getByText(
        "Of 5 booked rounds, 1 moved. That's 2 moves in all: a round that moves twice is one round and two moves.",
      ),
    ).toBeTruthy();
  });

  it("splits moves by who, with not recorded as its own group", async () => {
    await block(
      stats({
        booked_rounds: 9,
        moved_rounds: 6,
        moves: 15,
        by_me: 1,
        by_them: 2,
        by_mutual: 3,
        by_neither: 4,
        not_recorded: 5,
      }),
    );
    expect(rows("Who needed the change")).toEqual([
      ["Who needed the change", "Moves"],
      ["Me", "1"],
      ["Them", "2"],
      ["Both of us", "3"],
      ["Neither of us", "4"],
      ["Not recorded", "5"],
    ]);
    expect(screen.getByText(NOT_RECORDED)).toBeTruthy();
  });

  it("with only old moves, puts them all under not recorded", async () => {
    await block(stats({ booked_rounds: 2, moved_rounds: 1, moves: 3, not_recorded: 3 }));
    expect(rows("Who needed the change").at(-1)).toEqual(["Not recorded", "3"]);
    expect(rows("Who needed the change")[1]).toEqual(["Me", "0"]);
    expect(screen.getByText(NOT_RECORDED)).toBeTruthy();
  });

  it("explains not recorded only when there are some", async () => {
    await block(stats({ booked_rounds: 1, moved_rounds: 1, moves: 1, by_me: 1 }));
    expect(screen.queryByText(NOT_RECORDED)).toBeNull();
  });

  it("omits the lists and their hint when nobody reaches the threshold", async () => {
    await block(stats({ booked_rounds: 3, moved_rounds: 2, moves: 2, by_me: 2 }));
    expect(screen.queryByText(LIST_HINT)).toBeNull();
    expect(screen.queryByRole("table", { name: "Company" })).toBeNull();
    expect(screen.queryByRole("table", { name: "Recruiter" })).toBeNull();
  });

  it("lists companies and recruiters as raw counts, never as a share", async () => {
    const { container } = await block(
      stats({
        booked_rounds: 8,
        moved_rounds: 3,
        moves: 4,
        by_them: 4,
        companies: [{ id: "c", name: "Contoso", moved_rounds: 3, moves: 4 }],
        recruiters: [{ id: "r", name: "Sam Patel", moved_rounds: 3, moves: 4 }],
      }),
    );
    expect(screen.getByText(LIST_HINT)).toBeTruthy();
    expect(rows("Company")).toEqual([
      ["Company", "Rounds moved", "Moves"],
      ["Contoso", "3", "4"],
    ]);
    expect(rows("Recruiter")).toEqual([
      ["Recruiter", "Rounds moved", "Moves"],
      ["Sam Patel", "3", "4"],
    ]);
    expect(container.querySelector(".mantine-Card-root")?.textContent).not.toContain("%");
  });

  it("shows only the list that has someone in it", async () => {
    await block(
      stats({
        booked_rounds: 3,
        moved_rounds: 3,
        moves: 3,
        not_recorded: 3,
        companies: [{ id: "c", name: "Contoso", moved_rounds: 3, moves: 3 }],
      }),
    );
    expect(screen.getByRole("table", { name: "Company" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Recruiter" })).toBeNull();
  });

  it("says when it can't load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } })),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MantineProvider>
          <ReschedulingCard />
        </MantineProvider>
      </QueryClientProvider>,
    );
    expect(await screen.findByText("Couldn't load the rescheduling numbers.")).toBeTruthy();
  });
});

describe("a round's days moved", () => {
  const move = (from_at: string, to_at: string) => ({ from_at, to_at });
  const line = (rescheduled_count: number, moves: { from_at: string; to_at: string }[]) => {
    const view = render(
      <MantineProvider>
        <RoundDaysMoved interview={{ rescheduled_count, moves }} />
      </MantineProvider>,
    );
    const text = view.container.querySelector("p")?.textContent ?? ""; // not Mantine's style tag
    view.unmount();
    return text;
  };
  // Noon, so these read the same in any time zone a test runs in.
  const later = (days: number) =>
    move("2026-11-03T12:00:00Z", `2026-11-${String(3 + days).padStart(2, "0")}T12:00:00Z`);

  it("says pushed back, in the singular and the plural", () => {
    expect(line(1, [later(1)])).toBe("Pushed back 1 day in total.");
    expect(line(1, [later(3)])).toBe("Pushed back 3 days in total.");
  });

  it("doesn't call a move earlier pushed back", () => {
    expect(line(1, [move("2026-11-05T12:00:00Z", "2026-11-04T12:00:00Z")])).toBe(
      "Brought forward 1 day in total.",
    );
    expect(line(1, [move("2026-11-05T12:00:00Z", "2026-11-03T12:00:00Z")])).toBe(
      "Brought forward 2 days in total.",
    );
  });

  it("adds moves up, later and earlier cancelling out", () => {
    const moves = [later(5), move("2026-11-08T12:00:00Z", "2026-11-06T12:00:00Z")];
    expect(daysMoved(moves)).toBe(3);
    expect(line(2, moves)).toBe("Pushed back 3 days in total.");
    expect(line(2, [later(2), move("2026-11-05T12:00:00Z", "2026-11-03T12:00:00Z")])).toBe("");
  });

  it("counts calendar days, not hours", () => {
    // Under a day apart, but on different days; and 2 days 11 hours, which is still 2 days.
    expect(daysMoved([move("2026-11-03T10:00:00", "2026-11-05T21:00:00")])).toBe(2);
    expect(daysMoved([move("2026-11-03T23:00:00", "2026-11-04T01:00:00")])).toBe(1);
  });

  it("says nothing for a same-day move, or with no times saved", () => {
    expect(line(1, [move("2026-11-03T10:00:00", "2026-11-03T15:00:00")])).toBe("");
    expect(line(2, [])).toBe("");
  });

  it("says when moves with no saved times aren't counted", () => {
    expect(line(2, [later(2)])).toBe(
      "Pushed back 2 days in total. 1 other move has no saved times, so it isn't counted.",
    );
    expect(line(4, [later(2)])).toBe(
      "Pushed back 2 days in total. 3 other moves have no saved times, so they aren't counted.",
    );
  });
});
