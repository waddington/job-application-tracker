import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The Interviews calendar: a month of dots (the first view) or a year of small months, the chosen
// day's rounds in a panel beside with their actions, and a phone's layout. The browser's clock is
// frozen on Wednesday 12 June 2030, and each test books its own rounds that week, so nothing depends
// on when it runs.

const API = "/api/v1";
const NOW = new Date(2030, 5, 12, 10, 0);
const TODAY = "2030-06-12";
const LATER = "2030-06-20";
/** A local time on a day, as the API takes it. */
const at = (day: string, hours: number) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d, hours, 0).toISOString();
};

/** An application with a round today at 15:00 and another on the 20th at 11:00. */
const twoRounds = async (request: APIRequestContext, company: string) => {
  const app = await request.post(`${API}/applications/quick`, {
    data: { company_name: company, role_title: "Calendar Role", route: "direct", tags: [] },
  });
  expect(app.ok()).toBe(true);
  const { id } = (await app.json()) as { id: string };
  for (const [round, title, starts_at] of [
    [1, "First chat", at(TODAY, 15)],
    [2, "Second chat", at(LATER, 11)],
  ] as const) {
    const made = await request.post(`${API}/applications/${id}/interviews`, {
      data: { round, title, starts_at, format: "video" },
    });
    expect(made.ok()).toBe(true);
  }
  return { appId: id, first: "Round 1 · First chat", second: "Round 2 · Second chat" };
};

/** An application with a round that has no time yet, so Still to book shows. */
const unbookedRound = async (request: APIRequestContext, company: string) => {
  const app = await request.post(`${API}/applications/quick`, {
    data: { company_name: company, role_title: "Unbooked Role", route: "direct", tags: [] },
  });
  expect(app.ok()).toBe(true);
  const { id } = (await app.json()) as { id: string };
  const made = await request.post(`${API}/applications/${id}/interviews`, {
    data: { round: 1, title: "Time to agree", format: "video" },
  });
  expect(made.ok()).toBe(true);
};

const openCalendar = async (page: Page) => {
  await page.clock.setFixedTime(NOW);
  await page.goto("/interviews");
  await expect(page.getByRole("button", { name: /^(Previous month|Previous year)$/ })).toBeVisible();
};
const panelOf = (page: Page) => page.getByRole("region", { name: "Rounds on the chosen day" });
const dot = (page: Page, day: string) => page.locator(`button[data-day="${day}"]`);

test("the month is the first view; choosing a day lists its rounds, with their actions", async ({
  page,
  request,
}) => {
  const { appId, first, second } = await twoRounds(request, "Calendar Panel Co");
  await openCalendar(page);
  await expect(page.getByRole("heading", { level: 3 })).toHaveText("June 2030");

  // Today has a round, so the panel starts there; its dot says so in words.
  const panel = panelOf(page);
  await expect(panel.getByRole("heading", { name: "Wednesday 12 June" })).toBeVisible();
  await expect(dot(page, TODAY)).toHaveAttribute("aria-label", /^Wednesday 12 June, today: /);
  const ours = panel.locator("[data-round]").filter({ hasText: "Calendar Panel Co" });
  await expect(ours.getByText(first)).toBeVisible();

  // Choosing the 20th switches the panel to it.
  await dot(page, LATER).click();
  await expect(panel.getByRole("heading", { name: "Thursday 20 June" })).toBeFocused();
  await expect(ours.getByText(second)).toBeVisible();
  await expect(ours.getByText(first)).toBeHidden();
  await expect(ours.getByRole("link", { name: "Open the application" })).toHaveAttribute(
    "href",
    `/applications/${appId}`,
  );

  // The round's own actions, as on the list.
  await ours.getByRole("button", { name: `Reschedule ${second}` }).click();
  const dialog = page.locator(".mantine-Modal-content");
  await expect(dialog.getByText(`Reschedule ${second}`)).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();

  // The list is a click away, and stays chosen.
  await page.getByText("List", { exact: true }).click();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
});

test("Year shows twelve months and the year's figures; choosing a day fills the panel; Today comes back", async ({
  page,
  request,
}) => {
  const { second } = await twoRounds(request, "Calendar Year Co");
  await openCalendar(page);
  await page.getByText("Year", { exact: true }).click();
  const heading = page.getByRole("heading", { level: 3 });
  await expect(heading).toHaveText("2030");
  await expect(page.locator("section[aria-label$=' 2030']:not([aria-label^='Summary'])")).toHaveCount(12);
  await expect(
    page.getByRole("region", { name: "Summary for 2030" }).locator('[data-stat="comingUp"]'),
  ).toBeVisible();

  const panel = panelOf(page);
  await dot(page, LATER).click();
  await expect(panel.getByRole("heading", { name: "Thursday 20 June" })).toBeVisible();
  await expect(
    panel.locator("[data-round]").filter({ hasText: "Calendar Year Co" }).getByText(second),
  ).toBeVisible();

  await page.getByRole("button", { name: "Next year" }).click();
  await expect(heading).toHaveText("2031");
  await expect(dot(page, TODAY)).toHaveCount(0);
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(heading).toHaveText("2030");
  await expect(panel.getByRole("heading", { name: "Wednesday 12 June" })).toBeVisible();

  // Remembered.
  await page.reload();
  await expect(page.getByRole("button", { name: "Previous year" })).toBeVisible();
});

