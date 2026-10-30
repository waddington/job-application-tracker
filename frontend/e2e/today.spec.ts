import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Today: the home page. Tests share this file's data, and a few act on the same seeded person or
// call in a way that can't clash; none relies on another having run. Where a test needs a state
// the seed lacks, it makes one through the API.

const section = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const comingUp = (page: Page) => page.locator("#coming-up");

/** Today's date as the browser sees it (the config runs it in London). */
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const yesterday = () => new Date(Date.now() - 24 * 3600 * 1000).toISOString();

const get = async <T>(request: APIRequestContext, path: string): Promise<T> =>
  (await request.get(`/api/v1/${path}`)).json();

interface App {
  id: string;
  company_name: string;
  role_title: string;
  stage: string;
  follow_up_on: string | null;
  snoozed_until: string | null;
  reply_to_read_since: string | null;
  awaiting_reply_since: string | null;
}
interface Person {
  id: string;
  name: string;
  chased_on: string | null;
  closed_as: string | null;
  reply_to_read_since: string | null;
}
interface Call {
  id: string;
  title: string | null;
  status: string;
  notes: string | null;
}

const app = async (request: APIRequestContext, role: string) =>
  (await get<App[]>(request, "applications")).find((a) => a.role_title === role) as App;
const person = async (request: APIRequestContext, name: string) =>
  (await get<Person[]>(request, "contacts")).find((c) => c.name === name) as Person;
const call = async (request: APIRequestContext, title: string) =>
  (await get<Call[]>(request, "meetings")).find((m) => m.title === title) as Call;

/** Records anything the browser changes from here on. */
const watchWrites = (page: Page) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(`${r.method()} ${r.url()}`);
  });
  return writes;
};

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
});

