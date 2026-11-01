import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Interview rounds and calls: adding, editing and deleting from each page they start on, with and
// without people, rescheduling and outcomes. Each test makes its own application or person, with
// its own names. What Today does with them is in today.spec.ts.

interface Round {
  id: string;
  round: number;
  title: string | null;
  kind: string;
  status: string;
  label: string;
  format: string | null;
  location: string | null;
  meeting_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  deadline_at: string | null;
  prep: string | null;
  debrief: string | null;
  questions: string | null;
  task_instructions: string | null;
  interviewer_ids: string[];
  rescheduled_count: number | null;
  rescheduled_from: string | null;
}
interface Call {
  id: string;
  label: string;
  status: string;
  kind: string;
  title: string | null;
  starts_at: string;
  location: string | null;
  meeting_url: string | null;
  application_id: string | null;
  agenda: string | null;
  notes: string | null;
}

const API = "/api/v1";
const getJson = async <T>(request: APIRequestContext, path: string) =>
  (await (await request.get(`${API}/${path}`)).json()) as T;
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
// Whole seconds, as the database stores them.
const inDays = (days: number) =>
  new Date(Math.floor((Date.now() + days * 86_400_000) / 1000) * 1000).toISOString();
const application = (request: APIRequestContext, company: string, role = "Tested Role") =>
  post<{ id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: role,
    route: "direct",
    tags: [],
  });
const person = (request: APIRequestContext, name: string) =>
  post<{ id: string }>(request, "contacts", { name });
const addRound = (request: APIRequestContext, applicationId: string, data: object = {}) =>
  post<Round>(request, `applications/${applicationId}/interviews`, data);
const addCall = (request: APIRequestContext, contactId: string, data: object = {}) =>
  post<Call>(request, "meetings", { contact_id: contactId, starts_at: inDays(3), ...data });
const roundsOf = (request: APIRequestContext, applicationId: string) =>
  getJson<Round[]>(request, `interviews?application_id=${applicationId}`);
const callsOf = (request: APIRequestContext, contactId: string) =>
  getJson<Call[]>(request, `meetings?contact_id=${contactId}`);

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
const slow = (page: Page, url: string, method: string, ms = 800) =>
  page.route(url, async (route) => {
    if (route.request().method() === method) await pause(ms);
    await route.continue();
  });
const watchWrites = (page: Page) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return writes;
};
const answered = (page: Page, method: string, url: RegExp) =>
  page.waitForResponse((r) => r.request().method() === method && url.test(new URL(r.url()).pathname));

