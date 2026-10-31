import type { APIRequestContext, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The Timeline (filters, the address, lanes) and search (finding each kind of thing, and keeping up
// with changes). Each test uses its own names and looks for those.

const API = "/api/v1";
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const quick = (request: APIRequestContext, company: string, role: string, extra: object = {}) =>
  post<{ id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: role,
    route: "direct",
    tags: [],
    ...extra,
  });
const company = (request: APIRequestContext, name: string) =>
  post<{ id: string }>(request, "companies", { name });
const person = (request: APIRequestContext, data: object) => post<{ id: string }>(request, "contacts", data);
const companyId = async (request: APIRequestContext, name: string) => {
  const all = (await (await request.get(`${API}/companies`)).json()) as { id: string; name: string }[];
  return all.find((c) => c.name === name)?.id ?? "";
};
const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const call = (request: APIRequestContext, contactId: string, title: string, days = -1, extra: object = {}) =>
  post<{ id: string }>(request, "meetings", {
    contact_id: contactId,
    title,
    starts_at: inDays(days),
    status: days < 0 ? "done" : "scheduled",
    ...extra,
  });
const yesterdayNoon = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};
/** Until the page stops loading, its retries included, however it ends up answering. */
const settled = async (page: Page) => {
  await page.waitForTimeout(500);
  await expect(page.locator(".mantine-Loader-root")).toHaveCount(0, { timeout: 25_000 });
};
const theDialog = (page: Page) => page.locator(".mantine-Modal-content");
const menu = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true });

const openTimeline = async (page: Page, query = "") => {
  await page.goto(`/timeline${query}`);
  await expect(page.getByRole("heading", { name: "Timeline", level: 2 })).toBeVisible();
};
const pickPeriod = async (page: Page, name: string) => {
  await page.getByLabel("Period", { exact: true }).first().click();
  await page.getByRole("option", { name, exact: true }).click();
};
const pickAbout = async (page: Page, name: string) => {
  await page.getByLabel("About", { exact: true }).first().fill(name);
  await page.getByRole("option", { name, exact: true }).click();
};
const view = (page: Page, name: "List" | "Lanes") =>
  page.locator('[aria-label="View"]').getByText(name, { exact: true }).click();
const rowsBy = (page: Page, name: "Role" | "Person" | "Company" | "Agency") =>
  page.locator('[aria-label="One row per"]').getByText(name, { exact: true }).click();

const box = (page: Page) => page.getByRole("textbox", { name: "Search everything" });
const search = async (page: Page, q: string) => {
  await box(page).fill(q);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: `Results for “${q.trim()}”`, level: 2 })).toBeVisible();
};
const hit = (page: Page, title: string | RegExp) => page.getByRole("link", { name: title });

