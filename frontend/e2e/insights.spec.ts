import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Insights: every tab, the Sankey charts against what the API says, filters, hovering, what shows
// when something can't load, and that it keeps up with changes made elsewhere. Tests add to the
// same data, so they compare with the API or with a number read just before.

interface FlowNode {
  id: string;
  name: string;
  reached: number;
  current: number;
  kind: string;
}
interface Flow {
  applications: number;
  nodes: FlowNode[];
  links: { source: string; target: string; value: number }[];
}
interface Stats {
  applications: number;
  stages: { id: string; name: string; reached: number }[];
  routes: { route: string; applications: number }[];
}

const API = "/api/v1";
const getJson = async <T>(request: APIRequestContext, path: string) =>
  (await (await request.get(`${API}/${path}`)).json()) as T;
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const quick = (request: APIRequestContext, company: string, role: string, extra: object = {}) =>
  post<{ id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: role,
    route: "direct",
    tags: [],
    ...extra,
  });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const theDialog = (page: Page) => page.locator(".mantine-Modal-content");
const openInsights = async (page: Page) => {
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "Insights", level: 2 })).toBeVisible();
};
const tab = async (page: Page, name: string) => {
  await page.getByRole("tab", { name, exact: true }).click();
  await expect(page.getByRole("tab", { name, exact: true })).toHaveAttribute("aria-selected", "true");
};
const chart = (page: Page) => page.getByRole("img", { name: /^Sankey diagram of/ });
const card = (page: Page, title: string) =>
  page
    .locator(".mantine-Card-root")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) })
    .first();
const range = (page: Page, name: string) =>
  page.locator('[aria-label="Date range"]').getByText(name, { exact: true }).click();
const pickRoute = async (page: Page, within: Locator, name: string) => {
  await within.getByLabel("Route", { exact: true }).first().click();
  await page.getByRole("option", { name, exact: true }).click();
};
/** Fails one Insights request. */
const refuse = async (page: Page, path: string) => {
  await page.route(new RegExp(`/insights/${path}(\\?|$)`), (route) =>
    route.fulfill({ status: 500, json: { detail: "Failed for the test" } }),
  );
};

