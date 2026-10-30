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
    await expect(column(page, "Rejected")).toBeHidden();
    await drag(page, card(page, "Drag Closed Ltd", "Drag Closed"), "Rejected", "Drag Closed Ltd");
    await expect(page.getByText("Drag Closed Ltd moved to Rejected")).toBeVisible();
    await expect.poll(() => stageOf(request, "Drag Closed")).toBe("rejected");
    await expect(card(page, "Drag Closed Ltd", "Drag Closed")).toBeHidden();
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
    await page.mouse.move(1380, box.y + 40, { steps: 10 }); // the right-hand edge
    await expect(said(page)).toContainText(/Drag Far Ltd is over (Rejected|Withdrawn|Ghosted)\./, {
      timeout: 15_000,
    });
    await page.mouse.up();
    await expect.poll(() => stageOf(request, "Drag Far")).toMatch(/rejected|withdrawn|ghosted/);
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
