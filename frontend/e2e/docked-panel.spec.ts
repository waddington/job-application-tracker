import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The application panel (the quick view) docks beside the page on a tablet or desktop: the page makes room
// rather than going under it, still scrolls and takes clicks, and another row swaps what it shows. On a phone
// it's a full-screen overlay (docs/rfc/app-redesign.md §2, Panels; §8). The board's own tests (board.spec.ts)
// drag with it open.

const CONTOSO = ["Senior Backend Engineer", "Contoso"] as const;
const LITWARE = ["Senior Software Engineer", "Litware"] as const;
const listRow = (page: Page, role: string, company: string) => page.getByLabel(`Open ${role} at ${company}`);
const panel = (page: Page) => page.getByRole("dialog", { name: "Application" });
const panelHeading = (page: Page) => panel(page).getByRole("heading", { name: "Application" });

interface Row {
  role_title: string;
  company_id: string;
  agency_id: string | null;
}
const contoso = async (request: APIRequestContext) => {
  const rows: Row[] = await (await request.get("/api/v1/applications")).json();
  const found = rows.find((r) => r.role_title === CONTOSO[0]);
  if (!found?.agency_id)
    throw new Error("The demo data has changed: Contoso's application through an agency");
  return found;
};

/** Once the panel has slid in, nothing in `covered` runs under it: the page made room. */
const madeRoom = async (page: Page, ...covered: Locator[]) => {
  await expect(async () => {
    const box = await panel(page).boundingBox();
    const viewport = page.viewportSize();
    if (!box || !viewport) throw new Error("No panel");
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width); // it has finished sliding in
    expect(box.x + box.width).toBeGreaterThan(viewport.width - 20);
    for (const item of covered) {
      const other = await item.boundingBox();
      if (!other) throw new Error("Nothing to check");
      expect(other.x + other.width).toBeLessThanOrEqual(box.x);
    }
  }).toPass({ timeout: 5_000 });
};
/** The page's content: what's in <main>, which AppShell pads to make room. */
const content = (page: Page) => page.locator("main > *").first();

test.describe("on the Applications list", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/applications?view=list");
    await expect(listRow(page, ...CONTOSO)).toBeVisible();
  });

  test("it docks beside the list, which makes room, with focus on its heading", async ({ page }) => {
    await listRow(page, ...CONTOSO).click();
    await expect(panel(page).getByRole("heading", { name: CONTOSO[0] })).toBeVisible();
    await expect(panel(page)).toHaveAttribute("aria-modal", "false");
    await expect(panelHeading(page)).toBeFocused();
    // The row's first cell: the table scrolls sideways in its own box when it's wider than the page.
    await madeRoom(
      page,
      content(page),
      listRow(page, ...CONTOSO)
        .locator("td")
        .first(),
    );
  });

  test("another row swaps what it shows; closing gives the room back and focus to the row", async ({
    page,
  }) => {
    await listRow(page, ...CONTOSO).click();
    await expect(panel(page).getByRole("heading", { name: CONTOSO[0] })).toBeVisible();
    await listRow(page, ...LITWARE).click();
    await expect(panel(page).getByRole("heading", { name: LITWARE[0] })).toBeVisible();
    await expect(panel(page).getByRole("heading", { name: CONTOSO[0] })).toBeHidden();
    await expect(panelHeading(page)).toBeFocused();
    await expect(page.getByRole("dialog")).toHaveCount(1);

    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(listRow(page, ...LITWARE)).toBeFocused();
    const viewport = page.viewportSize();
    await expect(async () => {
      const box = await content(page).boundingBox();
      expect(box!.x + box!.width).toBeGreaterThan(viewport!.width - 60); // the page has its width back
    }).toPass();
  });

  test("its close button closes it", async ({ page }) => {
    await listRow(page, ...CONTOSO).click();
    await panel(page).getByRole("button", { name: "Close" }).click();
    await expect(panel(page)).toBeHidden();
    await expect(listRow(page, ...CONTOSO)).toBeFocused();
  });

  test("the page behind still scrolls, and Tab goes on from the panel into the page", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 500 });
    await listRow(page, ...CONTOSO).click();
    await madeRoom(page, content(page));
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(300, 400); // over the list
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    await expect(panel(page)).toBeInViewport();
    // No focus trap: the panel's last control isn't where Tab stops.
    await panel(page).getByRole("link", { name: "Open full page" }).focus();
    for (let i = 0; i < 40; i += 1) await page.keyboard.press("Tab");
    expect(await panel(page).evaluate((p) => p.contains(document.activeElement))).toBe(false);
  });
});

test("on Today it docks beside the page", async ({ page }) => {
  await page.goto("/");
  const opener = page.getByLabel("Open Coho Winery").first();
  await opener.click();
  await expect(panel(page).getByRole("button", { name: "Move to…" })).toBeVisible();
  await madeRoom(page, content(page), opener);
});

test("on a company's page it docks beside the page", async ({ page, request }) => {
  const { company_id } = await contoso(request);
  await page.goto(`/companies/${company_id}`);
  const opener = page.getByRole("row", { name: new RegExp(CONTOSO[0]) });
  await opener.click();
  await expect(panel(page).getByRole("heading", { name: CONTOSO[0] })).toBeVisible();
  await madeRoom(page, content(page), opener);
});

test("on an agency's page it docks beside the page", async ({ page, request }) => {
  const { agency_id } = await contoso(request);
  await page.goto(`/agencies/${agency_id}`);
  const opener = page.getByRole("row", { name: new RegExp(CONTOSO[0]) });
  await opener.click();
  await expect(panel(page).getByRole("heading", { name: CONTOSO[0] })).toBeVisible();
  await madeRoom(page, content(page), opener);
});

test.describe("under reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("neither the panel nor the page slides", async ({ page }) => {
    await page.goto("/applications?view=list");
    await listRow(page, ...CONTOSO).click();
    await expect(panel(page)).toBeVisible();
    const durations = await page.evaluate(() =>
      ["main", "aside"].map((tag) => getComputedStyle(document.querySelector(tag)!).transitionDuration),
    );
    expect(durations).toEqual(["0s", "0s"]);
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("it's a full-screen overlay", async ({ page }) => {
    await page.goto("/");
    // From the keyboard: at this width the tile's stage badge sits over the end of the name's button.
    await page.getByLabel("Open Coho Winery").first().focus();
    await page.keyboard.press("Enter");
    await expect(panel(page).getByRole("button", { name: "Move to…" })).toBeVisible();
    await expect(panel(page)).toHaveAttribute("aria-modal", "true");
    await expect(async () => {
      const box = await panel(page).boundingBox();
      expect(box?.x).toBe(0);
      expect(box?.width).toBe(390);
    }).toPass();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
  });
});
