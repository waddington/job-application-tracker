import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// An application's own page. Each test makes its own application through the API, so it can move,
// edit or delete it freely.

interface Detail {
  id: string;
  stage: string;
  applied_on: string | null;
  follow_up_on: string | null;
  snoozed_until: string | null;
  tags: string[];
  archived: boolean;
  awaiting_reply_since: string | null;
  reply_to_read_since: string | null;
  can_undo: boolean;
  contacts: { contact_id: string; relation: string }[];
  documents: { document_name: string; version_label: string; sent_on: string | null }[];
  events: { kind: string; summary: string | null }[];
}

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const card = (page: Page, title: string): Locator =>
  page.locator(".mantine-Card-root", {
    has: page.getByRole("heading", { name: title, exact: true, level: 4 }),
  });

let counter = 0;

/** A new application of its own, opened in the browser. Returns its id and how to read it back. */
const openNew = async (page: Page, request: APIRequestContext, data: object = {}) => {
  counter += 1;
  const company = `Page Co ${counter}`;
  const role = `Page Role ${counter}`;
  const made = await request.post("/api/v1/applications/quick", {
    data: { company_name: company, role_title: role, route: "direct", stage: "applied", tags: [], ...data },
  });
  expect(made.ok()).toBe(true);
  const { id } = (await made.json()) as { id: string };
  await page.goto(`/applications/${id}`);
  await expect(page.getByRole("heading", { name: role })).toBeVisible();
  return {
    id,
    company,
    role,
    read: async (): Promise<Detail> => (await request.get(`/api/v1/applications/${id}`)).json(),
  };
};

const move = async (page: Page, stage: string) => {
  await page.getByRole("button", { name: "Move to…" }).click();
  await page.getByRole("menuitem", { name: stage, exact: true }).click();
};

