import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Companies and agencies: creating them from their pages and from inside other dialogs, renaming
// them and seeing the new name everywhere, websites, what a delete leaves behind and what it
// refuses. Each test uses its own names. Creating people at agencies is in people.spec.ts.

interface Named {
  id: string;
  name: string;
  website: string | null;
  description?: string | null;
}
interface Person {
  id: string;
  name: string;
  agency_id: string | null;
  company_id: string | null;
}
interface Role {
  id: string;
  title: string;
  company_id: string;
}
interface Application {
  id: string;
  route: string;
  agency_id: string | null;
  recruiter_id: string | null;
  role_title: string;
  company_name: string;
}

const API = "/api/v1";
const list = async <T>(request: APIRequestContext, path: string) =>
  (await (await request.get(`${API}/${path}`)).json()) as T[];
const named = (request: APIRequestContext, path: "companies" | "agencies", name: string) =>
  list<Named>(request, path).then((all) => all.filter((c) => c.name === name));
const companies = (request: APIRequestContext, name: string) => named(request, "companies", name);
const agencies = (request: APIRequestContext, name: string) => named(request, "agencies", name);
const rolesCalled = (request: APIRequestContext, title: string) =>
  list<Role>(request, "roles").then((all) => all.filter((r) => r.title === title));
const create = async <T = Named>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const company = (request: APIRequestContext, name: string, website?: string) =>
  create(request, "companies", { name, website });
const agency = (request: APIRequestContext, name: string, website?: string) =>
  create(request, "agencies", { name, website });
const contact = (
  request: APIRequestContext,
  data: { name: string; agency_id?: string; company_id?: string },
) => create<Person>(request, "contacts", data);
const role = (request: APIRequestContext, data: { company_id: string; title: string; contact_id?: string }) =>
  create<Role>(request, "roles", data);
const apply = (
  request: APIRequestContext,
  data: {
    company_name: string;
    role_title: string;
    route?: string;
    agency_id?: string;
    recruiter_id?: string;
  },
) => create<Application>(request, "applications/quick", { route: "direct", tags: [], ...data });
const getJson = async <T>(request: APIRequestContext, path: string) =>
  (await (await request.get(`${API}/${path}`)).json()) as T;

const menu = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true });
const heading = (page: Page, name: string) => page.getByRole("heading", { name, level: 2 });
const notice = (page: Page, text: string | RegExp) => page.getByText(text).first();
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
/** Holds back one kind of request, as a slow disk or a busy machine would. */
const slow = (page: Page, url: string, method: string, ms = 800) =>
  page.route(url, async (route) => {
    if (route.request().method() === method) await pause(ms);
    await route.continue();
  });
/** Every request that changes something, as "METHOD path". */
const watchWrites = (page: Page) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return writes;
};
const answered = (page: Page, method: string, url: RegExp) =>
  page.waitForResponse((r) => r.request().method() === method && url.test(new URL(r.url()).pathname));

