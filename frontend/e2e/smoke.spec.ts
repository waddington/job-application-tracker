import { expect, test } from "./fixtures";

// The app starts, every page in the menu opens, and one thing can be added from end to end.
// Each area's own behaviour has its own file.

const PAGES = [
  "Roles",
  "Applications",
  "Interviews",
  "Offers",
  "Recruiters",
  "Companies",
  "Documents",
  "Notes",
  "Insights",
  "Timeline",
];

test("opens on Today, with the seeded data", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Coming up" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Waiting on them" })).toBeVisible();
  await expect(page.getByText("Connected")).toBeVisible();
});

test("opens every page from the menu", async ({ page }) => {
  await page.goto("/");
  const menu = page.getByRole("navigation", { name: "Main navigation" });
  for (const name of PAGES) {
    await menu.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  }
});

test("adds an application, which is still there after a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New application" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Company").fill("Trey Research");
  await dialog.getByLabel("Role", { exact: true }).fill("Staff Engineer");
  await dialog.getByRole("button", { name: "Add application" }).click();
  await expect(page.getByText("Application added")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Staff Engineer" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Staff Engineer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Trey Research" }).first()).toBeVisible();
});

test.describe("the safety net itself", () => {
  test("sees a console error", async ({ page, problems }) => {
    problems.allow(/something broke/);
    await page.goto("/");
    await page.evaluate(() => console.error("something broke"));
    await expect.poll(() => problems.list()).toContainEqual(expect.stringContaining("something broke"));
  });

  test("sees an uncaught exception", async ({ page, problems }) => {
    problems.allow(/something broke/);
    await page.goto("/");
    await page.evaluate(() =>
      setTimeout(() => {
        throw new Error("something broke");
      }),
    );
    await expect.poll(() => problems.list()).toContainEqual(expect.stringContaining("something broke"));
  });

  test("sees a failed request", async ({ page, problems }) => {
    problems.allow(/no-such-id/);
    await page.goto("/");
    await page.evaluate(() => fetch("/api/v1/applications/no-such-id"));
    await expect.poll(() => problems.list()).toContainEqual(expect.stringContaining("HTTP 404"));
  });

  // Must fail: if this passes, problems aren't failing tests.
  test.fail("a problem nobody allowed fails the test", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => console.error("something broke"));
  });

  test("runs on its own demo server, not the tracker", async ({ page, baseURL, request }) => {
    expect(baseURL).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(new URL(baseURL ?? "").port).not.toBe("8770");
    const health = await (await request.get("/api/v1/health")).json();
    expect(health.data_dir).toContain("jat-e2e-");
    expect(health.git_repo).toBe(false);
    await page.goto("/applications?view=list");
    await expect(page.getByLabel("Open Senior Backend Engineer at Contoso")).toBeVisible();
  });
});
