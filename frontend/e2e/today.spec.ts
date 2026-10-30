import type { Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Today: the home page. Each test acts on its own seeded row, so none depends on another.

const section = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
});

test.describe("what it shows", () => {
  test("the numbers, the pipeline and the three groups", async ({ page }) => {
    await expect(page.getByText(/^\d+ active$/)).toBeVisible();
    await expect(page.getByText(/^\d+ interviews? in the next two weeks$/)).toBeVisible();
    await expect(page.getByText(/^\d+ offers? to answer$/)).toBeVisible();
    await expect(page.getByLabel("Active applications by stage")).toBeVisible();
    for (const group of ["Your move", "Coming up", "Waiting on them"]) {
      await expect(page.getByRole("heading", { name: group, level: 3 })).toBeVisible();
      await expect(page.getByLabel(new RegExp(`^\\d+ in ${group}$`))).toBeVisible();
    }
  });

  test("each section of Your move and Waiting on them", async ({ page }) => {
    for (const name of [
      "Replies to read",
      "Offers to answer",
      "How did it go?",
      "To-dos",
      "Follow up",
      "Roles to decide",
      "Waiting to hear back",
      "Gone quiet",
    ]) {
      await expect(section(page, name)).toBeVisible();
    }
  });

  test("offers say what they're worth and when to answer, and link to their application", async ({
    page,
  }) => {
    const offers = section(page, "Offers to answer");
    await expect(offers.getByText("£95,000 a year")).toBeVisible();
    await expect(offers.getByText(/^Reply by \d+ \w+ \d{4}$/).first()).toBeVisible();
    await offers.getByRole("link", { name: "Litware · Senior Software Engineer" }).click();
    await expect(page).toHaveURL(/\/applications\/[^/]+$/);
    await expect(page.getByRole("heading", { name: "Senior Software Engineer" })).toBeVisible();
  });

  test("Coming up lists what's booked by time, then rounds not booked yet", async ({ page }) => {
    const text = await page.locator("main").innerText();
    const booked = text.indexOf("Round 3 · System design test");
    const unbooked = text.indexOf("Round 4 · Final with the CTO");
    expect(booked).toBeGreaterThan(-1);
    expect(unbooked).toBeGreaterThan(booked);
    await expect(page.getByText("Not booked yet")).toBeVisible();
  });

  test("how long someone usually takes to reply", async ({ page }) => {
    await expect(page.getByText(/Usually replies within \d+ working days?/)).toBeVisible();
  });

  test("Recent activity and How it works fold out", async ({ page }) => {
    await page.getByRole("button", { name: "Recent activity" }).click();
    await expect(
      page
        .locator("main")
        .getByText(/ago|today|yesterday/)
        .last(),
    ).toBeVisible();
    await page.getByRole("button", { name: "How it works" }).last().click();
    await expect(page.getByText("Add an application").first()).toBeVisible();
  });
});

test.describe("replies", () => {
  test("reading an application's reply clears it", async ({ page, request }) => {
    const replies = section(page, "Replies to read");
    await replies.getByRole("button", { name: "Read it: Fabrikam" }).click();
    await expect(replies.getByRole("button", { name: "Read it: Fabrikam" })).toBeHidden();
    const rows = await (await request.get("/api/v1/applications")).json();
    const fabrikam = rows.find((row: { company_name: string }) => row.company_name === "Fabrikam");
    expect(fabrikam.reply_to_read_since).toBeNull();
  });

  test("reading a person's reply clears it", async ({ page }) => {
    const replies = section(page, "Replies to read");
    await replies.getByRole("button", { name: "Read it: Sam Patel" }).click();
    await expect(replies.getByRole("button", { name: "Read it: Sam Patel" })).toBeHidden();
  });

  test("They've replied moves a waiting application to Replies to read", async ({ page }) => {
    const waiting = section(page, "Waiting to hear back");
    await waiting.getByRole("button", { name: "They've replied: Adventure Works" }).click();
    await expect(waiting.getByRole("button", { name: "They've replied: Adventure Works" })).toBeHidden();
    await expect(
      section(page, "Replies to read").getByRole("button", { name: "Read it: Adventure Works" }),
    ).toBeVisible();
  });
});

test.describe("chasing people", () => {
  test("Chased is recorded", async ({ page, request }) => {
    const person = async () => {
      const contacts = await (await request.get("/api/v1/contacts")).json();
      return contacts.find((c: { name: string }) => c.name === "Alex Morgan");
    };
    expect((await person()).chased_on).toBeNull();
    await page.getByRole("button", { name: "Chased: Alex Morgan" }).click();
    await expect.poll(async () => (await person()).chased_on).not.toBeNull();
  });

  test("Ghosted takes someone off the list, and Undo brings them back", async ({ page }) => {
    const waiting = section(page, "Waiting to hear back");
    await waiting.getByRole("button", { name: "Ghosted: Alex Morgan" }).click();
    await expect(waiting.getByRole("button", { name: "Ghosted: Alex Morgan" })).toBeHidden();
    await page.getByRole("alert").getByRole("button", { name: "Undo" }).click();
    await expect(waiting.getByRole("button", { name: "Ghosted: Alex Morgan" })).toBeVisible();
  });
});

