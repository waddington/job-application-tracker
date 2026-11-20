import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Notes, Documents, Insights and Search in the new look (docs/rfc/app-redesign.md §4 row 12): the notes' and the
// documents' cards in grids by the list's own width, each card its own height with a row's tops level; Insights'
// charts in the palette's chart tokens; nothing wider than a phone's screen and no badge cut short.

const sideways = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const cutBadges = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("main .mantine-Badge-label")]
      .filter((l) => l.scrollWidth > l.clientWidth + 0.5)
      .map((l) => l.textContent),
  );

/**
 * A grid's shape: how many cards share the first row, and what's wrong with it. A row's cards must start level, be as
 * wide as each other, and fill the grid's width between them; each card must end at its content (not stretched to the
 * tallest in its row).
 */
const gridShape = (page: Page, grid: string) =>
  page.locator(grid).evaluate((g) => {
    const cards = [...g.children] as HTMLElement[];
    const boxes = cards.map((c) => c.getBoundingClientRect());
    const columns = boxes.filter((b) => Math.round(b.top) === Math.round(boxes[0]!.top)).length;
    const bad: string[] = [];
    const row = boxes.slice(0, columns);
    if (row.some((b) => Math.abs(b.width - row[0]!.width) > 1)) bad.push("first row's cards differ in width");
    const area = g.getBoundingClientRect();
    if (row.length && Math.abs(row.at(-1)!.right - area.right) > 1)
      bad.push("first row doesn't fill the width");
    for (let i = columns; i < boxes.length; i += columns) {
      const tops = boxes.slice(i, i + columns).map((b) => Math.round(b.top));
      if (tops.some((t) => t !== tops[0])) bad.push(`row from card ${i} isn't level`);
    }
    cards.forEach((card, i) => {
      const last = card.lastElementChild?.getBoundingClientRect();
      const pad = parseFloat(getComputedStyle(card).paddingBottom);
      if (last && card.getBoundingClientRect().bottom - last.bottom > pad + 2)
        bad.push(`card ${i} is stretched`);
    });
    return { columns, bad };
  });

test.describe("Notes", () => {
  test("the notes are a grid by the page's width, each card its own height", async ({ page, request }) => {
    for (const n of [1, 2, 3, 4, 5, 6])
      await request.post("/api/v1/notes", {
        data: { title: `Grid note ${n}`, body: `Practise a rate limiter. ${"More detail. ".repeat(n * 8)}` },
      });
    await page.goto("/notes");
    await expect(page.getByText("Grid note 6", { exact: true })).toBeVisible();
    for (const [width, columns] of [
      [375, 1],
      [1440, 2],
      [1920, 4],
      [2560, 5],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() => gridShape(page, "[data-notes-grid]"), { message: `at ${width} px` })
        .toEqual({
          columns,
          bad: [],
        });
      expect(await sideways(page), `at ${width} px`).toBeLessThanOrEqual(1);
    }
    // Reading one note in its card grows that card only: its neighbour keeps its height.
    const card = (title: string) =>
      page.locator("[data-notes-grid] > *").filter({ has: page.getByText(title, { exact: true }) });
    const before = (await card("Grid note 5").boundingBox())!.height;
    await card("Grid note 6").getByRole("button", { expanded: false }).click();
    await expect(
      card("Grid note 6")
        .getByText(/More detail/)
        .last(),
    ).toBeVisible();
    await expect
      .poll(async () => (await card("Grid note 6").boundingBox())!.height)
      .toBeGreaterThan(before + 40);
    expect((await card("Grid note 5").boundingBox())!.height).toBeCloseTo(before, 0);
    expect((await gridShape(page, "[data-notes-grid]")).bad).toEqual([]);
  });
});

test.describe("Documents", () => {
  test("the CV files and each document are cards side by side, by the page's width", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByRole("heading", { name: "Backend CV" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CV files you've attached" })).toBeVisible();
    for (const [width, columns] of [
      [375, 1],
      [1440, 2],
      [1920, 3],
      [2560, 4],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await expect
        .poll(() => gridShape(page, "[data-documents-grid]"), { message: `at ${width} px` })
        .toEqual({
          columns,
          bad: [],
        });
      expect(await cutBadges(page), `at ${width} px`).toEqual([]);
    }
  });
});

test.describe("phone width", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("no page scrolls sideways or cuts a badge short", async ({ page }) => {
    for (const path of ["/notes", "/documents", "/insights", "/search?q=backend"]) {
      await page.goto(path);
      await expect(page.locator("[data-testid=query-loading]")).toHaveCount(0);
      await expect(page.locator("main h2").first()).toBeVisible();
      await expect.poll(() => sideways(page), { message: path }).toBeLessThanOrEqual(1);
      expect(await cutBadges(page), path).toEqual([]);
    }
    await page.goto("/insights");
    for (const tab of ["Applications", "Recruiter conversations", "CVs and cover letters", "Rejections"]) {
      await page.getByRole("tab", { name: tab }).click();
      await expect(page.locator("[data-testid=query-loading]")).toHaveCount(0);
      await expect.poll(() => sideways(page), { message: tab }).toBeLessThanOrEqual(1);
      await expect.poll(() => cutBadges(page), { message: tab }).toEqual([]);
    }
  });
});

test.describe("Insights' charts", () => {
  /** The colours the flow diagram's nodes and Weekly activity's six series are drawn in. */
  const drawn = (page: Page) =>
    page.evaluate(() => ({
      nodes: [
        ...new Set(
          [...document.querySelectorAll("main svg[role=img] rect")].map((r) => getComputedStyle(r).fill),
        ),
      ],
      series: Array.from(
        [...document.querySelectorAll("main [role=listitem]")].at(-1)!.children,
        (b) => getComputedStyle(b).backgroundColor,
      ),
    }));

  for (const scheme of ["light", "dark"] as const) {
    test(`in ${scheme} mode they take the palette's chart colours`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto("/insights");
      await page.getByRole("tab", { name: "Applications" }).click();
      await expect(page.locator("main svg[role=img]").first()).toBeVisible();
      const { nodes, series } = await drawn(page);
      // Applied (blue) and Screen (cyan) among the nodes, in the chart tokens' steps, not Mantine's own.
      const [blue, cyan] =
        scheme === "light"
          ? ["rgb(36, 119, 195)", "rgb(0, 154, 174)"]
          : ["rgb(59, 132, 202)", "rgb(29, 165, 185)"];
      expect(nodes).toEqual(expect.arrayContaining([blue, cyan]));
      // Six series in six different colours: added, applied, moves, interviews, calls, pitched.
      expect(series).toEqual(
        scheme === "light"
          ? [
              "rgb(101, 73, 148)",
              "rgb(196, 120, 10)",
              "rgb(61, 115, 197)",
              "rgb(209, 107, 157)",
              "rgb(19, 124, 84)",
              "rgb(172, 144, 22)",
            ]
          : [
              "rgb(156, 129, 209)",
              "rgb(179, 110, 13)",
              "rgb(99, 147, 219)",
              "rgb(192, 70, 134)",
              "rgb(65, 170, 124)",
              "rgb(144, 119, 0)",
            ],
      );
    });
  }
});
