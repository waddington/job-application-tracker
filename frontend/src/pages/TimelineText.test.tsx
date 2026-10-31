import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import dayjs from "dayjs";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CATEGORIES, categoryOf, type TimelineItem } from "../api/timelineHooks";
import { i18n } from "../i18n";
import { PSEUDO } from "../i18n/language";
import { ItemContext, TimelinePage, TimelineRow } from "./TimelinePage";

// The Timeline page's text comes from locales/en/timeline.ts (i18n-timeline-page). The before/after
// snapshot sees what the demo data reaches; this pins, by exact text, what it can't: rows for dates
// the demo lacks, plurals with one row, sentences for rows nothing links to, and names with markup.

const ITEM: TimelineItem = {
  id: "x",
  at: "2026-03-05T09:07:00",
  all_day: false,
  category: "stage",
  title: "the API's title",
  detail: null,
  people: [],
  archived: false,
} as unknown as TimelineItem;
const item = (over: Partial<TimelineItem>): TimelineItem => ({ ...ITEM, ...over });

async function wrapped(ui: ReactNode, url = "/") {
  const rootRoute = createRootRoute({ component: () => <Outlet />, notFoundComponent: () => <>{ui}</> });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MantineProvider>
        <RouterProvider router={router} />
      </MantineProvider>
    </QueryClientProvider>,
  );
  await router.load();
}

