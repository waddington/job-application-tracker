import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// What rescheduling adds to Insights and a round: real moves through the dialog, then what the
// pages say. Tests share this file's data, so they compare with numbers read just before.

interface Stats {
  booked_rounds: number;
  moved_rounds: number;
  moves: number;
  by_me: number;
  by_them: number;
  by_mutual: number;
  by_neither: number;
  not_recorded: number;
}

const API = "/api/v1";
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const statsNow = async (request: APIRequestContext) =>
  (await (await request.get(`${API}/insights/rescheduling`)).json()) as Stats;

/** The 10th of next month, so days either side are in the picker's month, whatever today is. */
const tenthNextMonth = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 10, 12)).toISOString();
};
const anApplication = (request: APIRequestContext, company: string, extra: object = {}) =>
  post<{ id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: "Tested Role",
    route: "direct",
    tags: [],
    ...extra,
  });
const aRound = (request: APIRequestContext, appId: string, title: string) =>
  post<{ id: string; round: number }>(request, `applications/${appId}/interviews`, {
    title,
    starts_at: tenthNextMonth(),
  });

/** Through the real dialog: moves the round by `days` in the picker's month, saying who. */
const reschedule = async (page: Page, label: string, days: number, who: string) => {
  await page.getByRole("button", { name: `Reschedule ${label}` }).click();
  const dialog = page.locator(".mantine-Modal-content");
  await dialog.getByText(`Reschedule ${label}`).click(); // also waits for it to stop moving
  await dialog.getByLabel("New time", { exact: true }).first().click();
  const shown = page.locator('[class*="DateTimePicker-day"]:not([data-outside])');
  await expect(shown.and(page.locator("[data-selected]"))).toBeVisible();
  const selected = await shown.evaluateAll((all) => all.findIndex((d) => d.hasAttribute("data-selected")));
  await shown.nth(selected + days).click();
  await page.locator('[class*="DateTimePicker-submitButton"]').click();
  await dialog
    .getByLabel(/^Who needed the change\?/)
    .first()
    .click();
  await page.getByRole("option", { name: who, exact: true }).click();
  await dialog.getByRole("button", { name: "Reschedule", exact: true }).click();
  await expect(dialog).toBeHidden();
};

const theBlock = async (page: Page) => {
  await page.goto("/insights");
  await page.getByRole("tab", { name: "Applications", exact: true }).click();
  return page
    .locator(".mantine-Card-root")
    .filter({ has: page.getByRole("heading", { name: "Rescheduling", exact: true }) });
};
const whoCell = (block: Locator, who: string) =>
  block
    .getByRole("table", { name: "Who needed the change" })
    .getByRole("row", { name: who })
    .locator("td")
    .nth(1);
const listRow = (block: Locator, list: string, name: string) =>
  block.getByRole("table", { name: list }).getByRole("row", { name });
const roundCard = (page: Page, label: string) =>
  page
    .locator(".mantine-Card-root")
    .filter({ has: page.getByRole("button", { name: `Reschedule ${label}` }) })
    .last(); // the round's own card, inside the Interviews card

