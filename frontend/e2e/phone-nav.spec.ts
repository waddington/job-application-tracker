import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The phone's bottom bar and More sheet (docs/rfc/app-redesign.md §2, Phones).

test.use({ viewport: { width: 375, height: 800 } });

const REST = ["Roles", "Recruiters", "Companies", "Offers", "Documents", "Insights", "Timeline"];
const BAR = "#root nav:has(> button)"; // not the hidden side menu, nor the sheet's (in a portal)
const bar = (page: Page) => page.locator(BAR);
const more = (page: Page) => bar(page).locator("button");
const sheet = (page: Page) => page.getByRole("dialog", { name: "More" });
const barTop = async (page: Page) => (await bar(page).boundingBox())!.y;
const scrollY = (page: Page) => page.evaluate(() => window.scrollY);
const today = async (page: Page) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
};
const openSheet = async (page: Page) => {
  await more(page).click();
  await expect(sheet(page).getByRole("button", { name: "Close" })).toBeFocused();
};
/** Whether a tap in the middle of the bar lands on it. */
const onTop = (page: Page) =>
  bar(page).evaluate((nav) => {
    const { x, y, width, height } = nav.getBoundingClientRect();
    return nav.contains(document.elementFromPoint(x + width / 2, y + height / 2));
  });

test("four tabs and More mark where you are, a record its section", async ({ page, request }) => {
  const [app] = (await (await request.get("/api/v1/applications")).json()) as { id: string }[];
  const [who] = (await (await request.get("/api/v1/contacts")).json()) as { id: string }[];
  await page.goto(`/applications/${app!.id}`);
  await expect(bar(page).getByRole("link")).toHaveText(["Today", "Applications", "Interviews", "Notes"]);
  await expect(bar(page).locator("[aria-current]")).toHaveText(["Applications"]);
  await page.goto(`/people/${who!.id}`);
  await expect(bar(page).locator("[aria-current]")).toHaveText(["More"]);
  await openSheet(page);
  await expect(more(page)).toHaveAttribute("aria-expanded", "true");
  await expect(sheet(page).getByRole("navigation").getByRole("link")).toHaveText(REST);
  await expect(sheet(page).locator('[aria-current="page"]')).toHaveText(["Recruiters"]);
  await page.goto("/notes-old");
  await expect(bar(page).locator("[aria-current]")).toHaveCount(0);
});

for (const at of ["en 320", "en 375", "zh-CN 320", "zh-CN 375"]) {
  test(`targets of 44 px and whole labels: ${at}`, async ({ page }) => {
    const [lang, width] = at.split(" ");
    await page.addInitScript((code) => localStorage.setItem("jat.language", code!), lang);
    await page.setViewportSize({ width: Number(width), height: 800 });
    await page.goto("/");
    await more(page).click();
    const items = page.locator(`${BAR} > *, [role=dialog] nav > *`);
    await expect(items).toHaveCount(5 + REST.length);
    for (const el of await items.all()) {
      const [size, lines, fits] = await el.evaluate((node) => {
        const range = document.createRange();
        range.selectNodeContents(node.lastElementChild!);
        const text = [...range.getClientRects()];
        const { left, right, width, height } = node.getBoundingClientRect();
        const fits =
          left >= 0 && right <= innerWidth && text.every((r) => r.left >= left && r.right <= right);
        return [Math.min(width, height), new Set(text.map((r) => Math.round(r.top))).size, fits] as const;
      });
      expect(size).toBeGreaterThanOrEqual(44);
      expect([lines, fits], (await el.textContent())!).toEqual([1, true]);
    }
  });
}

test("the sheet traps focus, and each way out gives it back to More", async ({ page }) => {
  await today(page);
  await openSheet(page);
  await expect(sheet(page)).toHaveAttribute("aria-modal", "true");
  for (const key of ["Tab", "Shift+Tab"]) {
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press(key);
      expect(await page.evaluate(() => !!document.activeElement?.closest("[role=dialog]"))).toBe(true);
    }
  }
  for (const out of [
    () => page.keyboard.press("Escape"),
    () => page.mouse.click(180, 30), // the backdrop
    () => sheet(page).getByRole("button", { name: "Close" }).click(),
  ]) {
    if (!(await sheet(page).isVisible())) await openSheet(page);
    await out();
    await expect(sheet(page)).toBeHidden();
    await expect(more(page)).toBeFocused();
    await expect(more(page)).toHaveAttribute("aria-expanded", "false");
    await expect(page).toHaveURL(/\/$/);
  }
});

test("choosing a page, or Back, closes it and leaves focus on the page", async ({ page }) => {
  await today(page);
  await openSheet(page);
  await sheet(page).getByRole("link", { name: "Companies" }).click();
  await expect(page).toHaveURL(/\/companies$/);
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator("main")).toBeFocused();
  await openSheet(page);
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator("main")).toBeFocused();
});

