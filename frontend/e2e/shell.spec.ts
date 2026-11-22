import type { Page } from "@playwright/test";

import { LANGUAGES } from "../src/i18n/language";
import { expect, test } from "./fixtures";

// The frame around every page: the menu, theme, language, help, the connection dot, the version,
// the backup download, not found, and phone width. What each page does is in its own file.

const MENU = [
  ["Today", "/", "Your move"],
  ["Roles", "/roles", "Roles"],
  ["Applications", "/applications", "Applications"],
  ["Recruiters", "/recruiters", "Recruiters"],
  ["Companies", "/companies", "Companies"],
  ["Interviews", "/interviews", "Interviews"],
  ["Offers", "/offers", "Offers"],
  ["Documents", "/documents", "Documents"],
  ["Notes", "/notes", "Notes"],
  ["Insights", "/insights", "Insights"],
  ["Timeline", "/timeline", "Timeline"],
] as const;

const menu = (page: Page) => page.getByRole("navigation", { name: "Main navigation" });
const item = (page: Page, name: string) => menu(page).getByRole("link", { name, exact: true });
const opened = async (page: Page) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
};
const scheme = (page: Page) => page.locator("html").getAttribute("data-mantine-color-scheme");
const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

test.describe("the menu", () => {
  test("marks where you are, and only there", async ({ page }) => {
    await opened(page);
    await expect(item(page, "Today")).toHaveAttribute("data-active", "true");
    await item(page, "Companies").click();
    await expect(page.getByRole("heading", { name: "Companies", level: 2 })).toBeVisible();
    await expect(item(page, "Companies")).toHaveAttribute("data-active", "true");
    await expect(item(page, "Today")).not.toHaveAttribute("data-active", "true");
    await expect(menu(page).locator('a[data-active="true"]')).toHaveCount(1);
  });

  test("stays on the section from a page inside it", async ({ page, request }) => {
    const made = await request.post("/api/v1/companies", { data: { name: "Inside Section Co" } });
    const { id } = (await made.json()) as { id: string };
    await page.goto(`/companies/${id}`);
    await expect(page.getByRole("heading", { name: "Inside Section Co", level: 2 })).toBeVisible();
    await expect(item(page, "Companies")).toHaveAttribute("data-active", "true");
  });

  for (const [name, path, heading] of MENU) {
    test(`${name}: its address opens directly, and after a reload`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      await expect(item(page, name)).toHaveAttribute("data-active", "true");
      await page.reload();
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      await expect(item(page, name)).toHaveAttribute("data-active", "true");
    });
  }

  test("the name at the top goes home; Back and Forward work", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("link", { name: "Job Application Tracker: today" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Notes", level: 2 })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
  });
});

test.describe("the theme", () => {
  test("switches both ways, says what it'll do, and is kept", async ({ page }) => {
    await opened(page);
    const toDark = page.getByRole("button", { name: "Switch to dark mode" });
    const toLight = page.getByRole("button", { name: "Switch to light mode" });
    await expect(toDark).toBeVisible();
    expect(await scheme(page)).toBe("light");
    const lightBackground = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    await toDark.click();
    await expect(toLight).toBeVisible();
    await expect.poll(() => scheme(page)).toBe("dark");
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe(
      lightBackground,
    );
    await page.reload();
    await expect(toLight).toBeVisible();
    await expect.poll(() => scheme(page)).toBe("dark");
    await toLight.click();
    await expect.poll(() => scheme(page)).toBe("light");
  });
});

test.describe("a browser that prefers dark", () => {
  test.use({ colorScheme: "dark" });

  test("starts dark; choosing light is kept", async ({ page }) => {
    await opened(page);
    await expect.poll(() => scheme(page)).toBe("dark");
    await page.getByRole("button", { name: "Switch to light mode" }).click();
    await expect.poll(() => scheme(page)).toBe("light");
    await page.reload();
    await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
    await expect.poll(() => scheme(page)).toBe("light");
  });
});

