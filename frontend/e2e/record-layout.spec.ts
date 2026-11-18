import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The record layout (RecordLayout, docs/rfc/app-redesign.md §2 Pages) on an application's and a company's page:
// laid out by the page's own width, so the docked quick view leaves it the room that's left. Three columns on a
// wide page (two main, one side), the main cards beside the side ones at mid widths, stacked when narrow.

type Box = { x: number; y: number; width: number; height: number };
type Parts = Partial<Record<"summary" | "main" | "main-2" | "side", Box>>;

const parts = (page: Page): Promise<Parts> =>
  page.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll<HTMLElement>("[data-record-part]")].map((el) => {
        const { x, y, width, height } = el.getBoundingClientRect();
        return [el.dataset.recordPart, { x, y, width, height }];
      }),
    ),
  );

/** "three" (main | main-2 | side, tops level), "two" (main above main-2, side beside), "stacked", or the boxes. */
const arrangement = async (page: Page) => {
  const { main, "main-2": second, side } = await parts(page);
  if (!main || !second || !side) return "loading";
  if (main.y === second.y && second.y === side.y && main.x < second.x && second.x < side.x) return "three";
  if (main.y === side.y && second.x === main.x && second.y > main.y && side.x > main.x) return "two";
  if (main.x === second.x && second.x === side.x && main.y < second.y && second.y < side.y) return "stacked";
  return JSON.stringify({ main, second, side });
};

const firstApp = async (request: APIRequestContext) => {
  const apps = (await (await request.get("/api/v1/applications")).json()) as {
    id: string;
    company_id: string;
    company_name: string;
    role_title: string;
  }[];
  return apps.find((a) => a.company_name === "Contoso" && a.role_title === "Senior Backend Engineer")!;
};

const noSidewaysScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("an application's page", () => {
  test("three columns on a wide page, under the summary, no column stretched to the tallest", async ({
    page,
    request,
  }) => {
    const app = await firstApp(request);
    await page.setViewportSize({ width: 1920, height: 1000 });
    await page.goto(`/applications/${app.id}`);
    await expect.poll(() => arrangement(page)).toBe("three");
    const { summary, main, "main-2": second, side } = await parts(page);
    // The summary spans all three, above them.
    expect(summary!.x).toBe(main!.x);
    expect(summary!.x + summary!.width).toBeCloseTo(side!.x + side!.width, 0);
    expect(summary!.y + summary!.height).toBeLessThanOrEqual(main!.y);
    // The main columns are wide enough to read, the side one about 420 px.
    expect(Math.min(main!.width, second!.width)).toBeGreaterThanOrEqual(400);
    expect(side!.width).toBe(420);
    // Each card fills its column's width, and no column stretches to the tallest: the side one ends well above the main ones.
    const cards = await page
      .locator("[data-record-part=main] > *, [data-record-part=main-2] > *, [data-record-part=side] > *")
      .evaluateAll((els) =>
        els.map((el) => el.getBoundingClientRect().width - el.parentElement!.getBoundingClientRect().width),
      );
    expect(cards.every((d) => Math.abs(d) < 1)).toBe(true);
    expect(side!.height).toBeLessThan(main!.height - 200);
    // Tab goes summary, then the main cards, then the side ones: the DOM order is the reading order.
    const order = await page
      .locator("[data-record-part]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-record-part")));
    expect(order).toEqual(["summary", "main", "main-2", "side"]);
  });

  test("the main cards beside the side ones at mid widths, the summary still on top", async ({
    page,
    request,
  }) => {
    const app = await firstApp(request);
    await page.setViewportSize({ width: 1440, height: 1000 }); // about 1,150 px of page
    await page.goto(`/applications/${app.id}`);
    await expect.poll(() => arrangement(page)).toBe("two");
    const { summary, main, side } = await parts(page);
    expect(summary!.y + summary!.height).toBeLessThanOrEqual(main!.y);
    expect(side!.width).toBeGreaterThanOrEqual(320);
  });

  test("stacked on a narrow page, and nothing scrolls sideways on a phone", async ({ page, request }) => {
    const app = await firstApp(request);
    await page.setViewportSize({ width: 900, height: 1000 });
    await page.goto(`/applications/${app.id}`);
    await expect.poll(() => arrangement(page)).toBe("stacked");
    await page.setViewportSize({ width: 375, height: 800 });
    await expect.poll(() => arrangement(page)).toBe("stacked");
    expect(await noSidewaysScroll(page)).toBe(0);
  });
});

test.describe("a company's page", () => {
  test("three columns on a wide page; nothing scrolls sideways at 2,560 px or on a phone", async ({
    page,
    request,
  }) => {
    const app = await firstApp(request);
    await page.setViewportSize({ width: 2560, height: 1000 });
    await page.goto(`/companies/${app.company_id}`);
    await expect.poll(() => arrangement(page)).toBe("three");
    expect(await noSidewaysScroll(page)).toBe(0);
    await page.setViewportSize({ width: 375, height: 800 });
    await expect.poll(() => arrangement(page)).toBe("stacked");
    expect(await noSidewaysScroll(page)).toBe(0);
  });

  test("with the quick view open, the columns lay out by the room left", async ({ page, request }) => {
    const app = await firstApp(request);
    await page.goto(`/companies/${app.company_id}`);
    for (const [width, expected] of [
      [1440, "stacked"], // the page has about 610 px beside the menu and the panel
      [1920, "two"],
      [2560, "three"],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator("[data-panel-opener]").first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Move to…" })).toBeVisible();
      await expect.poll(() => arrangement(page), { message: `at ${width} px` }).toBe(expected);
      // The page made room: no column runs under the panel.
      const panelLeft = (await dialog.boundingBox())!.x;
      for (const box of Object.values(await parts(page)))
        expect(box.x + box.width).toBeLessThanOrEqual(panelLeft);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });
});
