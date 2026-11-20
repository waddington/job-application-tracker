import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Offers and the Timeline in the new look (docs/rfc/app-redesign.md §4 row 11): on a phone, nothing wider than the
// screen. Offers' comparison table and the Timeline's lanes scroll sideways inside their own card, never the page.
// The demo data has two offers and a few months of history.

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("Offers: the comparison table scrolls sideways inside its card, not the page", async ({ page }) => {
    await page.goto("/offers");
    const card = page.locator(".mantine-Card-root").filter({ has: page.getByRole("table") });
    await expect(card.getByRole("rowheader", { name: "Worth a year" })).toBeVisible();
    await expect.poll(() => sideways(page)).toBeLessThanOrEqual(1);
    const box = (await card.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    const viewport = card.locator(".mantine-ScrollArea-viewport");
    expect(await viewport.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeGreaterThan(0);
    // It fades at the end while there's more, and the last offer can be scrolled to.
    await expect(card.locator(".mantine-ScrollArea-root")).toHaveAttribute("data-more-end");
    await viewport.evaluate((e) => (e.scrollLeft = e.scrollWidth));
    await expect(card.getByRole("columnheader").last()).toBeInViewport();
    await expect(card.locator(".mantine-ScrollArea-root")).not.toHaveAttribute("data-more-end");
  });

  for (const view of ["list", "lanes"]) {
    test(`the Timeline's ${view} doesn't scroll the page sideways`, async ({ page }) => {
      await page.goto(`/timeline?view=${view}&period=all`);
      await expect(page.locator(".mantine-Card-root").first()).toBeVisible();
      await expect(page.locator("[data-testid=query-loading]")).toHaveCount(0);
      await expect.poll(() => sideways(page)).toBeLessThanOrEqual(1);
      if (view === "lanes") {
        // The lanes scroll in their card instead.
        const viewport = page.locator(".mantine-Card-root .mantine-ScrollArea-viewport").first();
        expect(await viewport.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeGreaterThan(0);
      }
    });
  }
});

test("on a wide screen the Timeline's lanes fit their card, the last dot not cut or faded", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await page.goto("/timeline?view=lanes&period=all");
  const scroller = page.locator(".mantine-Card-root .mantine-ScrollArea-root").first();
  await expect(scroller.getByRole("list").first()).toBeVisible();
  await expect
    .poll(() =>
      scroller.locator(".mantine-ScrollArea-viewport").evaluate((e) => e.scrollWidth - e.clientWidth),
    )
    .toBeLessThanOrEqual(0);
  await expect(scroller).not.toHaveAttribute("data-more-end");
});