test.describe("a browser in another language, with a stale saved choice", () => {
  test.use({ locale: "xx-YY" }); // no language has this code, so it stays true as languages are added

  test("falls back to English, all the way", async ({ page, context }) => {
    await context.addInitScript(() => localStorage.setItem("jat.language", "xx"));
    await opened(page);
    expect(await page.evaluate(() => navigator.language)).toBe("xx-YY");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("language", () => {
  const openSwitch = async (page: Page) => {
    await page.getByRole("button", { name: "Language" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
  };

  test("English is chosen, more are coming, and pseudo isn't offered in the built app", async ({ page }) => {
    await opened(page);
    await openSwitch(page);
    const english = page.getByRole("menuitem", { name: "English" });
    await expect(english).toHaveAttribute("aria-current", "true");
    await expect(english).toHaveAttribute("lang", "en");
    await expect(page.getByRole("menuitem", { name: "简体中文" })).toHaveAttribute("lang", "zh-CN");
    await expect(page.getByRole("menuitem", { name: "More coming soon" })).toBeDisabled();
    // Each language, More coming soon and the link to the guide: no more than those.
    await expect(page.getByRole("menuitem")).toHaveCount(LANGUAGES.length + 2);
  });

  test("Don't see your language? opens the guide in a new tab, from the keyboard, and only then", async ({
    page,
    context,
  }) => {
    const toGitHub: string[] = [];
    await context.route("https://github.com/**", async (route) => {
      toGitHub.push(route.request().url());
      await route.fulfill({ status: 200, contentType: "text/html", body: "<title>The guide</title>" });
    });
    await opened(page);
    await page.getByRole("button", { name: "Language" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    const link = page.getByRole("menuitem", { name: "Don't see your language?" });
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(toGitHub).toEqual([]);

    // Down from the button, past the languages, skipping the greyed-out More coming soon.
    for (let i = 0; i <= LANGUAGES.length; i++) await page.keyboard.press("ArrowDown");
    await expect(link).toBeFocused();
    const popup = page.waitForEvent("popup");
    await page.keyboard.press("Enter");
    const guide = await popup;
    await expect(guide).toHaveURL(/\/blob\/main\/docs\/guide\/adding-a-language\.md$/);
    await expect(page.getByRole("menu")).toBeHidden();
    expect(toGitHub).toHaveLength(1);
  });

  test("choosing it is remembered in this browser", async ({ page }) => {
    await opened(page);
    await openSwitch(page);
    await page.getByRole("menuitem", { name: "English" }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem("jat.language"))).toBe("en");
    await page.reload();
    await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
  });

  test("?lang=pseudo does nothing in the built app", async ({ page }) => {
    await page.goto("/?lang=pseudo");
    await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
  });
});

test.describe("help", () => {
  test("opens over any page, and closes", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("button", { name: "How it works" }).click();
    const dialog = page.locator(".mantine-Modal-content");
    await expect(dialog.getByText("New application").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Notes", level: 2 })).toBeVisible();
  });
});

test.describe("the connection dot", () => {
  test("says connected, with the version", async ({ page, request }) => {
    const health = (await (await request.get("/api/v1/health")).json()) as { version: string };
    await opened(page);
    const dot = page.getByText("Connected");
    await expect(dot).toBeVisible();
    await dot.hover();
    await expect(page.getByRole("tooltip")).toContainText(`v${health.version}`);
  });

  test("says offline when the API doesn't answer, and how to start it", async ({ page, problems }) => {
    problems.allow(/503.*\/api\/v1\/health/);
    await page.route("**/api/v1/health", (route) => route.fulfill({ status: 503, body: "" }));
    await opened(page);
    const dot = page.getByText("API offline");
    await expect(dot).toBeVisible({ timeout: 15_000 });
    await dot.hover();
    await expect(page.getByRole("tooltip")).toContainText("uv run jat serve");
  });
});

test.describe("the version", () => {
  // Read from the server, never written here: it changes with every release. The footer shows the
  // page's own version, so this also checks the page's version (frontend/package.json) equals the
  // server's (src/jat/__init__.py): it catches a version bump that missed one of the files.
  test("the footer shows the server's version, linked to its release, with no mismatch", async ({
    page,
    request,
  }) => {
    const { version } = (await (await request.get("/api/v1/health")).json()) as { version: string };
    await opened(page);
    const link = menu(page).getByRole("link", {
      name: `v${version}: see what's in it on GitHub (opens in a new tab).`,
      exact: true,
    });
    await expect(link).toBeVisible();
    await expect(link).toHaveText(`v${version}`);
    await expect(link).toHaveAttribute(
      "href",
      `https://github.com/waddington/job-application-tracker/releases/tag/v${version}`,
    );
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(page.getByText(/^The server is v/)).toHaveCount(0);
  });

  test("an older server says so, and to restart the tracker", async ({ page, request }) => {
    const health = (await (await request.get("/api/v1/health")).json()) as { version: string };
    await page.route("**/api/v1/health", (route) => route.fulfill({ json: { ...health, version: "0.0.1" } }));
    await opened(page);
    await expect(
      menu(page).getByText(
        `The server is v0.0.1 but this page is v${health.version}. Restart the tracker to update.`,
      ),
    ).toBeVisible();
  });
});

test.describe("the backup", () => {
  test("downloads a real zip, with the data in it", async ({ page }) => {
    await opened(page);
    const waiting = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download a backup" }).click();
    const download = await waiting;
    expect(download.suggestedFilename()).toMatch(/\.zip$/);
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
    const zip = Buffer.concat(chunks);
    expect(zip.subarray(0, 2).toString()).toBe("PK");
    expect(zip.length).toBeGreaterThan(1000);
    // Names in a zip are stored plain: the export and config should be listed.
    const names = zip.toString("latin1");
    expect(names).toContain("config.toml");
    expect(names).toContain("export/");
    expect(names).toContain("RESTORE.md");
    expect(names).not.toContain(".tmp/");
  });

  test("another site can't set it off", async ({ request }) => {
    const refused = await request.get("/api/v1/backup/archive", {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(refused.status()).toBe(403);
    expect(await refused.text()).toContain("only be downloaded from the tracker");
  });
});

test.describe("not found", () => {
  test("an unknown address says so, and leads back", async ({ page }) => {
    await page.goto("/no/such/page");
    await expect(page.getByRole("heading", { name: "Page not found", level: 2 })).toBeVisible();
    await expect(page.getByText("There's nothing at this address.")).toBeVisible();
    await expect(menu(page).locator('a[data-active="true"]')).toHaveCount(0);
    await page.getByRole("link", { name: "Back to Today" }).click();
    await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
  });

  test("an unknown API address is an error, not the app", async ({ request }) => {
    const answer = await request.get("/api/v1/no-such-thing");
    expect(answer.status()).toBe(404);
    expect(answer.headers()["content-type"]).not.toContain("text/html");
  });

  for (const [what, path, words] of [
    ["application", "/applications/no-such-id", /^Couldn't load this application/],
    ["person", "/people/no-such-id", /^Couldn't load this person/],
    ["role", "/roles/no-such-id", /^Couldn't load this role/],
  ] as const) {
    test(`an ${what} that doesn't exist says so`, async ({ page, problems }) => {
      problems.allow(/404.*no-such-id/);
      await page.goto(path);
      await expect(page.getByText(words).first()).toBeVisible({ timeout: 20_000 });
    });
  }
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test("the menu is a bar along the bottom (phone-nav.spec.ts has the rest)", async ({ page }) => {
    await opened(page);
    await expect(item(page, "Today")).toHaveAttribute("aria-current", "page");
    await expect(item(page, "Notes")).toBeInViewport();
    await item(page, "Notes").click();
    await expect(page.getByRole("heading", { name: "Notes", level: 2 })).toBeVisible();
    await expect(item(page, "Notes")).toHaveAttribute("aria-current", "page");
  });

  test("New application is a small button, and works", async ({ page }) => {
    await opened(page);
    await page.getByRole("button", { name: "New application" }).filter({ visible: true }).click();
    const dialog = page.locator(".mantine-Modal-content");
    await dialog.getByLabel("Company").fill("Phone Added Co");
    await dialog.getByLabel("Role", { exact: true }).fill("Phone Added Role");
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(page.getByRole("heading", { name: "Phone Added Role" })).toBeVisible();
  });

  test("search works from the header", async ({ page }) => {
    await opened(page);
    await page.getByRole("textbox", { name: "Search everything" }).fill("Backend CV");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Results for “Backend CV”", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Backend CV" }).first()).toBeVisible();
  });

  for (const [name, path, heading] of MENU) {
    test(`${name} doesn't scroll sideways`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
      await page.waitForLoadState("networkidle");
      await expect.poll(() => sideways(page)).toBeLessThanOrEqual(1);
    });
  }
});

test.describe("wide screens", () => {
  test("the side menu is always there from 768 px, with no bottom bar", async ({ page }) => {
    await opened(page);
    for (const width of [1400, 768]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(item(page, "Timeline")).toBeInViewport();
      await expect(page.getByRole("button", { name: "More", exact: true })).toHaveCount(0);
    }
  });
});

test.describe("the page's width", () => {
  // The page wrapper is the first thing in <main>; the menu is 230 px, with 28 px of space after it.
  const box = async (page: Page) => (await page.locator("main > *").first().boundingBox())!;

  test("fills the window beside the menu", async ({ page }) => {
    await opened(page);
    const { x, width } = await box(page);
    expect(x).toBeCloseTo(230 + 28, 0);
    expect(width).toBeCloseTo(1400 - 230 - 2 * 28, 0);
  });

  test.describe("on a very wide screen", () => {
    test.use({ viewport: { width: 3000, height: 1000 } });
    for (const [name, path, heading] of [MENU[0], MENU[8], MENU[9]]) {
      test(`${name} stops at 2,400 px, from the left`, async ({ page }) => {
        await page.goto(path);
        await expect(page.getByRole("heading", { name: heading }).first()).toBeVisible();
        const { x, width } = await box(page);
        expect(x).toBeCloseTo(230 + 28, 0);
        expect(width).toBe(2400);
      });
    }
  });
});

test.describe("the background", () => {
  // A moment a fifth of the way into the drift's ten-minute cycle: butter, then mint two minutes later.
  const cycle = 600_000;
  const butter = "rgb(252, 248, 234)";
  const mint = "rgb(239, 248, 242)";
  const background = (page: Page, selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);

  test("drifts with the clock, the same behind the header and the menu, and a reload carries on", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.clock.install({ time: 2_000 * cycle + cycle / 5 });
    await opened(page);
    expect(await background(page, "body")).toBe(butter);
    expect(await background(page, "header")).toBe(butter);
    expect(await background(page, "nav")).toBe(butter);
    await item(page, "Notes").click();
    await expect(page.getByRole("heading", { name: "Notes", level: 2 })).toBeVisible();
    expect(await background(page, "body")).toBe(butter);
    await page.clock.runFor(cycle / 5);
    await expect.poll(() => background(page, "body")).toBe(mint);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Notes", level: 2 })).toBeVisible();
    expect(await background(page, "body")).toBe(mint);
  });

  test("stays lilac, or plum night, when motion is reduced", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.clock.install({ time: 2_000 * cycle + cycle / 5 });
    await opened(page);
    expect(await background(page, "body")).toBe("rgb(244, 241, 251)");
    await page.getByRole("button", { name: "Switch to dark mode" }).click();
    await expect.poll(() => background(page, "body")).toBe("rgb(23, 18, 31)");
    expect(await background(page, "header")).toBe("rgb(23, 18, 31)");
  });
});

test.describe("more of the frame", () => {
  test("an address that only starts like a section marks nothing", async ({ page }) => {
    for (const path of ["/notes-old", "/peoplex", "/agencies-old"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Page not found", level: 2 })).toBeVisible();
      await expect(menu(page).locator('a[data-active="true"]')).toHaveCount(0);
    }
  });

  test("a person's and an agency's pages are under Recruiters", async ({ page, request }) => {
    const firm = (await (
      await request.post("/api/v1/agencies", { data: { name: "Section Agency" } })
    ).json()) as { id: string };
    const who = (await (
      await request.post("/api/v1/contacts", { data: { name: "Section Person" } })
    ).json()) as { id: string };
    await page.goto(`/agencies/${firm.id}`);
    await expect(page.getByRole("heading", { name: "Section Agency", level: 2 })).toBeVisible();
    await expect(item(page, "Recruiters")).toHaveAttribute("data-active", "true");
    await expect(menu(page).locator('a[data-active="true"]')).toHaveCount(1);
    await page.goto(`/people/${who.id}`);
    await expect(page.getByRole("heading", { name: "Section Person", level: 2 })).toBeVisible();
    await expect(item(page, "Recruiters")).toHaveAttribute("data-active", "true");
    await expect(menu(page).locator('a[data-active="true"]')).toHaveCount(1);
  });

  // KNOWN BUG (fix-backup-same-site on the roadmap): expected to fail until it is fixed.
  test.fail("a site on another port of this machine can't set the backup off", async ({ request }) => {
    const refused = await request.get("/api/v1/backup/archive", {
      headers: { "sec-fetch-site": "same-site" },
    });
    expect(refused.status()).toBe(403);
  });

  test.describe("at phone width", () => {
    test.use({ viewport: { width: 390, height: 800 } });

    for (const lang of ["en", "zh-CN"]) {
      test(`the header's contents stay in the header, clear of the title (${lang})`, async ({ page }) => {
        await page.addInitScript((code) => localStorage.setItem("jat.language", code), lang);
        for (const path of ["/interviews", "/applications"]) {
          await page.goto(path);
          await expect(page.locator("main h2").first()).toBeVisible();
          for (const width of [305, 320, 375, 390, 600, 767]) {
            await page.setViewportSize({ width, height: 800 }); // 305: 320 with a scrollbar
            // Whatever's there: a fix may fold some of them away.
            const controls = page.locator("header").locator("a, button, input").filter({ visible: true });
            await expect(async () => {
              expect(await controls.count()).toBeGreaterThan(0);
              let free = 0; // where the one before it ends: side by side, none over another
              for (const box of await Promise.all((await controls.all()).map((el) => el.boundingBox()))) {
                expect(box!.y + box!.height).toBeLessThanOrEqual(56);
                expect(box!.x).toBeGreaterThanOrEqual(free - 0.5);
                free = box!.x + box!.width;
                expect(free).toBeLessThanOrEqual(width);
              }
              expect((await page.locator("main h2").first().boundingBox())!.y).toBeGreaterThanOrEqual(56);
              expect((await page.getByRole("search").boundingBox())!.width).toBeGreaterThanOrEqual(84); // 85 at 305
            }).toPass({ timeout: 5000 });
          }
        }
      });
    }
  });
});
