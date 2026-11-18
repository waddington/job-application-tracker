import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The record layout (RecordLayout, docs/rfc/app-redesign.md §2 Pages) on an application's, a company's, a person's,
// an agency's and a role's page: laid out by the page's own width, so the docked quick view leaves it the room that's left. Three columns on a
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
    role_id: string;
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
      // (An agency's Recruiters heading and its button sit in the column itself, not in a card.)
      const card = (control.closest(".mantine-Card-root") ?? side).getBoundingClientRect();
      if (control.getBoundingClientRect().right > card.right)
        cut.push(`past its card: ${control.outerHTML.slice(0, 80)}`);
    }
    return cut;
  });

/** Nothing in the side column is cut short at 1,100 px (the column at its 320 px floor), 1,440 (378) and 1,920 (420,
 *  beside two main columns). `last` is a button in the side column's last card, there once the page has loaded. */
const sideFits = async (page: Page, path: string, last: string) => {
  await page.goto(path);
  // The text is measured in the page's font, so wait for it rather than measure the fallback.
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1100, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => arrangement(page), { message: `${path} at ${width} px` }).not.toBe("stacked");
    await expect(page.locator("[data-record-part=side]").getByRole("button", { name: last })).toBeVisible();
    await expect.poll(() => cutInSide(page), { message: `${path} at ${width} px` }).toEqual([]);
  }
};

/** Each column's last card ends where the column does (it's as tall as its cards: not stretched to the tallest),
 *  and each card is as wide as its column. Returns the columns that aren't. */
const unevenColumns = (page: Page) =>
  page.locator("[data-record-part]").evaluateAll((columns) =>
    columns.flatMap((column) => {
      const box = column.getBoundingClientRect();
      const cards = [...column.children].map((card) => card.getBoundingClientRect());
      const bad: string[] = [];
      if (Math.abs(cards.at(-1)!.bottom - box.bottom) > 1) bad.push(`${column.dataset.recordPart} stretched`);
      if (cards.some((card) => Math.abs(card.width - box.width) > 1))
        bad.push(`${column.dataset.recordPart} has a card narrower or wider than it`);
      return bad;
    }),
  );

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
    await sideFits(page, `/applications/${app.id}`, "New person");
    await sideFits(page, `/companies/${app.company_id}`, "Add person");
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

/** A person's, an agency's and a role's page on the demo data, and a button in each one's last side card. */
const records = async (request: APIRequestContext) => {
  const named = async (kind: string, name: string) =>
    ((await (await request.get(`/api/v1/${kind}`)).json()) as { id: string; name: string }[]).find(
      (r) => r.name === name,
    )!.id;
  return {
    person: { path: `/people/${await named("contacts", "Alex Morgan")}`, last: "Upload" },
    agency: { path: `/agencies/${await named("agencies", "Northwind Talent")}`, last: "Add recruiter" },
    // Contoso's Senior Backend Engineer, which has an application.
    role: { path: `/roles/${(await firstApp(request)).role_id}`, last: "Upload" },
  };
};

test.describe("a person's, an agency's and a role's page", () => {
  for (const kind of ["person", "agency", "role"] as const) {
    test(`${kind}: three columns on a wide page, beside the side one at mid widths, stacked when narrow`, async ({
      page,
      request,
    }) => {
      const { path } = (await records(request))[kind];
      await page.setViewportSize({ width: 1920, height: 1000 });
      await page.goto(path);
      await expect.poll(() => arrangement(page)).toBe("three");
      const { main, "main-2": second, side } = await parts(page);
      expect(Math.min(main!.width, second!.width)).toBeGreaterThanOrEqual(400);
      expect(side!.width).toBe(420);
      const order = await page
        .locator("[data-record-part]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-record-part")));
      expect(order).toEqual(["main", "main-2", "side"]);
      for (const [width, expected] of [
        [1920, "three"],
        [2560, "three"],
        [1440, "two"],
        [900, "stacked"],
        [375, "stacked"],
      ] as const) {
        await page.setViewportSize({ width, height: 1000 });
        await expect.poll(() => arrangement(page), { message: `at ${width} px` }).toBe(expected);
        // Level tops are in the arrangement; each card fills its column, and no column stretches to the tallest.
        await expect.poll(() => unevenColumns(page), { message: `at ${width} px` }).toEqual([]);
        expect(await noSidewaysScroll(page), `at ${width} px`).toBe(0);
      }
    });

    test(`${kind}: the side cards' buttons and selects fit, down to the narrowest side column`, async ({
      page,
      request,
    }) => {
      const { path, last } = (await records(request))[kind];
      await sideFits(page, path, last);
    });
  }

  test("an agency's page with the quick view open lays out by the room left", async ({ page, request }) => {
    await page.goto((await records(request)).agency.path);
    for (const [width, expected] of [
      [1440, "stacked"],
      [1920, "two"],
      [2560, "three"],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator("[data-panel-opener]").first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Move to…" })).toBeVisible();
      await expect.poll(() => arrangement(page), { message: `at ${width} px` }).toBe(expected);
      await expect.poll(() => unevenColumns(page), { message: `at ${width} px` }).toEqual([]);
      const panelLeft = (await dialog.boundingBox())!.x;
      for (const box of Object.values(await parts(page)))
        expect(box.x + box.width).toBeLessThanOrEqual(panelLeft);
      expect(await noSidewaysScroll(page), `at ${width} px`).toBe(0);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });
});