test.describe("How did it go?", () => {
  const CALL = "Call with Sam Patel: Feedback on the final";

  test("Happened opens the call, and cancelling changes nothing", async ({ page }) => {
    await page.getByRole("button", { name: `Happened: ${CALL}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("How did it go?").first()).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: `Happened: ${CALL}` })).toBeVisible();
  });

  test("Didn't happen asks what happened, and saves nothing until you confirm", async ({ page }) => {
    const button = page.getByRole("button", { name: `Didn't happen: ${CALL}` });
    await button.click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("What happened?").fill("They had to cancel");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeVisible();

    await button.click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("What happened?").fill("They had to cancel");
    await dialog.getByRole("button", { name: "Mark as didn't happen" }).click();
    await expect(dialog).toBeHidden();
    await expect(button).toBeHidden();
  });
});

test.describe("to-dos", () => {
  const add = async (page: Page, text: string) => {
    const todos = section(page, "To-dos");
    await todos.getByLabel("New to-do").fill(text);
    await todos.getByRole("button", { name: "Add", exact: true }).click();
    await expect(todos.getByRole("checkbox", { name: text })).toBeVisible();
    return todos;
  };

  test("the button stays off until there's something to add", async ({ page }) => {
    await expect(section(page, "To-dos").getByRole("button", { name: "Add", exact: true })).toBeDisabled();
  });

  test("adding one shows it, and it's still there after a reload", async ({ page }) => {
    const todos = await add(page, "Update my portfolio");
    await page.reload();
    await expect(todos.getByRole("checkbox", { name: "Update my portfolio" })).toBeVisible();
  });

  test("ticking one moves it to Done recently", async ({ page }) => {
    const todos = await add(page, "Book the train");
    await todos.getByRole("checkbox", { name: "Book the train" }).click();
    await expect(todos.getByRole("checkbox", { name: "Book the train" })).toBeHidden();
    await todos.getByRole("button", { name: "Done recently" }).click();
    await expect(page.getByText("Book the train").first()).toBeVisible();
  });

  test("editing one changes its text", async ({ page }) => {
    const todos = await add(page, "Draft an email");
    await todos.getByRole("button", { name: "Edit to-do: Draft an email" }).click();
    await todos.getByLabel("What needs doing").fill("Draft a better email");
    await todos.getByRole("button", { name: "Save to-do" }).click();
    await expect(todos.getByRole("checkbox", { name: "Draft a better email" })).toBeVisible();
  });

  test("deleting one removes it", async ({ page }) => {
    page.on("dialog", (dialog) => dialog.accept());
    const todos = await add(page, "Throw this away");
    await todos.getByRole("button", { name: "Delete to-do: Throw this away" }).click();
    await expect(todos.getByRole("checkbox", { name: "Throw this away" })).toBeHidden();
  });

  test("one dated later goes under Coming up", async ({ page }) => {
    const todos = section(page, "To-dos");
    await todos.getByLabel("New to-do").fill("Renew the passport");
    await todos.getByLabel("Due (optional)").fill("1 Jan 2099");
    await page.keyboard.press("Escape");
    await todos.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Renew the passport" })).toBeVisible();
    await expect(todos.getByRole("checkbox", { name: "Renew the passport" })).toBeHidden();
    await expect(page.getByText("By 1 Jan 2099")).toBeVisible();
  });
});

test.describe("follow-ups and quiet applications", () => {
  test("a follow-up reminder moves it out of Follow up for now", async ({ page, request }) => {
    const follow = section(page, "Follow up");
    await follow.getByRole("button", { name: "Follow up on Northwind Traders" }).click();
    await page.getByRole("menuitem", { name: "Next week" }).click();
    await expect(follow.getByText("Northwind Traders")).toBeHidden();
    const rows = await (await request.get("/api/v1/applications")).json();
    const row = rows.find((r: { company_name: string }) => r.company_name === "Northwind Traders");
    expect(row.follow_up_on).not.toBeNull();
  });

  test("snoozing takes a quiet application off the list", async ({ page }) => {
    const quiet = section(page, "Gone quiet");
    await quiet.getByRole("button", { name: "Snooze Litware" }).click();
    await page.getByRole("menuitem", { name: "1 week" }).click();
    await expect(quiet.getByRole("button", { name: "Snooze Litware" })).toBeHidden();
  });

  test("marking one Ghosted asks first, and cancelling changes nothing", async ({ page }) => {
    const quiet = section(page, "Gone quiet");
    let asked = "";
    page.once("dialog", (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await quiet.getByRole("button", { name: "Mark Coho Winery as Ghosted" }).click();
    await expect.poll(() => asked).toContain("Coho Winery");
    await expect(quiet.getByRole("button", { name: "Mark Coho Winery as Ghosted" })).toBeVisible();
  });

  test("marking one Ghosted moves its stage", async ({ page, request }) => {
    page.once("dialog", (dialog) => dialog.accept());
    const quiet = section(page, "Gone quiet");
    await quiet.getByRole("button", { name: "Mark Coho Winery as Ghosted" }).click();
    await expect(quiet.getByRole("button", { name: "Mark Coho Winery as Ghosted" })).toBeHidden();
    const rows = await (await request.get("/api/v1/applications?archived=false")).json();
    const row = rows.find((r: { role_title: string }) => r.role_title === "Senior Full-stack Engineer");
    expect(row.stage).toBe("ghosted");
  });
});

test.describe("roles to decide", () => {
  test("Pass takes a role off the list, with its reason kept", async ({ page }) => {
    const roles = section(page, "Roles to decide");
    await roles.getByRole("button", { name: "Pass: Founding Backend Engineer" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Why? (optional)").fill("Too early a stage");
    await dialog.getByRole("button", { name: "Pass", exact: true }).click();
    await expect(roles.getByRole("button", { name: "Pass: Founding Backend Engineer" })).toBeHidden();
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