test.describe("Timeline: what's listed", () => {
  test("a call in the past, one ahead, and where each goes", async ({ page, request }) => {
    const who = await person(request, { name: "Listed Person" });
    await post(request, "meetings", {
      contact_id: who.id,
      title: "Past chat",
      starts_at: yesterdayNoon(),
      status: "done",
    });
    await call(request, who.id, "Future chat", 3);
    await openTimeline(page);
    const yesterday = page
      .locator("div")
      .filter({ has: page.getByRole("heading", { name: /^Yesterday · /, level: 3 }) })
      .last();
    await expect(yesterday.getByText("Call with Listed Person: Past chat")).toBeVisible();
    const ahead = page
      .locator(".mantine-Card-root")
      .filter({ has: page.getByRole("heading", { name: "Coming up" }) });
    await expect(ahead.getByText(/Future chat/)).toBeVisible();
    await expect(ahead.getByText(/Past chat/)).toBeHidden();
    await expect(ahead.getByRole("link", { name: "Listed Person" })).toHaveAttribute(
      "href",
      `/people/${who.id}`,
    );
  });

  test("a new application and a stage move show, in order, with links", async ({ page, request }) => {
    const app = await quick(request, "Timeline Move Co", "Timeline Move Role");
    expect(
      (await request.post(`${API}/applications/${app.id}/move`, { data: { to_stage: "applied" } })).ok(),
    ).toBe(true);
    await openTimeline(page);
    const links = page.getByRole("link", { name: "Timeline Move Role at Timeline Move Co" });
    await expect(links.first()).toHaveAttribute("href", `/applications/${app.id}`);
    const titles = await page
      .locator(".mantine-Group-root")
      .filter({ has: links })
      .filter({ hasText: /Interested → Applied|Added at Interested/ })
      .allInnerTexts();
    const moved = titles.findIndex((t) => t.includes("Interested → Applied"));
    const added = titles.findIndex((t) => t.includes("Added at Interested"));
    expect(moved).toBeGreaterThanOrEqual(0);
    expect(added).toBeGreaterThan(moved);
  });

  test("an archived application stays, marked", async ({ page, request }) => {
    const app = await quick(request, "Archived Timeline Co", "Archived Timeline Role");
    await request.patch(`${API}/applications/${app.id}`, { data: { archived: true } });
    await openTimeline(page);
    const row = page
      .locator("div")
      .filter({ has: page.getByRole("link", { name: /Archived Timeline Role at/ }) })
      .last();
    await expect(row.getByText("Archived", { exact: true })).toBeVisible();
  });

  test("keeps up: a call logged on someone's page is here without a reload", async ({ page, request }) => {
    const who = await person(request, { name: "Live Call Person" });
    await page.clock.setFixedTime(new Date());
    await openTimeline(page);
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    await expect(page.getByText(/Live Call Person/)).toBeHidden();
    await page.evaluate((to) => {
      window.history.pushState({}, "", to);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, `/people/${who.id}`);
    await page.getByRole("button", { name: "Book a call" }).click();
    const dialog = theDialog(page);
    await dialog.getByLabel("About", { exact: true }).fill("Just booked");
    await dialog.getByRole("button", { name: "Book call" }).click();
    await expect(dialog).toBeHidden();
    await menu(page, "Timeline").click();
    await expect(page.getByText("Call with Live Call Person: Just booked")).toBeVisible();
  });
});

test.describe("Timeline: filters", () => {
  test("kinds: unticking hides them, and None, Usual and Everything work", async ({ page, request }) => {
    const who = await person(request, { name: "Kinds Person" });
    await call(request, who.id, "Kinds call");
    await openTimeline(page);
    const title = page.getByText("Call with Kinds Person: Kinds call");
    await expect(title).toBeVisible();
    await page.getByText("Calls and meetings", { exact: true }).click();
    await expect(title).toBeHidden();
    await page.getByText("Calls and meetings", { exact: true }).click();
    await expect(title).toBeVisible();

    await expect(page.getByRole("button", { name: "Usual" })).toBeDisabled();
    await page.getByRole("button", { name: "None" }).click();
    await expect(page.getByText("Tick at least one kind of thing to show.")).toBeVisible();
    await expect(title).toBeHidden();
    await expect(page.getByRole("button", { name: "None" })).toBeDisabled();
    await page.getByRole("button", { name: "Usual" }).click();
    await expect(title).toBeVisible();
  });

  test("companies being added only show when asked for", async ({ page, request }) => {
    await company(request, "Added Kind Co");
    await openTimeline(page);
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    const added = page.getByRole("link", { name: "Added Kind Co", exact: true });
    await expect(added).toBeHidden();
    await page.getByRole("button", { name: "Everything" }).click();
    await expect(added.first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Everything" })).toBeDisabled();
  });

  test("a period: an old call goes when it's shorter, and the address keeps it", async ({
    page,
    request,
  }) => {
    const who = await person(request, { name: "Period Person" });
    await call(request, who.id, "Long ago chat", -60);
    await openTimeline(page);
    const title = page.getByText("Call with Period Person: Long ago chat");
    await expect(title).toBeVisible();
    await pickPeriod(page, "Last 30 days");
    await expect(title).toBeHidden();
    await expect(page).toHaveURL(/period=30/);
    await page.reload();
    await expect(page.getByLabel("Period", { exact: true }).first()).toHaveValue("Last 30 days");
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    await expect(title).toBeHidden();
    await pickPeriod(page, "Last 3 months");
    await expect(title).toBeVisible();
    await expect(page).not.toHaveURL(/period=/);
  });

  test("older than the default shows only for All time", async ({ page, request }) => {
    const who = await person(request, { name: "All Time Person" });
    await call(request, who.id, "Ancient chat", -200);
    await openTimeline(page);
    await expect(page.getByRole("heading", { level: 3 }).first()).toBeVisible();
    const title = page.getByText("Call with All Time Person: Ancient chat");
    await expect(title).toBeHidden();
    await pickPeriod(page, "All time");
    await expect(title).toBeVisible();
    await expect(page).toHaveURL(/period=all/);
  });

  test("About narrows to one person, is kept in the address, and clears", async ({ page, request }) => {
    const one = await person(request, { name: "About One Person" });
    const two = await person(request, { name: "About Two Person" });
    await call(request, one.id, "One chat");
    await call(request, two.id, "Two chat");
    await openTimeline(page);
    await expect(page.getByText(/Two chat/)).toBeVisible();
    await pickAbout(page, "About One Person");
    await expect(page.getByText(/Two chat/)).toBeHidden();
    await expect(page.getByText(/One chat/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`about=contact(%3A|:)${one.id}`));
    await page.reload();
    await expect(page.getByLabel("About", { exact: true }).first()).toHaveValue("About One Person");
    await expect(page.getByText(/One chat/)).toBeVisible();
    await expect(page.getByText(/Two chat/)).toBeHidden();
    await page.locator(".mantine-InputClearButton-root").click();
    await expect(page.getByText(/Two chat/)).toBeVisible();
    await expect(page).not.toHaveURL(/about=/);
  });

  test("the Timeline button on a company's page opens it, all time", async ({ page, request }) => {
    await quick(request, "Button Timeline Co", "Button Timeline Role");
    const id = await companyId(request, "Button Timeline Co");
    await page.goto(`/companies/${id}`);
    await page.getByRole("link", { name: "Timeline for Button Timeline Co" }).click();
    await expect(page.getByLabel("About", { exact: true }).first()).toHaveValue("Button Timeline Co");
    await expect(page.getByLabel("Period", { exact: true }).first()).toHaveValue("All time");
    await expect(page.getByRole("link", { name: /Button Timeline Role/ }).first()).toBeVisible();
  });

  test("the same for an agency and a person", async ({ page, request }) => {
    const firm = await post<{ id: string }>(request, "agencies", { name: "Button Agency" });
    const who = await person(request, { name: "Button Person" });
    await page.goto(`/agencies/${firm.id}`);
    await page.getByRole("link", { name: "Timeline for Button Agency" }).click();
    await expect(page.getByLabel("About", { exact: true }).first()).toHaveValue("Button Agency");
    await page.goto(`/people/${who.id}`);
    await page.getByRole("link", { name: "Timeline for Button Person" }).click();
    await expect(page.getByLabel("About", { exact: true }).first()).toHaveValue("Button Person");
  });

  test("someone since deleted filters nothing, rather than everything", async ({ page, request }) => {
    const who = await person(request, { name: "Gone Timeline Person" });
    const other = await person(request, { name: "Still Timeline Person" });
    await call(request, other.id, "Still here chat");
    await request.delete(`${API}/contacts/${who.id}`);
    await openTimeline(page, `?about=contact:${who.id}`);
    await expect(page.getByText(/Still here chat/)).toBeVisible();
    await expect(page.getByLabel("About", { exact: true }).first()).toHaveValue("");
  });

  test("nonsense in the address is ignored", async ({ page }) => {
    await openTimeline(page, "?period=banana&view=sideways&about=nonsense");
    await expect(page.getByLabel("Period", { exact: true }).first()).toHaveValue("Last 3 months");
    await expect(page.getByLabel("About", { exact: true }).first()).toHaveValue("");
    await expect(page.locator('[aria-label="View"] input[value="list"]')).toBeChecked();
    await pickPeriod(page, "Last 30 days");
    await expect(page).not.toHaveURL(/banana|sideways|nonsense/);
  });

  test("nothing to show says what to try", async ({ page, request }) => {
    const who = await person(request, { name: "Quiet Person" });
    await openTimeline(page, `?about=contact:${who.id}&period=30`);
    await page.getByRole("button", { name: "None" }).click();
    await page.getByRole("group", { name: "Show" }).getByText("Interviews", { exact: true }).click();
    await expect(page.getByText("Nothing here yet")).toBeVisible();
    await expect(page.getByText("Try a longer period, tick more kinds, or clear a filter.")).toBeVisible();
  });
});

test.describe("Timeline: lanes", () => {
  test("one row per role, with a dot that goes to it; the address keeps the view", async ({
    page,
    request,
  }) => {
    const app = await quick(request, "Lane Co", "Lane Role");
    await request.post(`${API}/applications/${app.id}/move`, { data: { to_stage: "applied" } });
    await openTimeline(page);
    await view(page, "Lanes");
    await expect(page).toHaveURL(/view=lanes/);
    const row = page.getByRole("link", { name: "Lane Co · Lane Role" });
    await expect(row).toBeVisible();
    await expect(page.getByText("Hollow dots are ahead; the dashed line is now.")).toBeVisible();
    await page.reload();
    await expect(row).toBeVisible();
    const dots = page.getByRole("list", { name: "Lane Co · Lane Role" }).getByRole("button");
    expect(await dots.count()).toBeGreaterThan(0);
    await expect(dots.first()).toHaveAttribute("aria-label", /·/);
    await dots.first().dispatchEvent("click");
    await expect(page).toHaveURL(new RegExp(`/applications/${app.id}$`));
  });

  test("by person, company and agency", async ({ page, request }) => {
    const firm = await post<{ id: string }>(request, "agencies", { name: "Lane Agency" });
    const who = await person(request, { name: "Lane Person", agency_id: firm.id });
    await quick(request, "Lane Client Co", "Lane Client Role", {
      route: "agency",
      agency_id: firm.id,
      recruiter_id: who.id,
    });
    await call(request, who.id, "Lane call");
    await openTimeline(page, "?view=lanes");
    await rowsBy(page, "Person");
    await expect(page.getByRole("link", { name: "Lane Person" })).toHaveAttribute(
      "href",
      `/people/${who.id}`,
    );
    await rowsBy(page, "Company");
    await expect(page.getByRole("link", { name: "Lane Client Co", exact: true }).first()).toBeVisible();
    await rowsBy(page, "Agency");
    await expect(page.getByRole("link", { name: "Lane Agency", exact: true })).toHaveAttribute(
      "href",
      `/agencies/${firm.id}`,
    );
  });

  test("a booked call's dot is hollow", async ({ page, request }) => {
    const who = await person(request, { name: "Hollow Person" });
    await call(request, who.id, "Hollow call", 3);
    await openTimeline(page, "?view=lanes");
    await rowsBy(page, "Person");
    const dot = page.getByRole("list", { name: "Hollow Person" }).getByRole("button");
    await expect(dot).toHaveAttribute("aria-label", /Call: Call with Hollow Person: Hollow call/);
    const fill = await dot.evaluate((el) => getComputedStyle(el).backgroundColor);
    const page_ = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(fill).toBe(page_);
  });

  test("with only what isn't linked, it says so", async ({ page, request }) => {
    const who = await person(request, { name: "Unlinked Person" });
    await call(request, who.id, "Unlinked call");
    await openTimeline(page, `?view=lanes&about=contact:${who.id}`);
    await rowsBy(page, "Agency");
    await expect(page.getByText("Nothing here is linked to an agency.")).toBeVisible();
  });

  test("more than thirty rows are cut down, and can be shown", async ({ page, request }) => {
    for (let i = 0; i < 32; i++) {
      const who = await person(request, { name: `Lane Crowd ${i}` });
      await call(request, who.id, "Crowd", -2);
    }
    await openTimeline(page, "?view=lanes");
    await rowsBy(page, "Person");
    const lanes = page.locator("ul[aria-label]");
    await expect(lanes).toHaveCount(30);
    const more = page.getByRole("button", { name: /^Show all \d+ rows$/ });
    const all = Number(/\d+/.exec((await more.innerText()) ?? "")?.[0]);
    expect(all).toBeGreaterThanOrEqual(32);
    await more.click();
    await expect(lanes).toHaveCount(all);
    await page.getByRole("button", { name: "Show the 30 most recent" }).click();
    await expect(lanes).toHaveCount(30);
  });

  // KNOWN BUG (fix-timeline-load-error-silent on the roadmap): expected to fail until it is fixed.
  test.fail("if it can't load, it says so rather than that there's nothing", async ({ page, problems }) => {
    problems.allow(/500.*\/api\/v1\/timeline/);
    await page.route(/\/api\/v1\/timeline/, (route) =>
      route.fulfill({ status: 500, json: { detail: "Failed for the test" } }),
    );
    await openTimeline(page);
    await settled(page);
    await expect(page.getByText("Nothing here yet")).toHaveCount(0);
  });
});

test.describe("search: finding things", () => {
  test("the box: Enter opens results, spaces trimmed; empty does nothing; / jumps to it", async ({
    page,
  }) => {
    await page.goto("/search");
    await expect(page.getByText(/Type in the search box at the top/)).toBeVisible();
    await box(page).fill("   ");
    await page.keyboard.press("Enter");
    await expect(page).not.toHaveURL(/q=./);
    await page.getByRole("heading", { name: "Search", level: 2 }).click();
    await page.keyboard.press("/");
    await expect(box(page)).toBeFocused();
    await search(page, "  Backend CV ");
    await expect(page).toHaveURL(/q=Backend/);
  });

  test("/ typed in another field stays there", async ({ page }) => {
    await page.goto("/notes");
    await page.getByRole("textbox", { name: "Search notes" }).click();
    await page.keyboard.type("a/b");
    await expect(page.getByRole("textbox", { name: "Search notes" })).toHaveValue("a/b");
  });

  test("the box follows the page: reload, Back, leaving", async ({ page }) => {
    await page.goto("/notes");
    await expect(page.getByRole("heading", { name: "Notes", level: 2 })).toBeVisible();
    await search(page, "Backend CV");
    await page.reload();
    await expect(box(page)).toHaveValue("Backend CV");
    await search(page, "Short cover");
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Results for “Backend CV”", level: 2 })).toBeVisible();
    await expect(box(page)).toHaveValue("Backend CV");
    await menu(page, "Notes").click();
    await expect(box(page)).toHaveValue("");
  });

  test("every word must match, in any case; none says so", async ({ page, request }) => {
    await company(request, "Quaint Harbour Trading");
    await page.goto("/search");
    await search(page, "harbour QUAINT");
    await expect(hit(page, "Quaint Harbour Trading")).toBeVisible();
    await expect(page.getByText("1 result", { exact: true })).toBeVisible();
    await search(page, "harbour nonsenseword");
    await expect(
      page.getByText("Nothing matches every word of “harbour nonsenseword”.", { exact: false }),
    ).toBeVisible();
    await expect(hit(page, "Quaint Harbour Trading")).toBeHidden();
  });

  test("characters with a meaning elsewhere are just characters", async ({ page, request }) => {
    await company(request, "Percent%Under_Score Co");
    await company(request, "PercentXUnderYScore Co");
    await page.goto("/search");
    await search(page, "Percent%Under_Score");
    await expect(hit(page, "Percent%Under_Score Co")).toBeVisible();
    await expect(hit(page, "PercentXUnderYScore Co")).toBeHidden();
    await page.goto(`/search?q=${encodeURIComponent('"quoted" & <tag>')}`);
    await expect(page.getByText(/Nothing matches every word/)).toBeVisible();
  });

  // KNOWN BUG (fix-long-search-misleads on the roadmap): expected to fail until it is fixed.
  test.fail("a very long search gets an honest answer", async ({ page, problems }) => {
    problems.allow(/422.*\/api\/v1\/search/);
    await page.goto("/search");
    await box(page).fill("x".repeat(201));
    await page.keyboard.press("Enter");
    await settled(page);
    await expect(page.getByText("Is the tracker running?")).toHaveCount(0);
  });

  test("a search that's all digits works, typed or in the address", async ({ page, request }) => {
    await company(request, "Numbered 20261 Co");
    await page.goto("/search?q=20261");
    await expect(page.getByRole("heading", { name: "Results for “20261”", level: 2 })).toBeVisible();
    await expect(hit(page, "Numbered 20261 Co")).toBeVisible();
    await expect(box(page)).toHaveValue("20261");
    await page.reload();
    await expect(hit(page, "Numbered 20261 Co")).toBeVisible();
  });

  // KNOWN BUG (fix-search-note-dead-link on the roadmap): expected to fail until it is fixed.
  test.fail("a note on a company since deleted opens something real", async ({ page, request, problems }) => {
    problems.allow(/404.*\/api\/v1\/companies/);
    const gone = await company(request, "Dead Link Co");
    await post(request, "notes", { title: "Deadlinkword note", body: "", links: [`company:${gone.id}`] });
    expect((await request.delete(`${API}/companies/${gone.id}`)).ok()).toBe(true);
    await page.goto("/search");
    await search(page, "Deadlinkword");
    await hit(page, "Deadlinkword note").click();
    await settled(page);
    await expect(page.getByText(/Couldn.t load this company|Page not found/)).toHaveCount(0);
  });

  test("each kind of thing is found, and goes to the right place", async ({ page, request }) => {
    const app = await quick(request, "Zircon Finds Co", "Zircon Finds Role");
    const coId = await companyId(request, "Zircon Finds Co");
    const firm = await post<{ id: string }>(request, "agencies", { name: "Zircon Agency" });
    const who = await person(request, {
      name: "Zircon Person",
      details: [{ kind: "email", value: "zircon.mail@example.com" }],
    });
    await post(request, `applications/${app.id}/interviews`, {
      title: "Prep round",
      debrief: "They asked zirconiumword",
    });
    await post(request, `applications/${app.id}/offers`, { notes: "Offer note zirconoffer" });
    await call(request, who.id, "Call about zirconcall");
    await post(request, "notes", { title: "Plain title", body: "Body has zirconnote inside", links: [] });
    await post(request, "documents", { name: "Zircondoc CV", kind: "cv" });
    await post(request, "links", {
      entity_type: "company",
      entity_id: coId,
      url: "https://zirconlink.example.com/x",
      title: "Zirconlink page",
    });
    await page.goto("/search");

    await search(page, "Zircon Finds Co");
    await expect(page.locator(`a[href="/companies/${coId}"]`).first()).toBeVisible();
    await expect(page.locator(`a[href="/applications/${app.id}"]`).first()).toBeVisible();
    await search(page, "Zircon Agency");
    await expect(hit(page, "Zircon Agency")).toHaveAttribute("href", `/agencies/${firm.id}`);
    await search(page, "zircon.mail@example.com");
    await expect(hit(page, "Zircon Person").first()).toHaveAttribute("href", `/people/${who.id}`);
    await search(page, "zirconiumword");
    await expect(page.getByText("Interview", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/They asked/).first()).toBeVisible();
    await search(page, "zirconoffer");
    await expect(page.getByText("Offer", { exact: true }).first()).toBeVisible();
    await search(page, "zirconcall");
    await expect(page.getByText("Call", { exact: true }).first()).toBeVisible();
    await search(page, "zirconnote");
    await expect(hit(page, "Plain title")).toBeVisible();
    await expect(page.getByText(/Body has/).first()).toBeVisible();
    await search(page, "Zircondoc");
    await expect(hit(page, "Zircondoc CV")).toHaveAttribute("href", /\/documents/);
    await search(page, "Zirconlink");
    await expect(hit(page, "Zirconlink page")).toHaveAttribute("href", `/companies/${coId}`);
  });

  test("a file is found by its name, and goes to what it's on", async ({ page, request }) => {
    const at = await company(request, "File Search Co");
    await request.post(`${API}/attachments`, {
      multipart: {
        entity_type: "company",
        entity_id: at.id,
        file: { name: "zirconfile.txt", mimeType: "text/plain", buffer: Buffer.from("made up") },
      },
    });
    await page.goto("/search");
    await search(page, "zirconfile");
    await expect(hit(page, "zirconfile.txt")).toHaveAttribute("href", `/companies/${at.id}`);
  });

  test("an archived application is marked, and comes after one that isn't", async ({ page, request }) => {
    const live = await quick(request, "Ranked Live Co", "Rankword New Role");
    const old = await quick(request, "Ranked Archive Co", "Rankword Old Role");
    // Archived last, so it's the newest of the two and only being archived can put it after.
    await request.patch(`${API}/applications/${old.id}`, { data: { archived: true } });
    const hits = (await (await request.get(`${API}/search?q=Rankword`)).json()) as {
      kind: string;
      id: string;
      archived: boolean;
    }[];
    const apps = hits.filter((h) => h.kind === "application");
    expect(apps.map((h) => h.id)).toEqual([live.id, old.id]);
    await page.goto("/search");
    await search(page, "Rankword");
    await expect(page.getByText("Archived", { exact: true })).toHaveCount(1);
  });
});

test.describe("search: keeping up", () => {
  test("a company's new name is found, and the old one isn't", async ({ page, request }) => {
    const at = await company(request, "Oldword Search Co");
    await request.patch(`${API}/companies/${at.id}`, { data: { name: "Newword Search Co" } });
    await page.goto("/search");
    await search(page, "Newword");
    await expect(hit(page, "Newword Search Co")).toBeVisible();
    await search(page, "Oldword");
    await expect(page.getByText(/Nothing matches every word/)).toBeVisible();
  });

  // KNOWN BUG (fix-search-stale-after-rename on the roadmap): expected to fail until it is fixed.
  test.fail("results seen before a rename show the new name on the way back", async ({ page, request }) => {
    await page.clock.setFixedTime(new Date());
    await company(request, "Backword Before Co");
    await page.goto("/search");
    await search(page, "Backword");
    await hit(page, "Backword Before Co").click();
    await expect(page.getByRole("heading", { name: "Backword Before Co", level: 2 })).toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await theDialog(page).getByLabel("Name").fill("Backword After Co");
    await theDialog(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Backword After Co", level: 2 })).toBeVisible();
    await page.goBack();
    await expect(hit(page, "Backword After Co")).toBeVisible();
    await expect(hit(page, "Backword Before Co")).toBeHidden();
  });

  test("something deleted goes from results seen before", async ({ page, request, problems }) => {
    problems.allow(/404.*\/api\/v1\/companies/);
    await page.clock.setFixedTime(new Date());
    await company(request, "Goneword Search Co");
    await page.goto("/search");
    await search(page, "Goneword");
    await hit(page, "Goneword Search Co").click();
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/companies$/);
    await page.goBack();
    await page.goBack();
    await expect(page.getByRole("heading", { name: "Results for “Goneword”", level: 2 })).toBeVisible();
    await expect(page.getByText(/Nothing matches every word/)).toBeVisible();
    await expect(hit(page, "Goneword Search Co")).toBeHidden();
  });

  test("if search fails, it says so", async ({ page, problems }) => {
    problems.allow(/500.*\/api\/v1\/search/);
    await page.route(/\/api\/v1\/search/, (route) =>
      route.fulfill({ status: 500, json: { detail: "Failed for the test" } }),
    );
    await page.goto("/search");
    await search(page, "anything");
    await expect(page.getByText("Search didn't work. Is the tracker running?")).toBeVisible({
      timeout: 15_000,
    });
  });
});