test.describe("the summary", () => {
  test("shows the stage, the route with links, and the dates", async ({ page, request }) => {
    const app = await openNew(page, request, {
      route: "agency",
      agency_name: "Summary Agency",
      recruiter_name: "Summary Person",
      applied_on: "2026-03-03",
    });
    const line = page.getByText("Route:").locator("..");
    await expect(line).toHaveText("Route: Through Summary Person at Summary Agency");
    await expect(page.getByText("Applied on:").locator("..")).toHaveText("Applied on: 3 Mar 2026");
    await expect(page.getByText("Last activity:").locator("..")).toContainText("today");
    await line.getByRole("link", { name: "Summary Agency" }).click();
    await expect(page).toHaveURL(/\/agencies\//);
    await page.goBack();
    await page.getByText("Route:").locator("..").getByRole("link", { name: "Summary Person" }).click();
    await expect(page).toHaveURL(/\/people\//);
    await page.goBack();
    await page.getByRole("link", { name: app.company }).first().click();
    await expect(page).toHaveURL(/\/companies\//);
  });

  test("a referral and a direct application say so", async ({ page, request }) => {
    await openNew(page, request, { route: "referral" });
    await expect(page.getByText("Route:").locator("..")).toHaveText("Route: Referral");
    await openNew(page, request);
    await expect(page.getByText("Route:").locator("..")).toHaveText("Route: Applied directly");
  });

  test("the Role card links to the role and the company", async ({ page, request }) => {
    const app = await openNew(page, request, { role_url: "https://jobs.example.com/page-role" });
    const role = card(page, "Role");
    await expect(role.getByRole("link", { name: "Job ad" })).toHaveAttribute(
      "href",
      "https://jobs.example.com/page-role",
    );
    await role.getByRole("link", { name: app.role }).click();
    await expect(page).toHaveURL(/\/roles\//);
    await expect(page.getByRole("heading", { name: app.role })).toBeVisible();
  });

  test("warns about another application for the same job", async ({ page, request }) => {
    const app = await openNew(page, request);
    const again = await request.post("/api/v1/applications/quick", {
      data: { company_name: app.company, role_title: app.role, route: "direct", tags: [] },
    });
    expect(again.ok()).toBe(true);
    await page.reload();
    await expect(page.getByText("Also applied for this job")).toBeVisible();
  });
});

test.describe("moving it", () => {
  test("Move to… lists the usual next stages first, then the others", async ({ page, request }) => {
    await openNew(page, request);
    await page.getByRole("button", { name: "Move to…" }).click();
    await expect(page.getByText("Usual next")).toBeVisible();
    await expect(page.getByText("Other stages")).toBeVisible();
    const items = await page.getByRole("menuitem").allInnerTexts();
    expect(items).toContain("Screen");
    expect(items).not.toContain("Applied"); // where it is now
    expect(items.indexOf("Screen")).toBeLessThan(items.indexOf("Interested"));
  });

  test("moves it, with the badge and timeline following", async ({ page, request }) => {
    const app = await openNew(page, request);
    await move(page, "Screen");
    await expect.poll(async () => (await app.read()).stage).toBe("screen");
    await expect(card(page, "Timeline").getByText("Applied → Screen")).toBeVisible();
    await expect(page.locator(".mantine-Badge-root", { hasText: "Screen" }).first()).toBeVisible();
  });

  test("Undo goes back one move at a time, and is off when there's nothing to undo", async ({
    page,
    request,
  }) => {
    const app = await openNew(page, request);
    const undo = page.getByRole("button", { name: "Undo last move" });
    await expect(undo).toBeDisabled();
    await move(page, "Screen");
    await expect.poll(async () => (await app.read()).stage).toBe("screen");
    await move(page, "Interviewing");
    await expect.poll(async () => (await app.read()).stage).toBe("interviewing");
    await undo.click();
    await expect.poll(async () => (await app.read()).stage).toBe("screen");
    await expect(card(page, "Timeline").getByText("Undone: back to Screen")).toBeVisible();
    await undo.click();
    await expect.poll(async () => (await app.read()).stage).toBe("applied");
  });

  test("moving to Applied fills in the date, if it had none", async ({ page, request }) => {
    const app = await openNew(page, request, { stage: "interested" });
    expect((await app.read()).applied_on).toBeNull();
    await move(page, "Applied");
    await expect.poll(async () => (await app.read()).applied_on).toBe(today());
  });

  test("a move that fails says so, and it stays where it was", async ({ page, request, problems }) => {
    problems.allow(/\/move/);
    const app = await openNew(page, request);
    await page.route("**/move", (route) =>
      route.fulfill({ status: 500, json: { detail: "Server says no" } }),
    );
    await move(page, "Screen");
    await expect(page.getByText("That didn't work")).toBeVisible();
    expect((await app.read()).stage).toBe("applied");
  });
});

test.describe("waiting and replies", () => {
  test("I've replied, then They've replied, then Read it", async ({ page, request }) => {
    const app = await openNew(page, request);
    await page.getByRole("button", { name: "I've replied, waiting" }).click();
    await expect.poll(async () => (await app.read()).awaiting_reply_since).toBe(today());
    await page.getByRole("button", { name: "They've replied" }).click();
    await expect.poll(async () => (await app.read()).reply_to_read_since).toBe(today());
    expect((await app.read()).awaiting_reply_since).toBeNull();
    await page.getByRole("button", { name: "Read it" }).click();
    await expect.poll(async () => (await app.read()).reply_to_read_since).toBeNull();
  });

  test("Heard back ends the wait", async ({ page, request }) => {
    const app = await openNew(page, request);
    await page.getByRole("button", { name: "I've replied, waiting" }).click();
    await page.getByRole("button", { name: "Heard back" }).click();
    await expect.poll(async () => (await app.read()).awaiting_reply_since).toBeNull();
    await expect(page.getByRole("button", { name: "I've replied, waiting" })).toBeVisible();
  });

  test("a closed application doesn't offer them", async ({ page, request }) => {
    await openNew(page, request, { stage: "rejected" });
    await expect(page.getByRole("button", { name: "Move to…" })).toBeVisible();
    await expect(page.getByRole("button", { name: "I've replied, waiting" })).toBeHidden();
  });
});

test.describe("details", () => {
  test("Save is off until something changes", async ({ page, request }) => {
    await openNew(page, request);
    const save = page.getByRole("button", { name: "Save details" });
    await expect(save).toBeDisabled();
    await page.getByLabel("Tags").first().fill("backend");
    await page.keyboard.press("Enter");
    await expect(save).toBeEnabled();
  });

  test("saves dates and tags, which are still there after a reload", async ({ page, request }) => {
    const app = await openNew(page, request);
    await page.getByLabel("Applied on", { exact: true }).fill("5 Jan 2026");
    await page.getByLabel("Follow up on").fill("1 Jan 2099");
    await page.getByLabel("Snooze until").fill("2 Jan 2099");
    await page.getByLabel("Tags").first().fill("backend");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect.poll(async () => (await app.read()).tags).toEqual(["backend"]);
    expect(await app.read()).toMatchObject({
      applied_on: "2026-01-05",
      follow_up_on: "2099-01-01",
      snoozed_until: "2099-01-02",
    });
    await expect(page.getByRole("button", { name: "Save details" })).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel("Follow up on")).toHaveValue("1 Jan 2099");
    await expect(page.getByText("Follow up on:").locator("..")).toHaveText("Follow up on: 1 Jan 2099");
  });

  test("clearing a date clears it", async ({ page, request }) => {
    const app = await openNew(page, request, { applied_on: "2026-03-03" });
    const applied = page.getByLabel("Applied on", { exact: true });
    await applied.clear();
    await page.keyboard.press("Tab");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect.poll(async () => (await app.read()).applied_on).toBeNull();
  });

  test("Archived takes it off the normal list, and can be undone", async ({ page, request }) => {
    const app = await openNew(page, request);
    await page.getByLabel("Archived").click({ force: true });
    await expect.poll(async () => (await app.read()).archived).toBe(true);
    await expect(page.locator(".mantine-Badge-root", { hasText: "Archived" })).toBeVisible();
    await page.getByLabel("Archived").click({ force: true });
    await expect.poll(async () => (await app.read()).archived).toBe(false);
  });

  test("an unsaved edit survives moving the stage", async ({ page, request }) => {
    const app = await openNew(page, request);
    await page.getByLabel("Tags").first().fill("keepme");
    await page.keyboard.press("Enter");
    await move(page, "Screen");
    await expect.poll(async () => (await app.read()).stage).toBe("screen");
    await page.getByRole("button", { name: "Save details" }).click();
    await expect.poll(async () => (await app.read()).tags).toEqual(["keepme"]);
  });
});

test.describe("log activity", () => {
  for (const [kind, button] of [
    ["Call", "Log call"],
    ["Email", "Log email"],
    ["Message", "Log message"],
    ["Note", "Log note"],
  ] as const) {
    test(`logs a ${kind.toLowerCase()} on the timeline`, async ({ page, request }) => {
      const app = await openNew(page, request);
      const log = card(page, "Log activity");
      await log.locator(".mantine-SegmentedControl-root").getByText(kind, { exact: true }).click();
      await log.getByPlaceholder("What happened?").fill(`A ${kind} happened`);
      await log.getByRole("button", { name: button }).click();
      const timeline = card(page, "Timeline");
      await expect(timeline.getByText(`A ${kind} happened`)).toBeVisible();
      await expect(timeline.getByText(kind, { exact: true })).toBeVisible();
      await expect(log.getByPlaceholder("What happened?")).toHaveValue("");
      expect((await app.read()).events.map((e) => e.summary)).toContain(`A ${kind} happened`);
    });
  }

  test("needs something written", async ({ page, request }) => {
    await openNew(page, request);
    await expect(card(page, "Log activity").getByRole("button", { name: "Log call" })).toBeDisabled();
  });
});

test.describe("people", () => {
  const people = (page: Page) => card(page, "People");

  test("starts empty and says who to add", async ({ page, request }) => {
    await openNew(page, request);
    await expect(people(page).getByText("No one linked yet.", { exact: false })).toBeVisible();
    await expect(people(page).getByRole("button", { name: "Link person" })).toBeDisabled();
  });

  test("links an existing person as the role chosen, and unlinks them", async ({ page, request }) => {
    const app = await openNew(page, request);
    const list = (await (await request.get("/api/v1/contacts")).json()) as { id: string; name: string }[];
    const alex = list.find((c) => c.name === "Alex Morgan") as { id: string };
    await people(page).getByPlaceholder("Choose a contact").click();
    await page.getByRole("option", { name: "Alex Morgan", exact: true }).click();
    await people(page).getByLabel("As").click();
    await page.getByRole("option", { name: "Hiring manager", exact: true }).click();
    await people(page).getByRole("button", { name: "Link person" }).click();
    await expect(people(page).getByRole("link", { name: "Alex Morgan" })).toBeVisible();
    await expect(people(page).getByText(/^Hiring manager/)).toBeVisible();
    await expect
      .poll(async () => (await app.read()).contacts)
      .toEqual([expect.objectContaining({ contact_id: alex.id, relation: "hiring_manager" })]);
    await people(page).getByRole("button", { name: "Remove Alex Morgan" }).click();
    await expect(people(page).getByRole("link", { name: "Alex Morgan" })).toBeHidden();
    await expect.poll(async () => (await app.read()).contacts).toEqual([]);
  });

  test("New person adds them at the company and links them", async ({ page, request }) => {
    const app = await openNew(page, request);
    await people(page).getByRole("button", { name: "New person" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Page Newperson");
    await dialog
      .getByRole("button", { name: /save|add/i })
      .last()
      .click();
    await expect(people(page).getByRole("link", { name: "Page Newperson" })).toBeVisible();
    const list = (await (await request.get("/api/v1/contacts")).json()) as {
      name: string;
      company_name?: string;
    }[];
    expect(list.filter((c) => c.name === "Page Newperson")).toHaveLength(1);
    expect((await app.read()).contacts).toHaveLength(1);
    await people(page).getByRole("link", { name: "Page Newperson" }).click();
    await expect(page).toHaveURL(/\/people\//);
    await expect(page.getByRole("link", { name: app.company }).first()).toBeVisible();
  });
});

test.describe("documents sent", () => {
  const documents = (page: Page) => card(page, "Documents sent");

  test("records a version with its date, and removes it", async ({ page, request }) => {
    const app = await openNew(page, request);
    await documents(page).getByPlaceholder("Pick a CV or cover letter").click();
    await page.getByRole("option", { name: "Backend CV · v3 (impact first)" }).click();
    await documents(page).getByLabel("Sent on").fill("4 Feb 2026");
    await page.keyboard.press("Tab");
    await documents(page).getByRole("button", { name: "Add", exact: true }).click();
    await expect(documents(page).getByText("CV · sent 4 Feb 2026")).toBeVisible();
    await expect
      .poll(async () => (await app.read()).documents)
      .toEqual([
        expect.objectContaining({
          document_name: "Backend CV",
          version_label: "v3 (impact first)",
          sent_on: "2026-02-04",
        }),
      ]);
    await documents(page).getByRole("button", { name: "Remove Backend CV v3 (impact first)" }).click();
    await expect.poll(async () => (await app.read()).documents).toEqual([]);
  });

  test("a version already recorded isn't offered again", async ({ page, request }) => {
    await openNew(page, request);
    await documents(page).getByPlaceholder("Pick a CV or cover letter").click();
    await page.getByRole("option", { name: "Backend CV · v2" }).click();
    await documents(page).getByRole("button", { name: "Add", exact: true }).click();
    await expect(documents(page).getByText(/^CV · sent/)).toBeVisible();
    await documents(page).getByPlaceholder("Pick a CV or cover letter").click();
    await expect(page.getByRole("option", { name: "Backend CV · v3 (impact first)" })).toBeVisible();
    await expect(page.getByRole("option", { name: "Backend CV · v2" })).toBeHidden();
  });
});

test.describe("at a glance", () => {
  test("says when nothing needs doing, and when a reply is waiting", async ({ page, request }) => {
    await openNew(page, request);
    const glance = page.locator(".mantine-Card-root", {
      has: page.getByRole("heading", { name: "At a glance" }),
    });
    await expect(glance.getByText("Nothing needs doing right now.")).toBeVisible();
    await page.getByRole("button", { name: "They've replied" }).click();
    await expect(glance.getByText("Needs attention")).toBeVisible();
  });
});

test.describe("deleting", () => {
  test("asks first, naming it, and cancelling keeps it", async ({ page, request }) => {
    const app = await openNew(page, request);
    let asked = "";
    page.once("dialog", (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await page.getByRole("button", { name: "Delete" }).click();
    await expect.poll(() => asked).toContain(`Delete your application to ${app.company} (${app.role})?`);
    expect((await request.get(`/api/v1/applications/${app.id}`)).ok()).toBe(true);
    await expect(page.getByRole("heading", { name: app.role })).toBeVisible();
  });

  test("confirming removes it and returns to the list, keeping its role and company", async ({
    page,
    request,
  }) => {
    const app = await openNew(page, request);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/applications$/);
    await expect(page.getByLabel(`Open ${app.role} at ${app.company}`)).toBeHidden();
    const gone = await request.get(`/api/v1/applications/${app.id}`);
    expect(gone.status()).toBe(404);
    const roles = (await (await request.get("/api/v1/roles")).json()) as { title: string }[];
    expect(roles.map((r) => r.title)).toContain(app.role);
  });

  test("an address that doesn't exist says it couldn't load", async ({ page, problems }) => {
    problems.allow(/no-such-application/);
    await page.goto("/applications/no-such-application");
    await expect(page.getByText("Couldn't load this application")).toBeVisible({ timeout: 15_000 });
  });
});
