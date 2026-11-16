import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Cards and lists that load on their own (components/QueryState.tsx): while their request is held
// they show skeleton lines, not their "nothing here" text; when it fails they say so with Retry,
// and Retry loads them (fix-loading-state-pattern). Requests are held, not slowed, so nothing here
// rests on timing.

const API = "/api/v1";

const post = async <T = { id: string }>(request: APIRequestContext, path: string, data: object) => {
  const res = await request.post(`${API}/${path}`, { data });
  expect(res.ok()).toBe(true);
  return (await res.json()) as T;
};

/** Holds every request to `url` until the returned function is called. */
const hold = async (page: Page, url: string) => {
  let release = () => {};
  const gate = new Promise<void>((done) => (release = done));
  await page.route(url, async (route) => {
    await gate;
    await route.continue();
  });
  return release;
};

const card = (page: Page, title: string) =>
  page.locator(".mantine-Card-root").filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const loading = (where: Locator) => where.locator('[aria-busy="true"]');

/** A failed request shows the failed line (after React Query's retries), never the empty text; Retry loads it. */
const failsThenRetries = async (page: Page, where: Locator, url: string, empty: string, loaded: string) => {
  await page.unroute(url);
  await page.route(url, (route) => route.fulfill({ status: 500, json: {} }));
  await page.reload();
  await expect(where.getByText("Couldn't load this.")).toBeVisible({ timeout: 15_000 });
  await expect(where.getByText(empty)).toBeHidden();
  await page.unroute(url);
  await where.getByRole("button", { name: "Retry" }).click();
  await expect(where.getByText(loaded)).toBeVisible();
  await expect(where.getByText("Couldn't load this.")).toBeHidden();
};

test("a company's Roles card doesn't say it has none while loading or after a failed load", async ({
  page,
  request,
  problems,
}) => {
  problems.allow(/\/role-summaries/);
  const company = await post(request, "companies", { name: "Loading Roles Co" });
  await post(request, "roles", { company_id: company.id, title: "Held Role Engineer" });
  const url = `**${API}/role-summaries?*company_id=${company.id}*`;
  const release = await hold(page, url);
  await page.goto(`/companies/${company.id}`);
  const roles = card(page, "Roles");
  const empty = "No roles yet. Add one you might go for, then apply or pass.";
  await expect(roles).toBeVisible();
  await expect(roles.getByText(empty)).toBeHidden();
  await expect(loading(roles)).toBeVisible();
  release();
  await expect(roles.getByText("Held Role Engineer")).toBeVisible();
  await expect(loading(roles)).toHaveCount(0);
  await failsThenRetries(page, roles, url, empty, "Held Role Engineer");
});

test("a person's Calls card doesn't say there are none while loading or after a failed load", async ({
  page,
  request,
  problems,
}) => {
  problems.allow(/\/meetings\?/);
  const person = await post(request, "contacts", { name: "Quinn Loading" });
  const starts = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
  await post(request, "meetings", { contact_id: person.id, title: "Held intro call", starts_at: starts });
  const url = `**${API}/meetings?*contact_id=${person.id}*`;
  const release = await hold(page, url);
  await page.goto(`/people/${person.id}`);
  const calls = card(page, "Calls and meetings");
  const empty = "No calls with Quinn Loading yet. Book one, or log one you've had.";
  await expect(calls).toBeVisible();
  await expect(calls.getByText(empty)).toBeHidden();
  await expect(loading(calls)).toBeVisible();
  release();
  await expect(calls.getByText("Held intro call")).toBeVisible();
  await expect(loading(calls)).toHaveCount(0);
  await failsThenRetries(page, calls, url, empty, "Held intro call");
});