/** The API's answer for each URL the page asks about; everything else is an empty list. */
function serve(items: TimelineItem[], now = new Date().toISOString()) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: Request | string) => {
      const url = typeof input === "string" ? input : input.url;
      const body = url.includes("/timeline") ? { items, now } : [];
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const CATEGORY_TEXT: [TimelineItem["category"], string, string][] = [
  ["stage", "Stage moves", "Stage"],
  ["message", "Messages", "Message"],
  ["meeting", "Calls and meetings", "Call"],
  ["interview", "Interviews", "Interview"],
  ["offer", "Offers", "Offer"],
  ["role", "Roles pitched or passed", "Role"],
  ["note", "Notes", "Note"],
  ["document", "Documents sent", "Document"],
  ["file", "Files", "File"],
  ["added", "Companies, agencies and people added", "Added"],
  ["other", "Other", "Other"],
];

describe("each kind of thing", () => {
  it.each(CATEGORY_TEXT)("%s reads %s, and %s on one entry", (value, label, one) => {
    const category = categoryOf(value);
    expect(i18n.t(category.label)).toBe(label);
    expect(i18n.t(category.one)).toBe(one);
  });

  it("covers every kind in the list", () => {
    expect(CATEGORY_TEXT.map(([value]) => value)).toEqual(CATEGORIES.map((c) => c.value));
  });
});

describe("a row", () => {
  it("shows the time, or All day", async () => {
    await wrapped(<TimelineRow item={item({})} />);
    expect(await screen.findByText("09:07")).toBeTruthy();
    cleanup();
    await wrapped(<TimelineRow item={item({ all_day: true, at: "2026-03-05" })} />);
    expect(await screen.findByText("All day")).toBeTruthy();
  });

  it("with a date, shows the date and time; an all-day one only the date", async () => {
    await wrapped(<TimelineRow item={item({})} showDate />);
    expect(await screen.findByText("5 Mar 09:07")).toBeTruthy();
    cleanup();
    await wrapped(<TimelineRow item={item({ all_day: true, at: "2026-03-05" })} showDate />);
    expect(await screen.findByText("5 Mar")).toBeTruthy();
  });

  it("words the title itself when it has text for that kind", async () => {
    await wrapped(<TimelineRow item={item({ kind: "company", company_name: "Example Co" })} />);
    expect(await screen.findByText("Added company Example Co")).toBeTruthy();
    expect(screen.queryByText("the API's title")).toBeNull();
  });

  it("words the title again when the language changes", async () => {
    const english = "Added company Example Co";
    await wrapped(<TimelineRow item={item({ kind: "company", company_name: "Example Co" })} />);
    expect(await screen.findByText(english)).toBeTruthy();
    try {
      await act(() => i18n.changeLanguage(PSEUDO));
      await waitFor(() => expect(screen.queryByText(english)).toBeNull());
      expect(screen.getByText(/Example Co/)).toBeTruthy();
    } finally {
      await act(() => i18n.changeLanguage("en"));
    }
    expect(await screen.findByText(english)).toBeTruthy();
  });

  describe.each<{ what: string; over: Partial<TimelineItem>; english: string }>([
    {
      what: "a stage move",
      over: { kind: "stage-event", stage_move: { from_name: "Applied", to_name: "Screen" } },
      english: "Applied → Screen",
    },
    {
      what: "a first stage",
      over: { kind: "stage-event", stage_move: { from_name: null, to_name: "Applied" } },
      english: "Added at Applied",
    },
    {
      what: "a round",
      over: { kind: "interview", round: { round: 2, title: null, kind: "final", status: "done" } },
      english: "Round 2 · Final (done)",
    },
    {
      what: "an offer reply",
      over: { kind: "offer-reply", offer: { per: "year", amount: 85000, currency: "GBP" } },
      english: "Reply due on the offer: £85,000 a year",
    },
    {
      what: "a call",
      over: {
        kind: "meeting",
        call: { kind: "video", title: null, status: "booked", contact_name: "Sam Sample" },
      },
      english: "Video call with Sam Sample (booked)",
    },
    {
      what: "a note",
      over: { kind: "note", note_title: "About Contoso" },
      english: "Note: About Contoso",
    },
    {
      what: "a closed person",
      over: {
        kind: "contact-closed",
        closed_as: "not_interested",
        people: [{ id: "p", name: "Sam Sample" }],
      },
      english: "Sam Sample: not interested",
    },
  ])("for $what", ({ over, english }) => {
    it("words the title again when the language changes", async () => {
      await wrapped(<TimelineRow item={item(over)} />);
      expect(await screen.findByText(english)).toBeTruthy();
      try {
        await act(() => i18n.changeLanguage(PSEUDO));
        await waitFor(() => expect(screen.queryByText(english)).toBeNull());
        expect(screen.queryByText("the API's title")).toBeNull();
      } finally {
        await act(() => i18n.changeLanguage("en"));
      }
      expect(await screen.findByText(english)).toBeTruthy();
    });

    it("shows the API's title from an older server, without the raw field", async () => {
      await wrapped(
        <TimelineRow
          item={item({
            ...over,
            stage_move: undefined,
            round: undefined,
            offer: undefined,
            call: undefined,
            note_title: undefined,
            closed_as: undefined,
          })}
        />,
      );
      expect(await screen.findByText("the API's title")).toBeTruthy();
    });
  });

  it("leaves the API's title and detail as they came", async () => {
    await wrapped(<TimelineRow item={item({ title: "Moved to <Screen>", detail: "{{not}} a value" })} />);
    expect(await screen.findByText("Moved to <Screen>")).toBeTruthy();
    expect(screen.getByText("{{not}} a value")).toBeTruthy();
  });
});

describe("what an entry is about", () => {
  it("says role at company, via agency and Archived, with names as you wrote them", async () => {
    await wrapped(
      <ItemContext
        item={item({
          application_id: "a1",
          role_id: "r1",
          role_title: "Engineer <Backend>",
          company_id: "c1",
          company_name: "Q&A {{Co}}",
          agency_id: "g1",
          agency_name: "Talent <b>Co</b>",
          archived: true,
        })}
      />,
    );
    expect(await screen.findByRole("link", { name: "Engineer <Backend> at Q&A {{Co}}" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "via Talent <b>Co</b>" })).toBeTruthy();
    expect(screen.getByText("Archived")).toBeTruthy();
  });
});

describe("the page", () => {
  it("heads a day Today, Yesterday or Tomorrow, else by its date, with the year if it's another", async () => {
    // Only Date is frozen, so a date's year is sure and the page's own timers still run. The server's
    // "now" is later than all of them, so each counts as past and gets a heading.
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 5, 17, 12) });
    try {
      serve(
        [
          item({ id: "tomorrow", at: "2026-06-18T09:00:00" }),
          item({ id: "today", at: "2026-06-17T09:00:00" }),
          item({ id: "yesterday", at: "2026-06-16T09:00:00" }),
          item({ id: "earlier", at: "2026-03-05T09:00:00" }),
          item({ id: "lastYear", at: "2025-03-05T09:00:00" }),
        ],
        "2026-06-20T09:00:00",
      );
      await wrapped(<TimelinePage />, "/?period=all");
      expect(await screen.findByText("Tomorrow · Thu 18 Jun")).toBeTruthy();
      expect(screen.getByText("Today · Wed 17 Jun")).toBeTruthy();
      expect(screen.getByText("Yesterday · Tue 16 Jun")).toBeTruthy();
      expect(screen.getByText("Thu 5 Mar")).toBeTruthy();
      expect(screen.getByText("Wed 5 Mar 2025")).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it("says what's coming up", async () => {
    serve([item({ id: "soon", at: dayjs().add(3, "day").format("YYYY-MM-DDTHH:mm:ss") })]);
    await wrapped(<TimelinePage />);
    expect(await screen.findByRole("heading", { name: "Coming up" })).toBeTruthy();
  });

  it("gets the empty text right for each state", async () => {
    serve([]);
    await wrapped(<TimelinePage />);
    expect(await screen.findByText("Nothing here yet")).toBeTruthy();
    expect(screen.getByText("Try a longer period, tick more kinds, or clear a filter.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "None" }));
    expect(await screen.findByText("Tick at least one kind of thing to show.")).toBeTruthy();
    cleanup();
    await wrapped(<TimelinePage />, "/?period=all");
    expect(
      await screen.findByText("Add an application, or log a call with someone, and it shows up here."),
    ).toBeTruthy();
  });
});

describe("the lanes", () => {
  it("names a row company · role, and a dot by date, kind and title", async () => {
    serve([
      item({
        id: "d",
        role_id: "r1",
        role_title: "Engineer",
        company_id: "c1",
        company_name: "Example Co",
        category: "meeting",
      }),
    ]);
    await wrapped(<TimelinePage />, "/?view=lanes&period=all");
    expect(await screen.findByRole("link", { name: "Example Co · Engineer" })).toBeTruthy();
    const dot = screen.getByRole("button", { name: "5 Mar 2026 09:07 · Call: the API's title" });
    fireEvent.mouseEnter(dot);
    expect(await screen.findByText("5 Mar 2026 09:07 · the API's title")).toBeTruthy();
  });

  it("words a dot's title itself when it has text for that kind", async () => {
    serve([
      item({
        id: "d",
        kind: "role-added",
        role_id: "r1",
        role_title: "Engineer",
        company_name: "Example Co",
        category: "added",
      }),
    ]);
    await wrapped(<TimelinePage />, "/?view=lanes&period=all");
    const dot = await screen.findByRole("button", {
      name: "5 Mar 2026 09:07 · Added: Added role Engineer at Example Co",
    });
    fireEvent.mouseEnter(dot);
    expect(await screen.findByText("5 Mar 2026 09:07 · Added role Engineer at Example Co")).toBeTruthy();
  });

  it("leaves the time off an all-day dot", async () => {
    serve([
      item({ id: "d", role_id: "r1", role_title: "E", company_name: "C", all_day: true, at: "2026-03-05" }),
    ]);
    await wrapped(<TimelinePage />, "/?view=lanes&period=all");
    expect(await screen.findByRole("button", { name: "5 Mar 2026 · Stage: the API's title" })).toBeTruthy();
  });

  it.each([
    ["Role", "Nothing here is linked to a role."],
    ["Person", "Nothing here is linked to a person."],
    ["Company", "Nothing here is linked to a company."],
    ["Agency", "Nothing here is linked to an agency."],
  ])("by %s, with nothing to show: %s", async (by, sentence) => {
    serve([item({})]);
    await wrapped(<TimelinePage />, "/?view=lanes&period=all");
    fireEvent.click(await screen.findByRole("radio", { name: by }));
    expect(await screen.findByText(sentence)).toBeTruthy();
  });

  it("offers more rows, and back to the 30 most recent", async () => {
    const many = Array.from({ length: 31 }, (_, n) =>
      item({ id: `i${n}`, role_id: `r${n}`, role_title: `R${n}`, company_name: "C" }),
    );
    serve(many);
    await wrapped(<TimelinePage />, "/?view=lanes&period=all");
    fireEvent.click(await screen.findByRole("button", { name: "Show all 31 rows" }));
    expect(await screen.findByRole("button", { name: "Show the 30 most recent" })).toBeTruthy();
  });

  it("has a count's text for one row, even though the page never shows it", () => {
    expect(i18n.t("timeline:lanes.showAll", { count: 1 })).toBe("Show all 1 rows");
    expect(i18n.t("timeline:lanes.showRecent", { count: 1 })).toBe("Show the 1 most recent");
  });
});
