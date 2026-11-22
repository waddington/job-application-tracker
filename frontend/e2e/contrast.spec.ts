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
