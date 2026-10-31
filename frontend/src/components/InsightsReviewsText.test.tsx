import { createMemoryHistory } from "@tanstack/react-router";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { App } from "../App";
import { makeRouter } from "../router";
import { mockApi, WORKFLOW } from "../test/mockApi";

// Recruiter conversations' and CV performance's text comes from locales/en/insights.ts
// (i18n-insights-reviews). A before/after snapshot of both tabs showed no change; these pin most
// of the plurals, states and verdicts the demo data can't reach.

const flow = { applications: 0, nodes: [], links: [] };

const tally = (over: Record<string, unknown> = {}) => ({
  calls_held: 0,
  calls_booked: 0,
  pitched: 0,
  applied: 0,
  passed: 0,
  deciding: 0,
  apply_rate: null,
  interviewed: 0,
  in_progress: 0,
  offers: 0,
  closed: 0,
  ghosted: 0,
  median_decide_days: null,
  last_call: null,
  ...over,
});

const conversations = (over: Record<string, unknown> = {}) => ({
  total: tally(),
  people_talked_to: 0,
  people: [],
  agencies: [],
  pass_reasons: [],
  flow,
  ...over,
});

const docTally = (sent: number, interviewed: number, over: Record<string, unknown> = {}) => ({
  sent,
  heard_back: interviewed,
  interviewed,
  offers: 0,
  open: 0,
  ghosted: 0,
  closed: 0,
  median_reply_days: null,
  interview_rate: null,
  interview_low: null,
  interview_high: null,
  ...over,
});

const doc = (id: string, name: string, tallyOf: ReturnType<typeof docTally>, versions: unknown[] = []) => ({
  id,
  name,
  versions,
  ...tallyOf,
});

const performance = (documents: unknown[], over: Record<string, unknown> = {}) => ({
  applications: 2,
  kinds: [{ kind: "cv", documents, none: docTally(0, 0), ...over }],
});

function open(tab: string, routes: Record<string, unknown>) {
  mockApi({
    "/api/v1/workflow": WORKFLOW,
    "/api/v1/health": {},
    "/api/v1/contacts": [],
    "/api/v1/cv-files": [],
    "/api/v1/insights/activity": [],
    "/api/v1/insights/whole-flow": flow,
    "/api/v1/insights/flow": flow,
    "/api/v1/insights/stats": { applications: 0, stages: [], routes: [] },
    ...routes,
  });
  render(<App router={makeRouter(createMemoryHistory({ initialEntries: ["/insights"] }))} />);
  return screen.findByRole("tab", { name: tab }).then((el) => fireEvent.click(el));
}

afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("recruiter conversations", () => {
  const openIt = (data: unknown) =>
    open("Recruiter conversations", { "/api/v1/insights/conversations": data });

  it("says when nothing's been pitched, in whole sentences", async () => {
    await openIt(conversations());
    const none = await screen.findByText(/^No roles pitched in this period\./);
    expect(none).toHaveTextContent(
      "No roles pitched in this period. On someone's page, Add roles from this call for each role they mention.",
    );
    expect(none.querySelector("b")).toHaveTextContent("Add roles from this call");
    expect(
      screen.getByText(
        "No calls or pitched roles in this period. Log a call on someone's page, or add the roles they mention.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("Agencies"));
    expect(await screen.findByText("No one from an agency in this period.")).toBeInTheDocument();
  });

  it("shows a person's marks and where they're from", async () => {
    const person = (id: string, over: Record<string, unknown>) => ({
      id,
      name: `Person ${id}`,
      closed_as: null,
      agency_name: null,
      company_name: null,
      ...tally({ applied: 1, in_progress: 1, offers: 2, closed: 1, ghosted: 1, apply_rate: 0.5 }),
      ...over,
    });
    await openIt(
      conversations({
        total: tally({ calls_booked: 2, apply_rate: 0.25, median_decide_days: 1 }),
        people: [
          person("a", { closed_as: "ghosted" }),
          person("b", { closed_as: "not_interested", agency_name: "Northwind Talent" }),
        ],
      }),
    );
    const a = (await screen.findByText("Person a")).closest("tr")!;
    for (const text of [
      "Ghosted",
      "Independent",
      "1 in progress",
      "2 offer",
      "1 closed",
      "1 ghosted",
      "50%",
    ]) {
      expect(within(a).getByText(text)).toBeInTheDocument();
    }
    const b = screen.getByText("Person b").closest("tr")!;
    expect(within(b).getByText("Not interested")).toBeInTheDocument();
    expect(within(b).getByText("Northwind Talent")).toBeInTheDocument();
    expect(screen.getByText("2 booked ahead")).toBeInTheDocument();
    expect(screen.getByText("25% of roles decided")).toBeInTheDocument();
    expect(screen.getByText("1 day")).toBeInTheDocument();
  });

  it("counts an agency's people", async () => {
    const agency = (id: string, people: number) => ({ id, name: `Agency ${id}`, people, ...tally() });
    await openIt(conversations({ agencies: [agency("a", 1), agency("b", 2)] }));
    fireEvent.click(await screen.findByText("Agencies"));
    expect(await screen.findByText("1 person")).toBeInTheDocument();
    expect(screen.getByText("2 people")).toBeInTheDocument();
  });

  it("says why you passed, with whatever's known", async () => {
    const reason = (id: string, person_name: string | null, decided_on: string | null) => ({
      role_id: id,
      role_title: `Role ${id}`,
      company_name: "Contoso",
      person_name,
      decided_on,
      reason: "Too far",
    });
    await openIt(
      conversations({
        pass_reasons: [
          reason("a", "Alex Morgan", "2026-10-02"),
          reason("b", "Sam Patel", null),
          reason("c", null, "2026-10-03"),
          reason("d", null, null),
        ],
      }),
    );
    expect(await screen.findByText("Contoso · from Alex Morgan · 2 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("Contoso · from Sam Patel")).toBeInTheDocument();
    expect(screen.getByText("Contoso · 3 Oct 2026")).toBeInTheDocument();
    expect(screen.getByText("Contoso")).toBeInTheDocument();
    expect(
      screen.getByText("The reasons you gave for passing on pitched roles, newest first."),
    ).toBeInTheDocument();
  });
});

describe("CVs and cover letters", () => {
  const openIt = (data: unknown, routes: Record<string, unknown> = {}) =>
    open("CVs and cover letters", { "/api/v1/insights/documents": data, ...routes });

  it("says when there's nothing to compare, with its link", async () => {
    await openIt(performance([]));
    const text = await screen.findByText(/^Nothing to compare yet\./);
    expect(text).toHaveTextContent(
      "Nothing to compare yet. Add your CVs on Documents (a new version each time you change one), then on each application say which one you sent (its Documents sent card). They'll be compared here.",
    );
    expect(within(text).getByRole("link", { name: "Documents" })).toHaveAttribute("href", "/documents");
    expect(text.querySelector("i")).toHaveTextContent("Documents sent");
  });

  it("counts applications, and CV files waiting, in the singular and plural", async () => {
    await openIt(performance([]), {
      "/api/v1/cv-files": [{ sha256: "a", version: null, sources: [], applications: [] }],
    });
    expect(await screen.findByText(/^Your 2 sent applications \(by the date/)).toBeInTheDocument();
    expect(
      await screen.findByText(/^1 CV file you've attached isn't a version yet, so it isn't compared here\./),
    ).toHaveTextContent(
      "1 CV file you've attached isn't a version yet, so it isn't compared here. Sort them out on Documents.",
    );
  });

  it("counts one application, and several CV files", async () => {
    const data = { ...performance([]), applications: 1 };
    await openIt(data, {
      "/api/v1/cv-files": ["a", "b"].map((sha256) => ({
        sha256,
        version: null,
        sources: [],
        applications: [],
      })),
    });
    expect(await screen.findByText(/^Your 1 sent application \(by the date/)).toBeInTheDocument();
    expect(
      await screen.findByText(
        /^2 CV files you've attached aren't a version yet, so they aren't compared here\./,
      ),
    ).toHaveTextContent(
      "2 CV files you've attached aren't a version yet, so they aren't compared here. Sort them out on Documents.",
    );
  });

  it("says other documents by their own words", async () => {
    const kind = (name: string) => ({ kind: name, documents: [], none: docTally(0, 0) });
    await openIt({ applications: 0, kinds: [kind("other"), kind("cv")] });
    expect(await screen.findByText("CVs")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Other documents"));
    expect(await screen.findByText("Which document works best")).toBeInTheDocument();
  });

  it("says when there's only one to compare", async () => {
    await openIt(performance([doc("d1", "Backend CV", docTally(3, 1))]));
    expect(
      await screen.findByText(
        "Only one so far: send another version (or record applications without one) to compare.",
      ),
    ).toBeInTheDocument();
  });

  it("names a version under its document, and what's not recorded", async () => {
    const v = (id: string, label: string) => ({ id, label, ...docTally(2, 1) });
    await openIt(
      performance([doc("d1", "Backend · Go", docTally(4, 2), [v("v1", "v2"), v("v2", "v3 · short")])], {
        none: docTally(1, 0),
      }),
    );
    expect(await screen.findByText("v3 · short")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument(); // not "Go · v2"
    expect(screen.getAllByText("No CV recorded").length).toBeGreaterThan(0);
    expect(screen.getByText("Which CV works best")).toBeInTheDocument();
  });

  // The tests in utils/abtest.test.ts decide the verdicts; these pin their words.
  const two = (a: [number, number], b: [number, number]) =>
    performance([doc("d1", "One", docTally(...a)), doc("d2", "Two", docTally(...b))]);

  it("says too few to tell", async () => {
    await openIt(two([3, 1], [2, 0]));
    expect(await screen.findByText("Too few to tell")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Too few to tell yet: send each to at least 5 applications (10 or more is better) before reading anything into it. So far One: 1 of 3 got a screen or interview (33%) and Two: 0 of 2 got a screen or interview (0%).",
      ),
    ).toBeInTheDocument();
  });

  it("says could be chance, with the test's numbers, for each measure", async () => {
    await openIt(two([20, 10], [20, 9]));
    expect(await screen.findByText("Could be chance")).toBeInTheDocument();
    expect(
      screen.getByText(
        "No real difference so far: One: 10 of 20 got a screen or interview (50%) and Two: 9 of 20 got a screen or interview (45%) could easily be chance. Keep sending both, or try a bigger change.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /^Fisher's exact test: p = \d\.\d{3}\. That's how often a gap this big would turn up by chance if both did equally well\.$/,
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Heard back" }));
    expect(await screen.findByText(/One: 10 of 20 heard back \(50%\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Offer" }));
    expect(await screen.findByText(/One: 0 of 20 got an offer \(0%\)/)).toBeInTheDocument();
  });

  it("says likely real, with a tiny p", async () => {
    await openIt(two([30, 28], [30, 2]));
    expect(await screen.findByText("Likely real")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Likely a real difference: One: 28 of 30 got a screen or interview (93%) and Two: 2 of 30 got a screen or interview (7%).",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Fisher's exact test: p = < 0.001. That's how often a gap this big would turn up by chance if both did equally well.",
      ),
    ).toBeInTheDocument();
  });

  it("says a hint", async () => {
    await openIt(two([20, 12], [20, 6]));
    expect(await screen.findByText("A hint")).toBeInTheDocument();
    expect(
      screen.getByText(
        "A hint, not proof yet: One: 12 of 20 got a screen or interview (60%) and Two: 6 of 20 got a screen or interview (30%). Keep sending both and see if it holds.",
      ),
    ).toBeInTheDocument();
  });
});