test("growing past 768 px takes the sheet, its trap and its scroll lock away", async ({ page }) => {
  await today(page);
  await openSheet(page);
  await page.setViewportSize({ width: 768, height: 500 });
  await expect(sheet(page)).toBeHidden();
  await expect(page.locator("body")).not.toHaveAttribute("data-scroll-locked");
  await page.mouse.move(500, 300);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => scrollY(page)).toBeGreaterThan(0);
  await page.getByRole("textbox", { name: "Search everything" }).focus();
  await page.keyboard.press("Tab"); // nothing pulls it back
  await expect(page.getByRole("button", { name: "How it works" }).first()).toBeFocused();
  await page.setViewportSize({ width: 375, height: 800 });
  await expect(more(page)).toHaveAttribute("aria-expanded", "false");
});

test("the sheet's foot has the connection, the backup and the version", async ({ page }) => {
  await today(page);
  await expect(page.getByTestId("more-alert")).toHaveCount(0);
  await openSheet(page);
  await expect(sheet(page).getByText("Connected")).toBeVisible();
  await expect(sheet(page).getByRole("link", { name: /^v\d+\.\d+\.\d+:/ })).toBeVisible();
  const download = page.waitForEvent("download");
  await sheet(page).getByRole("link", { name: "Download a backup" }).click();
  expect((await download).suggestedFilename()).toMatch(/\.zip$/);
});

for (const [what, status, says] of [
  ["offline", 503, /^API offline/],
  ["an older server", 200, /^The server is v0\.0\.1/],
] as const) {
  test(`More shows there's a problem (${what}) with the sheet closed`, async ({ page, problems }) => {
    if (status === 503) problems.allow(/503.*\/api\/v1\/health/);
    const json = { status: "ok", version: "0.0.1", schema: "1", git_repo: false };
    await page.route("**/api/v1/health", (route) => route.fulfill({ status, json }));
    await today(page);
    await expect(page.getByTestId("more-alert")).toBeVisible({ timeout: 15_000 });
    await expect(more(page)).toHaveAccessibleDescription(says);
    await openSheet(page);
    await expect(sheet(page).getByText(says)).toBeVisible();
  });
}

test("the end of every page, and what's scrolled or focused, stay clear of the bar", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { bottom: 34 } });
  for (const name of ["", "Applications", "Interviews", "Notes", ...REST]) {
    const path = `/${name.toLowerCase()}`;
    await page.goto(path);
    await expect(page.locator("main h2").first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(async () => {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const last = (await page.locator("main > *").first().boundingBox())!;
      expect(last.y + last.height, path).toBeLessThanOrEqual(await barTop(page));
      expect(await onTop(page), path).toBe(true);
    }).toPass({ timeout: 5000 });
  }
  const { y, height } = (await bar(page).boundingBox())!;
  expect(y + height).toBeLessThanOrEqual(800 - 34);

  // On Timeline, the last page: a link scrolled to, then one half under the bar that gets focus.
  await page.evaluate(() => window.scrollTo(0, 0));
  const link = page.locator("main a").nth(12);
  await link.evaluate((el) => el.scrollIntoView({ block: "end" }));
  const bottom = async () => {
    const box = (await link.boundingBox())!;
    return box.y + box.height;
  };
  expect(await bottom()).toBeLessThanOrEqual(y);
  await link.evaluate((el, top) => {
    const box = el.getBoundingClientRect();
    window.scrollBy(0, box.top + box.height / 2 - top);
  }, y);
  expect(await bottom()).toBeGreaterThan(y);
  await link.focus();
  await expect.poll(bottom).toBeLessThanOrEqual(y);
});

test("dialogs, menus, toasts and the full-screen quick view are over the bar", async ({ page }) => {
  await today(page);
  const layer = async (selector: string) =>
    Number(await page.$eval(selector, (el) => getComputedStyle(el).zIndex));
  const level = await layer(BAR);
  expect(await layer(".mantine-Notifications-root")).toBeGreaterThan(level);
  await page.getByRole("button", { name: /^Language/ }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  expect(await layer("[role=menu]")).toBeGreaterThan(level);
  await page.keyboard.press("Escape");

  const inBar = () => bar(page).evaluate((nav) => nav.contains(document.activeElement));
  await page.getByRole("button", { name: "New application" }).first().click();
  const dialog = page.getByRole("dialog", { name: "New application" });
  await expect(dialog).toBeVisible();
  expect(await onTop(page)).toBe(false);
  // No scroll padding under a dialog, or typing low in it scrolls the page behind.
  await expect(page.locator("html")).toHaveCSS("scroll-padding-bottom", "auto");
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Shift+Tab");
    expect(await inBar()).toBe(false);
  }
  await dialog.locator(".mantine-Modal-close").click();
  await expect(dialog).toBeHidden();

  const opener = page.getByLabel("Open Coho Winery").first();
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Application" })).toBeVisible();
  await expect.poll(() => onTop(page)).toBe(false);
  await expect(bar(page)).toHaveJSProperty("inert", true);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
  await expect(bar(page)).toHaveJSProperty("inert", false);
});

