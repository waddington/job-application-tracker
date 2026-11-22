import type { Locator } from "@playwright/test";

import { expect, test } from "./fixtures";

// The dark-mode and contrast pass (docs/rfc/app-redesign.md §8): what only computed styles show, as it's Mantine's
// own CSS the theme has to beat. The colours themselves are checked over the tokens (src/contrast.test.ts).

/** An element's text colour, faded as it is, against the background of the nearest `around`. */
const reads = (el: Locator, around: string) =>
  el.evaluate((e, selector) => {
    const ctx = document.createElement("canvas").getContext("2d")!;
    const paint = (color: string, alpha = 1) => {
      ctx.globalAlpha = alpha;
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = [...ctx.getImageData(0, 0, 1, 1).data].map((v) =>
        v / 255 <= 0.04045 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
    };
    const behind = paint(getComputedStyle(e.closest(selector)!).backgroundColor);
    const text = paint(getComputedStyle(e).color, Number(getComputedStyle(e).opacity));
    return (Math.max(text, behind) + 0.05) / (Math.min(text, behind) + 0.05);
  }, around);

for (const scheme of ["light", "dark"] as const) {
  test(`in ${scheme}, Mantine's own colours read`, async ({ page, request, problems }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    const apps = (await (await request.get("/api/v1/applications")).json()) as { id: string }[];
    await page.goto(`/applications/${apps[0]!.id}`);

    const bullet = page.locator(".mantine-Timeline-itemBullet").first();
    expect(await reads(bullet, ".mantine-Timeline-itemBullet")).toBeGreaterThanOrEqual(3);

    await page.getByPlaceholder("https://docs.google.com/", { exact: false }).fill("not a link");
    await page.keyboard.press("Enter");
    const error = page.locator(".mantine-InputWrapper-error").first();
    expect(await reads(error, ".mantine-Card-root")).toBeGreaterThanOrEqual(4.5);

    await page.locator(".mantine-DateInput-input").first().click();
    for (const day of ["[data-outside]", "[data-weekend]:not([data-outside], [data-selected])"]) {
      const cell = page.locator(`.mantine-DateInput-day${day}`).first();
      expect(await reads(cell, ".mantine-Popover-dropdown"), day).toBeGreaterThanOrEqual(4.5);
    }

    // The picked segment's edge and the picked option's tick.
    await page.goto("/timeline");
    const edge = scheme === "light" ? "rgb(138, 127, 156)" : "rgb(138, 128, 160)";
    await expect(page.locator(".mantine-SegmentedControl-indicator").first()).toHaveCSS(
      "box-shadow",
      new RegExp(`${edge.replace(/[()]/g, "\\$&")} 0px 0px 0px 1px inset`),
    );
    await page.getByRole("combobox", { name: "Period" }).click();
    await expect(page.locator("[role=option][aria-selected=true] > svg")).toHaveCSS("opacity", /^(0\.56|1)$/);

    await page.goto("/");
    problems.allow(/\/todos/);
    await page.route("**/api/v1/todos/**", (route) =>
      route.fulfill({ status: 500, json: { detail: "It broke" } }),
    );
    await page.locator("main .mantine-Checkbox-input").first().click();
    const toast = page.locator(".mantine-Notification-description").first();
    await expect(toast).toBeVisible();
    expect(await reads(toast, ".mantine-Notification-root")).toBeGreaterThanOrEqual(4.5);
  });
}

test("rows, scrollers, board cards, cut-short links and Timeline dots show their focus rings", async ({
  page,
}) => {
  await page.goto("/applications");
  await page.keyboard.press("Shift"); // the keyboard was used last, so :focus-visible applies
  const row = page.locator("main tr[tabindex]").first();
  await row.focus();
  await expect(row).toHaveCSS("outline-style", "solid");
  await expect(row).toHaveCSS("outline-offset", "-2px");
  // Firefox stops at what scrolls; here it's given a tabindex to stand in for that.
  const scroller = page.locator("main .mantine-ScrollArea-viewport").first();
  await scroller.evaluate((el) => {
    el.tabIndex = 0;
    el.focus();
  });
  await expect(scroller).toHaveCSS("outline-style", "solid");
  await expect(scroller).toHaveCSS("outline-offset", "-2px");

  await page.getByText("Board", { exact: true }).click();
  await page.keyboard.press("Shift");
  const card = page
    .locator("main [data-panel-opener]")
    .filter({ has: page.locator("a") })
    .first();
  await card.focus();
  await expect(card).toHaveCSS("outline-style", "solid");
  await expect(card).toHaveCSS("outline-width", "2px");
  await card.locator("a").focus();
  await expect(card.locator("a")).toHaveCSS("outline-offset", "-2px"); // inside, where it isn't clipped

  await page.goto("/timeline");
  await page.getByText("Lanes", { exact: true }).click();
  await page.keyboard.press("Shift");
  const dot = page.locator("main li > button[aria-label]").last();
  await dot.focus();
  await expect(dot).toHaveCSS("outline-style", "solid"); // not the browser's own ("auto")
  await expect(dot).toHaveCSS("outline-offset", "0px"); // within the 2 px the last one has
});