test.describe("what it shows", () => {
  test("the numbers, the pipeline and the three groups", async ({ page }) => {
    await expect(page.getByText(/^\d+ active$/)).toBeVisible();
    await expect(page.getByText("1 interview in the next two weeks")).toBeVisible();
    await expect(page.getByText("2 offers to answer")).toBeVisible();
    await expect(page.getByLabel("Active applications by stage")).toBeVisible();
    for (const group of ["Your move", "Coming up", "Waiting on them"]) {
      await expect(page.getByRole("heading", { name: group, level: 3 })).toBeVisible();
      await expect(page.getByLabel(new RegExp(`^\\d+ in ${group}$`))).toBeVisible();
    }
  });

  test("the sections that always have something in the seed", async ({ page }) => {
    for (const name of ["Offers to answer", "To-dos", "Roles to decide", "Waiting to hear back"]) {
      await expect(section(page, name)).toBeVisible();
    }
  });

  test("offers say what they're worth and when to answer, and link to their application", async ({
    page,
  }) => {
    const offers = section(page, "Offers to answer");
    const litware = offers
      .locator("div")
      .filter({ hasText: "£95,000 a year" })
      .filter({ hasText: "Litware" })
      .filter({ hasNotText: "Wide World" })
      .first();
    await expect(litware).toContainText(/Reply by \d+ \w+ \d{4}/);
    await offers.getByRole("link", { name: "Litware · Senior Software Engineer" }).click();
    await expect(page).toHaveURL(/\/applications\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Senior Software Engineer" })).toBeVisible();
  });

  test("Coming up lists what's booked by time, then rounds not booked yet", async ({ page }) => {
    const text = await comingUp(page).innerText();
    const order = [
      "Roles for the new year",
      "Ask who's on the platform team",
      "Round 3 · System design test",
      "Round 4 · Final with the CTO",
    ].map((item) => text.indexOf(item));
    expect(order.every((at) => at >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    await expect(comingUp(page).getByText("Not booked yet")).toBeVisible();
  });

  test("how long someone usually takes to reply", async ({ page }) => {
    await expect(
      section(page, "Waiting to hear back").getByText(/Usually replies within 1 working day/),
    ).toBeVisible();
  });

  test("Recent activity folds out, with a link to the Timeline", async ({ page }) => {
    await page.getByRole("button", { name: "Recent activity" }).click();
    const panel = page.getByRole("region", { name: "Recent activity" });
    await expect(panel.getByRole("link").last()).toHaveAttribute("href", "/timeline");
    await expect(panel.getByText(/Contoso|Litware|Wide World|Coho|Fabrikam|Adventure/).first()).toBeVisible();
  });

  test("How it works folds out", async ({ page }) => {
    await page.getByRole("button", { name: "How it works" }).last().click();
    await expect(
      page.getByRole("region", { name: "How it works" }).getByText("Add an application"),
    ).toBeVisible();
  });

  test("opening a row shows the quick view", async ({ page }) => {
    await page.getByLabel("Open Coho Winery").first().click();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Move to…" })).toBeVisible();
  });

  test("with nothing to do, it says you're caught up", async ({ page }) => {
    await page.route("**/api/v1/next-actions*", async (route) => {
      const real = await (await route.fetch()).json();
      const empty = Object.fromEntries(
        Object.entries(real).map(([key, value]) => [key, Array.isArray(value) ? [] : value]),
      );
      await route.fulfill({ json: empty });
    });
    await page.route("**/api/v1/todos*", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/v1/role-summaries*", (route) => route.fulfill({ json: [] }));
    await page.reload();
    await expect(page.getByText("All caught up")).toBeVisible();
  });
});

test.describe("replies", () => {
  test("reading an application's reply clears it", async ({ page, request }) => {
    const replies = section(page, "Replies to read");
    await replies.getByRole("button", { name: "Read it: Fabrikam" }).click();
    await expect(replies.getByRole("button", { name: "Read it: Fabrikam" })).toBeHidden();
    expect((await app(request, "Staff Platform Engineer")).reply_to_read_since).toBeNull();
  });

  test("reading a person's reply clears it", async ({ page, request }) => {
    const replies = section(page, "Replies to read");
    await replies.getByRole("button", { name: "Read it: Sam Patel" }).click();
    await expect(replies.getByRole("button", { name: "Read it: Sam Patel" })).toBeHidden();
    expect((await person(request, "Sam Patel")).reply_to_read_since).toBeNull();
  });

  test("They've replied moves a waiting application to Replies to read", async ({ page }) => {
    const waiting = section(page, "Waiting to hear back");
    await waiting.getByRole("button", { name: "They've replied: Adventure Works" }).click();
    await expect(waiting.getByRole("button", { name: "They've replied: Adventure Works" })).toBeHidden();
    await expect(
      section(page, "Replies to read").getByRole("button", { name: "Read it: Adventure Works" }),
    ).toBeVisible();
  });

  test("Heard back ends the wait", async ({ page, request }) => {
    const waiting = section(page, "Waiting to hear back");
    await waiting.getByRole("button", { name: "Heard back from Coho Winery" }).click();
    await expect(waiting.getByRole("button", { name: "Heard back from Coho Winery" })).toBeHidden();
    expect((await app(request, "Full-stack Engineer")).awaiting_reply_since).toBeNull();
  });
});

test.describe("chasing people", () => {
  test("Chased is recorded with today's date", async ({ page, request }) => {
    await page.getByRole("button", { name: "Chased: Alex Morgan" }).click();
    await expect.poll(async () => (await person(request, "Alex Morgan")).chased_on).toBe(today());
  });

  test("Ghosted takes someone off the list, and Undo brings them back", async ({ page, request }) => {
    const waiting = section(page, "Waiting to hear back");
    await waiting.getByRole("button", { name: "Ghosted: Alex Morgan" }).click();
    await expect(waiting.getByRole("button", { name: "Ghosted: Alex Morgan" })).toBeHidden();
    expect((await person(request, "Alex Morgan")).closed_as).toBe("ghosted");
    await page.getByRole("alert").getByRole("button", { name: "Undo" }).click();
    await expect(waiting.getByRole("button", { name: "Ghosted: Alex Morgan" })).toBeVisible();
    expect((await person(request, "Alex Morgan")).closed_as).toBeNull();
  });

  test("Not interested takes someone off the list", async ({ page, request }) => {
    const jordan = await person(request, "Jordan Lee");
    await request.patch(`/api/v1/contacts/${jordan.id}`, { data: { awaiting_reply_since: today() } });
    await page.reload();
    const waiting = section(page, "Waiting to hear back");
    await waiting.getByRole("button", { name: "Not interested: Jordan Lee" }).click();
    await expect(waiting.getByRole("button", { name: "Not interested: Jordan Lee" })).toBeHidden();
    expect((await person(request, "Jordan Lee")).closed_as).toBe("not_interested");
  });
});

test.describe("How did it go?", () => {
  const SEEDED = "Call with Sam Patel: Feedback on the final";

  const bookPastCall = async (page: Page, request: APIRequestContext, title: string) => {
    const alex = await person(request, "Alex Morgan");
    const made = await request.post("/api/v1/meetings", {
      data: { contact_id: alex.id, title, starts_at: yesterday() },
    });
    expect(made.ok()).toBe(true);
    await page.reload();
    return `Call with Alex Morgan: ${title}`;
  };

  const bookPastRound = async (page: Page, request: APIRequestContext, title: string) => {
    const go = await app(request, "Backend Engineer (Go)");
    const made = await request.post(`/api/v1/applications/${go.id}/interviews`, {
      data: { title, starts_at: yesterday() },
    });
    expect(made.ok()).toBe(true);
    await page.reload();
  };

  test("Happened opens the call, and cancelling saves nothing", async ({ page }) => {
    const writes = watchWrites(page);
    await page.getByRole("button", { name: `Happened: ${SEEDED}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("How did it go?")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: `Happened: ${SEEDED}` })).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("Happened, then saving, records how it went", async ({ page, request }) => {
    const label = await bookPastCall(page, request, "Happened test");
    await page.getByRole("button", { name: `Happened: ${label}` }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("How did it go?").fill("Good chat, two roles to look at");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("button", { name: `Happened: ${label}` })).toBeHidden();
    expect(await call(request, "Happened test")).toMatchObject({
      status: "done",
      notes: expect.stringContaining("Good chat"),
    });
  });

  test("Didn't happen asks what happened, and saves nothing until you confirm", async ({ page, request }) => {
    const label = await bookPastCall(page, request, "Missed test");
    const writes = watchWrites(page);
    const button = page.getByRole("button", { name: `Didn't happen: ${label}` });
    await button.click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("What happened?").fill("They had to cancel");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeVisible();
    expect(writes).toEqual([]);

    await button.click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("What happened?").fill("They had to cancel");
    await dialog.getByRole("button", { name: "Mark as didn't happen" }).click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeHidden();
    expect(await call(request, "Missed test")).toMatchObject({
      status: "cancelled",
      notes: expect.stringContaining("They had to cancel"),
    });
  });

  test("a round's Done asks for the debrief and the questions", async ({ page, request }) => {
    await bookPastRound(page, request, "Done round");
    await page.getByRole("button", { name: /^Done: Round \d+ · Done round/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Debrief").fill("Went well");
    await dialog.getByLabel("Questions asked").fill("Why this company?");
    await dialog.getByRole("button", { name: "Mark as done" }).click();
    await expect(page.getByRole("button", { name: /^Done: Round \d+ · Done round/ })).toBeHidden();
    const rounds = await get<{ title: string; status: string; debrief: string; questions: string }[]>(
      request,
      "interviews",
    );
    expect(rounds.find((r) => r.title === "Done round")).toMatchObject({
      status: "done",
      debrief: "Went well",
      questions: "Why this company?",
    });
  });

  test("a round's Didn't happen is kept on the record", async ({ page, request }) => {
    await bookPastRound(page, request, "Missed round");
    await page.getByRole("button", { name: /^Didn't happen: Round \d+ · Missed round/ }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("What happened?").fill("They rescheduled");
    await dialog.getByRole("button", { name: "Mark as didn't happen" }).click();
    await expect(page.getByRole("button", { name: /^Didn't happen: Round \d+ · Missed round/ })).toBeHidden();
    const rounds = await get<{ title: string; status: string }[]>(request, "interviews");
    expect(rounds.find((r) => r.title === "Missed round")?.status).toBe("cancelled");
  });
});

test.describe("to-dos", () => {
  const box = (page: Page, name: string, checked?: boolean) =>
    section(page, "To-dos").getByRole("checkbox", { name, exact: true, checked });

  const add = async (page: Page, text: string) => {
    const todos = section(page, "To-dos");
    await todos.getByLabel("New to-do").fill(text);
    await todos.getByRole("button", { name: "Add", exact: true }).click();
    await expect(box(page, text)).toBeVisible();
    return todos;
  };

  test("the button stays off until there's something to add", async ({ page }) => {
    await expect(section(page, "To-dos").getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  });

  test("adding one shows it, and it's still there after a reload", async ({ page }) => {
    await add(page, "Update my CV headline");
    await page.reload();
    await expect(box(page, "Update my CV headline")).toBeVisible();
  });

  test("ticking one moves it to Done recently, and unticking brings it back", async ({ page }) => {
    const todos = await add(page, "Book the train");
    await box(page, "Book the train").click();
    await expect(box(page, "Book the train", false)).toBeHidden();
    await todos.getByRole("button", { name: "Done recently" }).click();
    await box(page, "Book the train", true).click();
    await expect(box(page, "Book the train", false)).toBeVisible();
  });

  test("Undo after ticking brings it back", async ({ page }) => {
    await add(page, "Tick by mistake");
    await box(page, "Tick by mistake").click();
    await expect(box(page, "Tick by mistake")).toBeHidden();
    await page
      .getByRole("alert")
      .filter({ hasText: "Tick by mistake" })
      .getByRole("button", { name: "Undo" })
      .click();
    await expect(box(page, "Tick by mistake", false)).toBeVisible();
  });

  test("editing one changes its text", async ({ page }) => {
    const todos = await add(page, "Draft an email");
    await todos.getByRole("button", { name: "Edit to-do: Draft an email" }).click();
    await todos.getByLabel("What needs doing").fill("Draft a better email");
    await todos.getByRole("button", { name: "Save to-do" }).click();
    await expect(box(page, "Draft a better email")).toBeVisible();
    await expect(box(page, "Draft an email")).toBeHidden();
  });

  test("deleting one removes it, and Undo adds it back", async ({ page }) => {
    const todos = await add(page, "Throw this away");
    await todos.getByRole("button", { name: "Delete to-do: Throw this away" }).click();
    await expect(box(page, "Throw this away")).toBeHidden();
    await page
      .getByRole("alert")
      .filter({ hasText: "Throw this away" })
      .getByRole("button", { name: "Undo" })
      .click();
    await expect(box(page, "Throw this away")).toBeVisible();
  });

  test("one dated later goes under Coming up", async ({ page }) => {
    const todos = section(page, "To-dos");
    await todos.getByLabel("New to-do").fill("Renew the passport");
    await todos.getByLabel("Due (optional)").fill("1 Jan 2099");
    await page.keyboard.press("Escape");
    await todos.getByRole("button", { name: "Add", exact: true }).click();
    await expect(comingUp(page).getByRole("checkbox", { name: "Renew the passport" })).toBeVisible();
    await expect(todos.getByRole("checkbox", { name: "Renew the passport" })).toBeHidden();
    await expect(comingUp(page).getByText("By 1 Jan 2099")).toBeVisible();
  });
});

test.describe("follow-ups and quiet applications", () => {
  test("a follow-up reminder moves its date on, and it leaves Follow up", async ({ page, request }) => {
    const follow = section(page, "Follow up");
    await follow.getByRole("button", { name: "Follow up on Northwind Traders" }).click();
    await page.getByRole("menuitem", { name: "Next week" }).click();
    await expect(follow.getByText("Northwind Traders")).toBeHidden();
    const date = (await app(request, "Lead Engineer")).follow_up_on as string;
    expect(date > today()).toBe(true);
  });

  test("Done on a follow-up clears the date and logs it", async ({ page, request }) => {
    const row = await app(request, "Senior Python Developer");
    await request.patch(`/api/v1/applications/${row.id}`, { data: { follow_up_on: today() } });
    await page.reload();
    const line = section(page, "Follow up")
      .locator("div")
      .filter({ has: page.getByLabel("Open Wide World Importers") })
      .filter({ has: page.getByRole("button", { name: "Done", exact: true }) })
      .last();
    await line.getByRole("button", { name: "Done", exact: true }).click();
    await expect.poll(async () => (await app(request, "Senior Python Developer")).follow_up_on).toBeNull();
    const detail = await get<{ events: { summary: string | null }[] }>(request, `applications/${row.id}`);
    expect(detail.events.map((e) => e.summary)).toContain("Followed up");
  });

  test("snoozing takes a quiet application off the list", async ({ page, request }) => {
    const quiet = section(page, "Gone quiet");
    await quiet.getByRole("button", { name: "Snooze Litware" }).click();
    await page.getByRole("menuitem", { name: "1 week" }).click();
    await expect(quiet.getByRole("button", { name: "Snooze Litware" })).toBeHidden();
    const until = (await app(request, "Senior Software Engineer")).snoozed_until as string;
    expect(until > today()).toBe(true);
  });

  test("marking one Ghosted asks first, and cancelling changes nothing", async ({ page, request }) => {
    const writes = watchWrites(page);
    const quiet = section(page, "Gone quiet");
    let asked = "";
    page.once("dialog", (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await quiet.getByRole("button", { name: "Mark Coho Winery as Ghosted" }).click();
    await expect.poll(() => asked).toContain("Coho Winery");
    await expect(quiet.getByRole("button", { name: "Mark Coho Winery as Ghosted" })).toBeVisible();
    expect(writes).toEqual([]);
    expect((await app(request, "Senior Full-stack Engineer")).stage).not.toBe("ghosted");
  });

  test("marking one Ghosted moves its stage", async ({ page, request }) => {
    page.once("dialog", (dialog) => dialog.accept());
    const quiet = section(page, "Gone quiet");
    await quiet.getByRole("button", { name: "Mark Coho Winery as Ghosted" }).click();
    await expect(quiet.getByRole("button", { name: "Mark Coho Winery as Ghosted" })).toBeHidden();
    expect((await app(request, "Senior Full-stack Engineer")).stage).toBe("ghosted");
  });
});

test.describe("roles to decide", () => {
  test("Pass takes a role off the list, with its reason kept", async ({ page, request }) => {
    const roles = section(page, "Roles to decide");
    await roles.getByRole("button", { name: "Pass: Founding Backend Engineer" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Why? (optional)").fill("Too early a stage");
    await dialog.getByRole("button", { name: "Pass", exact: true }).click();
    await expect(roles.getByRole("button", { name: "Pass: Founding Backend Engineer" })).toBeHidden();
    const all = await get<{ title: string; decision: string; decision_reason: string }[]>(request, "roles");
    expect(all.find((r) => r.title === "Founding Backend Engineer")).toMatchObject({
      decision: "passed",
      decision_reason: "Too early a stage",
    });
  });

  test("Apply makes the application and opens it", async ({ page }) => {
    await section(page, "Roles to decide")
      .getByRole("button", { name: "Apply: Senior Frontend Engineer" })
      .click();
    await page.getByRole("dialog").getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Senior Frontend Engineer" })).toBeVisible();
  });
});