test("in a short window it makes way while you type, and not under your press", async ({ page }) => {
  await today(page);
  const box = page.getByLabel("New to-do");
  await box.fill("Pressed under the bar");
  await expect(bar(page)).toBeInViewport(); // a tall window keeps it
  await page.setViewportSize({ width: 375, height: 350 });
  await expect(bar(page)).not.toBeInViewport();
  const add = page.locator("form").filter({ has: box }).getByRole("button", { name: "Add", exact: true });
  await add.evaluate((el) => window.scrollBy(0, el.getBoundingClientRect().top - (350 - 48)));
  const { x, y, width, height } = (await add.boundingBox())!;
  expect(y + height / 2).toBeGreaterThan(350 - 72); // where the bar comes back to
  await page.mouse.click(x + width / 2, y + height / 2, { delay: 120 });
  await expect(page.getByRole("checkbox", { name: "Pressed under the bar" })).toBeAttached();
  await page.getByRole("heading", { name: "Your move" }).click();
  await expect(bar(page)).toBeInViewport();
});

test.describe("the board", () => {
  test.use({ hasTouch: true });

  test("scrolls under a finger, and a mouse drag over the bar", async ({ page, request }) => {
    const app = { role_title: "Bar Drag", route: "direct", stage: "applied", tags: [] };
    for (let n = 0; n < 8; n++) {
      const data = { ...app, company_name: `Bar Drag ${n} Ltd` };
      expect((await request.post("/api/v1/applications/quick", { data })).status()).toBeLessThan(300);
    }
    await page.goto("/applications?view=board");
    await page.getByText("Board", { exact: true }).click();
    const card = page.getByLabel(/^Bar Drag \d Ltd: Bar Drag$/).first();
    await expect(card).toBeVisible();

    const cdp = await page.context().newCDPSession(page);
    type Touch = "touchStart" | "touchMove" | "touchEnd";
    const touch = (type: Touch, ...touchPoints: { x: number; y: number }[]) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
    await touch("touchStart", { x: 30, y: 700 });
    for (let y = 660; y >= 300; y -= 40) await touch("touchMove", { x: 30, y });
    await touch("touchEnd");
    await expect.poll(() => scrollY(page)).toBeGreaterThan(0);

    const said = page.locator("[id^=DndLiveRegion]");
    const lift = async () => {
      await card.scrollIntoViewIfNeeded();
      const { x, y } = (await card.boundingBox())!;
      await page.mouse.move(x + 20, y + 15);
      await page.mouse.down();
      await page.mouse.move(x + 32, y + 25, { steps: 4 });
      return y;
    };
    await page.evaluate(() => window.scrollTo(0, 0));
    await lift();
    const from = await scrollY(page);
    await page.mouse.move(180, (await barTop(page)) + 20, { steps: 10 }); // on the bar itself
    await expect.poll(() => scrollY(page)).toBeGreaterThan(from + 100);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(said).toContainText("Cancelled.");

    const y = await lift();
    await page.mouse.move(365, y + 40, { steps: 10 }); // the right-hand edge
    await expect(said).toContainText("is over Ghosted.", { timeout: 15_000 });
    await page.mouse.up();
    await expect(said).toContainText("dropped on Ghosted.");
  });
});

for (const scheme of ["light", "dark"] as const) {
  test(`readable over anything in ${scheme}, and no slide when motion is reduced`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await today(page);
    const ratios = await bar(page).evaluate((nav) => {
      const ctx = document.createElement("canvas").getContext("2d")!;
      const luminance = (...layers: string[]) => {
        for (const layer of layers) {
          ctx.fillStyle = layer;
          ctx.fillRect(0, 0, 1, 1);
        }
        const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) =>
          v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4,
        );
        return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
      };
      const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
      const glass = getComputedStyle(nav).backgroundColor;
      const pill = getComputedStyle(nav.querySelector("[aria-current] > span")!);
      const text = getComputedStyle(nav.querySelector("button")!).color; // the ring's colour too
      return ["#000", "#fff"].map((behind) => ({
        text: ratio(luminance(text), luminance(behind, glass)),
        pill: ratio(luminance(pill.backgroundColor), luminance(behind, glass)),
        icon: ratio(luminance(pill.color), luminance(pill.backgroundColor)),
      }));
    });
    for (const { text, pill, icon } of ratios) {
      expect(text).toBeGreaterThanOrEqual(4.5);
      expect(Math.min(pill, icon)).toBeGreaterThanOrEqual(3);
    }
    await openSheet(page);
    await expect(sheet(page)).toHaveCSS("transition-duration", "0s");
  });
}