test("a company's Links card doesn't say it has none while loading or after a failed load", async ({
  page,
  request,
  problems,
}) => {
  problems.allow(/\/links\?/);
  const company = await post(request, "companies", { name: "Loading Links Co" });
  await post(request, "links", {
    entity_type: "company",
    entity_id: company.id,
    url: "https://jobs.example.com/held",
    title: "Held job ad",
  });
  const url = `**${API}/links?*entity_id=${company.id}*`;
  const release = await hold(page, url);
  await page.goto(`/companies/${company.id}`);
  const links = card(page, "Links");
  const empty = "Job ads, Google Docs, repos: anything with a URL.";
  await expect(links).toBeVisible();
  await expect(links.getByText(empty)).toBeHidden();
  await expect(loading(links)).toBeVisible();
  release();
  await expect(links.getByText("Held job ad")).toBeVisible();
  await expect(loading(links)).toHaveCount(0);
  await failsThenRetries(page, links, url, empty, "Held job ad");
});

// loading-state-page-skeletons-records: a record's page draws its own shape while its record loads.
test("a company's page shows a skeleton of the page, not a spinner, while its record loads", async ({
  page,
  request,
}) => {
  const company = await post(request, "companies", { name: "Held Page Co" });
  const release = await hold(page, `**${API}/companies/${company.id}/summary`);
  await page.goto(`/companies/${company.id}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("link", { name: "All companies" })).toBeVisible();
  await expect(main.getByTestId("query-loading").first()).toBeVisible();
  await expect(main.locator(".mantine-Loader-root")).toHaveCount(0);
  await expect(main.getByRole("heading", { name: "Held Page Co" })).toHaveCount(0);
  release();
  await expect(main.getByRole("heading", { name: "Held Page Co", level: 2 })).toBeVisible();
});

test.describe("Today", () => {
  const section = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

  test("Done recently doesn't say nothing's ticked off while loading or after a failed load", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/\/todos\?/);
    const todo = await post(request, "todos", { text: "Held done to-do" });
    expect((await request.patch(`${API}/todos/${todo.id}`, { data: { done: true } })).ok()).toBe(true);
    const url = `**${API}/todos?*status=done*`;
    const release = await hold(page, url);
    await page.goto("/");
    const todos = section(page, "To-dos");
    await todos.getByRole("button", { name: "Done recently" }).click();
    const empty = "Nothing ticked off yet.";
    await expect(todos).toBeVisible();
    await expect(todos.getByText(empty)).toBeHidden();
    await expect(loading(todos)).toBeVisible();
    release();
    await expect(todos.getByText("Held done to-do")).toBeVisible();
    await expect(loading(todos)).toHaveCount(0);

    await page.route(url, (route) => route.fulfill({ status: 500, json: {} }));
    await page.reload();
    await todos.getByRole("button", { name: "Done recently" }).click();
    await expect(todos.getByText("Couldn't load this.")).toBeVisible({ timeout: 15_000 });
    await expect(todos.getByText(empty)).toBeHidden();
    await page.unroute(url);
    await todos.getByRole("button", { name: "Retry" }).click();
    await expect(todos.getByText("Held done to-do")).toBeVisible();
  });

  test("Recent activity doesn't say nothing happened while loading or after a failed load", async ({
    page,
    problems,
  }) => {
    problems.allow(/\/timeline\?/);
    const url = `**${API}/timeline?*`;
    const release = await hold(page, url);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Your move" })).toBeVisible();
    await page.getByRole("button", { name: "Recent activity" }).click();
    const recent = page.getByRole("region", { name: "Recent activity" });
    const empty = "Nothing in the last two weeks.";
    await expect(recent).toBeVisible();
    await expect(recent.getByText(empty)).toBeHidden();
    await expect(loading(recent)).toBeVisible();
    release();
    const seeded = /Contoso|Litware|Wide World|Coho|Fabrikam|Adventure/;
    await expect(recent.getByText(seeded).first()).toBeVisible();
    await expect(loading(recent)).toHaveCount(0);

    await page.unroute(url);
    await page.route(url, (route) => route.fulfill({ status: 500, json: {} }));
    await page.reload();
    await page.getByRole("button", { name: "Recent activity" }).click();
    await expect(recent.getByText("Couldn't load this.")).toBeVisible({ timeout: 15_000 });
    await expect(recent.getByText(empty)).toBeHidden();
    await page.unroute(url);
    await recent.getByRole("button", { name: "Retry" }).click();
    await expect(recent.getByText(seeded).first()).toBeVisible();
  });
});
