import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The Roles, Recruiters and Companies lists (docs/rfc/app-redesign.md §4 row 10): on soft cards across the page's
// width, the recruiters' tiles a column for about every 280 px of it, and nothing wider than a phone's screen
// (a table or a row of views scrolls sideways inside its own space, never the page).

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

/** The page's own width: its outer wrapper, the first thing in <main>. */
const pageWidth = async (page: Page) => (await page.locator("main > *").first().boundingBox())!.width;

const companiesCard = (page: Page) =>
  page.locator(".mantine-Card-root").filter({ has: page.getByRole("columnheader", { name: "Company" }) });

/** How many recruiter tiles sit in the first row. */
const tilesInFirstRow = (page: Page) =>
  page.evaluate(() => {
    const tops = [
      ...document.querySelectorAll<HTMLElement>("main .mantine-SimpleGrid-root > .mantine-Card-root"),
    ].map((e) => Math.round(e.getBoundingClientRect().top));
    return tops.filter((top) => top === tops[0]).length;
  });

/** The view a SegmentedControl has picked: its checked radio's label. */
const picked = (page: Page) =>
  page
    .locator(".mantine-SegmentedControl-root input:checked")
    .evaluate((e) => (e as HTMLInputElement).labels?.[0]?.textContent ?? "");

/**
 * Where the views' last option ends once every box around it that you can scroll sideways (overflow auto or scroll)
 * is scrolled to its end, as a swipe would. A box that clips (overflow hidden) can only be scrolled by a script, so it
 * doesn't count: Playwright's own scroll-into-view would reach the option through one, where a finger can't.
 */
const lastViewEnds = (page: Page) =>
  page.locator(".mantine-SegmentedControl-root").evaluate((root) => {
    for (let e = root.parentElement; e; e = e.parentElement)
      if (["auto", "scroll"].includes(getComputedStyle(e).overflowX)) e.scrollLeft = e.scrollWidth;
    return [...root.querySelectorAll("label")].at(-1)!.getBoundingClientRect().right;
  });

test.describe("wide screens", () => {
  for (const width of [1440, 2560]) {
    test(`at ${width} px the Companies table is on a card the page's width`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/companies");
      await expect(page.getByRole("row", { name: /Contoso/ })).toBeVisible();
      const card = (await companiesCard(page).boundingBox())!;
      expect(Math.abs(card.width - (await pageWidth(page)))).toBeLessThanOrEqual(1);
      const table = (await companiesCard(page).locator("table").boundingBox())!;
      expect(card.width - table.width).toBeLessThanOrEqual(40); // only the card's padding around it
    });

    test(`at ${width} px the Roles list is on a card the page's width`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto("/roles");
      const card = page.locator(".mantine-Card-root").filter({ hasText: "Senior Frontend Engineer" }).last();
      await expect(card).toBeVisible();
      expect(Math.abs((await card.boundingBox())!.width - (await pageWidth(page)))).toBeLessThanOrEqual(1);
    });
  }

  test("the recruiters' tiles take more columns as the page widens, up to six", async ({ page, request }) => {
    // Seven or more people, so the first row can fill at every width.
    for (const n of [1, 2, 3, 4, 5])
      await request.post("/api/v1/contacts", { data: { name: `Tile Person ${n}` } });
    await page.goto("/recruiters");
    await expect(page.getByRole("link", { name: "Tile Person 5", exact: true })).toBeVisible();
    for (const [width, columns] of [
      [375, 1],
      [1440, 4],
      [1920, 5],
      [2560, 6],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await expect.poll(() => tilesInFirstRow(page), { message: `at ${width} px` }).toBe(columns);
    }
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("Companies: the table scrolls sideways inside its card, not the page", async ({ page }) => {
    await page.goto("/companies");
    await expect(page.getByRole("row", { name: /Contoso/ })).toBeVisible();
    await expect.poll(() => sideways(page)).toBeLessThanOrEqual(1);
    const card = (await companiesCard(page).boundingBox())!;
    expect(card.x + card.width).toBeLessThanOrEqual(375);
    const viewport = companiesCard(page).locator(".mantine-ScrollArea-viewport");
    expect(await viewport.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeGreaterThan(0);
    await viewport.evaluate((e) => (e.scrollLeft = e.scrollWidth));
    await expect(page.getByRole("columnheader", { name: "Website" })).toBeInViewport();
  });

  test("Roles: the views scroll in their own row, and the last can be picked", async ({ page }) => {
    await page.goto("/roles");
    await expect(page.getByText("Senior Frontend Engineer")).toBeVisible();
    await expect.poll(() => sideways(page)).toBeLessThanOrEqual(1);
    expect(await lastViewEnds(page)).toBeLessThanOrEqual(375);
    await page.locator(".mantine-SegmentedControl-root").getByText("All", { exact: true }).click();
    await expect.poll(() => picked(page)).toBe("All");
    expect(await sideways(page)).toBeLessThanOrEqual(1);
  });

  test.describe("in Chinese", () => {
    test.use({ locale: "zh-CN" });

    test("Recruiters: the views scroll in their own row, and the last can be picked", async ({ page }) => {
      await page.goto("/recruiters");
      await expect(page.getByRole("link", { name: "Alex Morgan", exact: true })).toBeVisible();
      await expect.poll(() => sideways(page)).toBeLessThanOrEqual(1);
      // Seven views are wider than the screen in Chinese; a swipe along their row brings the last fully into view.
      expect(await lastViewEnds(page)).toBeLessThanOrEqual(375);
      const last = page.locator(".mantine-SegmentedControl-root label").last();
      const name = (await last.textContent())!;
      await last.click();
      await expect.poll(() => picked(page)).toBe(name);
    });
  });
});
