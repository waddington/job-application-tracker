import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The application panel (the quick view) docks beside the page from 992 px: the page makes room rather than
// going under it, still scrolls and takes clicks, and another row swaps what it shows. Narrower (a phone or a
// small tablet) it's a full-screen overlay (docs/rfc/app-redesign.md §2, Panels; §8). The board's own tests
// (board.spec.ts) drag with it open, and move a card from it.

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
/** Lets timers and transitions that might move focus or close something run. A fixed wait on purpose: it
 * backs "nothing happens later" checks, which have no state to poll for (gotchas.md prefers polling otherwise). */
const settle = (page: Page) => page.evaluate(() => new Promise((done) => setTimeout(done, 400)));
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

  test("the page behind still scrolls, and there's no focus trap", async ({ page }) => {
    await page.setViewportSize({ width: 1400, height: 500 });
    await listRow(page, ...CONTOSO).click();
    await madeRoom(page, content(page));
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.move(300, 400); // over the list
    await page.mouse.wheel(0, 300);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
    await expect(panel(page)).toBeInViewport();
    // The panel follows the page: Shift+Tab from its heading goes back into the page.
    await expect(panelHeading(page)).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("main"))).toBe(true);
  });

  test("after a move made from it with the keyboard, Escape still closes it", async ({ page, request }) => {
    const made = await request.post("/api/v1/applications/quick", {
      data: {
        company_name: "Key Move Ltd",
        role_title: "Key Move",
        route: "direct",
        stage: "applied",
        tags: [],
      },
    });
    expect(made.ok()).toBe(true);
    const { id } = await made.json();
    const stage = async () => (await (await request.get(`/api/v1/applications/${id}`)).json()).stage;
    await page.reload();
    await listRow(page, "Key Move", "Key Move Ltd").focus();
    await page.keyboard.press("Enter");
    await panel(page).getByRole("button", { name: "Move to…" }).focus();
    await page.keyboard.press("Enter");
    const screen = page.getByRole("menuitem", { name: "Screen" });
    await expect(screen).toBeVisible();
    await page.keyboard.press("ArrowDown"); // the first of the usual next stages
    await expect(screen).toBeFocused();
    await page.keyboard.press("Enter");
    await expect.poll(stage).toBe("screen");
    await expect(panel(page).getByText("Applied → Screen")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
  });

  test("its contents keep their state, and focus, when the window crosses 992 px", async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await listRow(page, ...CONTOSO).click();
    const note = panel(page).getByPlaceholder("What happened?");
    await note.fill("Half a thought");
    await expect(note).toBeFocused();
    await page.setViewportSize({ width: 800, height: 900 });
    await expect(panel(page)).toHaveAttribute("aria-modal", "true");
    await expect(note).toHaveValue("Half a thought");
    await settle(page);
    await expect(note).toBeFocused();
    await page.setViewportSize({ width: 1100, height: 900 });
    await expect(panel(page)).toHaveAttribute("aria-modal", "false");
    await expect(note).toHaveValue("Half a thought");
    await settle(page);
    await expect(note).toBeFocused();
  });

  test("Escape in the feedback dialog it opens leaves the panel open", async ({ page, request }) => {
    const made = await request.post("/api/v1/applications/quick", {
      data: {
        company_name: "Escape Ask Ltd",
        role_title: "Escape Ask",
        route: "direct",
        stage: "applied",
        tags: [],
      },
    });
    expect(made.ok()).toBe(true);
    const { id } = await made.json();
    await page.reload();
    await listRow(page, "Escape Ask", "Escape Ask Ltd").click();
    await panel(page).getByRole("button", { name: "Move to…" }).click();
    await page.getByRole("menuitem", { name: "Rejected" }).click();
    const asking = page.getByRole("dialog", { name: "Moving to Rejected: any feedback?" });
    await asking.getByLabel("What did they say?").fill("Not now");
    await expect(asking.getByLabel("What did they say?")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(asking).toBeHidden();
    await settle(page);
    await expect(panel(page).getByRole("heading", { name: "Escape Ask" })).toBeVisible();
    const app = await (await request.get(`/api/v1/applications/${id}`)).json();
    expect(app.stage).toBe("applied");
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

for (const [what, width] of [
  ["a phone", 390],
  ["a small tablet", 800],
] as const) {
  test.describe(`on ${what}`, () => {
    test.use({ viewport: { width, height: 844 } });

    test("it's a full-screen overlay, and focus comes back to the opener", async ({ page }) => {
      await page.goto("/");
      // From the keyboard: on a phone the tile's stage badge sits over the end of the name's button.
      const opener = page.getByLabel("Open Coho Winery").first();
      await opener.focus();
      await page.keyboard.press("Enter");
      await expect(panel(page).getByRole("button", { name: "Move to…" })).toBeVisible();
      await expect(panel(page)).toHaveAttribute("aria-modal", "true");
      await expect(panelHeading(page)).toBeFocused();
      await expect(async () => {
        const box = await panel(page).boundingBox();
        expect(box?.x).toBe(0);
        expect(box?.width).toBe(width);
      }).toPass();
      await page.keyboard.press("Escape");
      await expect(panel(page)).toBeHidden();
      await expect(opener).toBeFocused();
    });
  });
}
