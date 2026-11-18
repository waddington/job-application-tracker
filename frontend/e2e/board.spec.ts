import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The board: real dragging with the mouse and the keyboard, moves it refuses, closed stages and
// round columns. Each drag test adds its own card.

const card = (page: Page, company: string, role: string) => page.getByLabel(`${company}: ${role}`);
const column = (page: Page, title: string) => page.getByLabel(`${title} column`, { exact: true });
/** What the board tells screen readers: how we know where a drag really is. */
const said = (page: Page) => page.locator("[id^=DndLiveRegion]");
const settled = (page: Page) => page.evaluate(() => new Promise((done) => setTimeout(done, 300)));
const watchMoves = (page: Page) => {
  const moves: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") moves.push(r.url());
  });
  return moves;
};

interface Row {
  id: string;
  role_title: string;
  stage: string;
}
const rows = async (request: APIRequestContext): Promise<Row[]> =>
  (await request.get("/api/v1/applications")).json();
const stageOf = async (request: APIRequestContext, role: string) =>
  (await rows(request)).find((r) => r.role_title === role)?.stage;

/** Add a card at a stage, so a test can drag something no other test touches. */
const addCard = async (
  page: Page,
  request: APIRequestContext,
  company: string,
  role: string,
  stage = "applied",
) => {
  const made = await request.post("/api/v1/applications/quick", {
    data: { company_name: company, role_title: role, route: "direct", stage, tags: [] },
  });
  expect(made.ok()).toBe(true);
  await page.reload();
  // A closed card only shows once closed stages do.
  if (!["rejected", "withdrawn", "ghosted"].includes(stage))
    await expect(card(page, company, role)).toBeVisible();
};

/**
 * Press, travel in steps (it needs a few pixels to count as a drag), wait until the board says
 * it's over the target (it can autoscroll under the pointer), and let go.
 */
const drag = async (page: Page, from: Locator, title: string, company: string) => {
  await from.scrollIntoViewIfNeeded();
  const start = await from.boundingBox();
  if (!start) throw new Error("Nothing to drag");
  await page.mouse.move(start.x + start.width / 2, start.y + 15);
  await page.mouse.down();
  await page.mouse.move(start.x + start.width / 2 + 12, start.y + 25, { steps: 4 });
  // Columns can appear once the drag starts, so find the target only now.
  const target = column(page, title);
  await expect(async () => {
    await target.scrollIntoViewIfNeeded();
    const end = await target.boundingBox();
    if (!end) throw new Error("Nowhere to drop");
    await page.mouse.move(end.x + end.width / 2, end.y + 30, { steps: 8 });
    await expect(said(page)).toContainText(`${company} is over ${title}.`, { timeout: 300 });
  }).toPass({ timeout: 6_000 });
  await page.mouse.up();
};

// Wide enough for every column, so the board's autoscroll doesn't move a target under the
// pointer. One test below drags at a normal width, with the scrolling.
test.use({ viewport: { width: 3800, height: 1000 } });

test.beforeEach(async ({ page }) => {
  await page.goto("/applications?view=board");
  await expect(column(page, "Applied")).toBeVisible();
});

test.describe("what it shows", () => {
  test("a column per open stage, in workflow order, with counts", async ({ page }) => {
    const titles = await page
      .getByLabel(/ column$/)
      .evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")));
    expect(titles).toEqual(
      ["Interested", "Applied", "Screen", "Interviewing", "Final", "Offer", "Accepted"].map(
        (name) => `${name} column`,
      ),
    );
    const offer = column(page, "Offer");
    await expect(offer.getByLabel(/: /)).toHaveCount(2);
    await expect(offer.getByText("2", { exact: true })).toBeVisible();
  });

  test("closed stages stay hidden until asked for", async ({ page }) => {
    await expect(column(page, "Rejected")).toBeHidden();
    await expect(card(page, "Tailspin Toys", "Engineering Manager")).toBeHidden();
    await page.getByLabel("Show closed stages").check({ force: true });
    await expect(column(page, "Rejected").getByLabel("Tailspin Toys: Engineering Manager")).toBeVisible();
    await page.getByLabel("Show closed stages").uncheck({ force: true });
    await expect(column(page, "Rejected")).toBeHidden();
  });

  test("a card shows its round, who it came through, and a reply to read", async ({ page }) => {
    await expect(card(page, "Contoso", "Senior Backend Engineer")).toContainText(
      "Round 3 · System design test",
    );
    await expect(card(page, "Contoso", "Senior Backend Engineer")).toContainText("Alex Morgan");
    await expect(card(page, "Fabrikam", "Staff Platform Engineer")).toContainText("Reply to read");
  });

  test("a direct card names its in-house recruiter, and one without shows no one", async ({
    page,
    request,
  }) => {
    const made = await request.post("/api/v1/applications/quick", {
      data: { company_name: "In-house Card Co", role_title: "Card Role", recruiter_name: "Ellis Varga" },
    });
    expect(made.ok()).toBe(true);
    // Another role at the same company, with no recruiter: their name mustn't leak onto it.
    await addCard(page, request, "In-house Card Co", "Other Card Role");
    await expect(card(page, "In-house Card Co", "Card Role")).toContainText("Ellis Varga");
    await expect(card(page, "In-house Card Co", "Other Card Role")).not.toContainText("Ellis Varga");
  });

  test("a filter applies to the board too", async ({ page }) => {
    await expect(card(page, "Litware", "Senior Software Engineer")).toBeVisible();
    await page.getByPlaceholder("Search company, role, recruiter…").fill("Contoso");
    await expect(card(page, "Litware", "Senior Software Engineer")).toBeHidden();
    await expect(card(page, "Contoso", "Senior Backend Engineer")).toBeVisible();
  });
});