test.describe("the Rescheduling block", () => {
  test("shows the demo data's moves", async ({ page }) => {
    const block = await theBlock(page);
    await expect(block.getByText(/^Of \d+ booked rounds, \d+ moved\./)).toBeVisible();
    await expect(listRow(block, "Company", "Wide World Importers")).toBeVisible();
    await expect(listRow(block, "Recruiter", "Sam Patel")).toBeVisible();
    await expect(block.getByText(/^Not recorded means the app doesn't know who/)).toBeVisible();
    await expect(block.getByText(/%/)).toHaveCount(0);
  });

  test("counts real reschedules, telling rounds from moves", async ({ page, request }) => {
    const app = await anApplication(request, "Counted Co");
    const first = await aRound(request, app.id, "Counted one");
    const second = await aRound(request, app.id, "Counted two");
    const before = await statsNow(request);

    await page.goto(`/applications/${app.id}`);
    await reschedule(page, `Round ${first.round} · Counted one`, 2, "Them");
    await reschedule(page, `Round ${first.round} · Counted one`, 1, "Me");
    await reschedule(page, `Round ${second.round} · Counted two`, 1, "Both of us");

    const block = await theBlock(page);
    const booked = before.booked_rounds;
    await expect(
      block.getByText(`Of ${booked} booked rounds, ${before.moved_rounds + 2} moved.`),
    ).toContainText(`That's ${before.moves + 3} moves in all`);
    await expect(whoCell(block, "Them")).toHaveText(String(before.by_them + 1));
    await expect(whoCell(block, "Me")).toHaveText(String(before.by_me + 1));
    await expect(whoCell(block, "Both of us")).toHaveText(String(before.by_mutual + 1));
    await expect(whoCell(block, "Neither of us")).toHaveText(String(before.by_neither));
    await expect(whoCell(block, "Not recorded")).toHaveText(String(before.not_recorded));
  });

  test("puts a move with no who under not recorded", async ({ page, request }) => {
    const app = await anApplication(request, "Unrecorded Co");
    const round = await aRound(request, app.id, "No who");
    const before = await statsNow(request);
    // As the round's Edit form saves it: a new time, and nothing about who.
    const moved = await request.patch(`${API}/interviews/${round.id}`, {
      data: { starts_at: new Date(Date.parse(tenthNextMonth()) + 86_400_000).toISOString() },
    });
    expect(moved.ok()).toBe(true);

    const block = await theBlock(page);
    await expect(whoCell(block, "Not recorded")).toHaveText(String(before.not_recorded + 1));
    await expect(whoCell(block, "Them")).toHaveText(String(before.by_them));
    await expect(block.getByText(/^Not recorded means the app doesn't know who/)).toBeVisible();
  });

  test("lists a company and a recruiter only from the third moved round", async ({ page, request }) => {
    const app = await anApplication(request, "Threshold Co", {
      route: "agency",
      agency_name: "Threshold Agency",
      recruiter_name: "Thea Threshold",
    });
    const titles = ["Listed one", "Listed two", "Listed three"];
    const rounds = [];
    for (const title of titles) rounds.push(await aRound(request, app.id, title));
    const before = await statsNow(request);

    await page.goto(`/applications/${app.id}`);
    await reschedule(page, `Round ${rounds[0]?.round} · Listed one`, 1, "Them");
    await reschedule(page, `Round ${rounds[0]?.round} · Listed one`, 1, "Them");
    await reschedule(page, `Round ${rounds[1]?.round} · Listed two`, 1, "Them");

    // Two moved rounds, three moves: still not listed, in either list.
    let block = await theBlock(page);
    await expect(whoCell(block, "Them")).toHaveText(String(before.by_them + 3));
    await expect(listRow(block, "Company", "Wide World Importers")).toBeVisible();
    await expect(block.getByRole("row", { name: "Threshold Co" })).toHaveCount(0);
    await expect(block.getByRole("row", { name: "Thea Threshold" })).toHaveCount(0);

    await page.goto(`/applications/${app.id}`);
    await reschedule(page, `Round ${rounds[2]?.round} · Listed three`, 1, "Me");

    block = await theBlock(page);
    await expect(listRow(block, "Company", "Threshold Co").locator("td")).toHaveText([
      "Threshold Co",
      "3",
      "4",
    ]);
    await expect(listRow(block, "Recruiter", "Thea Threshold").locator("td")).toHaveText([
      "Thea Threshold",
      "3",
      "4",
    ]);
    await expect(
      block.getByText(/^Only companies and recruiters with at least 3 moved rounds/),
    ).toBeVisible();
  });

  // Everything here was added just now, so real numbers can't differ by period. This proves the page
  // asks for the period and shows that answer; tests/test_reschedule_insights.py proves the filter.
  test("a date range shows the numbers for that period", async ({ page, request }) => {
    const all = await statsNow(request);
    const inPeriod = { ...all, by_neither: all.by_neither + 41 };
    await page.route("**/insights/rescheduling?*since=*", (route) => route.fulfill({ json: inPeriod }));

    const block = await theBlock(page);
    await expect(whoCell(block, "Neither of us")).toHaveText(String(all.by_neither));
    await page.locator('[aria-label="Date range"]').getByText("Last 30 days", { exact: true }).click();
    await expect(whoCell(block, "Neither of us")).toHaveText(String(inPeriod.by_neither));
    await page.locator('[aria-label="Date range"]').getByText("All time", { exact: true }).click();
    await expect(whoCell(block, "Neither of us")).toHaveText(String(all.by_neither));
  });
});

test.describe("a round's days moved", () => {
  test("adds up the moves and doesn't call moving earlier pushed back", async ({ page, request }) => {
    const app = await anApplication(request, "Days Co");
    const round = await aRound(request, app.id, "Days");
    const label = `Round ${round.round} · Days`;
    await page.goto(`/applications/${app.id}`);
    const card = roundCard(page, label);
    await expect(card.getByText(/in total\./)).toHaveCount(0);

    await reschedule(page, label, 3, "Them");
    await expect(card.getByText("Pushed back 3 days in total.")).toBeVisible();
    await reschedule(page, label, -2, "Me");
    await expect(card.getByText("Pushed back 1 day in total.")).toBeVisible();
    await reschedule(page, label, -1, "Me");
    await expect(card.getByText(/in total\./)).toHaveCount(0); // back on its first day
    await reschedule(page, label, -2, "Both of us");
    await expect(card.getByText("Brought forward 2 days in total.")).toBeVisible();

    await page.reload();
    await expect(card.getByText("Brought forward 2 days in total.")).toBeVisible();
  });
});