const openCompanies = async (page: Page) => {
  await page.goto("/companies");
  await expect(heading(page, "Companies")).toBeVisible();
  await expect(page.getByRole("row").nth(1)).toBeVisible();
};
const openRecruiters = async (page: Page) => {
  await page.goto("/recruiters");
  await expect(heading(page, "Recruiters")).toBeVisible();
  await expect(page.getByRole("link", { name: "Alex Morgan" }).first()).toBeVisible();
};
const openCompany = async (page: Page, id: string, name: string) => {
  await page.goto(`/companies/${id}`);
  await expect(heading(page, name)).toBeVisible();
};
const openAgency = async (page: Page, id: string, name: string) => {
  await page.goto(`/agencies/${id}`);
  await expect(heading(page, name)).toBeVisible();
};
const newCompany = async (page: Page) => {
  await page.getByRole("button", { name: "New company" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("New company", { exact: true })).toBeVisible();
  return dialog;
};
const editDialog = async (page: Page, name: string) => {
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Edit ${name}`)).toBeVisible();
  return dialog;
};
const saveDialog = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const rename = async (page: Page, from: string, to: string) => {
  const dialog = await editDialog(page, from);
  await dialog.getByLabel("Name").fill(to);
  await saveDialog(dialog);
  await expect(heading(page, to)).toBeVisible();
};
const pressDelete = (page: Page) => page.getByRole("button", { name: "Delete", exact: true }).click();
/** Presses Delete, answers its question, and returns what it asked. */
const deleteAnswering = async (page: Page, accept: boolean) => {
  const message = new Promise<string>((done) => {
    page.once("dialog", (d) => {
      done(d.message());
      void (accept ? d.accept() : d.dismiss());
    });
  });
  await pressDelete(page);
  return message;
};
const newPerson = async (page: Page) => {
  await page.getByRole("button", { name: "New person" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("New person", { exact: true })).toBeVisible();
  return dialog;
};
const addInside = async (page: Page, dialog: Locator, field: "Agency" | "Company", name: string) => {
  await dialog.getByLabel(field).first().fill(name);
  await page.getByRole("option", { name: `+ Add "${name}"` }).click();
  await expect(dialog.getByLabel(field).first()).toHaveValue(name);
};
const addRoleDialog = async (page: Page) => {
  await page.getByRole("button", { name: "Add role" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Add a role to decide on")).toBeVisible();
  return dialog;
};
const roleTitle = (dialog: Locator) => dialog.getByLabel("Role", { exact: true });
const submitRole = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Add role", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const roleLine = (page: Page, title: string) =>
  page
    .locator("div")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) })
    .filter({ has: page.getByRole("button", { name: `Edit ${title}` }) })
    .last();
const newApplication = async (page: Page) => {
  await page.getByRole("button", { name: "New application" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Add application" })).toBeVisible();
  return dialog;
};
const applicationRow = (page: Page, title: string) => page.getByRole("row").filter({ hasText: title });
const companyRow = (page: Page, name: string) => page.getByRole("row", { name: `Open ${name}`, exact: true });
const view = (page: Page, name: string) =>
  page.locator(".mantine-SegmentedControl-root").getByText(name).click();

test.describe("creating a company", () => {
  test("asks for a name, and a website that is one", async ({ page, request }) => {
    await openCompanies(page);
    const dialog = await newCompany(page);
    await dialog.getByRole("button", { name: "Add company" }).click();
    await expect(dialog.getByText("Name the company")).toBeVisible();
    await dialog.getByLabel("Name").fill("Bad Site Co");
    await dialog.getByLabel("Website").fill("not a site");
    await dialog.getByRole("button", { name: "Add company" }).click();
    await expect(dialog.getByText("Links start with http:// or https://")).toBeVisible();
    expect(await companies(request, "Bad Site Co")).toHaveLength(0);
  });

  test("from Companies: trimmed, saved, and its page opens", async ({ page, request }) => {
    await openCompanies(page);
    const dialog = await newCompany(page);
    await dialog.getByLabel("Name").fill("  Fresh Co ");
    await dialog.getByLabel("Website").fill("https://fresh.example.com");
    await dialog.getByRole("button", { name: "Add company" }).click();
    await expect(dialog).toBeHidden();
    await expect(heading(page, "Fresh Co")).toBeVisible();
    const made = await companies(request, "Fresh Co");
    expect(made).toHaveLength(1);
    expect(page.url()).toContain(`/companies/${made[0]?.id}`);
    await expect(page.getByRole("link", { name: "fresh.example.com" })).toHaveAttribute(
      "href",
      /^https:\/\/fresh\.example\.com/,
    );
    await page.getByRole("link", { name: "All companies" }).click();
    await expect(companyRow(page, "Fresh Co")).toBeVisible();
    await page.reload();
    await expect(companyRow(page, "Fresh Co")).toBeVisible();
  });

  test("without a website has none", async ({ page, request }) => {
    await openCompanies(page);
    const dialog = await newCompany(page);
    await dialog.getByLabel("Name").fill("No Site Co");
    await dialog.getByRole("button", { name: "Add company" }).click();
    await expect(heading(page, "No Site Co")).toBeVisible();
    expect((await companies(request, "No Site Co"))[0]?.website).toBeNull();
  });

  test("closing it adds nothing", async ({ page, request }) => {
    await openCompanies(page);
    const writes = watchWrites(page);
    const dialog = await newCompany(page);
    await dialog.getByLabel("Name").fill("Cancelled Co");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/\/companies$/);
    expect(writes).toEqual([]);
    expect(await companies(request, "Cancelled Co")).toHaveLength(0);
  });

  // KNOWN BUG (fix-new-company-keeps-draft on the roadmap): expected to fail until it is fixed.
  test.fail("closing it leaves nothing behind for next time", async ({ page }) => {
    await openCompanies(page);
    const dialog = await newCompany(page);
    await dialog.getByLabel("Name").fill("Draft Co");
    await dialog.getByLabel("Website").fill("https://draft.example.com");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "New company" }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue("");
    await expect(dialog.getByLabel("Website")).toHaveValue("");
  });

  test("a double click on a slow save makes one", async ({ page, request }) => {
    await slow(page, `**${API}/companies`, "POST");
    await openCompanies(page);
    const dialog = await newCompany(page);
    await dialog.getByLabel("Name").fill("Double Click Co");
    await dialog.getByRole("button", { name: "Add company" }).dblclick();
    await expect(heading(page, "Double Click Co")).toBeVisible();
    expect(await companies(request, "Double Click Co")).toHaveLength(1);
  });

  test("a website the server refuses is explained, and the dialog stays", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/422.*\/api\/v1\/companies/);
    await openCompanies(page);
    const dialog = await newCompany(page);
    await dialog.getByLabel("Name").fill("Hollow Site Co");
    await dialog.getByLabel("Website").fill("https://");
    const refused = answered(page, "POST", /\/companies$/);
    await dialog.getByRole("button", { name: "Add company" }).click();
    expect((await refused).status()).toBe(422);
    await expect(notice(page, "That didn't work")).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveValue("Hollow Site Co");
    expect(await companies(request, "Hollow Site Co")).toHaveLength(0);
  });

  // KNOWN BUG (fix-duplicate-company-name on the roadmap): expected to fail until it is fixed.
  test.fail("the same name twice doesn't make a second company", async ({ page, request, problems }) => {
    problems.allow(/\/api\/v1\/companies/); // a fix may refuse it
    await company(request, "Twin Co");
    await openCompanies(page);
    const dialog = await newCompany(page);
    await dialog.getByLabel("Name").fill("Twin Co");
    const posted = answered(page, "POST", /\/companies$/);
    await dialog.getByRole("button", { name: "Add company" }).click();
    await posted;
    expect(await companies(request, "Twin Co")).toHaveLength(1);
  });
});

test.describe("making a company inside other dialogs", () => {
  test("in the person dialog: it exists by itself, with them at it", async ({ page, request }) => {
    await openRecruiters(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Inside Dialog Person");
    await addInside(page, dialog, "Company", "Person Dialog Co");
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(dialog).toBeHidden();
    const made = await companies(request, "Person Dialog Co");
    expect(made).toHaveLength(1);
    const people = await list<Person>(request, "contacts");
    expect(people.find((p) => p.name === "Inside Dialog Person")?.company_id).toBe(made[0]?.id);
    await menu(page, "Companies").click();
    await expect(companyRow(page, "Person Dialog Co")).toBeVisible();
    await companyRow(page, "Person Dialog Co").click();
    await expect(page.getByRole("link", { name: "Inside Dialog Person" })).toBeVisible();
  });

  test("typing an existing one in the person dialog offers it, not a new one", async ({ page, request }) => {
    await company(request, "Existing Person Co");
    await openRecruiters(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Company").first().fill("existing person co");
    await expect(page.getByRole("option", { name: "Existing Person Co", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: /^\+ Add/ })).toBeHidden();
  });

  test("in the role dialog: the role is at it, and there's one", async ({ page, request }) => {
    await page.goto("/roles");
    await expect(heading(page, "Roles")).toBeVisible();
    const dialog = await addRoleDialog(page);
    await addInside(page, dialog, "Company", "Role Dialog Co");
    await roleTitle(dialog).fill("Inside Role");
    await submitRole(dialog);
    const made = await companies(request, "Role Dialog Co");
    expect(made).toHaveLength(1);
    expect((await rolesCalled(request, "Inside Role"))[0]?.company_id).toBe(made[0]?.id);
    await expect(roleLine(page, "Inside Role")).toContainText("Role Dialog Co");
    await menu(page, "Companies").click();
    await expect(companyRow(page, "Role Dialog Co")).toBeVisible();
  });

  test("typing an existing one in the role dialog offers it, not a new one", async ({ page, request }) => {
    await company(request, "Existing Role Co");
    await page.goto("/roles");
    await expect(heading(page, "Roles")).toBeVisible();
    const dialog = await addRoleDialog(page);
    await dialog.getByLabel("Company").first().fill("EXISTING ROLE CO");
    await expect(page.getByRole("option", { name: "Existing Role Co", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: /^\+ Add/ })).toBeHidden();
  });

  test("made in the person dialog, it can be picked in the role dialog", async ({ page, request }) => {
    await openRecruiters(page);
    const person = await newPerson(page);
    await person.getByLabel("Name").fill("Hand Over Person");
    await addInside(page, person, "Company", "Hand Over Co");
    await person.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(person).toBeHidden();
    await menu(page, "Roles").click();
    await expect(heading(page, "Roles")).toBeVisible();
    const dialog = await addRoleDialog(page);
    await dialog.getByLabel("Company").first().fill("Hand Over Co");
    await page.getByRole("option", { name: "Hand Over Co", exact: true }).click();
    await roleTitle(dialog).fill("Handed Over Role");
    await submitRole(dialog);
    expect(await companies(request, "Hand Over Co")).toHaveLength(1);
  });

  test("in New application: it's made once and lists the application", async ({ page, request }) => {
    await openCompanies(page);
    const dialog = await newApplication(page);
    await dialog.getByLabel("Company").fill("Application Dialog Co");
    await dialog.getByLabel("Role", { exact: true }).fill("Inside Application");
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(dialog).toBeHidden();
    const made = await companies(request, "Application Dialog Co");
    expect(made).toHaveLength(1);
    await openCompany(page, made[0]?.id ?? "", "Application Dialog Co");
    await expect(page.getByRole("row").filter({ hasText: "Inside Application" })).toBeVisible();
  });

  test("New application reuses a name typed in another case, with spaces", async ({ page, request }) => {
    const existing = await company(request, "Reused Name Co");
    await openCompanies(page);
    const dialog = await newApplication(page);
    await dialog.getByLabel("Company").fill("  reused NAME co ");
    await dialog.getByLabel("Role", { exact: true }).fill("Reused Application");
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(dialog).toBeHidden();
    expect(await companies(request, "Reused Name Co")).toHaveLength(1);
    const all = await list<Named>(request, "companies");
    expect(all.filter((c) => c.name.toLowerCase().trim() === "reused name co")).toHaveLength(1);
    await openCompany(page, existing.id, "Reused Name Co");
    await expect(page.getByRole("row").filter({ hasText: "Reused Application" })).toBeVisible();
  });

  test("cancelling New application makes no company", async ({ page, request }) => {
    await openCompanies(page);
    const writes = watchWrites(page);
    const dialog = await newApplication(page);
    await dialog.getByLabel("Company").fill("Never Made Co");
    await dialog.getByLabel("Role", { exact: true }).fill("Never Made Role");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
    expect(await companies(request, "Never Made Co")).toHaveLength(0);
  });

  test("started from a company's page, a role is at that company", async ({ page, request }) => {
    const here = await company(request, "Role Start Co");
    await openCompany(page, here.id, "Role Start Co");
    const dialog = await addRoleDialog(page);
    await expect(dialog.getByLabel("Company").first()).toHaveValue("Role Start Co");
    await roleTitle(dialog).fill("Started Here");
    await submitRole(dialog);
    expect((await rolesCalled(request, "Started Here"))[0]?.company_id).toBe(here.id);
    await expect(page.getByRole("link", { name: "Started Here" })).toBeVisible();
  });

  // KNOWN BUG (fix-person-saved-before-new-company on the roadmap): expected to fail until it is fixed.
  test.fail(
    "saving a person while their new company is still being made keeps them at it",
    async ({ page, request }) => {
      await slow(page, `**${API}/companies`, "POST", 1500);
      await openRecruiters(page);
      const dialog = await newPerson(page);
      await dialog.getByLabel("Name").fill("Too Quick Person");
      await dialog.getByLabel("Company").first().fill("Too Quick Co");
      const made = answered(page, "POST", /\/companies$/);
      await page.getByRole("option", { name: '+ Add "Too Quick Co"' }).click();
      await dialog.getByRole("button", { name: "Add person", exact: true }).click();
      await made;
      await expect(dialog).toBeHidden();
      const people = await list<Person>(request, "contacts");
      const [co] = await companies(request, "Too Quick Co");
      expect(people.find((p) => p.name === "Too Quick Person")?.company_id).toBe(co?.id);
    },
  );

  // KNOWN BUG (fix-person-saved-before-new-company on the roadmap): expected to fail until it is fixed.
  test.fail(
    "saving a person while their new agency is still being made keeps them at it",
    async ({ page, request }) => {
      await slow(page, `**${API}/agencies`, "POST", 1500);
      await openRecruiters(page);
      const dialog = await newPerson(page);
      await dialog.getByLabel("Name").fill("Too Quick Recruiter");
      await dialog.getByLabel("Agency").first().fill("Too Quick Agency");
      const made = answered(page, "POST", /\/agencies$/);
      await page.getByRole("option", { name: '+ Add "Too Quick Agency"' }).click();
      await dialog.getByRole("button", { name: "Add person", exact: true }).click();
      await made;
      await expect(dialog).toBeHidden();
      const people = await list<Person>(request, "contacts");
      const [made2] = await agencies(request, "Too Quick Agency");
      expect(people.find((p) => p.name === "Too Quick Recruiter")?.agency_id).toBe(made2?.id);
    },
  );
});

test.describe("renaming a company", () => {
  test("asks for a name, and a real website", async ({ page, request }) => {
    const here = await company(request, "Checked Co");
    await openCompany(page, here.id, "Checked Co");
    const writes = watchWrites(page);
    const dialog = await editDialog(page, "Checked Co");
    await dialog.getByLabel("Name").fill("   ");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog.getByText("It needs a name")).toBeVisible();
    await dialog.getByLabel("Name").fill("Checked Co");
    for (const bad of ["not a site", "https://nodot", "ftp://files.example.com"]) {
      await dialog.getByLabel("Website").fill(bad);
      await dialog.getByRole("button", { name: "Save", exact: true }).click();
      await expect(dialog.getByText("Like https://contoso.example.com")).toBeVisible();
    }
    expect(writes).toEqual([]);
  });

  test("Cancel and Escape change nothing, and it reopens as saved", async ({ page, request }) => {
    const here = await company(request, "Steady Co", "https://steady.example.com");
    await openCompany(page, here.id, "Steady Co");
    const writes = watchWrites(page);
    let dialog = await editDialog(page, "Steady Co");
    await dialog.getByLabel("Name").fill("Changed Mind Co");
    await dialog.getByLabel("Website").fill("");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(heading(page, "Steady Co")).toBeVisible();
    dialog = await editDialog(page, "Steady Co");
    await expect(dialog.getByLabel("Name")).toHaveValue("Steady Co");
    await expect(dialog.getByLabel("Website")).toHaveValue(/steady\.example\.com/);
    await dialog.getByLabel("Name").fill("Changed Mind Again Co");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(heading(page, "Steady Co")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("shows on roles, applications, people and Companies without a reload", async ({ page, request }) => {
    const here = await company(request, "Before Rename Co");
    const person = await contact(request, { name: "Rename Watcher", company_id: here.id });
    await role(request, { company_id: here.id, title: "Rename Role" });
    await apply(request, { company_name: "Before Rename Co", role_title: "Rename Application" });
    // Each page is seen first, so what it holds has to be refreshed rather than loaded new.
    await page.goto("/roles");
    await expect(roleLine(page, "Rename Role")).toContainText("Before Rename Co");
    await menu(page, "Applications").click();
    await expect(applicationRow(page, "Rename Application")).toContainText("Before Rename Co");
    await menu(page, "Recruiters").click();
    await expect(page.getByRole("link", { name: "Before Rename Co", exact: true })).toBeVisible();
    await menu(page, "Companies").click();
    await companyRow(page, "Before Rename Co").click();
    await expect(heading(page, "Before Rename Co")).toBeVisible();

    await rename(page, "Before Rename Co", "After Rename Co");
    expect(await companies(request, "Before Rename Co")).toHaveLength(0);

    await menu(page, "Roles").click();
    await expect(roleLine(page, "Rename Role")).toContainText("After Rename Co");
    await menu(page, "Applications").click();
    await expect(applicationRow(page, "Rename Application")).toContainText("After Rename Co");
    await menu(page, "Recruiters").click();
    await expect(page.getByRole("link", { name: "After Rename Co", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Before Rename Co", exact: true })).toBeHidden();
    await menu(page, "Companies").click();
    await expect(companyRow(page, "After Rename Co")).toBeVisible();
    await expect(companyRow(page, "Before Rename Co")).toBeHidden();

    await page.goto(`/people/${person.id}`);
    await expect(page.getByRole("link", { name: "After Rename Co", exact: true })).toBeVisible();
    await page.goto("/applications");
    await expect(applicationRow(page, "Rename Application")).toContainText("After Rename Co");
  });

  test("the name is trimmed, and a new website replaces the old", async ({ page, request }) => {
    const here = await company(request, "Trim Me Co", "https://old.example.com");
    await openCompany(page, here.id, "Trim Me Co");
    const dialog = await editDialog(page, "Trim Me Co");
    await dialog.getByLabel("Name").fill("  Trimmed Co  ");
    await dialog.getByLabel("Website").fill(" https://new.example.com ");
    await saveDialog(dialog);
    await expect(page.getByRole("link", { name: "new.example.com" })).toBeVisible();
    await expect(page.getByRole("link", { name: "old.example.com" })).toBeHidden();
    const [saved] = await companies(request, "Trimmed Co");
    expect(saved?.website).toContain("https://new.example.com");
  });

  test("clearing the website removes it, everywhere and for good", async ({ page, request }) => {
    const here = await company(request, "Clear Site Co", "https://clearme.example.com");
    await request.patch(`${API}/companies/${here.id}`, { data: { description: "Kept words" } });
    await openCompany(page, here.id, "Clear Site Co");
    await expect(page.getByRole("link", { name: "clearme.example.com" })).toBeVisible();
    const dialog = await editDialog(page, "Clear Site Co");
    await dialog.getByLabel("Website").fill("");
    await saveDialog(dialog);
    await expect(page.getByRole("link", { name: "clearme.example.com" })).toBeHidden();
    const saved = await getJson<Named>(request, `companies/${here.id}`);
    expect(saved.website).toBeNull();
    expect(saved.description).toBe("Kept words");
    await page.reload();
    await expect(heading(page, "Clear Site Co")).toBeVisible();
    await expect(page.getByRole("link", { name: "clearme.example.com" })).toBeHidden();
    await expect(page.getByLabel("About", { exact: true })).toHaveValue("Kept words");
    await menu(page, "Companies").click();
    await expect(companyRow(page, "Clear Site Co")).toBeVisible();
    await expect(companyRow(page, "Clear Site Co").getByRole("link")).toHaveCount(0);
  });

  // KNOWN BUG (fix-double-save-locked on the roadmap): expected to fail until it is fixed.
  test.fail("a double click on a slow save closes it, with no error", async ({ page, request }) => {
    const here = await company(request, "Save Once Co");
    await slow(page, `**${API}/companies/${here.id}`, "PATCH");
    await openCompany(page, here.id, "Save Once Co");
    const dialog = await editDialog(page, "Save Once Co");
    await dialog.getByLabel("Name").fill("Saved Once Co");
    await dialog.getByRole("button", { name: "Save", exact: true }).dblclick();
    await expect(dialog).toBeHidden();
    await expect(heading(page, "Saved Once Co")).toBeVisible();
  });

  test("if it's been deleted meanwhile, that's said and the dialog stays", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/404.*\/api\/v1\/companies/);
    const here = await company(request, "Gone Meanwhile Co");
    await openCompany(page, here.id, "Gone Meanwhile Co");
    const dialog = await editDialog(page, "Gone Meanwhile Co");
    await request.delete(`${API}/companies/${here.id}`);
    await dialog.getByLabel("Name").fill("Too Late Co");
    const refused = answered(page, "PATCH", /\/companies\//);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    expect((await refused).status()).toBe(404);
    await expect(notice(page, "That didn't work")).toBeVisible();
    await expect(dialog).toBeVisible();
    expect(await companies(request, "Too Late Co")).toHaveLength(0);
  });

  // KNOWN BUG (fix-rename-drops-unsaved-about on the roadmap): expected to fail until it is fixed.
  test.fail("words being typed in About survive a rename", async ({ page, request }) => {
    const here = await company(request, "Typing Co");
    await openCompany(page, here.id, "Typing Co");
    await page.getByLabel("About", { exact: true }).fill("Half a thought");
    await pause(1100); // timestamps are in whole seconds
    await rename(page, "Typing Co", "Still Typing Co");
    await expect(page.getByLabel("About", { exact: true })).toHaveValue("Half a thought");
  });

  // KNOWN BUG (fix-website-rules-differ on the roadmap): expected to fail until it is fixed.
  test.fail("New company and Edit agree on what a website is", async ({ page, request }) => {
    const website = "https://intranet";
    const other = await company(request, "Rules Other Co");
    await openCompanies(page);
    const add = await newCompany(page);
    await add.getByLabel("Name").fill("Rules New Co");
    await add.getByLabel("Website").fill(website);
    await add.getByRole("button", { name: "Add company" }).click();
    const added = heading(page, "Rules New Co");
    await expect(added.or(add.getByText("Links start with http:// or https://"))).toBeVisible();
    const newTakesIt = await added.isVisible();

    await openCompany(page, other.id, "Rules Other Co");
    const edit = await editDialog(page, "Rules Other Co");
    await edit.getByLabel("Name").fill("Rules Edited Co");
    await edit.getByLabel("Website").fill(website);
    await edit.getByRole("button", { name: "Save", exact: true }).click();
    const edited = heading(page, "Rules Edited Co");
    await expect(edited.or(edit.getByText("Like https://contoso.example.com"))).toBeVisible();
    expect(await edited.isVisible()).toBe(newTakesIt);
  });

  // KNOWN BUG (fix-duplicate-company-name on the roadmap): expected to fail until it is fixed.
  test.fail("to another company's name doesn't make two the same", async ({ page, request, problems }) => {
    problems.allow(/\/api\/v1\/companies/); // a fix may refuse it
    await company(request, "Taken Name Co");
    const here = await company(request, "Wants Name Co");
    await openCompany(page, here.id, "Wants Name Co");
    const dialog = await editDialog(page, "Wants Name Co");
    await dialog.getByLabel("Name").fill("Taken Name Co");
    const saved = answered(page, "PATCH", /\/companies\//);
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await saved;
    expect(await companies(request, "Taken Name Co")).toHaveLength(1);
  });
});

test.describe("deleting a company", () => {
  test("saying no keeps it", async ({ page, request }) => {
    const here = await company(request, "Kept Co");
    await openCompany(page, here.id, "Kept Co");
    const writes = watchWrites(page);
    const asked = await deleteAnswering(page, false);
    expect(asked).toBe("Delete Kept Co and its roles? Its people stay, without a company.");
    await expect(heading(page, "Kept Co")).toBeVisible();
    expect(writes).toEqual([]);
    expect(await companies(request, "Kept Co")).toHaveLength(1);
  });

  test("an empty one goes, back to Companies, and stays gone", async ({ page, request }) => {
    const here = await company(request, "Doomed Co");
    await openCompany(page, here.id, "Doomed Co");
    await deleteAnswering(page, true);
    await expect(heading(page, "Companies")).toBeVisible();
    await expect(page).toHaveURL(/\/companies$/);
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expect(companyRow(page, "Doomed Co")).toBeHidden();
    expect(await companies(request, "Doomed Co")).toHaveLength(0);
    await page.reload();
    await expect(page.getByRole("row").nth(1)).toBeVisible();
    await expect(companyRow(page, "Doomed Co")).toBeHidden();
  });

  test("its roles go with it, and its people stay without a company", async ({ page, request }) => {
    const here = await company(request, "Roles Only Co");
    const person = await contact(request, { name: "Left Behind Person", company_id: here.id });
    await role(request, { company_id: here.id, title: "Doomed Role" });
    await role(request, { company_id: here.id, title: "Doomed Role Two", contact_id: person.id });
    await openCompany(page, here.id, "Roles Only Co");
    await expect(page.getByRole("link", { name: "Doomed Role", exact: true })).toBeVisible();
    await deleteAnswering(page, true);
    await expect(heading(page, "Companies")).toBeVisible();
    expect(await companies(request, "Roles Only Co")).toHaveLength(0);
    expect(await rolesCalled(request, "Doomed Role")).toHaveLength(0);
    expect(await rolesCalled(request, "Doomed Role Two")).toHaveLength(0);
    expect((await getJson<Person>(request, `contacts/${person.id}`)).company_id).toBeNull();
    await menu(page, "Roles").click();
    await expect(heading(page, "Roles")).toBeVisible();
    await expect(page.getByRole("link", { name: "Doomed Role", exact: true })).toBeHidden();
    await page.goto(`/people/${person.id}`);
    await expect(heading(page, "Left Behind Person")).toBeVisible();
    await expect(page.getByRole("link", { name: "Roles Only Co" })).toBeHidden();
  });

  test("one with an application can't go: it says so and asks nothing of the server", async ({
    page,
    request,
  }) => {
    const made = await apply(request, { company_name: "One App Co", role_title: "Blocking Role" });
    const [here] = await companies(request, made.company_name);
    await openCompany(page, here?.id ?? "", "One App Co");
    const writes = watchWrites(page);
    expect(await deleteAnswering(page, true)).toBe(
      "One App Co still has an application. Delete it first, or archive it instead.",
    );
    await expect(heading(page, "One App Co")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("several applications are counted", async ({ page, request }) => {
    await apply(request, { company_name: "Two Apps Co", role_title: "First Blocking" });
    await apply(request, { company_name: "Two Apps Co", role_title: "Second Blocking" });
    const [here] = await companies(request, "Two Apps Co");
    await openCompany(page, here?.id ?? "", "Two Apps Co");
    expect(await deleteAnswering(page, true)).toBe(
      "Two Apps Co still has 2 applications. Delete them first, or archive them instead.",
    );
  });

  test("an archived application still counts", async ({ page, request }) => {
    const made = await apply(request, { company_name: "Archived App Co", role_title: "Archived Role" });
    await request.patch(`${API}/applications/${made.id}`, { data: { archived: true } });
    const [here] = await companies(request, "Archived App Co");
    await openCompany(page, here?.id ?? "", "Archived App Co");
    const writes = watchWrites(page);
    expect(await deleteAnswering(page, true)).toContain("still has an application");
    expect(writes).toEqual([]);
    expect(await companies(request, "Archived App Co")).toHaveLength(1);
  });

  test("once its last application is deleted, it can go", async ({ page, request }) => {
    const made = await apply(request, { company_name: "Freed Co", role_title: "Freed Role" });
    const [here] = await companies(request, "Freed Co");
    await request.delete(`${API}/applications/${made.id}`);
    await openCompany(page, here?.id ?? "", "Freed Co");
    await deleteAnswering(page, true);
    await expect(heading(page, "Companies")).toBeVisible();
    expect(await companies(request, "Freed Co")).toHaveLength(0);
  });

  test("an application added since the page opened: the server refuses, and says why", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/409.*\/api\/v1\/companies/);
    const here = await company(request, "Stale Page Co");
    await openCompany(page, here.id, "Stale Page Co");
    await expect(page.getByText("No applications here yet.")).toBeVisible();
    await apply(request, { company_name: "Stale Page Co", role_title: "Stale Role" });
    const refused = answered(page, "DELETE", /\/companies\//);
    await deleteAnswering(page, true);
    expect((await refused).status()).toBe(409);
    await expect(notice(page, "Couldn't delete it")).toBeVisible();
    await expect(notice(page, /Stale Page Co has an application\. Delete it first/)).toBeVisible();
    await expect(heading(page, "Stale Page Co")).toBeVisible();
    expect(await companies(request, "Stale Page Co")).toHaveLength(1);
  });

  test("deleted already: it says so", async ({ page, request, problems }) => {
    problems.allow(/404.*\/api\/v1\/companies/);
    const here = await company(request, "Twice Gone Co");
    await openCompany(page, here.id, "Twice Gone Co");
    await request.delete(`${API}/companies/${here.id}`);
    const refused = answered(page, "DELETE", /\/companies\//);
    await deleteAnswering(page, true);
    expect((await refused).status()).toBe(404);
    await expect(notice(page, "Couldn't delete it")).toBeVisible();
  });

  test("it's no longer offered in the role dialog", async ({ page, request }) => {
    const here = await company(request, "Unoffered Co");
    await page.goto("/roles");
    await expect(heading(page, "Roles")).toBeVisible();
    let dialog = await addRoleDialog(page);
    await dialog.getByLabel("Company").first().fill("Unoffered Co");
    await expect(page.getByRole("option", { name: "Unoffered Co", exact: true })).toBeVisible();
    await openCompany(page, here.id, "Unoffered Co");
    await deleteAnswering(page, true);
    await expect(heading(page, "Companies")).toBeVisible();
    await menu(page, "Roles").click();
    await expect(heading(page, "Roles")).toBeVisible();
    dialog = await addRoleDialog(page);
    await dialog.getByLabel("Company").first().fill("Unoffered Co");
    await expect(page.getByRole("option", { name: '+ Add "Unoffered Co"' })).toBeVisible();
    await expect(page.getByRole("option", { name: "Unoffered Co", exact: true })).toBeHidden();
  });
});

test.describe("the company pages", () => {
  test("search narrows the list, and says when nothing matches", async ({ page, request }) => {
    await company(request, "Findable Zebra Co");
    await company(request, "Other Yak Co");
    await openCompanies(page);
    const search = page.getByRole("textbox", { name: "Search companies" });
    await search.fill("  findable zebra ");
    await expect(companyRow(page, "Findable Zebra Co")).toBeVisible();
    await expect(companyRow(page, "Other Yak Co")).toBeHidden();
    await search.fill("nothing is called this");
    await expect(page.getByText("No companies match.")).toBeVisible();
    await search.fill("");
    await expect(companyRow(page, "Other Yak Co")).toBeVisible();
  });

  test("a row opens by click and by Enter; its link goes to the website instead", async ({
    page,
    request,
  }) => {
    await company(request, "Row Open Co", "https://rowopen.example.com");
    await openCompanies(page);
    await companyRow(page, "Row Open Co").click();
    await expect(heading(page, "Row Open Co")).toBeVisible();
    await page.getByRole("link", { name: "All companies" }).click();
    await companyRow(page, "Row Open Co").focus();
    await page.keyboard.press("Enter");
    await expect(heading(page, "Row Open Co")).toBeVisible();
    await page.getByRole("link", { name: "All companies" }).click();
    const link = companyRow(page, "Row Open Co").getByRole("link", { name: "rowopen.example.com" });
    await expect(link).toHaveAttribute("href", /^https:\/\/rowopen\.example\.com/);
    await expect(link).toHaveAttribute("target", "_blank");
  });

  test("the list counts applications, and those in progress", async ({ page, request }) => {
    const active = await apply(request, { company_name: "Counted Co", role_title: "Counted One" });
    await apply(request, { company_name: "Counted Co", role_title: "Counted Two" });
    await request.post(`${API}/applications/${active.id}/move`, { data: { to_stage: "rejected" } });
    await openCompanies(page);
    const cells = companyRow(page, "Counted Co").getByRole("cell");
    await expect(cells.nth(1)).toHaveText("2");
    await expect(cells.nth(2)).toHaveText("1");
  });

  test("its page lists its applications, and one opens", async ({ page, request }) => {
    await apply(request, { company_name: "Listing Co", role_title: "Listed Role" });
    const [here] = await companies(request, "Listing Co");
    await openCompany(page, here?.id ?? "", "Listing Co");
    await page.getByRole("row").filter({ hasText: "Listed Role" }).click();
    await expect(page.getByRole("dialog").getByText("Listed Role").first()).toBeVisible();
  });

  test("About saves, survives a reload, and can be emptied", async ({ page, request }) => {
    const here = await company(request, "About Co");
    await openCompany(page, here.id, "About Co");
    const card = page
      .locator(".mantine-Card-root")
      .filter({ has: page.getByLabel("About", { exact: true }) });
    const save = card.getByRole("button", { name: "Save", exact: true });
    await expect(save).toBeDisabled();
    await page.getByLabel("About", { exact: true }).fill("Makes fictional widgets");
    await save.click();
    await expect(save).toBeDisabled();
    await page.reload();
    await expect(page.getByLabel("About", { exact: true })).toHaveValue("Makes fictional widgets");
    await page.getByLabel("About", { exact: true }).fill("");
    await save.click();
    await expect(save).toBeDisabled();
    expect((await getJson<Named>(request, `companies/${here.id}`)).description).toBeNull();
  });

  test("a company that doesn't exist says so", async ({ page, problems }) => {
    problems.allow(/404.*\/api\/v1\/companies\/no-such-company/);
    await page.goto("/companies/no-such-company");
    await expect(page.getByText("Couldn't load this company.")).toBeVisible({ timeout: 20_000 });
  });

  test("an agency that doesn't exist says so", async ({ page, problems }) => {
    problems.allow(/404.*\/api\/v1\/agencies\/no-such-agency/);
    await page.goto("/agencies/no-such-agency");
    await expect(page.getByText("Couldn't load this agency.")).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("renaming an agency", () => {
  test("shows on a recruiter's tile and everywhere else, without a reload", async ({ page, request }) => {
    const here = await agency(request, "Before Agency");
    const person = await contact(request, { name: "Tile Recruiter", agency_id: here.id });
    await apply(request, {
      company_name: "Agency Rename Client",
      role_title: "Through Agency Role",
      route: "agency",
      agency_id: here.id,
      recruiter_id: person.id,
    });
    await openRecruiters(page);
    await expect(page.getByRole("link", { name: "Before Agency", exact: true })).toBeVisible();
    await menu(page, "Applications").click();
    await expect(applicationRow(page, "Through Agency Role")).toContainText("Before Agency");
    await menu(page, "Recruiters").click();
    await page.getByRole("link", { name: "Before Agency", exact: true }).click();
    await expect(heading(page, "Before Agency")).toBeVisible();

    await rename(page, "Before Agency", "After Agency");
    await expect(page.getByText("Roles through After Agency")).toBeVisible();

    await menu(page, "Recruiters").click();
    await expect(page.getByRole("link", { name: "After Agency", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Before Agency", exact: true })).toBeHidden();
    await expect(page.getByRole("link", { name: /^After Agency: 1 person/ })).toBeVisible();
    await page.getByRole("textbox", { name: "Search recruiters" }).fill("after agency");
    await expect(page.getByRole("link", { name: "Tile Recruiter" })).toBeVisible();
    await menu(page, "Applications").click();
    await expect(applicationRow(page, "Through Agency Role")).toContainText("After Agency");

    await page.goto(`/people/${person.id}`);
    await expect(page.getByRole("link", { name: "After Agency", exact: true })).toBeVisible();
    await page.goto("/recruiters");
    await expect(page.getByRole("link", { name: "After Agency", exact: true })).toBeVisible();
  });

  test("shows on a role that came through them", async ({ page, request }) => {
    const here = await agency(request, "Role Agency Before");
    const person = await contact(request, { name: "Role Agency Recruiter", agency_id: here.id });
    const client = await company(request, "Role Agency Client");
    const made = await role(request, {
      company_id: client.id,
      title: "Agency Sent Role",
      contact_id: person.id,
    });
    await openAgency(page, here.id, "Role Agency Before");
    await rename(page, "Role Agency Before", "Role Agency After");
    await page.goto(`/roles/${made.id}`);
    await expect(page.getByRole("link", { name: "Role Agency After", exact: true })).toBeVisible();
  });

  test("asks for a name, and a real website", async ({ page, request }) => {
    const here = await agency(request, "Checked Agency");
    await openAgency(page, here.id, "Checked Agency");
    const writes = watchWrites(page);
    const dialog = await editDialog(page, "Checked Agency");
    await dialog.getByLabel("Name").fill("");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog.getByText("It needs a name")).toBeVisible();
    await dialog.getByLabel("Name").fill("Checked Agency");
    await dialog.getByLabel("Website").fill("agency.example.com");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(dialog.getByText("Like https://contoso.example.com")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("Cancel changes nothing", async ({ page, request }) => {
    const here = await agency(request, "Steady Agency", "https://steadyagency.example.com");
    await openAgency(page, here.id, "Steady Agency");
    const writes = watchWrites(page);
    const dialog = await editDialog(page, "Steady Agency");
    await dialog.getByLabel("Name").fill("Changed Mind Agency");
    await dialog.getByLabel("Website").fill("");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(heading(page, "Steady Agency")).toBeVisible();
    await expect(page.getByRole("link", { name: "steadyagency.example.com" })).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("clearing the website removes it, for good", async ({ page, request }) => {
    const here = await agency(request, "Clear Site Agency", "https://clearagency.example.com");
    await openAgency(page, here.id, "Clear Site Agency");
    await expect(page.getByRole("link", { name: "clearagency.example.com" })).toBeVisible();
    const dialog = await editDialog(page, "Clear Site Agency");
    await dialog.getByLabel("Website").fill("   ");
    await saveDialog(dialog);
    await expect(page.getByRole("link", { name: "clearagency.example.com" })).toBeHidden();
    expect((await getJson<Named>(request, `agencies/${here.id}`)).website).toBeNull();
    await page.reload();
    await expect(heading(page, "Clear Site Agency")).toBeVisible();
    await expect(page.getByRole("link", { name: "clearagency.example.com" })).toBeHidden();
  });

  // KNOWN BUG (fix-double-save-locked on the roadmap): expected to fail until it is fixed.
  test.fail("a double click on a slow save closes it, with no error", async ({ page, request }) => {
    const here = await agency(request, "Save Once Agency");
    await slow(page, `**${API}/agencies/${here.id}`, "PATCH");
    await openAgency(page, here.id, "Save Once Agency");
    const dialog = await editDialog(page, "Save Once Agency");
    await dialog.getByLabel("Name").fill("Saved Once Agency");
    await dialog.getByRole("button", { name: "Save", exact: true }).dblclick();
    await expect(dialog).toBeHidden();
    await expect(heading(page, "Saved Once Agency")).toBeVisible();
  });
});

test.describe("deleting an agency", () => {
  test("saying no keeps it", async ({ page, request }) => {
    const here = await agency(request, "Kept Agency");
    await openAgency(page, here.id, "Kept Agency");
    const writes = watchWrites(page);
    expect(await deleteAnswering(page, false)).toBe(
      "Delete Kept Agency? Its recruiters and the roles it sent stay, without an agency.",
    );
    await expect(heading(page, "Kept Agency")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("its recruiters stay, independent, and it's gone from Recruiters", async ({ page, request }) => {
    const here = await agency(request, "Doomed Agency");
    const person = await contact(request, { name: "Agencyless Recruiter", agency_id: here.id });
    await openAgency(page, here.id, "Doomed Agency");
    await expect(page.getByRole("link", { name: "Agencyless Recruiter" })).toBeVisible();
    await deleteAnswering(page, true);
    await expect(heading(page, "Recruiters")).toBeVisible();
    await expect(page).toHaveURL(/\/recruiters$/);
    await expect(page.getByRole("link", { name: "Agencyless Recruiter" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Doomed Agency", exact: true })).toBeHidden();
    await expect(page.getByRole("link", { name: /^Doomed Agency:/ })).toBeHidden();
    const saved = await getJson<Person>(request, `contacts/${person.id}`);
    expect(saved).toMatchObject({ name: "Agencyless Recruiter", agency_id: null, company_id: null });
    expect(await agencies(request, "Doomed Agency")).toHaveLength(0);
    await view(page, "Independent");
    await expect(page.getByRole("link", { name: "Agencyless Recruiter" })).toBeVisible();
    await page.goto(`/people/${person.id}`);
    await expect(heading(page, "Agencyless Recruiter")).toBeVisible();
    await expect(page.getByRole("link", { name: "Doomed Agency" })).toBeHidden();
  });

  test("someone who also has a company now shows at the company", async ({ page, request }) => {
    const here = await agency(request, "Doomed Both Agency");
    const co = await company(request, "Remaining Co");
    const person = await contact(request, {
      name: "Both Recruiter",
      agency_id: here.id,
      company_id: co.id,
    });
    await openAgency(page, here.id, "Doomed Both Agency");
    await deleteAnswering(page, true);
    await expect(page.getByRole("link", { name: "Remaining Co", exact: true })).toBeVisible();
    expect(await getJson<Person>(request, `contacts/${person.id}`)).toMatchObject({
      agency_id: null,
      company_id: co.id,
    });
  });

  test("an application with a recruiter stays through them, and can still be saved", async ({
    page,
    request,
  }) => {
    const here = await agency(request, "Doomed App Agency");
    const person = await contact(request, { name: "Stays On Recruiter", agency_id: here.id });
    const made = await apply(request, {
      company_name: "Agency App Client",
      role_title: "Recruiter Kept Role",
      route: "agency",
      agency_id: here.id,
      recruiter_id: person.id,
    });
    await openAgency(page, here.id, "Doomed App Agency");
    await expect(page.getByRole("row").filter({ hasText: "Recruiter Kept Role" })).toBeVisible();
    await deleteAnswering(page, true);
    await expect(heading(page, "Recruiters")).toBeVisible();
    expect(await getJson<Application>(request, `applications/${made.id}`)).toMatchObject({
      route: "agency",
      agency_id: null,
      recruiter_id: person.id,
    });
    await menu(page, "Applications").click();
    const row = applicationRow(page, "Recruiter Kept Role");
    await expect(row).toContainText("Stays On Recruiter");
    await expect(row).not.toContainText("Doomed App Agency");
    await page.goto(`/applications/${made.id}`);
    await page.getByLabel("Tags", { exact: true }).first().fill("kept");
    await page.keyboard.press("Enter");
    const saved = answered(page, "PATCH", /\/applications\//);
    await page.getByRole("button", { name: "Save details" }).click();
    expect((await saved).status()).toBe(200);
  });

  test("an application with only the agency stays, labelled as through an agency", async ({
    page,
    request,
  }) => {
    const here = await agency(request, "Doomed Only Agency");
    const made = await apply(request, {
      company_name: "Only Agency Client",
      role_title: "Agency Only Role",
      route: "agency",
      agency_id: here.id,
    });
    await openAgency(page, here.id, "Doomed Only Agency");
    await deleteAnswering(page, true);
    await expect(heading(page, "Recruiters")).toBeVisible();
    expect(await getJson<Application>(request, `applications/${made.id}`)).toMatchObject({
      route: "agency",
      agency_id: null,
      recruiter_id: null,
    });
    await menu(page, "Applications").click();
    const row = applicationRow(page, "Agency Only Role");
    await expect(row).toContainText("Agency");
    await expect(row).not.toContainText("Doomed Only Agency");
    await page.goto(`/applications/${made.id}`);
    await expect(page.getByText("Agency Only Role").first()).toBeVisible();
  });

  // KNOWN BUG (fix-agency-delete-blocks-application-save on the roadmap): expected to fail until it is fixed.
  test.fail(
    "an application with only the agency can still be saved afterwards",
    async ({ page, request, problems }) => {
      problems.allow(/422.*\/api\/v1\/applications/);
      const here = await agency(request, "Doomed Save Agency");
      const made = await apply(request, {
        company_name: "Save After Client",
        role_title: "Save After Role",
        route: "agency",
        agency_id: here.id,
      });
      await openAgency(page, here.id, "Doomed Save Agency");
      await deleteAnswering(page, true);
      await expect(heading(page, "Recruiters")).toBeVisible();
      await page.goto(`/applications/${made.id}`);
      await page.getByLabel("Tags", { exact: true }).first().fill("still-mine");
      await page.keyboard.press("Enter");
      const saved = answered(page, "PATCH", /\/applications\//);
      await page.getByRole("button", { name: "Save details" }).click();
      expect((await saved).status()).toBe(200);
    },
  );

  test("it's no longer offered in the person dialog", async ({ page, request }) => {
    const here = await agency(request, "Unoffered Agency");
    await openAgency(page, here.id, "Unoffered Agency");
    await deleteAnswering(page, true);
    await expect(heading(page, "Recruiters")).toBeVisible();
    const dialog = await newPerson(page);
    await dialog.getByLabel("Agency").first().fill("Unoffered Agency");
    await expect(page.getByRole("option", { name: '+ Add "Unoffered Agency"' })).toBeVisible();
    await expect(page.getByRole("option", { name: "Unoffered Agency", exact: true })).toBeHidden();
  });

  test("deleted already: it says so", async ({ page, request, problems }) => {
    problems.allow(/404.*\/api\/v1\/agencies/);
    const here = await agency(request, "Twice Gone Agency");
    await openAgency(page, here.id, "Twice Gone Agency");
    await request.delete(`${API}/agencies/${here.id}`);
    const refused = answered(page, "DELETE", /\/agencies\//);
    await deleteAnswering(page, true);
    expect((await refused).status()).toBe(404);
    await expect(notice(page, "Couldn't delete it")).toBeVisible();
  });
});