test.describe("opening a card", () => {
  test("a click opens the quick view", async ({ page }) => {
    await card(page, "Contoso", "Senior Backend Engineer").click();
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Senior Backend Engineer" }),
    ).toBeVisible();
  });

  test("Enter opens it from the keyboard", async ({ page }) => {
    await card(page, "Contoso", "Senior Backend Engineer").focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("dialog").getByRole("heading", { name: "Senior Backend Engineer" }),
    ).toBeVisible();
  });

  test("the quick view docks beside the board, which makes room, and another card swaps it", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1400, height: 1000 }); // narrower than the page's cap, so it shrinks
    const contoso = card(page, "Contoso", "Senior Backend Engineer");
    await contoso.click();
    const panel = page.getByRole("dialog", { name: "Application" });
    await expect(panel.getByRole("heading", { name: "Senior Backend Engineer" })).toBeVisible();
    await expect(async () => {
      const box = await panel.boundingBox();
      const board = await page.locator("main > *").first().boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(1400); // slid in
      expect(box!.x + box!.width).toBeGreaterThan(1380);
      expect(board!.x + board!.width).toBeLessThanOrEqual(box!.x);
    }).toPass({ timeout: 5_000 });
    await card(page, "Litware", "Senior Software Engineer").click();
    await expect(panel.getByRole("heading", { name: "Senior Software Engineer" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
  });

  test("after a move from the quick view, closing it gives focus to the card in its new column", async ({
    page,
    request,
  }) => {
    await addCard(page, request, "Panel Move Ltd", "Panel Move");
    await card(page, "Panel Move Ltd", "Panel Move").click();
    const panel = page.getByRole("dialog", { name: "Application" });
    await panel.getByRole("button", { name: "Move to…" }).click();
    await page.getByRole("menuitem", { name: "Screen" }).click();
    await expect.poll(() => stageOf(request, "Panel Move")).toBe("screen");
    await expect(column(page, "Screen").getByLabel("Panel Move Ltd: Panel Move")).toBeVisible();
    // The menu unmounts with focus in it; focus comes back to the panel rather than being lost.
    await expect(panel.getByRole("heading", { name: "Application" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(column(page, "Screen").getByLabel("Panel Move Ltd: Panel Move")).toBeFocused();
  });

  test("dragging a card with the quick view open moves it", async ({ page, request }) => {
    await addCard(page, request, "Drag Open Ltd", "Drag Open");
    await card(page, "Contoso", "Senior Backend Engineer").click();
    const panel = page.getByRole("dialog", { name: "Application" });
    await expect(panel.getByRole("heading", { name: "Senior Backend Engineer" })).toBeVisible();
    await drag(page, card(page, "Drag Open Ltd", "Drag Open"), "Screen", "Drag Open Ltd");
    await expect.poll(() => stageOf(request, "Drag Open")).toBe("screen");
    await expect(column(page, "Screen").getByLabel("Drag Open Ltd: Drag Open")).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Senior Backend Engineer" })).toBeVisible();
  });

  test("Escape cancelling a drag leaves the quick view open", async ({ page, request }) => {
    await addCard(page, request, "Drag Cancel Ltd", "Drag Cancel");
    await card(page, "Contoso", "Senior Backend Engineer").click();
    const panel = page.getByRole("dialog", { name: "Application" });
    await expect(panel.getByRole("heading", { name: "Senior Backend Engineer" })).toBeVisible();
    const from = card(page, "Drag Cancel Ltd", "Drag Cancel");
    const start = await from.boundingBox();
    if (!start) throw new Error("Nothing to drag");
    await page.mouse.move(start.x + start.width / 2, start.y + 15);
    await page.mouse.down();
    await page.mouse.move(start.x + start.width / 2 + 40, start.y + 40, { steps: 6 });
    await expect(said(page)).toContainText("Drag Cancel Ltd is over"); // the drag has started
    await page.keyboard.press("Escape");
    await expect(said(page)).toContainText("Cancelled.");
    await page.mouse.up();
    await settled(page);
    await expect(panel).toBeVisible();
    expect(await stageOf(request, "Drag Cancel")).toBe("applied");
  });

  test("the recruiter's name opens their page, not the quick view, and moves nothing", async ({ page }) => {
    const moves = watchMoves(page);
    await card(page, "Contoso", "Senior Backend Engineer").getByRole("link", { name: "Alex Morgan" }).click();
    await expect(page).toHaveURL(/\/people\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Alex Morgan", level: 2 })).toBeVisible();
    await expect(page.getByRole("dialog")).toBeHidden();
    expect(moves).toEqual([]);
  });

  test("Enter on the recruiter's name opens their page too", async ({ page }) => {
    await card(page, "Contoso", "Senior Backend Engineer").getByRole("link", { name: "Alex Morgan" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/people\/[^/]+$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("with only an agency, its name opens the agency's page", async ({ page, request }) => {
    const made = await request.post("/api/v1/applications/quick", {
      data: {
        company_name: "Agency Card Co",
        role_title: "Agency Card Role",
        route: "agency",
        agency_name: "Card Agency Ltd",
        stage: "applied",
        tags: [],
      },
    });
    expect(made.ok()).toBe(true);
    await page.reload();
    await card(page, "Agency Card Co", "Agency Card Role")
      .getByRole("link", { name: "Card Agency Ltd" })
      .click();
    await expect(page).toHaveURL(/\/agencies\/[^/]+$/);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("a referral's card has no link where the recruiter would be", async ({ page }) => {
    await expect(card(page, "Litware", "Senior Software Engineer").getByRole("link")).toHaveCount(0);
  });
});

test.describe("dragging with the mouse", () => {
  test("to another stage moves it, and it stays after a reload", async ({ page, request }) => {
    await addCard(page, request, "Drag One Ltd", "Drag One");
    await drag(page, card(page, "Drag One Ltd", "Drag One"), "Screen", "Drag One Ltd");
    await expect(column(page, "Screen").getByLabel("Drag One Ltd: Drag One")).toBeVisible();
    await expect.poll(() => stageOf(request, "Drag One")).toBe("screen");
    await page.reload();
    await expect(column(page, "Screen").getByLabel("Drag One Ltd: Drag One")).toBeVisible();
  });

  test("the move is on its timeline and can be undone", async ({ page, request }) => {
    await addCard(page, request, "Drag Undo Ltd", "Drag Undo");
    await drag(page, card(page, "Drag Undo Ltd", "Drag Undo"), "Screen", "Drag Undo Ltd");
    await expect.poll(() => stageOf(request, "Drag Undo")).toBe("screen");
    await card(page, "Drag Undo Ltd", "Drag Undo").click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByText("Applied → Screen")).toBeVisible();
    await drawer.getByRole("button", { name: "Undo last move" }).click();
    await expect.poll(() => stageOf(request, "Drag Undo")).toBe("applied");
    await page.keyboard.press("Escape");
    await expect(column(page, "Applied").getByLabel("Drag Undo Ltd: Drag Undo")).toBeVisible();
  });

  test("onto its own column does nothing", async ({ page, request }) => {
    await addCard(page, request, "Drag Stay Ltd", "Drag Stay");
    const moves = watchMoves(page);
    await drag(page, card(page, "Drag Stay Ltd", "Drag Stay"), "Applied", "Drag Stay Ltd");
    await expect(said(page)).toContainText("Drag Stay Ltd dropped on Applied.");
    await settled(page);
    expect(moves).toEqual([]);
    expect(await stageOf(request, "Drag Stay")).toBe("applied");
  });

  test("let go outside any column, nothing changes and closed stages hide again", async ({
    page,
    request,
  }) => {
    await addCard(page, request, "Drag Out Ltd", "Drag Out");
    const moves = watchMoves(page);
    const from = card(page, "Drag Out Ltd", "Drag Out");
    await from.scrollIntoViewIfNeeded();
    const box = await from.boundingBox();
    if (!box) throw new Error("Nothing to drag");
    await page.mouse.move(box.x + box.width / 2, box.y + 15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 12, box.y + 25, { steps: 4 });
    await expect(column(page, "Rejected")).toBeAttached();
    await page.mouse.move(5, 5, { steps: 8 });
    await expect(said(page)).toContainText("Drag Out Ltd isn't over a stage.");
    await page.mouse.up();
    await expect(said(page)).toContainText("Drag Out Ltd dropped.");
    await expect(column(page, "Rejected")).toBeHidden();
    await settled(page);
    expect(moves).toEqual([]);
    expect(await stageOf(request, "Drag Out")).toBe("applied");
  });

  test("the counts follow the card", async ({ page, request }) => {
    await addCard(page, request, "Drag Count Ltd", "Drag Count");
    const count = (title: string) => column(page, title).getByLabel(/: /).count();
    const before = [await count("Applied"), await count("Final")];
    await drag(page, card(page, "Drag Count Ltd", "Drag Count"), "Final", "Drag Count Ltd");
    await expect(column(page, "Final").getByLabel("Drag Count Ltd: Drag Count")).toBeVisible();
    expect([await count("Applied"), await count("Final")]).toEqual([
      (before[0] as number) - 1,
      (before[1] as number) + 1,
    ]);
    await expect(
      column(page, "Final")
        .getByText(String((before[1] as number) + 1), { exact: true })
        .first(),
    ).toBeVisible();
  });

  test("a closed card can be dragged back to an open stage", async ({ page, request }) => {
    await addCard(page, request, "Drag Back Ltd", "Drag Back", "rejected");
    await expect(card(page, "Drag Back Ltd", "Drag Back")).toBeHidden();
    await page.getByLabel("Show closed stages").check({ force: true });
    await drag(page, card(page, "Drag Back Ltd", "Drag Back"), "Screen", "Drag Back Ltd");
    await expect.poll(() => stageOf(request, "Drag Back")).toBe("screen");
  });

  test("a closed stage appears while dragging, and dropping there says where it went", async ({
    page,
    request,
  }) => {
    await addCard(page, request, "Drag Closed Ltd", "Drag Closed");
    await expect(column(page, "Withdrawn")).toBeHidden();
    await drag(page, card(page, "Drag Closed Ltd", "Drag Closed"), "Withdrawn", "Drag Closed Ltd");
    await expect(page.getByText("Drag Closed Ltd moved to Withdrawn")).toBeVisible();
    await expect.poll(() => stageOf(request, "Drag Closed")).toBe("withdrawn");
    await expect(card(page, "Drag Closed Ltd", "Drag Closed")).toBeHidden();
    await expect(page.getByRole("dialog")).toBeHidden(); // only Rejected asks for feedback
  });

  test("dropping on Rejected asks for feedback, and saves it with the move", async ({ page, request }) => {
    await addCard(page, request, "Drag Reject Ltd", "Drag Reject");
    const moves = watchMoves(page);
    await drag(page, card(page, "Drag Reject Ltd", "Drag Reject"), "Rejected", "Drag Reject Ltd");
    const dialog = page.getByRole("dialog", { name: "Moving to Rejected: any feedback?" });
    await expect(dialog.getByText("Drag Reject at Drag Reject Ltd")).toBeVisible();
    expect(moves).toEqual([]); // nothing saved yet
    await dialog.getByLabel("What did they say?").fill("  Wanted more Go ✓\nNice take-home.");
    await dialog.getByRole("button", { name: "Move to Rejected" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Drag Reject Ltd moved to Rejected")).toBeVisible();
    const saved = (await rows(request)).find((r) => r.role_title === "Drag Reject") as Row & {
      rejection_feedback: string | null;
    };
    expect([saved.stage, saved.rejection_feedback]).toEqual([
      "rejected",
      "  Wanted more Go ✓\nNice take-home.",
    ]);
  });

  test("cancelling the feedback puts the card back, unmoved", async ({ page, request }) => {
    await addCard(page, request, "Drag Unreject Ltd", "Drag Unreject");
    const moves = watchMoves(page);
    await drag(page, card(page, "Drag Unreject Ltd", "Drag Unreject"), "Rejected", "Drag Unreject Ltd");
    const dialog = page.getByRole("dialog", { name: "Moving to Rejected: any feedback?" });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(column(page, "Applied").getByLabel("Drag Unreject Ltd: Drag Unreject")).toBeVisible();
    await settled(page);
    expect(moves).toEqual([]);
    expect(await stageOf(request, "Drag Unreject")).toBe("applied");
  });

  test("a short drag that comes back to its own column doesn't open the card", async ({ page, request }) => {
    await addCard(page, request, "Drag Noopen Ltd", "Drag Noopen");
    const from = card(page, "Drag Noopen Ltd", "Drag Noopen");
    await from.scrollIntoViewIfNeeded();
    const box = await from.boundingBox();
    if (!box) throw new Error("Nothing to drag");
    await page.mouse.move(box.x + box.width / 2, box.y + 15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + 15, { steps: 4 });
    await page.mouse.up();
    await expect(said(page)).toContainText("Drag Noopen Ltd dropped on Applied.");
    await settled(page);
    await expect(page.getByRole("dialog")).toBeHidden();
  });

  test("a failed move puts the card back and says so", async ({ page, request, problems }) => {
    problems.allow(/\/move/);
    await addCard(page, request, "Drag Fail Ltd", "Drag Fail");
    await page.route("**/move", (route) =>
      route.fulfill({ status: 500, json: { detail: "Server says no" } }),
    );
    await drag(page, card(page, "Drag Fail Ltd", "Drag Fail"), "Screen", "Drag Fail Ltd");
    await expect(page.getByText("That didn't work")).toBeVisible();
    await expect(column(page, "Applied").getByLabel("Drag Fail Ltd: Drag Fail")).toBeVisible();
    await expect(column(page, "Screen").getByLabel("Drag Fail Ltd: Drag Fail")).toBeHidden();
  });
});

/** Where each column sits: its left and right edges and width. */
const columnBoxes = (page: Page) =>
  page.getByLabel(/ column$/).evaluateAll((els) =>
    els.map((e) => {
      const r = e.getBoundingClientRect();
      const px = (n: number) => Math.round(n); // sub-pixel layout differs between frames
      return { title: e.getAttribute("aria-label"), x: px(r.x), right: px(r.right), width: px(r.width) };
    }),
  );
/** The same columns in the same places, give or take a pixel. */
const sameAs = (
  now: Awaited<ReturnType<typeof columnBoxes>>,
  then: Awaited<ReturnType<typeof columnBoxes>>,
) => {
  expect(now.map((b) => b.title)).toEqual(then.map((b) => b.title));
  now.forEach((b, i) => {
    expect(Math.abs(b.x - then[i]!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.width - then[i]!.width)).toBeLessThanOrEqual(1);
  });
};
const allAbout = (widths: number[], width: number) =>
  widths.forEach((w) => expect(Math.abs(w - width)).toBeLessThan(1.5));

test.describe("the board fills the window", () => {
  test("its columns share the width beside the menu, as far as 16 px from the edge", async ({ page }) => {
    await page.setViewportSize({ width: 1800, height: 1000 });
    await expect(async () => {
      const boxes = await columnBoxes(page);
      expect(boxes).toHaveLength(7);
      const width = boxes[0]!.width;
      expect(width).toBeGreaterThan(200); // wider than the 180 px they can shrink to, so it's sharing
      expect(width).toBeLessThanOrEqual(360);
      allAbout(
        boxes.map((b) => b.width),
        width,
      );
      expect(Math.abs(boxes.at(-1)!.right - (1800 - 16))).toBeLessThan(2); // the last ends at the gutter
    }).toPass({ timeout: 5_000 });
    // Nothing to scroll sideways.
    const viewport = page.locator(".mantine-ScrollArea-viewport").filter({ has: column(page, "Applied") });
    expect(await viewport.evaluate((e) => e.scrollWidth - e.clientWidth)).toBeLessThanOrEqual(1);
  });

  test("on a very wide screen it passes the page's cap, but no column stretches past 360 px", async ({
    page,
  }) => {
    // 3,800 px: the page's 2,400 px cap would stop well short of the window's edge.
    const boxes = await columnBoxes(page);
    allAbout(
      boxes.map((b) => b.width),
      360,
    );
    const board = await page
      .locator(".mantine-ScrollArea-root")
      .filter({ has: column(page, "Applied") })
      .boundingBox();
    expect(board!.x + board!.width).toBeGreaterThan(3800 - 20); // to the 16 px gutter
    expect(boxes[0]!.x).toBeLessThan(300); // starts beside the menu, not centred
    for (let i = 1; i < boxes.length; i++) expect(boxes[i]!.x - boxes[i - 1]!.right).toBeLessThan(16);
  });

  test("the list keeps the page's 2,400 px cap", async ({ page }) => {
    await page.getByText("List", { exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "Stage" })).toBeVisible();
    expect((await page.locator("main > *").first().boundingBox())!.width).toBe(2400);
  });

  test("the List/Board switch stays where it is between the two views", async ({ page }) => {
    // 3,800 px: the board runs on past the cap, the title and filters don't.
    const where = async () => (await page.getByText("List", { exact: true }).boundingBox())!;
    const onBoard = await where();
    expect(onBoard.x).toBeLessThan(230 + 28 + 2400);
    await page.getByText("List", { exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "Stage" })).toBeVisible();
    const onList = await where();
    expect(Math.abs(onList.x - onBoard.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(onList.y - onBoard.y)).toBeLessThanOrEqual(1);
  });

  test("its scrollbar follows columns that are added, and reaches the last", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const viewport = page.locator(".mantine-ScrollArea-viewport").filter({ has: column(page, "Applied") });
    const scroller = page.locator(".mantine-ScrollArea-root").filter({ has: column(page, "Applied") });
    const bar = scroller.locator(".mantine-ScrollArea-scrollbar[data-orientation=horizontal]");
    /** The thumb's width, and what it should be: the track's share that's in view. */
    const thumb = async () =>
      bar.evaluate(
        (track, el) => {
          const view = el as HTMLElement;
          const t = track.querySelector(".mantine-ScrollArea-thumb")!.getBoundingClientRect().width;
          const want = (track.getBoundingClientRect().width * view.clientWidth) / view.scrollWidth;
          return { t, want, overflow: view.scrollWidth - view.clientWidth };
        },
        await viewport.elementHandle(),
      );
    await page.getByLabel("Show closed stages").check({ force: true });
    await expect(column(page, "Ghosted")).toBeAttached();
    await expect(async () => {
      const { t, want, overflow } = await thumb();
      expect(overflow).toBeGreaterThan(500); // ten columns at 180 px don't fit
      expect(Math.abs(t - want)).toBeLessThan(4);
    }).toPass({ timeout: 5_000 });
    // Drag the thumb all the way right: the last column comes fully into view.
    // Other tests have added cards, so the board can run below the window: bring the bar into view.
    await bar.scrollIntoViewIfNeeded();
    const box = (await bar.locator(".mantine-ScrollArea-thumb").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(1440, box.y + box.height / 2, { steps: 8 });
    await page.mouse.up();
    await expect(async () => {
      const last = (await column(page, "Ghosted").boundingBox())!;
      expect(last.x + last.width).toBeLessThanOrEqual(1440);
      expect(last.x).toBeGreaterThan(230);
    }).toPass({ timeout: 5_000 });
  });

  test("with the quick view open, the columns share the room left beside it", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1000 });
    await card(page, "Contoso", "Senior Backend Engineer").click();
    const panel = page.getByRole("dialog", { name: "Application" });
    await expect(panel.getByRole("heading", { name: "Senior Backend Engineer" })).toBeVisible();
    await expect(async () => {
      const dock = (await panel.boundingBox())!;
      expect(dock.x + dock.width).toBeGreaterThan(2540); // slid in
      const boxes = await columnBoxes(page);
      const width = boxes[0]!.width;
      expect(width).toBeGreaterThanOrEqual(180);
      allAbout(
        boxes.map((b) => b.width),
        width,
      );
      const right = boxes.at(-1)!.right;
      expect(right).toBeLessThanOrEqual(dock.x);
      expect(right).toBeGreaterThan(dock.x - 40); // up to the panel, not short of it
    }).toPass({ timeout: 5_000 });
  });

  test("while dragging, the columns keep their width and the closed stages come in after them", async ({
    page,
    request,
  }) => {
    await page.setViewportSize({ width: 1920, height: 1000 });
    await addCard(page, request, "Hold Width Ltd", "Hold Width");
    // Measured once the board has taken the new window width: under a full run's load the first frames after the
    // resize can still have the columns at 180 px (2026-11-18, fix-board-drag-width-race).
    await expect.poll(async () => (await columnBoxes(page))[0]!.width).toBeGreaterThan(200);
    const before = await columnBoxes(page);
    const box = (await card(page, "Hold Width Ltd", "Hold Width").boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + 15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 12, box.y + 25, { steps: 4 });
    await expect(column(page, "Rejected")).toBeVisible();
    const during = await columnBoxes(page);
    sameAs(during.slice(0, before.length), before);
    expect(during.find((b) => b.title === "Rejected column")!.x).toBeGreaterThan(before.at(-1)!.right);
    await page.keyboard.press("Escape");
    await page.mouse.up();
    await expect(column(page, "Rejected")).toBeHidden();
    sameAs(await columnBoxes(page), before);
  });
});

test.describe("at a normal window width", () => {
  test.use({ viewport: { width: 1400, height: 1000 } });

  test("the board scrolls while dragging, to reach a column off-screen", async ({ page, request }) => {
    await addCard(page, request, "Drag Far Ltd", "Drag Far", "interested");
    const from = card(page, "Drag Far Ltd", "Drag Far");
    const box = await from.boundingBox();
    if (!box) throw new Error("Nothing to drag");
    await page.mouse.move(box.x + box.width / 2, box.y + 15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 12, box.y + 25, { steps: 4 });
    // The last column starts well off-screen: at 1,400 px even the open stages' columns, at their
    // narrowest (180 px), run past the window's edge, and the closed ones come in after them.
    const far = column(page, "Ghosted");
    expect((await far.boundingBox())!.x).toBeGreaterThan(1400 + 180);
    await page.mouse.move(1380, box.y + 40, { steps: 10 }); // the right-hand edge
    // Scrolled to the end: past Rejected (whose drop would ask for feedback) to the last column.
    await expect(said(page)).toContainText("Drag Far Ltd is over Ghosted.", { timeout: 15_000 });
    await page.mouse.up();
    await expect.poll(() => stageOf(request, "Drag Far")).toBe("ghosted");
  });
});

test.describe("dragging with the keyboard", () => {
  test("Space picks up, Escape cancels", async ({ page, request }) => {
    await addCard(page, request, "Key Cancel Ltd", "Key Cancel");
    const moves = watchMoves(page);
    await card(page, "Key Cancel Ltd", "Key Cancel").focus();
    await page.keyboard.press("Space");
    await expect(said(page)).toContainText("Key Cancel Ltd is over Applied.");
    await page.keyboard.press("Escape");
    await expect(said(page)).toContainText("Cancelled. Key Cancel Ltd stays where it was.");
    await settled(page);
    expect(moves).toEqual([]);
    expect(await stageOf(request, "Key Cancel")).toBe("applied");
  });

  test("the arrow keys carry it to another stage, and Space drops it", async ({ page, request }) => {
    await addCard(page, request, "Key Move Ltd", "Key Move");
    await card(page, "Key Move Ltd", "Key Move").focus();
    await page.keyboard.press("Space");
    await expect(said(page)).toContainText("Key Move Ltd is over Applied.");
    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(said(page)).toContainText("Key Move Ltd is over Screen.", { timeout: 100 });
    }).toPass({ timeout: 15_000 });
    await page.keyboard.press("Space");
    await expect(said(page)).toContainText("Key Move Ltd dropped on Screen.");
    await expect.poll(() => stageOf(request, "Key Move")).toBe("screen");
  });
});

test.describe("when the workflow limits moves", () => {
  test("a move it doesn't allow is refused, and nothing changes", async ({ page, request }) => {
    await addCard(page, request, "Drag Limited Ltd", "Drag Limited");
    await page.route("**/api/v1/workflow", async (route) => {
      const workflow = await (await route.fetch()).json();
      workflow.transitions = "configured";
      for (const stage of workflow.stages) stage.allowed_next = [];
      await route.fulfill({ json: workflow });
    });
    await page.reload();
    await expect(card(page, "Drag Limited Ltd", "Drag Limited")).toBeVisible();
    const moves = watchMoves(page);
    await drag(page, card(page, "Drag Limited Ltd", "Drag Limited"), "Screen", "Drag Limited Ltd");
    await expect(page.getByText("That move isn't allowed")).toBeVisible();
    await expect(page.getByText("Applied can't go to Screen.")).toBeVisible();
    await settled(page);
    expect(moves).toEqual([]);
    expect(await stageOf(request, "Drag Limited")).toBe("applied");
  });
});

test.describe("a column per interview round", () => {
  const rounds = (page: Page) => page.getByLabel("A column per interview round");
  const NO_ROUND = "Interviewing · No round yet";
  /** A card in the interviewing stage, with a first round booked. */
  const addRound = async (page: Page, request: APIRequestContext, company: string, role: string) => {
    await addCard(page, request, company, role, "interviewing");
    const row = (await rows(request)).find((r) => r.role_title === role) as Row;
    const made = await request.post(`/api/v1/applications/${row.id}/interviews`, {
      data: { title: "First chat", starts_at: new Date(Date.now() + 86_400_000).toISOString() },
    });
    expect(made.ok()).toBe(true);
    await page.reload();
    return row;
  };

  test("splits the interviewing stage, and is remembered", async ({ page }) => {
    await expect(column(page, NO_ROUND)).toBeHidden();
    await rounds(page).check({ force: true });
    await expect(column(page, NO_ROUND)).toBeVisible();
    await expect(column(page, "Interviewing · Round 1")).toBeVisible();
    await expect(column(page, "Interviewing · Round 2")).toBeVisible();
    await expect(
      column(page, "Interviewing · Round 3").getByLabel("Contoso: Senior Backend Engineer"),
    ).toBeVisible();
    await expect(column(page, "Interviewing")).toBeHidden();
    await page.reload();
    await expect(column(page, NO_ROUND)).toBeVisible();
    await rounds(page).uncheck({ force: true });
    await expect(column(page, "Interviewing")).toBeVisible();
  });

  test("leaves other stages alone", async ({ page }) => {
    await rounds(page).check({ force: true });
    await expect(column(page, "Applied")).toBeVisible();
    await expect(column(page, "Offer")).toBeVisible();
  });

  test("a card in a round moves on to the next stage like any other", async ({ page, request }) => {
    await addRound(page, request, "Round Out Ltd", "Round Out");
    await rounds(page).check({ force: true });
    await expect(column(page, "Interviewing · Round 1").getByLabel("Round Out Ltd: Round Out")).toBeVisible();
    await drag(page, card(page, "Round Out Ltd", "Round Out"), "Final", "Round Out Ltd");
    await expect.poll(() => stageOf(request, "Round Out")).toBe("final");
  });

  test("a card already in a round can't go back to No round yet", async ({ page, request }) => {
    await addRound(page, request, "Round Back Ltd", "Round Back");
    await rounds(page).check({ force: true });
    const moves = watchMoves(page);
    await drag(page, card(page, "Round Back Ltd", "Round Back"), NO_ROUND, "Round Back Ltd");
    await expect(page.getByText("Rounds go in order")).toBeVisible();
    await settled(page);
    expect(moves).toEqual([]);
  });

  test("a card can't be dropped straight into a round", async ({ page, request }) => {
    await addCard(page, request, "Round Skip Ltd", "Round Skip");
    const moves = watchMoves(page);
    await rounds(page).check({ force: true });
    await drag(page, card(page, "Round Skip Ltd", "Round Skip"), "Interviewing · Round 2", "Round Skip Ltd");
    await expect(page.getByText("Rounds go in order")).toBeVisible();
    await expect(
      page.getByText(
        "Drop it on Interviewing · No round yet; it moves along as you add its interview rounds.",
      ),
    ).toBeVisible();
    await settled(page);
    expect(moves).toEqual([]);
  });

  test("dropping on No round yet moves it into the stage", async ({ page, request }) => {
    await addCard(page, request, "Round Enter Ltd", "Round Enter");
    await rounds(page).check({ force: true });
    await drag(page, card(page, "Round Enter Ltd", "Round Enter"), NO_ROUND, "Round Enter Ltd");
    await expect(column(page, NO_ROUND).getByLabel("Round Enter Ltd: Round Enter")).toBeVisible();
    await expect.poll(() => stageOf(request, "Round Enter")).toBe("interviewing");
  });

  test("a card's round comes from its interviews, so it can't be dragged between rounds", async ({
    page,
    request,
  }) => {
    await addCard(page, request, "Round Stay Ltd", "Round Stay", "interviewing");
    await rounds(page).check({ force: true });
    await drag(page, card(page, "Round Stay Ltd", "Round Stay"), "Interviewing · Round 1", "Round Stay Ltd");
    await expect(
      page.getByText(
        "A card's round comes from its interviews: add or finish a round on the application to move it along.",
      ),
    ).toBeVisible();
    await expect(column(page, NO_ROUND).getByLabel("Round Stay Ltd: Round Stay")).toBeVisible();
    expect(await stageOf(request, "Round Stay")).toBe("interviewing");
  });

  test("adding its interview moves the card along", async ({ page, request }) => {
    await addCard(page, request, "Round Along Ltd", "Round Along", "interviewing");
    await rounds(page).check({ force: true });
    await expect(column(page, NO_ROUND).getByLabel("Round Along Ltd: Round Along")).toBeVisible();
    const row = (await rows(request)).find((r) => r.role_title === "Round Along") as Row;
    const made = await request.post(`/api/v1/applications/${row.id}/interviews`, {
      data: { title: "First chat", starts_at: new Date(Date.now() + 86_400_000).toISOString() },
    });
    expect(made.ok()).toBe(true);
    await page.reload();
    await expect(
      column(page, "Interviewing · Round 1").getByLabel("Round Along Ltd: Round Along"),
    ).toBeVisible();
  });
});