test("each day's number sits just above its own dot, however wide the screen", async ({ page, request }) => {
  await twoRounds(request, "Calendar Number Co");
  // Something to book, so from 1,920 px the calendar shares the page with it.
  await unbookedRound(request, "Calendar Number Unbooked Co");
  for (const width of [3800, 2560, 2048, 1920, 1440, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    await openCalendar(page);
    await expect(dot(page, LATER)).toBeVisible();
    // A day's cell holds its number, then its dot (a small one, or a button with rounds).
    const cells = await page
      .locator("section[aria-label='June 2030'] span:has(> span + *)")
      .evaluateAll((els) =>
        els.map((cell) => {
          const [num, mark] = [cell.children[0]!, cell.children[1]!].map((e) => e.getBoundingClientRect());
          return {
            day: cell.children[0]!.textContent,
            apart: Math.abs(num!.left + num!.width / 2 - (mark!.left + mark!.width / 2)),
            above: num!.bottom <= mark!.top + 1,
          };
        }),
      );
    expect(cells).toHaveLength(30);
    for (const c of cells) expect(c, `day ${c.day} at ${width} px`).toMatchObject({ above: true });
    for (const c of cells) expect(c.apart, `day ${c.day} at ${width} px`).toBeLessThan(3);
  }
});

/** Where a box is, rounded: left, top, width. */
const box = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).first().boundingBox())!;
  return { left: Math.round(b.x), top: Math.round(b.y), width: Math.round(b.width) };
};
const calendarCard =
  "main .mantine-Card-root:has(button[aria-label='Previous month'], button[aria-label='Previous year'])";
const toBookCard = "[data-testid=to-book]";

test("on a wide page Still to book sits beside the calendar, level with it; narrower, under it", async ({
  page,
  request,
}) => {
  await unbookedRound(request, "Calendar Beside Co");
  await openCalendar(page);
  for (const [width, beside] of [
    [1440, false],
    [1920, true],
    [2560, true],
    [3800, true],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(page.locator(toBookCard).getByText("Calendar Beside Co")).toBeVisible();
    await expect
      .poll(
        async () => {
          const [cal, book] = [await box(page, calendarCard), await box(page, toBookCard)];
          return beside
            ? book.top === cal.top && book.left >= cal.left + cal.width && book.width >= 720
            : book.left === cal.left && book.top > cal.top && book.width === cal.width;
        },
        { message: `at ${width} px` },
      )
      .toBe(true);
    // Beside or under, nothing pushes the page sideways.
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  // A year's small months, beside it too, each keep room for their days.
  await page.getByText("Year", { exact: true }).click();
  for (const width of [1440, 1920, 2560, 3800]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(
        () =>
          page
            .locator("section[aria-label$=' 2030']:not([aria-label^='Summary'])")
            .evaluateAll((els) => Math.min(...els.map((e) => e.getBoundingClientRect().width))),
        { message: `at ${width} px` },
      )
      .toBeGreaterThanOrEqual(200);
  }
});

test("on a wide page the list's cards sit side by side: what's ahead, and everything earlier", async ({
  page,
  request,
}) => {
  await twoRounds(request, "Calendar List Co");
  await page.clock.setFixedTime(NOW);
  await page.goto("/interviews?view=list");
  const card = (name: string) =>
    page.locator(".mantine-Card-root").filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(card("Coming up").getByText("Calendar List Co").first()).toBeVisible();
  for (const [width, beside] of [
    [1440, false],
    [1920, true],
    [2560, true],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(
        async () => {
          const ahead = (await card("Coming up").boundingBox())!;
          const earlier = (await card("Earlier and cancelled").boundingBox())!;
          return beside
            ? Math.round(ahead.y) === Math.round(earlier.y) && earlier.x >= ahead.x + ahead.width
            : Math.round(ahead.x) === Math.round(earlier.x) && earlier.y > ahead.y;
        },
        { message: `at ${width} px` },
      )
      .toBe(true);
  }
});

test("on a phone nothing scrolls sideways; the panel is under the month and above the year", async ({
  page,
  request,
}) => {
  const { second } = await twoRounds(request, "Calendar Phone Co");
  await unbookedRound(request, "Calendar Phone Unbooked Co"); // Still to book's table scrolls in its card
  await page.setViewportSize({ width: 375, height: 760 });
  for (const view of ["Month", "Year"]) {
    await openCalendar(page);
    await page.getByText(view, { exact: true }).click();
    await dot(page, LATER).click();
    await expect(
      panelOf(page).locator("[data-round]").filter({ hasText: "Calendar Phone Co" }).getByText(second),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const panelTop = (await panelOf(page).boundingBox())!.y;
    const juneTop = (await page.locator("section[aria-label='June 2030']").boundingBox())!.y;
    if (view === "Month") expect(panelTop).toBeGreaterThan(juneTop);
    else expect(panelTop).toBeLessThan(juneTop);
  }
});
