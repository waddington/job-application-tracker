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

/** The side column's buttons and selects whose text is cut short, or that run past their card's edge. */
const cutInSide = (page: Page) =>
  page.locator("[data-record-part=side]").evaluate((side) => {
    const cut: string[] = [];
    const canvas = document.createElement("canvas").getContext("2d")!;
    for (const label of side.querySelectorAll<HTMLElement>(".mantine-Button-label"))
      if (label.scrollWidth > label.clientWidth + 0.5) cut.push(`button "${label.textContent}"`);
    for (const input of side.querySelectorAll<HTMLInputElement>(".mantine-Select-input")) {
      const style = getComputedStyle(input);
      canvas.font = style.font;
      const text = input.value || input.placeholder;
      const room = input.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      if (canvas.measureText(text).width > room) cut.push(`select "${text}"`);
    }
    for (const control of side.querySelectorAll<HTMLElement>("button, input")) {
      const card = control.closest(".mantine-Card-root")!.getBoundingClientRect();
      if (control.getBoundingClientRect().right > card.right)
        cut.push(`past its card: ${control.outerHTML.slice(0, 80)}`);
    }
    return cut;
  });

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
    // (The seed, scripts/seed_demo.py, gives this application four rounds and a timeline, so its main columns are
    // much the taller; a seed with far fewer would need a new margin here.)
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

  test("the side cards' buttons and selects fit, down to the narrowest side column", async ({
    page,
    request,
  }) => {
    const app = await firstApp(request);
    // The application's to-dos, role and people; the company's to-dos, roles and people.
    for (const [path, last] of [
      [`/applications/${app.id}`, "New person"],
      [`/companies/${app.company_id}`, "Add person"],
    ] as const) {
      await page.goto(path);
      // The text is measured in the page's font, so wait for it rather than measure the fallback.
      await page.evaluate(() => document.fonts.ready);
      // 1,100 px: the side column at its 320 px floor; 1,440 px: 378 px; 1,920 px: 420 px beside two main columns.
      for (const width of [1100, 1440, 1920]) {
        await page.setViewportSize({ width, height: 1000 });
        await expect.poll(() => arrangement(page), { message: `${path} at ${width} px` }).not.toBe("stacked");
        await expect(page.getByRole("button", { name: last })).toBeVisible();
        await expect.poll(() => cutInSide(page), { message: `${path} at ${width} px` }).toEqual([]);
      }
    }
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