test.describe("the whole picture", () => {
  test("opens first, and its chart agrees with the API", async ({ page, request }) => {
    const flow = await getJson<Flow>(request, "insights/whole-flow");
    expect(flow.links.length).toBeGreaterThan(0);
    await openInsights(page);
    await expect(page.getByRole("tab", { name: "The whole picture" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(chart(page)).toHaveAttribute(
      "aria-label",
      new RegExp(`^Sankey diagram of ${plural(flow.applications, "role")},`),
    );
    await expect(chart(page).locator("path")).toHaveCount(flow.links.length);
    await expect(chart(page).locator("rect")).toHaveCount(flow.nodes.length);
    await expect(
      card(page, "The whole picture").getByText(`${plural(flow.applications, "role")} by the date`),
    ).toBeVisible();
    for (const node of flow.nodes) {
      await expect(
        chart(page)
          .locator("rect title")
          .filter({ hasText: new RegExp(`^${node.name}: `) }),
      ).toHaveText(`${node.name}: ${plural(node.reached, "role")}`);
    }
  });

  test("a new role is counted, whether deciding or passed on", async ({ page, request }) => {
    const before = (await getJson<Flow>(request, "insights/whole-flow")).applications;
    const at = await post<{ id: string }>(request, "companies", { name: "Whole Picture Co" });
    await post(request, "roles", { company_id: at.id, title: "Whole Picture Role" });
    await post(request, "roles", {
      company_id: at.id,
      title: "Whole Picture Passed",
      decision: "passed",
      decision_reason: "Made up reason",
    });
    await openInsights(page);
    await expect(chart(page)).toHaveAttribute(
      "aria-label",
      new RegExp(`^Sankey diagram of ${plural(before + 2, "role")},`),
    );
  });

  test("if it can't load, it says so", async ({ page, problems }) => {
    problems.allow(/500.*\/insights\/whole-flow/);
    await refuse(page, "whole-flow");
    await openInsights(page);
    await expect(page.getByText("Couldn't load the whole picture.")).toBeVisible({ timeout: 20_000 });
  });

  test("with nothing to show, it says what to do", async ({ page }) => {
    await page.route(/\/insights\/whole-flow/, (route) =>
      route.fulfill({ json: { applications: 0, nodes: [], links: [] } }),
    );
    await openInsights(page);
    await expect(
      page.getByText("Nothing here yet: add a role or an application and it shows up."),
    ).toBeVisible();
    await expect(chart(page)).toBeHidden();
  });
});

test.describe("the Sankey chart", () => {
  const openFlow = async (page: Page) => {
    await openInsights(page);
    await tab(page, "Applications");
    await expect(chart(page)).toBeVisible();
  };

  test("hovering a stage or a flow gives its numbers, and they go away again", async ({ page, request }) => {
    const flow = await getJson<Flow>(request, "insights/flow");
    await openFlow(page);
    const idle = page.getByText("Hover over a stage or a flow to see its numbers.");
    await expect(idle).toBeVisible();
    const stage = flow.nodes.find((n) => n.reached > 0);
    const index = await chart(page)
      .locator("rect title")
      .evaluateAll((all, name) => all.findIndex((t) => t.textContent?.startsWith(`${name}: `)), stage?.name);
    await chart(page).locator("rect").nth(index).hover({ force: true });
    await expect(idle).toBeHidden();
    await expect(
      page.locator("p", { hasText: new RegExp(`^${stage?.name}: ${stage?.reached} application`) }),
    ).toBeVisible();
    await page.getByRole("heading", { name: "Insights", level: 2 }).hover();
    await expect(idle).toBeVisible();
  });

  test("a flow's title gives its share, and hovering it shows that", async ({ page, request }) => {
    const flow = await getJson<Flow>(request, "insights/flow");
    await openFlow(page);
    const [link] = flow.links;
    const from = flow.nodes.find((n) => n.id === link?.source);
    const to = flow.nodes.find((n) => n.id === link?.target);
    const share = Math.round((100 * (link?.value ?? 0)) / (from?.reached ?? 1));
    const words = `${from?.name} → ${to?.name}: ${plural(link?.value ?? 0, "application")} (${share}% of ${from?.name})`;
    const path = chart(page)
      .locator("path")
      .filter({ has: page.locator("title", { hasText: `${from?.name} → ${to?.name}: ` }) });
    await expect(path.locator("title")).toHaveText(words);
    await path.dispatchEvent("mouseover");
    await expect(page.locator("p", { hasText: words })).toBeVisible();
  });

  test("on a phone it scrolls by itself, and the page doesn't", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await openFlow(page);
    await expect(page.getByRole("heading", { name: "Stage by stage" })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      )
      .toBeLessThanOrEqual(1);
    const box = await chart(page).boundingBox();
    expect(box?.width).toBeGreaterThan(390);
  });
});

test.describe("Applications", () => {
  test("the count and tables agree with the API", async ({ page, request }) => {
    const flow = await getJson<Flow>(request, "insights/flow");
    const stats = await getJson<Stats>(request, "insights/stats");
    await openInsights(page);
    await tab(page, "Applications");
    await expect(
      page.getByText(new RegExp(`^${plural(flow.applications, "application")} by the date`)),
    ).toBeVisible();
    const stages = card(page, "Stage by stage");
    for (const stage of stats.stages.filter((s) => s.reached > 0)) {
      await expect(
        stages.getByRole("row").filter({ hasText: stage.name }).getByRole("cell").nth(1),
      ).toHaveText(String(stage.reached));
    }
    const routes = card(page, "Direct vs recruiter");
    for (const route of stats.routes) {
      const name =
        { direct: "Direct", agency: "Via an agency", referral: "Referral" }[route.route] ?? route.route;
      await expect(routes.getByRole("row").filter({ hasText: name }).getByRole("cell").nth(1)).toHaveText(
        String(route.applications),
      );
    }
  });

  test("a route filter narrows the chart, and goes back", async ({ page, request }) => {
    const all = await getJson<Flow>(request, "insights/flow");
    const agency = await getJson<Flow>(request, "insights/flow?route=agency");
    expect(agency.applications).toBeLessThan(all.applications);
    await openInsights(page);
    await tab(page, "Applications");
    const flowCard = card(page, "Where applications go");
    const says = (n: number) => flowCard.getByText(new RegExp(`^${plural(n, "application")} by the date`));
    await expect(says(all.applications)).toBeVisible();
    await pickRoute(page, flowCard, "Via an agency");
    await expect(says(agency.applications)).toBeVisible();
    await expect(chart(page).locator("path")).toHaveCount(agency.links.length);
    await pickRoute(page, flowCard, "Any route");
    await expect(says(all.applications)).toBeVisible();
  });

  test("a date range is asked of every tab, and what comes back is shown", async ({ page, request }) => {
    const all = await getJson<Flow>(request, "insights/flow");
    const asked: string[] = [];
    page.on("request", (r) => {
      const url = new URL(r.url());
      if (url.pathname.includes("/insights/") && url.searchParams.has("since"))
        asked.push(url.pathname.split("/").pop() ?? "");
    });
    // Seeded applications are all recent, so the answer for a shorter range is made up.
    await page.route(/\/insights\/flow\?.*since=/, (route) =>
      route.fulfill({ json: { applications: 777, nodes: [], links: [] } }),
    );
    await openInsights(page);
    await tab(page, "Applications");
    const flowCard = card(page, "Where applications go");
    await expect(
      flowCard.getByText(new RegExp(`^${plural(all.applications, "application")} by the date`)),
    ).toBeVisible();
    await range(page, "Last 30 days");
    await expect(flowCard.getByText(/^777 applications by the date/)).toBeVisible();
    await tab(page, "The whole picture");
    await tab(page, "Recruiter conversations");
    await tab(page, "CVs and cover letters");
    await expect
      .poll(() => asked)
      .toEqual(
        expect.arrayContaining(["flow", "stats", "scorecard", "whole-flow", "conversations", "documents"]),
      );
    await range(page, "All time");
    await tab(page, "Applications");
    await expect(
      flowCard.getByText(new RegExp(`^${plural(all.applications, "application")} by the date`)),
    ).toBeVisible();
  });

  test("nothing matching says so; nothing moved yet says so", async ({ page }) => {
    await page.route(/\/insights\/flow/, (route) =>
      route.fulfill({ json: { applications: 0, nodes: [], links: [] } }),
    );
    await openInsights(page);
    await tab(page, "Applications");
    await expect(page.getByText("No applications match these filters.")).toBeVisible();
    await page.unroute(/\/insights\/flow/);
    await page.route(/\/insights\/flow/, (route) =>
      route.fulfill({ json: { applications: 2, nodes: [], links: [] } }),
    );
    await pickRoute(page, card(page, "Where applications go"), "Direct");
    await expect(page.getByText("No application has moved on from its first stage yet.")).toBeVisible();
  });

  test("if the flow or stats can't load, it says which", async ({ page, problems }) => {
    problems.allow(/500.*\/insights\/(flow|stats)/);
    await refuse(page, "flow");
    await refuse(page, "stats");
    await openInsights(page);
    await tab(page, "Applications");
    await expect(page.getByText("Couldn't load the flow.")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Couldn't load the stats.")).toBeVisible({ timeout: 20_000 });
  });

  test("a new application counts, without a reload", async ({ page, request }) => {
    // The clock stands still, so only a refresh can bring the new number.
    await page.clock.setFixedTime(new Date());
    const before = (await getJson<Flow>(request, "insights/flow")).applications;
    await openInsights(page);
    await tab(page, "Applications");
    await expect(page.getByText(new RegExp(`^${plural(before, "application")} by the date`))).toBeVisible();
    await page.getByRole("button", { name: "New application" }).first().click();
    const dialog = theDialog(page);
    await dialog.getByLabel("Company").fill("Counted Now Co");
    await dialog.getByLabel("Role", { exact: true }).fill("Counted Now Role");
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Counted Now Role" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Insights", exact: true })
      .click();
    await tab(page, "Applications");
    // KNOWN BUG (fix-insights-stale-after-new-application on the roadmap): expected to fail until it is fixed.
    test.fail();
    await expect(
      page.getByText(new RegExp(`^${plural(before + 1, "application")} by the date`)),
    ).toBeVisible();
  });
});

test.describe("the scorecard", () => {
  test("by recruiter and by agency, with what they sent", async ({ page, request }) => {
    const firm = await post<{ id: string }>(request, "agencies", { name: "Scored Agency" });
    const who = await post<{ id: string }>(request, "contacts", {
      name: "Scored Recruiter",
      agency_id: firm.id,
    });
    await quick(request, "Scored Client One", "Scored Role One", {
      route: "agency",
      agency_id: firm.id,
      recruiter_id: who.id,
    });
    await quick(request, "Scored Client Two", "Scored Role Two", {
      route: "agency",
      agency_id: firm.id,
      recruiter_id: who.id,
    });
    await openInsights(page);
    await tab(page, "Applications");
    const score = card(page, "Recruiter scorecard");
    const person = score.getByRole("row").filter({ hasText: "Scored Recruiter" });
    await expect(person.getByRole("cell").nth(1)).toHaveText("2");
    await expect(person.getByRole("cell").nth(2)).toHaveText(/^0\b/);
    await expect(person.getByText("2 active")).toBeVisible();
    await expect(person.getByRole("link", { name: "Scored Agency" })).toHaveAttribute(
      "href",
      `/agencies/${firm.id}`,
    );
    await score.getByText("Agencies", { exact: true }).click();
    const agency = score.getByRole("row").filter({ hasText: "Scored Agency" });
    await expect(agency.getByRole("link", { name: "Scored Agency" })).toBeVisible();
    await expect(agency.getByRole("cell").nth(1)).toHaveText("2");
    await expect(score.getByRole("columnheader", { name: "Agency" })).toBeVisible();
  });

  test("with no one, it says so; if it can't load, it says that", async ({ page, problems }) => {
    problems.allow(/500.*\/insights\/scorecard/);
    await page.route(/\/insights\/scorecard/, (route) =>
      route.fulfill({ json: { recruiters: [], agencies: [] } }),
    );
    await openInsights(page);
    await tab(page, "Applications");
    await expect(page.getByText("No roles from recruiters in this period.")).toBeVisible();
    await card(page, "Recruiter scorecard").getByText("Agencies", { exact: true }).click();
    await expect(page.getByText("No roles from agencies in this period.")).toBeVisible();
    await page.unroute(/\/insights\/scorecard/);
    await refuse(page, "scorecard");
    await page.reload();
    await tab(page, "Applications");
    await expect(page.getByText("Couldn't load the scorecard.")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("Recruiter conversations", () => {
  test("the numbers, the person's row, why you passed and the chart agree with the API", async ({
    page,
    request,
  }) => {
    const who = await post<{ id: string }>(request, "contacts", { name: "Talked To Person" });
    const call = await post<{ id: string }>(request, "meetings", {
      contact_id: who.id,
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
      status: "done",
    });
    const at = await post<{ id: string }>(request, "companies", { name: "Pitched Co" });
    await post(request, "roles", {
      company_id: at.id,
      title: "Pitched And Passed",
      contact_id: who.id,
      meeting_id: call.id,
      decision: "passed",
      decision_reason: "Too far to travel",
    });
    await post(request, "roles", { company_id: at.id, title: "Pitched Still Open", contact_id: who.id });
    const data = await getJson<{
      total: { calls_held: number; pitched: number; applied: number; passed: number; deciding: number };
      people_talked_to: number;
      flow: Flow;
      people: {
        id: string;
        name: string;
        calls_held: number;
        pitched: number;
        passed: number;
        deciding: number;
      }[];
    }>(request, "insights/conversations");
    expect(data.people.find((p) => p.id === who.id)).toMatchObject({
      calls_held: 1,
      pitched: 2,
      passed: 1,
      deciding: 1,
    });
    await openInsights(page);
    await tab(page, "Recruiter conversations");
    await expect(page.getByText("Calls held", { exact: true }).first()).toBeVisible();
    const statValue = (label: string) =>
      page.getByText(label, { exact: true }).first().locator("xpath=following-sibling::*[1]");
    await expect(statValue("Roles pitched")).toHaveText(String(data.total.pitched));
    await expect(statValue("Passed")).toHaveText(String(data.total.passed));
    await expect(statValue("Still deciding")).toHaveText(String(data.total.deciding));
    const people = card(page, "Who you talk to");
    const row = people.getByRole("row").filter({ has: page.getByRole("link", { name: "Talked To Person" }) });
    await expect(row).toBeVisible();
    const reasons = card(page, "Why you passed");
    await expect(reasons.getByRole("link", { name: "Pitched And Passed" })).toBeVisible();
    await expect(reasons.getByText(/Too far to travel/)).toBeVisible();
    await expect(chart(page).locator("path")).toHaveCount(data.flow.links.length);
    await expect(chart(page).locator("rect")).toHaveCount(data.flow.nodes.length);
  });

  test("by people and by agency", async ({ page, request }) => {
    const firm = await post<{ id: string }>(request, "agencies", { name: "Talking Agency" });
    const who = await post<{ id: string }>(request, "contacts", {
      name: "Talking Recruiter",
      agency_id: firm.id,
    });
    await post(request, "meetings", {
      contact_id: who.id,
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
      status: "done",
    });
    await openInsights(page);
    await tab(page, "Recruiter conversations");
    const people = card(page, "Who you talk to");
    await expect(people.getByRole("link", { name: "Talking Recruiter" })).toBeVisible();
    await people.locator('[aria-label="Conversations by"]').getByText("Agencies", { exact: true }).click();
    await expect(people.getByText("Talking Agency")).toBeVisible();
    await expect(people.getByRole("link", { name: "Talking Recruiter" })).toBeHidden();
  });

  test("if it can't load, it says so", async ({ page, problems }) => {
    problems.allow(/500.*\/insights\/conversations/);
    await refuse(page, "conversations");
    await openInsights(page);
    await tab(page, "Recruiter conversations");
    await expect(page.getByText("Couldn't load recruiter conversations.")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("CVs and cover letters", () => {
  test("shows which works best, kind by kind, with the API's numbers", async ({ page, request }) => {
    const data = await getJson<{ kinds: { kind: string; documents: { name: string; sent: number }[] }[] }>(
      request,
      "insights/documents",
    );
    expect(data.kinds.map((k) => k.kind)).toEqual(["cv", "cover_letter"]);
    await openInsights(page);
    await tab(page, "CVs and cover letters");
    await expect(page.getByRole("heading", { name: "Which CV works best" })).toBeVisible();
    await expect(page.getByRole("table").first()).toContainText("Backend CV");
    await page
      .locator('[aria-label="Kind of document"]')
      .getByText(/^Cover letter/)
      .click();
    await expect(page.getByRole("heading", { name: "Which cover letter works best" })).toBeVisible();
    await expect(page.getByRole("table").first()).toContainText("Short cover letter");
  });

  test("comparing two gives a verdict; the measure and who's compared change it", async ({ page }) => {
    await openInsights(page);
    await tab(page, "CVs and cover letters");
    const verdict = page.locator(".mantine-Alert-root").filter({
      has: page.locator(".mantine-Alert-title", {
        hasText: /Too few to tell|Could be chance|A hint|Likely real/,
      }),
    });
    await expect(page.getByLabel("Compare", { exact: true }).first()).toBeVisible();
    await page.locator('[aria-label="Measure"]').getByText("Heard back", { exact: true }).click();
    await expect(verdict).toContainText("heard back");
    await page.locator('[aria-label="Measure"]').getByText("Offer", { exact: true }).click();
    await expect(verdict).toContainText("got an offer");
    await expect(verdict).toContainText(/\d+ of \d+ got an offer/);
    const withBox = page.getByLabel("With", { exact: true }).first();
    const current = await withBox.inputValue();
    const compared = await page.getByLabel("Compare", { exact: true }).first().inputValue();
    await withBox.click();
    const another = page
      .getByRole("option")
      .filter({ hasNotText: current })
      .filter({ hasNotText: compared })
      .and(page.locator(":not([data-combobox-disabled])"))
      .first();
    const name = (await another.innerText()).trim();
    await another.click();
    await expect(verdict).toContainText(name);
  });

  test("a route narrows the sent applications", async ({ page, request }) => {
    const all = await getJson<{ applications: number }>(request, "insights/documents");
    const agency = await getJson<{ applications: number }>(request, "insights/documents?route=agency");
    expect(agency.applications).toBeLessThan(all.applications);
    await openInsights(page);
    await tab(page, "CVs and cover letters");
    const section = card(page, "Which CV works best");
    await expect(section.getByText(new RegExp(`Your ${all.applications} sent application`))).toBeVisible();
    await pickRoute(page, section, "Via an agency");
    await expect(section.getByText(new RegExp(`Your ${agency.applications} sent application`))).toBeVisible();
  });

  test("if it can't load, it says so", async ({ page, problems }) => {
    problems.allow(/500.*\/insights\/documents/);
    await refuse(page, "documents");
    await openInsights(page);
    await tab(page, "CVs and cover letters");
    await expect(page.getByText("Couldn't load how your CVs are doing.")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("weekly activity", () => {
  test("shows twelve weeks on every tab", async ({ page }) => {
    await openInsights(page);
    const weeks = page.getByRole("list", { name: "Weekly activity" }).getByRole("listitem");
    await expect(weeks).toHaveCount(12);
    await tab(page, "Recruiter conversations");
    await expect(weeks).toHaveCount(12);
  });

  test("something added this week counts, in this week", async ({ page, request }) => {
    await openInsights(page);
    const weeks = page.getByRole("list", { name: "Weekly activity" }).getByRole("listitem");
    await expect(weeks).toHaveCount(12);
    const label = (await weeks.last().getAttribute("aria-label")) ?? "";
    const before = Number(/(\d+) added/.exec(label)?.[1]);
    await quick(request, "This Week Co", "This Week Role");
    await page.reload();
    await expect(weeks.last()).toHaveAttribute("aria-label", new RegExp(`\\b${before + 1} added`));
  });

  // KNOWN BUG (fix-weekly-activity-no-error on the roadmap): expected to fail until it is fixed.
  test.fail("if it can't load, it says so rather than spinning", async ({ page, problems }) => {
    problems.allow(/500.*\/insights\/activity/);
    await refuse(page, "activity");
    await openInsights(page);
    const weekly = card(page, "Weekly activity");
    await expect(weekly.getByText(/Couldn't load/)).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("seen on other pages", () => {
  test("a new name for an agency or a recruiter shows on the scorecard", async ({ page, request }) => {
    const firm = await post<{ id: string }>(request, "agencies", { name: "Renamed Score Agency" });
    const who = await post<{ id: string }>(request, "contacts", {
      name: "Before Score Person",
      agency_id: firm.id,
    });
    await quick(request, "Renamed Score Client", "Renamed Score Role", {
      route: "agency",
      agency_id: firm.id,
      recruiter_id: who.id,
    });
    await request.patch(`${API}/agencies/${firm.id}`, { data: { name: "After Score Agency" } });
    await request.patch(`${API}/contacts/${who.id}`, { data: { name: "After Score Person" } });
    await openInsights(page);
    await tab(page, "Applications");
    const score = card(page, "Recruiter scorecard");
    await expect(score.getByText("After Score Person")).toBeVisible();
    await expect(score.getByText("Before Score Person")).toBeHidden();
    await score.getByText("Agencies", { exact: true }).click();
    await expect(score.getByRole("link", { name: "After Score Agency" })).toBeVisible();
    await expect(score.getByRole("link", { name: "Renamed Score Agency" })).toBeHidden();
  });

  test("a deleted agency leaves the scorecard", async ({ page, request }) => {
    const firm = await post<{ id: string }>(request, "agencies", { name: "Gone Score Agency" });
    await quick(request, "Gone Score Client", "Gone Score Role", { route: "agency", agency_id: firm.id });
    await request.delete(`${API}/agencies/${firm.id}`);
    await openInsights(page);
    await tab(page, "Applications");
    const score = card(page, "Recruiter scorecard");
    await score.getByText("Agencies", { exact: true }).click();
    await expect(score.getByRole("row").nth(1)).toBeVisible();
    await expect(score.getByRole("link", { name: "Gone Score Agency" })).toBeHidden();
  });
});