const theDialog = (page: Page) => page.locator(".mantine-Modal-content");
/** Two real clicks, as quick as a person's double click. */
const doubleClick = async (page: Page, button: Locator) => {
  const box = await button.boundingBox();
  if (!box) throw new Error("No button to click");
  const [x, y] = [box.x + box.width / 2, box.y + box.height / 2];
  await page.mouse.click(x, y);
  await pause(60);
  await page.mouse.click(x, y);
};
const menu = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true });
const openApplication = async (page: Page, id: string) => {
  await page.goto(`/applications/${id}`);
  await expect(page.getByRole("button", { name: /^Add round \d+$/ })).toBeVisible();
};
const openInterviews = async (page: Page) => {
  await page.goto("/interviews");
  await expect(page.getByRole("heading", { name: "Earlier and cancelled" })).toBeVisible();
};
const openPerson = async (page: Page, id: string) => {
  await page.goto(`/people/${id}`);
  await expect(page.getByRole("button", { name: "Book a call" })).toBeVisible();
};
const newRound = async (page: Page) => {
  await page.getByRole("button", { name: /^Add round \d+$/ }).click();
  const dialog = theDialog(page);
  await expect(dialog.getByText("Add an interview round")).toBeVisible();
  await dialog.getByText("Add an interview round").click();
  return dialog;
};
const submitRound = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Add round", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const editRound = async (page: Page, label: string) => {
  await page.getByRole("button", { name: `Edit ${label}` }).click();
  const dialog = theDialog(page);
  await expect(dialog.getByText(`Edit ${label}`)).toBeVisible();
  await dialog.getByText(`Edit ${label}`).click();
  return dialog;
};
const save = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const pick = async (page: Page, dialog: Locator, label: string, option: string) => {
  await dialog.getByLabel(label, { exact: true }).first().click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const whoField = (dialog: Locator) => dialog.getByLabel(/^Who needed the change\?/).first();
const pickWho = async (page: Page, dialog: Locator, option: string) => {
  await whoField(dialog).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const answerNext = (page: Page, accept: boolean) => {
  page.once("dialog", (d) => void (accept ? d.accept() : d.dismiss()));
};
/** Sets a date and time picker to another day of the month it shows. */
const moveDay = async (page: Page, dialog: Locator, label: string) => {
  await dialog.getByLabel(label, { exact: true }).first().click();
  const days = page.locator('[class*="DateTimePicker-day"]:not([data-outside]):not([data-selected])');
  await days.last().click();
  await page.locator('[class*="DateTimePicker-submitButton"]').click();
};
const interviewRow = (page: Page, label: string) => page.getByRole("row").filter({ hasText: label });
const section = (page: Page, name: string) =>
  page.locator(".mantine-Card-root").filter({ has: page.getByRole("heading", { name, exact: true }) });
const newCall = async (page: Page) => {
  await page.getByRole("button", { name: "Book a call" }).click();
  const dialog = theDialog(page);
  await expect(dialog.getByText("Book a call")).toBeVisible();
  await dialog.getByText("Book a call").click(); // also waits for it to stop moving
  return dialog;
};
const callMenu = async (page: Page, label: string, item: "Edit" | "Delete") => {
  await page.getByRole("button", { name: `More for ${label}` }).click();
  await page.getByRole("menuitem", { name: item }).click();
};

test.describe("adding a round", () => {
  test("asks for a round number, and refuses a link that isn't one", async ({ page, request }) => {
    const app = await application(request, "Round Rules Co");
    await openApplication(page, app.id);
    const writes = watchWrites(page);
    const dialog = await newRound(page);
    await dialog.getByLabel("Round", { exact: true }).fill("");
    await dialog.getByRole("button", { name: "Add round", exact: true }).click();
    await expect(dialog.getByText("Rounds go from 1 to 99")).toBeVisible();
    await dialog.getByLabel("Round", { exact: true }).fill("1");
    await dialog.getByLabel("Meeting link").fill("meet.example.com/x");
    await dialog.getByRole("button", { name: "Add round", exact: true }).click();
    await expect(dialog.getByText("Links start with http:// or https://")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("with nothing filled in: the next round, not booked", async ({ page, request }) => {
    const app = await application(request, "Bare Round Co");
    await openApplication(page, app.id);
    await expect(page.getByText("No interviews yet.")).toBeVisible();
    await submitRound(await newRound(page));
    const card = section(page, "Interviews");
    await expect(card.getByText("Round 1 · Technical")).toBeVisible();
    await expect(card.getByText("Not booked yet")).toBeVisible();
    await expect(card.getByText("Coming up")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add round 2" })).toBeVisible();
    expect(await roundsOf(request, app.id)).toMatchObject([
      { round: 1, kind: "technical", status: "scheduled", starts_at: null, interviewer_ids: [] },
    ]);
    await menu(page, "Interviews").click();
    await expect(interviewRow(page, "Bare Round Co")).toContainText("Not booked yet");
  });

  test("with everything, and it's all kept after a reload", async ({ page, request }) => {
    const app = await application(request, "Full Round Co");
    const one = await person(request, "Panel Person One");
    const two = await person(request, "Panel Person Two");
    await openApplication(page, app.id);
    const dialog = await newRound(page);
    await dialog.getByLabel("What is it?").fill("  Architecture chat ");
    await pick(page, dialog, "Type", "System design");
    await pick(page, dialog, "Format", "In person");
    await dialog.getByLabel("Meeting link").fill("https://meet.example.com/full");
    await dialog.getByLabel("Location").fill("Office, floor 3");
    await dialog.getByLabel("Interviewers").click();
    await page.getByRole("option", { name: "Panel Person One", exact: true }).click();
    await page.getByRole("option", { name: "Panel Person Two", exact: true }).click();
    await dialog.getByText("Add an interview round").click();
    await dialog.getByLabel("Prep", { exact: true }).fill("Read the blog");
    await dialog.getByLabel("Debrief", { exact: true }).fill("Went fine");
    await dialog.getByLabel("Questions asked", { exact: true }).fill("Caching");
    await submitRound(dialog);
    await page.reload();
    const card = section(page, "Interviews");
    await expect(card.getByText("Round 1 · Architecture chat")).toBeVisible();
    await expect(
      card.getByText(/with Panel Person (One, Panel Person Two|Two, Panel Person One)/),
    ).toBeVisible();
    await expect(card.getByRole("link", { name: "Join link" })).toHaveAttribute(
      "href",
      /^https:\/\/meet\.example\.com\/full/,
    );
    await expect(card.getByText("Went fine")).toBeVisible();
    expect((await roundsOf(request, app.id))[0]).toMatchObject({
      title: "Architecture chat",
      kind: "system_design",
      format: "onsite",
      location: "Office, floor 3",
      prep: "Read the blog",
      debrief: "Went fine",
      questions: "Caching",
    });
    expect((await roundsOf(request, app.id))[0]?.interviewer_ids.sort()).toEqual([one.id, two.id].sort());
    await page.goto(`/people/${one.id}`);
    await expect(page.getByRole("link", { name: "Round 1 · Architecture chat" })).toBeVisible();
  });

  test("a coding task or take-home asks for the task, and only those do", async ({ page, request }) => {
    const app = await application(request, "Task Round Co");
    await openApplication(page, app.id);
    const dialog = await newRound(page);
    await expect(dialog.getByLabel("Task instructions")).toBeHidden();
    await pick(page, dialog, "Type", "Coding task");
    await expect(dialog.getByLabel("Task instructions")).toBeVisible();
    await expect(dialog.getByLabel("Due", { exact: true })).toBeVisible();
    await pick(page, dialog, "Type", "Technical");
    await expect(dialog.getByLabel("Task instructions")).toBeHidden();
    await pick(page, dialog, "Format", "Take-home");
    await expect(dialog.getByLabel("Task instructions")).toBeVisible();
    await dialog.getByLabel("Task instructions").fill("Build a small API");
    await dialog.getByLabel("Repo or platform link").fill("https://repo.example.com/task");
    await submitRound(dialog);
    expect((await roundsOf(request, app.id))[0]).toMatchObject({
      format: "take_home",
      task_instructions: "Build a small API",
    });
  });

  // KNOWN BUG (fix-hidden-link-blocks-save on the roadmap): expected to fail until it is fixed.
  test.fail(
    "a bad repo link on a field that's since been hidden doesn't stop the save",
    async ({ page, request }) => {
      const app = await application(request, "Hidden Link Round Co");
      await openApplication(page, app.id);
      const dialog = await newRound(page);
      await pick(page, dialog, "Type", "Coding task");
      await dialog.getByLabel("Repo or platform link").fill("not a link");
      await pick(page, dialog, "Type", "Technical");
      await dialog.getByRole("button", { name: "Add round", exact: true }).click();
      await expect.poll(() => roundsOf(request, app.id).then((r) => r.length), { timeout: 3_000 }).toBe(1);
    },
  );

  test("already done, or cancelled, it's on record but not coming up", async ({ page, request }) => {
    const app = await application(request, "Past Round Co");
    await openApplication(page, app.id);
    let dialog = await newRound(page);
    await dialog.getByLabel("What is it?").fill("Earlier chat");
    await dialog.getByText("Done", { exact: true }).click();
    await submitRound(dialog);
    await expect(page.getByRole("button", { name: "Add round 2" })).toBeVisible();
    dialog = await newRound(page);
    await dialog.getByLabel("What is it?").fill("Dropped chat");
    await dialog.getByText("Cancelled", { exact: true }).click();
    await submitRound(dialog);
    expect((await roundsOf(request, app.id)).map((r) => r.status)).toEqual(["done", "cancelled"]);
    await menu(page, "Interviews").click();
    const earlier = section(page, "Earlier and cancelled");
    await expect(earlier.getByText("Round 1 · Earlier chat")).toBeVisible();
    await expect(earlier.getByText("Round 2 · Dropped chat")).toBeVisible();
    await expect(section(page, "Coming up").getByText("Earlier chat")).toBeHidden();
  });

  test("Cancel and Escape add nothing, and the next one starts empty", async ({ page, request }) => {
    const app = await application(request, "Cancelled Round Co");
    await openApplication(page, app.id);
    const writes = watchWrites(page);
    let dialog = await newRound(page);
    await dialog.getByLabel("What is it?").fill("Never mind");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    dialog = await newRound(page);
    await expect(dialog.getByLabel("What is it?")).toHaveValue("");
    await dialog.getByLabel("What is it?").fill("Never mind again");
    await page.keyboard.press("Escape");
    if (await dialog.isVisible()) await page.keyboard.press("Escape"); // the suggestions, then the dialog
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
    expect(await roundsOf(request, app.id)).toHaveLength(0);
  });

  test("a description used before is suggested", async ({ page, request }) => {
    const first = await application(request, "Suggest One Co");
    await addRound(request, first.id, { title: "Very particular panel" });
    const app = await application(request, "Suggest Two Co");
    await openApplication(page, app.id);
    const dialog = await newRound(page);
    await dialog.getByLabel("What is it?").fill("Very part");
    await expect(page.getByRole("option", { name: "Very particular panel" })).toBeVisible();
  });

  test("a double click on a slow save adds one", async ({ page, request }) => {
    const app = await application(request, "Double Round Co");
    await slow(page, `**${API}/applications/${app.id}/interviews`, "POST");
    await openApplication(page, app.id);
    const dialog = await newRound(page);
    const writes = watchWrites(page);
    await doubleClick(page, dialog.getByRole("button", { name: "Add round", exact: true }));
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Add round 2" })).toBeVisible();
    expect(await roundsOf(request, app.id)).toHaveLength(1);
    expect(writes).toHaveLength(1);
  });

  test("a link the server refuses is explained, and what you typed stays", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/422.*\/interviews/);
    const app = await application(request, "Refused Round Co");
    await openApplication(page, app.id);
    const dialog = await newRound(page);
    await dialog.getByLabel("What is it?").fill("Kept words");
    await dialog.getByLabel("Meeting link").fill("https://");
    const refused = answered(page, "POST", /\/interviews$/);
    await dialog.getByRole("button", { name: "Add round", exact: true }).click();
    expect((await refused).status()).toBe(422);
    await expect(page.getByText("That didn't work").first()).toBeVisible();
    await expect(dialog.getByLabel("What is it?")).toHaveValue("Kept words");
    expect(await roundsOf(request, app.id)).toHaveLength(0);
  });
});

test.describe("editing a round", () => {
  test("from its application: what changed is saved, the rest kept, and it's no reschedule", async ({
    page,
    request,
  }) => {
    const app = await application(request, "Edit Round Co");
    await addRound(request, app.id, {
      title: "First idea",
      starts_at: inDays(4),
      ends_at: inDays(4.05),
      prep: "Kept prep",
      location: "Kept place",
    });
    const [before] = await roundsOf(request, app.id);
    await openApplication(page, app.id);
    const dialog = await editRound(page, "Round 1 · First idea");
    await dialog.getByLabel("What is it?").fill("Better idea");
    await save(dialog);
    await expect(section(page, "Interviews").getByText("Round 1 · Better idea")).toBeVisible();
    const [saved] = await roundsOf(request, app.id);
    expect(saved).toMatchObject({
      title: "Better idea",
      prep: "Kept prep",
      location: "Kept place",
      starts_at: before?.starts_at,
      ends_at: before?.ends_at,
      rescheduled_count: 0,
    });
    await page.reload();
    await expect(section(page, "Interviews").getByText("Rescheduled")).toBeHidden();
  });

  test("Cancel sends nothing, and it reopens as saved", async ({ page, request }) => {
    const app = await application(request, "Cancel Edit Co");
    await addRound(request, app.id, { title: "Steady" });
    await openApplication(page, app.id);
    const writes = watchWrites(page);
    let dialog = await editRound(page, "Round 1 · Steady");
    await dialog.getByLabel("What is it?").fill("Changed mind");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    dialog = await editRound(page, "Round 1 · Steady");
    await expect(dialog.getByLabel("What is it?")).toHaveValue("Steady");
    expect(writes).toEqual([]);
  });

  test("emptying fields clears them, and the type stands in for the title", async ({ page, request }) => {
    const app = await application(request, "Clear Round Co");
    await addRound(request, app.id, {
      title: "Named",
      kind: "pairing",
      meeting_url: "https://meet.example.com/clear",
      location: "Somewhere",
    });
    await openApplication(page, app.id);
    const dialog = await editRound(page, "Round 1 · Named");
    await dialog.getByLabel("What is it?").fill("");
    await dialog.getByLabel("Meeting link").fill("");
    await dialog.getByLabel("Location").fill("   ");
    await save(dialog);
    const card = section(page, "Interviews");
    await expect(card.getByText("Round 1 · Pairing")).toBeVisible();
    await expect(card.getByRole("link", { name: "Join link" })).toBeHidden();
    expect((await roundsOf(request, app.id))[0]).toMatchObject({
      title: null,
      meeting_url: null,
      location: null,
    });
  });

  test("from Interviews: it shows on the application without a reload", async ({ page, request }) => {
    const app = await application(request, "Page Edit Co");
    await addRound(request, app.id, { title: "Page before", starts_at: inDays(5) });
    await openInterviews(page);
    const dialog = await editRound(page, "Round 1 · Page before");
    await dialog.getByLabel("What is it?").fill("Page after");
    await save(dialog);
    const row = interviewRow(page, "Round 1 · Page after");
    await expect(row).toContainText("Page Edit Co");
    await row.getByRole("link", { name: "Page Edit Co" }).click();
    await expect(section(page, "Interviews").getByText("Round 1 · Page after")).toBeVisible();
  });

  test("a task made ordinary loses its due date", async ({ page, request }) => {
    const app = await application(request, "Untask Co");
    await addRound(request, app.id, { title: "Was a task", kind: "coding_task", deadline_at: inDays(6) });
    await openApplication(page, app.id);
    await expect(section(page, "Interviews").getByText(/^Due /)).toBeVisible();
    const dialog = await editRound(page, "Round 1 · Was a task");
    await pick(page, dialog, "Type", "Technical");
    await save(dialog);
    await expect(section(page, "Interviews").getByText("Not booked yet")).toBeVisible();
    expect((await roundsOf(request, app.id))[0]?.deadline_at).toBeNull();
  });

  test("an interviewer taken off comes off their page too", async ({ page, request }) => {
    const app = await application(request, "Interviewer Off Co");
    const who = await person(request, "Taken Off Interviewer");
    await addRound(request, app.id, { title: "Panel", interviewer_ids: [who.id] });
    await openApplication(page, app.id);
    const card = section(page, "Interviews");
    await expect(card.getByText("with Taken Off Interviewer")).toBeVisible();
    const dialog = await editRound(page, "Round 1 · Panel");
    await dialog.getByLabel("Interviewers").click();
    await page.keyboard.press("Backspace");
    await dialog.getByText("Edit Round 1 · Panel").click();
    await save(dialog);
    await expect(card.getByText("with Taken Off Interviewer")).toBeHidden();
    expect((await roundsOf(request, app.id))[0]?.interviewer_ids).toEqual([]);
    await page.goto(`/people/${who.id}`);
    await expect(page.getByRole("button", { name: "Book a call" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Round 1 · Panel" })).toBeHidden();
  });

  test("an interviewer who's deleted comes off, and the round stays", async ({ page, request }) => {
    const app = await application(request, "Interviewer Gone Co");
    const who = await person(request, "Deleted Interviewer");
    await addRound(request, app.id, { title: "Kept round", interviewer_ids: [who.id] });
    await request.delete(`${API}/contacts/${who.id}`);
    await openApplication(page, app.id);
    const card = section(page, "Interviews");
    await expect(card.getByText("Round 1 · Kept round")).toBeVisible();
    await expect(card.getByText("Deleted Interviewer")).toBeHidden();
    expect((await roundsOf(request, app.id))[0]?.interviewer_ids).toEqual([]);
  });

  test("deleted meanwhile: it says so, and the dialog stays", async ({ page, request, problems }) => {
    problems.allow(/404.*\/api\/v1\/interviews/);
    const app = await application(request, "Gone Round Co");
    const made = await addRound(request, app.id, { title: "Going" });
    await openApplication(page, app.id);
    const dialog = await editRound(page, "Round 1 · Going");
    await request.delete(`${API}/interviews/${made.id}`);
    const refused = answered(page, "PATCH", /\/interviews\//);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    expect((await refused).status()).toBe(404);
    await expect(page.getByText("That didn't work").first()).toBeVisible();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("What is it?")).toHaveValue("Round 1 · Going".slice(10));
  });

  test("a double click on a slow save closes it, with no error", async ({ page, request }) => {
    const app = await application(request, "Double Edit Co");
    const made = await addRound(request, app.id, { title: "Twice" });
    await slow(page, `**${API}/interviews/${made.id}`, "PATCH");
    await openApplication(page, app.id);
    const dialog = await editRound(page, "Round 1 · Twice");
    await dialog.getByLabel("What is it?").fill("Once");
    const writes = watchWrites(page);
    await doubleClick(page, dialog.getByRole("button", { name: "Save", exact: true }));
    await expect(dialog).toBeHidden();
    await expect(section(page, "Interviews").getByText("Round 1 · Once")).toBeVisible();
    expect(writes).toHaveLength(1);
  });
});

test.describe("deleting a round", () => {
  test("saying no keeps it", async ({ page, request }) => {
    const app = await application(request, "Keep Round Co");
    await addRound(request, app.id, { title: "Kept" });
    await openApplication(page, app.id);
    const writes = watchWrites(page);
    answerNext(page, false);
    await page.getByRole("button", { name: "Delete Round 1 · Kept" }).click();
    await expect(section(page, "Interviews").getByText("Round 1 · Kept")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("saying yes removes it everywhere, and the number comes free", async ({ page, request }) => {
    const app = await application(request, "Drop Round Co");
    await addRound(request, app.id, { title: "Dropped", starts_at: inDays(2) });
    await openInterviews(page);
    await expect(interviewRow(page, "Drop Round Co")).toBeVisible();
    await interviewRow(page, "Drop Round Co").getByRole("link", { name: "Drop Round Co" }).click();
    answerNext(page, true);
    await page.getByRole("button", { name: "Delete Round 1 · Dropped" }).click();
    await expect(page.getByText("No interviews yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add round 1" })).toBeVisible();
    expect(await roundsOf(request, app.id)).toHaveLength(0);
    await menu(page, "Interviews").click();
    await expect(page.getByRole("heading", { name: "Earlier and cancelled" })).toBeVisible();
    await expect(interviewRow(page, "Drop Round Co")).toBeHidden();
  });

  test("the next number follows the highest left", async ({ page, request }) => {
    const app = await application(request, "Gap Round Co");
    const first = await addRound(request, app.id, { title: "One" });
    await addRound(request, app.id, { title: "Two" });
    await request.delete(`${API}/interviews/${first.id}`);
    await openApplication(page, app.id);
    await expect(page.getByRole("button", { name: "Add round 3" })).toBeVisible();
  });

  test("deleting the application takes its rounds", async ({ page, request }) => {
    const app = await application(request, "Whole App Co");
    await addRound(request, app.id, { title: "Goes too", starts_at: inDays(2) });
    await request.delete(`${API}/applications/${app.id}`);
    await openInterviews(page);
    await expect(interviewRow(page, "Whole App Co")).toBeHidden();
  });
});

test.describe("the Interviews page", () => {
  test("splits what's coming up from the rest, soonest first", async ({ page, request }) => {
    const app = await application(request, "Split Page Co");
    await addRound(request, app.id, { title: "Later one", starts_at: inDays(9) });
    await addRound(request, app.id, { title: "Sooner one", starts_at: inDays(8) });
    await addRound(request, app.id, { title: "Long ago", starts_at: inDays(-8) });
    await addRound(request, app.id, { title: "Off", status: "cancelled", starts_at: inDays(3) });
    await openInterviews(page);
    const ahead = section(page, "Coming up");
    await expect(ahead.getByText("Later one")).toBeVisible();
    const text = (await ahead.innerText()).replace(/\s+/g, " ");
    expect(text.indexOf("Sooner one")).toBeLessThan(text.indexOf("Later one"));
    const earlier = section(page, "Earlier and cancelled");
    await expect(earlier.getByRole("row").filter({ hasText: "Long ago" })).toContainText("Awaiting outcome");
    await expect(earlier.getByRole("row").filter({ hasText: "Round 4 · Off" })).toContainText("Cancelled");
    await expect(ahead.getByText("Long ago")).toBeHidden();
  });

  test("only a booked round can be rescheduled", async ({ page, request }) => {
    const app = await application(request, "Offer Move Co");
    await addRound(request, app.id, { title: "Booked", starts_at: inDays(5) });
    await addRound(request, app.id, { title: "Undated" });
    await addRound(request, app.id, { title: "Finished", status: "done", starts_at: inDays(-5) });
    await openInterviews(page);
    await expect(page.getByRole("button", { name: "Reschedule Round 1 · Booked" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Round 2 · Undated" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reschedule Round 2 · Undated" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Reschedule Round 3 · Finished" })).toBeHidden();
  });
});

test.describe("rescheduling", () => {
  const open = async (page: Page, label: string) => {
    await page.getByRole("button", { name: `Reschedule ${label}` }).click();
    const dialog = theDialog(page);
    await expect(dialog.getByText(`Reschedule ${label}`)).toBeVisible();
    return dialog;
  };

  test("stays disabled until the time moves; Cancel sends nothing", async ({ page, request }) => {
    const app = await application(request, "No Move Co");
    await addRound(request, app.id, { title: "Still", starts_at: inDays(6) });
    await openInterviews(page);
    const writes = watchWrites(page);
    const dialog = await open(page, "Round 1 · Still");
    const go = dialog.getByRole("button", { name: "Reschedule", exact: true });
    await expect(go).toBeDisabled();
    await dialog.getByLabel("Why? (optional)").fill("Only a reason");
    await expect(go).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
    expect((await roundsOf(request, app.id))[0]?.rescheduled_count).toBe(0);
  });

  test("moves it with its end, counts it, and says why on the timeline", async ({ page, request }) => {
    const app = await application(request, "Moved Round Co");
    await addRound(request, app.id, {
      title: "Moving",
      starts_at: inDays(6),
      ends_at: new Date(Date.parse(inDays(6)) + 3_600_000).toISOString(),
    });
    const [stored] = await roundsOf(request, app.id);
    await openInterviews(page);
    let dialog = await open(page, "Round 1 · Moving");
    await moveDay(page, dialog, "New time");
    await pickWho(page, dialog, "Them");
    await dialog.getByLabel("Why? (optional)").fill("  They had a   clash ");
    await dialog.getByRole("button", { name: "Reschedule", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(interviewRow(page, "Round 1 · Moving")).toContainText("Rescheduled");
    const [moved] = await roundsOf(request, app.id);
    expect(moved?.rescheduled_count).toBe(1);
    expect(moved?.rescheduled_from).toBe(stored?.starts_at);
    expect(moved?.starts_at).not.toBe(stored?.starts_at);
    const length = (r?: Round) => Date.parse(r?.ends_at ?? "") - Date.parse(r?.starts_at ?? "");
    expect(Math.abs(length(moved) - length(stored))).toBeLessThan(2_000);

    dialog = await open(page, "Round 1 · Moving");
    await moveDay(page, dialog, "New time");
    await pickWho(page, dialog, "Me");
    await dialog.getByRole("button", { name: "Reschedule", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(interviewRow(page, "Round 1 · Moving")).toContainText("Rescheduled ×2");

    await page.goto(`/applications/${app.id}`);
    await expect(page.getByText(/They had a clash/).first()).toBeVisible();
  });

  test("changing the time in Edit counts as well", async ({ page, request }) => {
    const app = await application(request, "Edit Move Co");
    await addRound(request, app.id, { title: "Edited time", starts_at: inDays(6) });
    await openApplication(page, app.id);
    const dialog = await editRound(page, "Round 1 · Edited time");
    await moveDay(page, dialog, "When");
    await save(dialog);
    await expect(section(page, "Interviews").getByText("Rescheduled")).toBeVisible();
    expect((await roundsOf(request, app.id))[0]?.rescheduled_count).toBe(1);
  });

  test("giving an undated round its first time isn't a move", async ({ page, request }) => {
    const app = await application(request, "First Time Co");
    await addRound(request, app.id, { title: "Undated" });
    await openApplication(page, app.id);
    const dialog = await editRound(page, "Round 1 · Undated");
    await moveDay(page, dialog, "When");
    await save(dialog);
    const card = section(page, "Interviews");
    await expect(card.getByText("Not booked yet")).toBeHidden();
    await expect(card.getByText("Rescheduled")).toBeHidden();
    expect((await roundsOf(request, app.id))[0]?.rescheduled_count).toBe(0);
  });

  test("while saving it can't be closed; if refused, what you typed stays", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/422.*\/api\/v1\/interviews/);
    const app = await application(request, "Stuck Move Co");
    const made = await addRound(request, app.id, { title: "Stuck", starts_at: inDays(6) });
    await page.route(`**${API}/interviews/${made.id}`, async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      await pause(800);
      return route.fulfill({ status: 422, json: { detail: "Refused for the test" } });
    });
    await openInterviews(page);
    const dialog = await open(page, "Round 1 · Stuck");
    await moveDay(page, dialog, "New time");
    await pickWho(page, dialog, "Both of us");
    await dialog.getByLabel("Why? (optional)").fill("Kept reason");
    await dialog.getByRole("button", { name: "Reschedule", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
    await expect(page.getByText("That didn't work").first()).toBeVisible();
    await expect(dialog.getByLabel("Why? (optional)")).toHaveValue("Kept reason");
    await expect(whoField(dialog)).toHaveValue("Both of us");
  });
});

test.describe("booking and logging a call", () => {
  test("from a person's page: them, the next hour, one call", async ({ page, request }) => {
    const who = await person(request, "Booked Person");
    await openPerson(page, who.id);
    await expect(page.getByText("No calls with Booked Person yet.")).toBeVisible();
    const dialog = await newCall(page);
    await expect(dialog.getByLabel("With", { exact: true }).first()).toHaveValue("Booked Person");
    await expect(dialog.getByLabel("With", { exact: true }).first()).toBeDisabled();
    await dialog.getByLabel("About", { exact: true }).fill(" Market catch-up ");
    await dialog.getByRole("button", { name: "Book call" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Call with Booked Person: Market catch-up")).toBeVisible();
    const [saved] = await callsOf(request, who.id);
    expect(saved).toMatchObject({ kind: "call", status: "scheduled", title: "Market catch-up" });
    const ahead = Date.parse(saved?.starts_at ?? "") - Date.now();
    expect(ahead).toBeGreaterThan(0);
    expect(ahead).toBeLessThanOrEqual(3_600_000);
    await page.reload();
    await expect(page.getByRole("button", { name: /^More for Call with Booked Person/ })).toBeVisible();
  });

  test("the link field follows how it's happening", async ({ page, request }) => {
    const who = await person(request, "How Person");
    await openPerson(page, who.id);
    const dialog = await newCall(page);
    await expect(dialog.getByLabel("Link (optional)")).toBeVisible();
    await dialog.getByText("Video call", { exact: true }).click();
    await expect(dialog.getByLabel("Meeting link")).toBeVisible();
    await dialog.getByLabel("Meeting link").fill("https://meet.example.com/how");
    await dialog.getByRole("button", { name: "Book call" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: "Join link" })).toHaveAttribute(
      "href",
      /^https:\/\/meet\.example\.com\/how/,
    );
    const second = await newCall(page);
    await second.getByText("In person", { exact: true }).click();
    await expect(second.getByLabel("Meeting link")).toBeHidden();
    await second.getByLabel("Where").fill("Their office");
    await second.getByLabel("About", { exact: true }).fill("Coffee");
    await second.getByRole("button", { name: "Book call" }).click();
    await expect(second).toBeHidden();
    await expect(page.getByText("Meeting with How Person: Coffee")).toBeVisible();
    const calls = await callsOf(request, who.id);
    expect(calls.find((c) => c.title === "Coffee")).toMatchObject({
      kind: "in_person",
      location: "Their office",
    });
  });

  test("refuses a link that isn't one", async ({ page, request }) => {
    const who = await person(request, "Bad Link Person");
    await openPerson(page, who.id);
    const writes = watchWrites(page);
    const dialog = await newCall(page);
    await dialog.getByLabel("Link (optional)").fill("not a link");
    await dialog.getByRole("button", { name: "Book call" }).click();
    await expect(dialog.getByText("Links start with http:// or https://")).toBeVisible();
    expect(writes).toEqual([]);
  });

  // KNOWN BUG (fix-hidden-link-blocks-save on the roadmap): expected to fail until it is fixed.
  test.fail(
    "a bad link on a field that's since been hidden doesn't stop the save",
    async ({ page, request }) => {
      const who = await person(request, "Hidden Link Person");
      await openPerson(page, who.id);
      const dialog = await newCall(page);
      await dialog.getByLabel("Link (optional)").fill("not a link");
      await dialog.getByText("In person", { exact: true }).click();
      await dialog.getByRole("button", { name: "Book call" }).click();
      await expect.poll(() => callsOf(request, who.id).then((c) => c.length), { timeout: 3_000 }).toBe(1);
    },
  );

  test("Cancel books nothing", async ({ page, request }) => {
    const who = await person(request, "No Call Person");
    await openPerson(page, who.id);
    const writes = watchWrites(page);
    const dialog = await newCall(page);
    await dialog.getByLabel("About", { exact: true }).fill("Never");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
    await expect(page.getByText("No calls with No Call Person yet.")).toBeVisible();
  });

  test("logging one that happened asks how it went, and its notes show", async ({ page, request }) => {
    const who = await person(request, "Logged Person");
    await openPerson(page, who.id);
    const dialog = await newCall(page);
    await expect(dialog.getByLabel("Agenda")).toBeVisible();
    await dialog.getByText("Happened", { exact: true }).click();
    await expect(dialog.getByLabel("Agenda")).toBeHidden();
    await dialog.getByLabel("How did it go?").fill("Two **strong** roles");
    await dialog.getByRole("button", { name: "Log call" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("strong", { hasText: "strong" })).toBeVisible();
    await expect(page.getByText("Happened", { exact: true })).toBeVisible();
    expect((await callsOf(request, who.id))[0]).toMatchObject({
      status: "done",
      notes: "Two **strong** roles",
    });
  });

  test("an agenda shows as Markdown while booked", async ({ page, request }) => {
    const who = await person(request, "Agenda Person");
    await openPerson(page, who.id);
    const dialog = await newCall(page);
    await dialog.getByLabel("Agenda").fill("Ask about **rates**");
    await dialog.getByRole("button", { name: "Book call" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.locator("strong", { hasText: "rates" })).toBeVisible();
  });

  test("about an application: linked both ways, and it can be taken off", async ({ page, request }) => {
    const app = await application(request, "Call About Co", "Call About Role");
    const who = await person(request, "About Person");
    await openPerson(page, who.id);
    let dialog = await newCall(page);
    await dialog.getByLabel("About", { exact: true }).fill("Linked");
    await dialog.getByLabel("About an application (optional)").first().click();
    await page.getByRole("option", { name: "Call About Co · Call About Role" }).click();
    await dialog.getByRole("button", { name: "Book call" }).click();
    await expect(dialog).toBeHidden();
    const link = page.getByRole("link", { name: "Call About Co · Call About Role" });
    await expect(link).toHaveAttribute("href", new RegExp(`/applications/${app.id}$`));
    expect((await callsOf(request, who.id))[0]?.application_id).toBe(app.id);

    await callMenu(page, "Call with About Person: Linked", "Edit");
    dialog = theDialog(page);
    await dialog.getByLabel("About an application (optional)").first().click();
    await page.getByRole("option", { name: "Call About Co · Call About Role" }).click(); // choosing it again clears it
    await save(dialog);
    await expect(link).toBeHidden();
    expect((await callsOf(request, who.id))[0]?.application_id).toBeNull();
  });

  test("a double click on a slow save books one", async ({ page, request }) => {
    const who = await person(request, "Double Call Person");
    await slow(page, `**${API}/meetings`, "POST");
    await openPerson(page, who.id);
    const dialog = await newCall(page);
    const writes = watchWrites(page);
    await doubleClick(page, dialog.getByRole("button", { name: "Book call" }));
    await expect(dialog).toBeHidden();
    expect(await callsOf(request, who.id)).toHaveLength(1);
    expect(writes).toHaveLength(1);
  });
});

test.describe("a call afterwards", () => {
  test("editing it saves the change, keeps the rest; Cancel sends nothing", async ({ page, request }) => {
    const who = await person(request, "Edit Call Person");
    await addCall(request, who.id, { title: "Before", agenda: "Kept agenda" });
    const [before] = await callsOf(request, who.id);
    const label = "Call with Edit Call Person: Before";
    await openPerson(page, who.id);
    const writes = watchWrites(page);
    await callMenu(page, label, "Edit");
    let dialog = theDialog(page);
    await expect(dialog.getByText(`Edit ${label}`)).toBeVisible();
    await dialog.getByLabel("About", { exact: true }).fill("Changed mind");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);

    await callMenu(page, label, "Edit");
    dialog = theDialog(page);
    await expect(dialog.getByLabel("About", { exact: true })).toHaveValue("Before");
    await dialog.getByLabel("About", { exact: true }).fill("After");
    await save(dialog);
    await expect(page.getByText("Call with Edit Call Person: After")).toBeVisible();
    const [saved] = await callsOf(request, who.id);
    expect(saved).toMatchObject({ title: "After", agenda: "Kept agenda", starts_at: before?.starts_at });
  });

  test("a past booked call asks what happened; Happened keeps the agenda", async ({ page, request }) => {
    const who = await person(request, "Past Call Person");
    await addCall(request, who.id, { title: "Was booked", starts_at: inDays(-1), agenda: "My agenda" });
    const label = "Call with Past Call Person: Was booked";
    await openPerson(page, who.id);
    await page.getByRole("button", { name: `Happened: ${label}` }).click();
    const dialog = theDialog(page);
    await dialog.getByLabel("How did it go?").fill("Good");
    await save(dialog);
    await expect(page.getByRole("button", { name: `Happened: ${label}` })).toBeHidden();
    await expect(page.getByRole("button", { name: "Add roles from this call" })).toBeVisible();
    expect((await callsOf(request, who.id))[0]).toMatchObject({
      status: "done",
      notes: "Good",
      agenda: "My agenda",
    });
  });

  test("Didn't happen: Cancel keeps it; saying what happened marks it", async ({ page, request }) => {
    const who = await person(request, "Missed Call Person");
    await addCall(request, who.id, { title: "Missed", starts_at: inDays(-1) });
    const label = "Call with Missed Call Person: Missed";
    await openPerson(page, who.id);
    const button = page.getByRole("button", { name: `Didn't happen: ${label}` });
    await button.click();
    const dialog = theDialog(page);
    await dialog.getByLabel("What happened?").fill("Changed my mind");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect((await callsOf(request, who.id))[0]?.status).toBe("scheduled");
    await button.click();
    await dialog.getByLabel("What happened?").fill("They cancelled");
    await dialog.getByRole("button", { name: "Mark as didn't happen" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Didn't happen", { exact: true })).toBeVisible();
    await expect(page.getByText("They cancelled")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add roles from this call" })).toBeHidden();
  });

  test("roles added from a call show under it, and survive deleting it", async ({ page, request }) => {
    const who = await person(request, "Role Call Person");
    const company = await post<{ id: string }>(request, "companies", { name: "Call Role Co" });
    await addCall(request, who.id, { title: "Pitched", status: "done", starts_at: inDays(-2) });
    const label = "Call with Role Call Person: Pitched";
    await openPerson(page, who.id);
    await page.getByRole("button", { name: "Add roles from this call" }).click();
    const dialog = theDialog(page);
    await dialog.getByLabel("Company").first().fill("Call Role Co");
    await page.getByRole("option", { name: "Call Role Co", exact: true }).click();
    await dialog.getByLabel("Role", { exact: true }).fill("Pitched Role");
    await dialog.getByRole("button", { name: "Add role", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: "Pitched Role" }).first()).toBeVisible();
    page.once("dialog", (d) => void d.accept()); // if a fix asks first
    await callMenu(page, label, "Delete");
    await expect(page.getByRole("button", { name: `More for ${label}` })).toBeHidden();
    await page.reload();
    await expect(page.getByRole("link", { name: "Pitched Role" }).first()).toBeVisible();
    const roles = await getJson<{ title: string; company_id: string }[]>(request, "roles");
    expect(roles.filter((r) => r.title === "Pitched Role")).toMatchObject([{ company_id: company.id }]);
  });

  // KNOWN BUG (fix-call-delete-no-confirm on the roadmap): expected to fail until it is fixed.
  test.fail("deleting asks first", async ({ page, request }) => {
    const who = await person(request, "Careful Call Person");
    await addCall(request, who.id, { title: "Precious", status: "done", notes: "Long notes" });
    await openPerson(page, who.id);
    let asked = false;
    page.once("dialog", (d) => {
      asked = true;
      void d.dismiss();
    });
    const writes = watchWrites(page);
    await callMenu(page, "Call with Careful Call Person: Precious", "Delete");
    await pause(800);
    expect(writes).toEqual([]);
    expect(asked || (await theDialog(page).isVisible())).toBe(true);
  });

  test("a person's deleted calls go with them", async ({ page, request }) => {
    const who = await person(request, "Gone Call Person");
    const app = await application(request, "Gone Call Co");
    await addCall(request, who.id, { application_id: app.id, title: "Goes" });
    await request.delete(`${API}/contacts/${who.id}`);
    expect(await getJson<Call[]>(request, `meetings?application_id=${app.id}`)).toHaveLength(0);
    await page.goto(`/applications/${app.id}`);
    await expect(page.getByText("No interviews yet.")).toBeVisible();
    await expect(page.getByText("Call with Gone Call Person")).toBeHidden();
  });
});

test.describe("what's left behind by an edit", () => {
  // KNOWN BUG (fix-hidden-link-kept on the roadmap): expected to fail until it is fixed.
  test.fail("a video call made in person loses its join link", async ({ page, request }) => {
    const who = await person(request, "Moved Offline Person");
    await addCall(request, who.id, {
      title: "Was video",
      kind: "video",
      meeting_url: "https://meet.example.com/offline",
    });
    const label = "Video call with Moved Offline Person: Was video";
    await openPerson(page, who.id);
    await callMenu(page, label, "Edit");
    const dialog = theDialog(page);
    await dialog.getByText("In person", { exact: true }).click();
    await save(dialog);
    await expect(page.getByText("Meeting with Moved Offline Person: Was video")).toBeVisible();
    await expect(page.getByRole("link", { name: "Join link" })).toBeHidden();
  });

  // KNOWN BUG (fix-round-end-before-start on the roadmap): expected to fail until it is fixed.
  test.fail(
    "a round marked done and moved in one edit still ends after it starts",
    async ({ page, request }) => {
      const app = await application(request, "Both Changes Co");
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 10).toISOString();
      await addRound(request, app.id, {
        title: "Both",
        starts_at: start,
        ends_at: new Date(Date.parse(start) + 3_600_000).toISOString(),
      });
      await openApplication(page, app.id);
      const dialog = await editRound(page, "Round 1 · Both");
      await dialog.getByText("Done", { exact: true }).click();
      await moveDay(page, dialog, "When");
      await save(dialog);
      const [saved] = await roundsOf(request, app.id);
      expect(saved?.status).toBe("done");
      expect(Date.parse(saved?.ends_at ?? "")).toBeGreaterThan(Date.parse(saved?.starts_at ?? ""));
    },
  );

  // KNOWN BUG (fix-didnt-happen-notes-hidden on the roadmap): expected to fail until it is fixed.
  test.fail("what you wrote about a call that didn't happen can be edited", async ({ page, request }) => {
    const who = await person(request, "Editable Notes Person");
    await addCall(request, who.id, { title: "Off call", status: "cancelled", notes: "They cancelled" });
    await openPerson(page, who.id);
    await callMenu(page, "Call with Editable Notes Person: Off call", "Edit");
    await expect(theDialog(page).locator("textarea").first()).toBeVisible();
    const boxes = await theDialog(page)
      .locator("textarea")
      .evaluateAll((all) => all.map((box) => (box as HTMLTextAreaElement).value));
    expect(boxes).toContain("They cancelled");
  });

  test("a whole-number round: 1.5 gets a clear answer", async ({ page, request, problems }) => {
    problems.allow(/422.*\/interviews/);
    const app = await application(request, "Half Round Co");
    await openApplication(page, app.id);
    const dialog = await newRound(page);
    await dialog.getByLabel("Round", { exact: true }).fill("1.5");
    await dialog.getByRole("button", { name: "Add round", exact: true }).click();
    await expect(
      dialog.getByText("Rounds go from 1 to 99").or(page.getByText("That didn't work").first()).first(),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(await roundsOf(request, app.id)).toHaveLength(0);
  });
});
