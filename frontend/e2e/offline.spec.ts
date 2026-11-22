import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The app's server is on this machine, so losing the network mustn't stop it (fix-offline-requests-paused).
// The browser's offline event is sent by hand: context.setOffline would cut off localhost too.
const loseTheNetwork = (page: Page) => page.evaluate(() => window.dispatchEvent(new Event("offline")));

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Connected")).toBeVisible();
  await loseTheNetwork(page);
});

test("with the network lost, a page not opened yet still loads", async ({ page }) => {
  const answered = page.waitForResponse((r) => r.url().includes("/api/v1/insights"), { timeout: 10_000 });
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByText("Insights", { exact: true })
    .click();
  expect((await answered).status()).toBe(200);
  await expect(page.getByTestId("query-loading")).toHaveCount(0);
});

test("with the network lost, a save still lands, and shows", async ({ page, request }) => {
  const text = "Saved with the network lost";
  await page.getByLabel("New to-do").fill(text);
  await page.getByLabel("New to-do").press("Enter");
  await expect(page.getByRole("checkbox", { name: text, exact: true })).toBeVisible();
  expect(await (await request.get("/api/v1/todos")).text()).toContain(text);
});
