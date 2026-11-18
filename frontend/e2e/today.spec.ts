import type { APIRequestContext, APIResponse, Page } from "@playwright/test";

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

  test("a round or call on today has the Today pill at full strength; later ones don't", async ({
    page,
    request,
  }) => {
    const soon = new Date(Date.now() + 10 * 60 * 1000);
    const londonDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(d);
    test.skip(londonDay(soon) !== today(), "too close to midnight to book something later today");
    const go = await app(request, "Backend Engineer (Go)");
    const alex = await person(request, "Alex Morgan");
    expect(
      (
        await request.post(`/api/v1/applications/${go.id}/interviews`, {
          data: { title: "Pill round", starts_at: soon.toISOString() },
        })
      ).ok(),
    ).toBe(true);
    expect(
      (
        await request.post("/api/v1/meetings", {
          data: { contact_id: alex.id, title: "Pill call", starts_at: soon.toISOString() },
        })
      ).ok(),
    ).toBe(true);
    await page.reload();
    const row = (title: string) =>
      comingUp(page)
        .getByText(title)
        .locator("xpath=ancestor::div[contains(@class,'mantine-Stack-root')][1]");
    // How strongly it shows: its own opacity times every parent's (buttons fade until you point at a row).
    const strength = (el: ReturnType<Page["locator"]>) =>
      el.evaluate((e) => {
        let o = 1;
        for (let n: Element | null = e; n; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
        return o;
      });
    await page.mouse.move(0, 0);
    for (const title of ["Pill round", "Call with Alex Morgan: Pill call"]) {
      const pill = row(title).getByText("Today", { exact: true });
      await expect(pill).toBeVisible();
      expect(await strength(pill)).toBe(1);
      // Its Reschedule fades like every other row's, round or call.
      expect(await strength(row(title).getByRole("button", { name: "Reschedule" }))).toBeLessThan(1);
    }
    // Tomorrow's call keeps its date and gets no pill (found first, so the check can't pass on nothing).
    const tomorrow = row("Roles for the new year");
    await expect(tomorrow.getByRole("button", { name: "Reschedule" })).toBeVisible();
    await expect(tomorrow.getByText("Today", { exact: true })).toHaveCount(0);
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

  test("a round's Done moves its application to Waiting to hear back", async ({ page, request }) => {
    // Its own application, with no other round to come: the seeded ones have some.
    const idOf = async (made: Promise<APIResponse>) => ((await (await made).json()) as { id: string }).id;
    const company_id = await idOf(request.post("/api/v1/companies", { data: { name: "Wingtip Toys" } }));
    const role_id = await idOf(
      request.post("/api/v1/roles", { data: { company_id, title: "Waiting Round Engineer" } }),
    );
    const appId = await idOf(
      request.post("/api/v1/applications", { data: { role_id, stage: "interviewing" } }),
    );
    const happened = yesterday();
    const made = await request.post(`/api/v1/applications/${appId}/interviews`, {
      data: { title: "Wait round", starts_at: happened },
    });
    expect(made.ok()).toBe(true);
    await page.reload();
    const done = page.getByRole("button", { name: /^Done: Round \d+ · Wait round/ });
    const heardBack = section(page, "Waiting to hear back").getByRole("button", {
      name: "Heard back from Wingtip Toys",
    });
    await expect(done).toBeVisible();
    await expect(heardBack).toBeHidden();
    await done.click();
    await page.getByRole("dialog").getByRole("button", { name: "Mark as done" }).click();
    await expect(done).toBeHidden();
    await expect(heardBack).toBeVisible();
    // Waiting since the day the round happened, in the browser's time zone (London).
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date(happened));
    expect((await get<App>(request, `applications/${appId}`)).awaiting_reply_since).toBe(day);
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

  // The form stops an empty to-do, so the refusal is sent by hand. The detail differs from the text
  // on purpose: the toast must show the text for the code, and the detail only without one.
  for (const [body, shown] of [
    [{ detail: "The API's English", code: "todo_text_required", params: {} }, "text: say what needs doing"],
    [{ detail: "The API's English" }, "The API's English"],
    [{ detail: "The API's English", code: "from_a_newer_server", params: {} }, "The API's English"],
  ] as const) {
    test(`a refusal shows "${shown}" for ${JSON.stringify(body)}`, async ({ page, problems }) => {
      problems.allow(/422.*\/api\/v1\/todos/);
      await page.route("**/api/v1/todos", (route) =>
        route.request().method() === "POST" ? route.fulfill({ status: 422, json: body }) : route.fallback(),
      );
      const todos = section(page, "To-dos");
      await todos.getByLabel("New to-do").fill("Refused to-do");
      await todos.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText("That didn't work")).toBeVisible();
      await expect(page.getByText(shown, { exact: true })).toBeVisible();
    });
  }

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
    const detail = await get<{ events: { summary: string | null; msg: { key: string } | null }[] }>(
      request,
      `applications/${row.id}`,
    );
    const followed = detail.events.find((e) => e.summary === "Followed up");
    expect(followed?.msg?.key).toBe("event.followedUp");
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

test.describe("the recruiter on a row", () => {
  // Two applications made here, one through an in-house recruiter: their rounds and offers show
  // "Company · Role · Recruiter", and the other's just "Company · Role".
  const send = async (request: APIRequestContext, path: string, data: object) => {
    const made = await request.post(`/api/v1/${path}`, { data });
    expect(made.ok(), path).toBe(true);
    return (await made.json()) as { id: string };
  };
  const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

  test("shows on rounds to close, rounds needing a new time and offers", async ({ page, request }) => {
    const make = async (company: string, recruiter?: string) => {
      const { id } = await send(request, "applications/quick", {
        company_name: company,
        role_title: "Card Role",
        route: "direct",
        recruiter_name: recruiter,
      });
      await send(request, `applications/${id}/interviews`, { title: "Past round", starts_at: yesterday() });
      const moving = await send(request, `applications/${id}/interviews`, { starts_at: inDays(3) });
      await send(request, `interviews/${moving.id}/needs-new-time`, { by: "them" });
      await send(request, `applications/${id}/offers`, { respond_by: inDays(3).slice(0, 10) });
    };
    await make("Recruited Cards Co", "Harper Quill");
    await make("Unrecruited Cards Co");
    await page.reload();
    for (const name of ["How did it go?", "Needs a new time", "Offers to answer"]) {
      const line = (company: string) =>
        section(page, name)
          .locator("p")
          .filter({ has: page.getByRole("link", { name: `${company} · Card Role`, exact: true }) });
      await expect(line("Recruited Cards Co")).toHaveText("Recruited Cards Co · Card Role · Harper Quill");
      const person = line("Recruited Cards Co").getByRole("link", { name: "Harper Quill" });
      await expect(person).toHaveAttribute("href", /^\/people\/.+/);
      await expect(line("Unrecruited Cards Co")).toHaveText("Unrecruited Cards Co · Card Role");
    }
  });
});

// The three groups lay out by the room the page has, not the window's width (TodayPage.module.css), so the
// docked panel taking 540 px of a wide window doesn't squeeze them into three cramped columns.
test.describe("where the three groups sit", () => {
  type Box = { x: number; y: number; width: number; height: number };
  const boxes = async (page: Page): Promise<Box[]> =>
    Promise.all(
      ["#your-move", "#coming-up", "#waiting-on-them"].map(
        async (id) => (await page.locator(id).boundingBox())!,
      ),
    );
  /** How the groups sit: "move | ahead | waiting" side by side, "move | ahead / waiting" with Your move beside
   * the other two, or "stacked". Groups side by side share a top. */
  const arrangement = async (page: Page) => {
    const [move, ahead, waiting] = await boxes(page);
    if (move!.y === ahead!.y && ahead!.y === waiting!.y && move!.x < ahead!.x && ahead!.x < waiting!.x)
      return "three";
    if (move!.y === ahead!.y && ahead!.x > move!.x && waiting!.x === ahead!.x && waiting!.y > ahead!.y)
      return "two";
    if (move!.x === ahead!.x && ahead!.x === waiting!.x && move!.y < ahead!.y && ahead!.y < waiting!.y)
      return "stacked";
    return JSON.stringify({ move, ahead, waiting });
  };
  const narrowest = async (page: Page) => Math.min(...(await boxes(page)).map((b) => b.width));

  test("three columns on a wide page", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await expect.poll(() => arrangement(page)).toBe("three");
    expect(await narrowest(page)).toBeGreaterThanOrEqual(350);
    // The cards start level, though Coming up's hint wraps under its title.
    const cards = await Promise.all(
      ["#your-move", "#coming-up", "#waiting-on-them"].map(
        async (id) => (await page.locator(`${id} > .mantine-Card-root`).boundingBox())!,
      ),
    );
    const tops = cards.map((c) => c.y);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1);
    // …and each ends where its rows do, not stretched to the tallest (Your move has the most here).
    const [move, ahead] = cards;
    expect(ahead!.height).toBeLessThan(move!.height - 50);
    // A waiting row's name shows whole: its status drops under it rather than cutting it short.
    const names = page.locator("#waiting-on-them [data-panel-opener] > p:first-child");
    await expect(names.first()).toBeVisible();
    const cut = await names.evaluateAll((els) =>
      els.filter((el) => el.scrollWidth > el.clientWidth).map((el) => el.textContent),
    );
    expect(cut).toEqual([]);
    // Nor does the status run over it.
    const overlaps = await names.evaluateAll((els) =>
      els.flatMap((el) => {
        const name = el.getBoundingClientRect();
        const status = el
          .closest("[data-panel-opener]")!
          .parentElement!.nextElementSibling!.getBoundingClientRect();
        const sameLine = status.top < name.bottom && name.top < status.bottom;
        return sameLine && status.left < name.right ? [el.textContent] : [];
      }),
    );
    expect(overlaps).toEqual([]);
  });

  test("Your move beside the other two at mid widths", async ({ page }) => {
    await page.setViewportSize({ width: 1300, height: 1000 });
    await expect.poll(() => arrangement(page)).toBe("two");
    expect(await narrowest(page)).toBeGreaterThanOrEqual(350);
  });

  test("stacked when narrow", async ({ page }) => {
    await page.setViewportSize({ width: 900, height: 1000 });
    await expect.poll(() => arrangement(page)).toBe("stacked");
  });

  test("with the panel docked they make do with the room left, never cramped", async ({ page }) => {
    for (const [width, expected] of [
      [1400, "stacked"], // 1,400 px leaves the page about 570 px beside the menu and the panel
      [1920, "two"],
      [2560, "three"],
    ] as const) {
      await page.setViewportSize({ width, height: 1000 });
      await page.locator("[data-panel-opener]").first().click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("button", { name: "Move to…" })).toBeVisible();
      await expect.poll(() => arrangement(page), { message: `at ${width} px` }).toBe(expected);
      expect(await narrowest(page)).toBeGreaterThanOrEqual(350);
      // The page made room: no group runs under the panel.
      const panelLeft = (await dialog.boundingBox())!.x;
      for (const box of await boxes(page)) expect(box.x + box.width).toBeLessThanOrEqual(panelLeft);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    }
  });

  test("a very wide screen keeps its rows readable", async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 1000 });
    await expect.poll(() => arrangement(page)).toBe("three");
    // Nothing runs off the side or scrolls sideways.
    for (const box of await boxes(page)) expect(box.x + box.width).toBeLessThanOrEqual(2560);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
});
