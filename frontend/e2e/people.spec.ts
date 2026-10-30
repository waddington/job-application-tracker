import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Agencies and people: creating and editing each, in every order and from inside each other's
// dialogs, checking what's saved, that nothing is made twice, and that it shows on other pages.
// Each test uses its own names.

interface Detail {
  kind: string;
  value: string;
  label: string | null;
}
interface Person {
  id: string;
  name: string;
  title: string | null;
  agency_id: string | null;
  company_id: string | null;
  favourite: boolean;
  closed_as: string | null;
  details: Detail[];
}
interface Named {
  id: string;
  name: string;
  website?: string | null;
}

const list = async <T>(request: APIRequestContext, path: string) =>
  (await (await request.get(`/api/v1/${path}`)).json()) as T[];
const people = (request: APIRequestContext, name: string) =>
  list<Person>(request, "contacts").then((all) => all.filter((p) => p.name === name));
const person = async (request: APIRequestContext, name: string) => (await people(request, name))[0] as Person;
const agencies = (request: APIRequestContext, name: string) =>
  list<Named>(request, "agencies").then((all) => all.filter((a) => a.name === name));
const companies = (request: APIRequestContext, name: string) =>
  list<Named>(request, "companies").then((all) => all.filter((c) => c.name === name));
const create = async (request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`/api/v1/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as Named;
};

const openPage = async (page: Page) => {
  await page.goto("/recruiters");
  await expect(page.getByRole("heading", { name: "Recruiters", level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Alex Morgan" }).first()).toBeVisible();
};
const menu = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true });

const newPerson = async (page: Page) => {
  await page.getByRole("button", { name: "New person" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("New person", { exact: true })).toBeVisible();
  return dialog;
};
const addPerson = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Add person", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const pick = async (page: Page, dialog: Locator, field: "Agency" | "Company", name: string) => {
  await dialog.getByLabel(field).first().click();
  await page.getByRole("option", { name, exact: true }).click();
};
const addInside = async (page: Page, dialog: Locator, field: "Agency" | "Company", name: string) => {
  await dialog.getByLabel(field).first().fill(name);
  await page.getByRole("option", { name: `+ Add "${name}"` }).click();
  await expect(dialog.getByLabel(field).first()).toHaveValue(name);
};
const editFromPage = async (page: Page, id: string, name: string) => {
  await page.goto(`/people/${id}`);
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Edit ${name}`)).toBeVisible();
  return dialog;
};
const save = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const view = (page: Page, name: string | RegExp) =>
  page.locator(".mantine-SegmentedControl-root").getByText(name).click();

test.describe("creating an agency", () => {
  test("asks for a name, and a website that is one", async ({ page, request }) => {
    await openPage(page);
    await page.getByRole("button", { name: "New agency" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Add agency" }).click();
    await expect(dialog.getByText("Name the agency")).toBeVisible();
    await dialog.getByLabel("Name").fill("Bad Site Agency");
    await dialog.getByLabel("Website").fill("not a site");
    await dialog.getByRole("button", { name: "Add agency" }).click();
    await expect(dialog.getByText("Links start with http:// or https://")).toBeVisible();
    expect(await agencies(request, "Bad Site Agency")).toHaveLength(0);
  });

  test("from Recruiters, with no one in it yet", async ({ page, request }) => {
    await openPage(page);
    await page.getByRole("button", { name: "New agency" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("  Empty Agency ");
    await dialog.getByLabel("Website").fill("https://empty.example.com");
    await dialog.getByRole("button", { name: "Add agency" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: "Empty Agency" }).first()).toBeVisible();
    const made = await agencies(request, "Empty Agency");
    expect(made).toHaveLength(1);
    expect(made[0]?.website).toContain("https://empty.example.com");
    await page.goto(`/agencies/${made[0]?.id}`);
    await expect(page.getByRole("heading", { name: "Empty Agency", level: 2 })).toBeVisible();
  });

  test("closing it adds nothing", async ({ page, request }) => {
    await openPage(page);
    await page.getByRole("button", { name: "New agency" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Cancelled Agency");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(await agencies(request, "Cancelled Agency")).toHaveLength(0);
  });

  // KNOWN BUG (fix-duplicate-agency-name on the roadmap): expected to fail until it is fixed.
  test.fail("the same name twice doesn't make a second agency", async ({ page, request }) => {
    await create(request, "agencies", { name: "Twin Agency" });
    await openPage(page);
    await page.getByRole("button", { name: "New agency" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Twin Agency");
    await dialog.getByRole("button", { name: "Add agency" }).click();
    await expect(dialog).toBeHidden();
    expect(await agencies(request, "Twin Agency")).toHaveLength(1);
  });
});

test.describe("creating a person", () => {
  test("asks who it is", async ({ page }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(dialog.getByText("Who is it?")).toBeVisible();
  });

  test("with just a name: independent", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill(" Nobody Attached ");
    await addPerson(dialog);
    expect(await people(request, "Nobody Attached")).toHaveLength(1);
    expect(await person(request, "Nobody Attached")).toMatchObject({
      agency_id: null,
      company_id: null,
      title: null,
    });
    await view(page, "Independent");
    await expect(page.getByRole("link", { name: "Nobody Attached" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Alex Morgan" })).toBeHidden();
    await view(page, "Agencies");
    await expect(page.getByRole("link", { name: "Nobody Attached" })).toBeHidden();
  });

  test("at an existing agency", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Existing Agency" });
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Agency Person");
    await dialog.getByLabel("Job title").fill("Senior Consultant");
    await pick(page, dialog, "Agency", "Existing Agency");
    await addPerson(dialog);
    expect(await person(request, "Agency Person")).toMatchObject({
      agency_id: agency.id,
      company_id: null,
      title: "Senior Consultant",
    });
    await page.goto(`/agencies/${agency.id}`);
    await expect(page.getByRole("link", { name: "Agency Person" })).toBeVisible();
    expect(await agencies(request, "Existing Agency")).toHaveLength(1);
  });

  test("with a new agency made inside the dialog, which then exists by itself", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Inside Person");
    await addInside(page, dialog, "Agency", "Inside Agency");
    await addPerson(dialog);
    const [agency] = await agencies(request, "Inside Agency");
    expect(await person(request, "Inside Person")).toMatchObject({ agency_id: agency?.id });
    await expect(page.getByRole("link", { name: "Inside Agency" }).first()).toBeVisible();
    await page.goto(`/agencies/${agency?.id}`);
    await expect(page.getByRole("heading", { name: "Inside Agency", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Inside Person" })).toBeVisible();
  });

  test("an agency made inside the dialog can be picked in the next one", async ({ page, request }) => {
    await openPage(page);
    let dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Reuse First");
    await addInside(page, dialog, "Agency", "Reuse Inside Agency");
    await addPerson(dialog);
    dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Reuse Second");
    await pick(page, dialog, "Agency", "Reuse Inside Agency");
    await addPerson(dialog);
    expect(await agencies(request, "Reuse Inside Agency")).toHaveLength(1);
    const [first, second] = [await person(request, "Reuse First"), await person(request, "Reuse Second")];
    expect(second.agency_id).toBe(first.agency_id);
  });

  test("an agency made inside the dialog stays, even if you then cancel the person", async ({
    page,
    request,
  }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Never Saved");
    await addInside(page, dialog, "Agency", "Left Behind Agency");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(await people(request, "Never Saved")).toHaveLength(0);
    expect(await agencies(request, "Left Behind Agency")).toHaveLength(1);
  });

  test("at an existing company", async ({ page, request }) => {
    const company = await create(request, "companies", { name: "People Co" });
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Company Person");
    await pick(page, dialog, "Company", "People Co");
    await addPerson(dialog);
    expect(await person(request, "Company Person")).toMatchObject({
      company_id: company.id,
      agency_id: null,
    });
    await view(page, "Companies");
    await expect(page.getByRole("link", { name: "Company Person" })).toBeVisible();
    await page.goto(`/companies/${company.id}`);
    await expect(page.getByRole("link", { name: "Company Person" })).toBeVisible();
  });

  test("with a new company made inside the dialog", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Inside Company Person");
    await addInside(page, dialog, "Company", "Inside Co");
    await addPerson(dialog);
    const [company] = await companies(request, "Inside Co");
    expect(await person(request, "Inside Company Person")).toMatchObject({ company_id: company?.id });
    await menu(page, "Companies").click();
    await expect(page.getByLabel("Open Inside Co")).toBeVisible();
  });

  test("with both an agency and a company", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Both Person");
    await addInside(page, dialog, "Agency", "Both Agency");
    await addInside(page, dialog, "Company", "Both Co");
    await addPerson(dialog);
    const saved = await person(request, "Both Person");
    expect(saved.agency_id).toBe((await agencies(request, "Both Agency"))[0]?.id);
    expect(saved.company_id).toBe((await companies(request, "Both Co"))[0]?.id);
  });

  test("with every kind of detail", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Detail Person");
    const values = dialog.getByLabel("Value");
    await values.nth(0).fill("detail@example.com");
    await dialog.getByLabel("Label", { exact: true }).nth(0).fill("work");
    await dialog.getByRole("button", { name: "Add a detail" }).click();
    await values.nth(1).fill("+44 7700 900123");
    await dialog.getByRole("button", { name: "Add a detail" }).click();
    await dialog.getByLabel("Kind").nth(2).click();
    await page.getByRole("option", { name: "LinkedIn", exact: true }).click();
    await values.nth(2).fill("https://www.linkedin.com/in/detail-person");
    await addPerson(dialog);
    const saved = await person(request, "Detail Person");
    expect(saved.details.map((d) => [d.kind, d.value, d.label])).toEqual([
      ["email", "detail@example.com", "work"],
      ["phone", "+44 7700 900123", null],
      ["linkedin", "https://www.linkedin.com/in/detail-person", null],
    ]);
    await page.goto(`/people/${saved.id}`);
    await expect(page.getByRole("link", { name: "detail@example.com" })).toHaveAttribute(
      "href",
      "mailto:detail@example.com",
    );
    await expect(page.getByText("+44 7700 900123")).toBeVisible();
  });

  test("checks an email and a link, and drops empty rows", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Checked Person");
    const values = dialog.getByLabel("Value");
    await values.nth(0).fill("not an email");
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(dialog.getByText("That doesn't look like an email")).toBeVisible();
    await values.nth(0).fill("checked@example.com");
    await dialog.getByRole("button", { name: "Add a detail" }).click();
    await dialog.getByLabel("Kind").nth(1).click();
    await page.getByRole("option", { name: "Link", exact: true }).click();
    await values.nth(1).fill("not a link");
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(dialog.getByText("Links start with https://")).toBeVisible();
    await values.nth(1).clear();
    await dialog.getByRole("button", { name: "Add a detail" }).click();
    await addPerson(dialog);
    expect((await person(request, "Checked Person")).details).toHaveLength(1);
  });

  test("an email someone else has is refused, saying so, and keeps the form", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/\/api\/v1\/contacts/);
    await create(request, "contacts", {
      name: "Email Owner",
      details: [{ kind: "email", value: "taken@example.com" }],
    });
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Email Copier");
    await dialog.getByLabel("Value").first().fill("taken@example.com");
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(page.getByText("That didn't work")).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveValue("Email Copier");
    expect(await people(request, "Email Copier")).toHaveLength(0);
  });

  test("the same name twice is allowed: they may be two people", async ({ page, request }) => {
    await create(request, "contacts", { name: "Common Name" });
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Common Name");
    await addPerson(dialog);
    expect(await people(request, "Common Name")).toHaveLength(2);
  });

  test("Cancel adds nothing", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Cancelled Person");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(await people(request, "Cancelled Person")).toHaveLength(0);
  });

  test("started from an agency's page, they're at that agency", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Start Agency" });
    await page.goto(`/agencies/${agency.id}`);
    await page.getByRole("button", { name: "Add recruiter" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Agency").first()).toHaveValue("Start Agency");
    await dialog.getByLabel("Name").fill("Started Here");
    await addPerson(dialog);
    await expect(page.getByRole("link", { name: "Started Here" })).toBeVisible();
    expect((await person(request, "Started Here")).agency_id).toBe(agency.id);
  });

  test("started from a company's page, they're at that company", async ({ page, request }) => {
    const company = await create(request, "companies", { name: "Start Company" });
    await page.goto(`/companies/${company.id}`);
    await page.getByRole("button", { name: "Add person" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Company").first()).toHaveValue("Start Company");
    await dialog.getByLabel("Name").fill("Started At Company");
    await addPerson(dialog);
    expect((await person(request, "Started At Company")).company_id).toBe(company.id);
  });
});

test.describe("editing a person", () => {
  test("the form shows what's saved", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Shown Agency" });
    const made = await create(request, "contacts", {
      name: "Shown Person",
      title: "Consultant",
      agency_id: agency.id,
      details: [{ kind: "email", value: "shown@example.com", label: "work" }],
    });
    const dialog = await editFromPage(page, made.id, "Shown Person");
    await expect(dialog.getByLabel("Name")).toHaveValue("Shown Person");
    await expect(dialog.getByLabel("Job title")).toHaveValue("Consultant");
    await expect(dialog.getByLabel("Agency").first()).toHaveValue("Shown Agency");
    await expect(dialog.getByLabel("Value").first()).toHaveValue("shown@example.com");
    await expect(dialog.getByLabel("Label", { exact: true }).first()).toHaveValue("work");
  });

  test("recruiter first, then giving them an existing agency", async ({ page, request }) => {
    const made = await create(request, "contacts", { name: "Later Agency Person" });
    const agency = await create(request, "agencies", { name: "Later Agency" });
    const dialog = await editFromPage(page, made.id, "Later Agency Person");
    await pick(page, dialog, "Agency", "Later Agency");
    await save(dialog);
    expect((await person(request, "Later Agency Person")).agency_id).toBe(agency.id);
    await expect(page.getByRole("link", { name: "Later Agency" }).first()).toBeVisible();
    await page.goto(`/agencies/${agency.id}`);
    await expect(page.getByRole("link", { name: "Later Agency Person" })).toBeVisible();
  });

  test("recruiter first, then making their agency inside the dialog", async ({ page, request }) => {
    const made = await create(request, "contacts", { name: "Later Inside Person" });
    const dialog = await editFromPage(page, made.id, "Later Inside Person");
    await addInside(page, dialog, "Agency", "Later Inside Agency");
    await save(dialog);
    const [agency] = await agencies(request, "Later Inside Agency");
    expect((await person(request, "Later Inside Person")).agency_id).toBe(agency?.id);
  });

  test("moving to another agency moves them on both agencies' pages", async ({ page, request }) => {
    const from = await create(request, "agencies", { name: "Move From Agency" });
    const to = await create(request, "agencies", { name: "Move To Agency" });
    const made = await create(request, "contacts", { name: "Moving Person", agency_id: from.id });
    const dialog = await editFromPage(page, made.id, "Moving Person");
    await pick(page, dialog, "Agency", "Move To Agency");
    await save(dialog);
    await page.goto(`/agencies/${to.id}`);
    await expect(page.getByRole("link", { name: "Moving Person" })).toBeVisible();
    await page.goto(`/agencies/${from.id}`);
    await expect(page.getByRole("heading", { name: "Move From Agency", level: 2 })).toBeVisible();
    await expect(page.getByRole("link", { name: "Moving Person" })).toBeHidden();
  });

  test("taking the agency off leaves them independent, and the agency there", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Off Agency" });
    const made = await create(request, "contacts", { name: "Off Person", agency_id: agency.id });
    const dialog = await editFromPage(page, made.id, "Off Person");
    await pick(page, dialog, "Agency", "Off Agency"); // choosing it again takes it off
    await save(dialog);
    expect((await person(request, "Off Person")).agency_id).toBeNull();
    expect(await agencies(request, "Off Agency")).toHaveLength(1);
  });

  test("from an agency to a company", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Switch Agency" });
    const company = await create(request, "companies", { name: "Switch Co" });
    const made = await create(request, "contacts", { name: "Switch Person", agency_id: agency.id });
    const dialog = await editFromPage(page, made.id, "Switch Person");
    await pick(page, dialog, "Agency", "Switch Agency");
    await pick(page, dialog, "Company", "Switch Co");
    await save(dialog);
    expect(await person(request, "Switch Person")).toMatchObject({ agency_id: null, company_id: company.id });
  });

  test("renaming shows everywhere they appear", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Rename Agency" });
    const made = await create(request, "contacts", { name: "Old Name", agency_id: agency.id });
    const co = await create(request, "companies", { name: "Rename Co" });
    await create(request, "roles", { company_id: co.id, title: "Rename Role", contact_id: made.id });
    const app = await create(request, "applications/quick", {
      company_name: "Rename App Co",
      role_title: "Rename App",
      route: "agency",
      agency_id: agency.id,
      recruiter_id: made.id,
      tags: [],
    });
    const dialog = await editFromPage(page, made.id, "Old Name");
    await dialog.getByLabel("Name").fill("New Name");
    await save(dialog);
    await expect(page.getByRole("heading", { name: "New Name", level: 2 })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Old Name" })).toBeHidden();
    await page.goto(`/applications/${app.id}`);
    await expect(page.getByText("Route:").locator("..")).toHaveText(
      "Route: Through New Name at Rename Agency",
    );
    await page.goto("/roles");
    await expect(page.getByText(/from New Name/).first()).toBeVisible();
    await page.goto("/recruiters");
    await expect(page.getByRole("link", { name: "New Name" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Old Name" })).toBeHidden();
  });

  test("changing and removing details", async ({ page, request }) => {
    const made = await create(request, "contacts", {
      name: "Details Edit",
      details: [
        { kind: "email", value: "keep@example.com" },
        { kind: "phone", value: "+44 7700 900999" },
      ],
    });
    const dialog = await editFromPage(page, made.id, "Details Edit");
    await dialog.getByLabel("Value").nth(0).fill("changed@example.com");
    await dialog.getByRole("button", { name: "Remove detail" }).nth(1).click();
    await save(dialog);
    const saved = await person(request, "Details Edit");
    expect(saved.details.map((d) => d.value)).toEqual(["changed@example.com"]);
  });

  test("clearing the job title clears it", async ({ page, request }) => {
    const made = await create(request, "contacts", { name: "Title Clear", title: "Consultant" });
    const dialog = await editFromPage(page, made.id, "Title Clear");
    await dialog.getByLabel("Job title").clear();
    await save(dialog);
    expect((await person(request, "Title Clear")).title).toBeNull();
  });

  test("editing doesn't touch their favourite star, or their ghost", async ({ page, request }) => {
    const made = await create(request, "contacts", { name: "Marks Stay", favourite: true });
    await request.patch(`/api/v1/contacts/${made.id}`, {
      data: { closed_as: "ghosted", closed_on: "2026-01-01" },
    });
    const dialog = await editFromPage(page, made.id, "Marks Stay");
    await dialog.getByLabel("Job title").fill("Lead");
    await save(dialog);
    expect(await person(request, "Marks Stay")).toMatchObject({
      favourite: true,
      closed_as: "ghosted",
      title: "Lead",
    });
  });

  test("giving them someone else's email is refused", async ({ page, request, problems }) => {
    problems.allow(/\/api\/v1\/contacts/);
    await create(request, "contacts", {
      name: "Owner Two",
      details: [{ kind: "email", value: "owned@example.com" }],
    });
    const made = await create(request, "contacts", { name: "Copier Two" });
    const dialog = await editFromPage(page, made.id, "Copier Two");
    await dialog.getByRole("button", { name: "Add a detail" }).click();
    await dialog.getByLabel("Kind").first().click();
    await page.getByRole("option", { name: "Email", exact: true }).click();
    await dialog.getByLabel("Value").first().fill("owned@example.com");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("That didn't work")).toBeVisible();
    await expect(dialog).toBeVisible();
    expect((await person(request, "Copier Two")).details).toHaveLength(0);
  });

  test("the pencil on a tile opens the same form", async ({ page, request }) => {
    await create(request, "contacts", { name: "Tile Edit" });
    await openPage(page);
    await page.getByRole("button", { name: "Edit Tile Edit" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Tile Edited");
    await save(dialog);
    await expect(page.getByRole("link", { name: "Tile Edited" })).toBeVisible();
  });
});

test.describe("finding people", () => {
  test("search finds by name, agency and email", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Findable Agency" });
    await create(request, "contacts", {
      name: "Findable Person",
      agency_id: agency.id,
      details: [{ kind: "email", value: "seek-me@example.com" }],
    });
    await openPage(page);
    const search = page.getByLabel("Search recruiters");
    for (const term of ["Findable Person", "Findable Agency", "seek-me@example.com"]) {
      await search.fill(term);
      await expect(page.getByRole("link", { name: "Findable Person" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Sam Patel" })).toBeHidden();
    }
  });

  test("says when no one matches", async ({ page }) => {
    await openPage(page);
    await page.getByLabel("Search recruiters").fill("no such person anywhere");
    await expect(page.getByRole("link", { name: "Alex Morgan" })).toBeHidden();
  });
});

test.describe("favourites", () => {
  test("starring from the tile files them under Favourites, first in the list", async ({ page, request }) => {
    const made = await create(request, "contacts", { name: "Aaa Star" });
    await openPage(page);
    await page.getByRole("button", { name: "Favourite: Aaa Star" }).click();
    await expect.poll(async () => (await person(request, "Aaa Star")).favourite).toBe(true);
    await view(page, /^Favourites · \d+$/);
    await expect(page.getByRole("link", { name: "Aaa Star" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sam Patel" })).toBeHidden();
    await page.goto(`/people/${made.id}`);
    await page.getByRole("button", { name: "Favourite: Aaa Star" }).click();
    await expect.poll(async () => (await person(request, "Aaa Star")).favourite).toBe(false);
  });
});

test.describe("ghosts", () => {
  const ghost = async (page: Page, request: APIRequestContext, name: string) => {
    const made = await create(request, "contacts", { name });
    await page.goto(`/people/${made.id}`);
    await page.getByRole("button", { name: `Ghosted: ${name}` }).click();
    await expect.poll(async () => (await person(request, name)).closed_as).toBe("ghosted");
    return made;
  };

  test("marking one shows under Ghosted, and Not a ghost undoes it", async ({ page, request }) => {
    await ghost(page, request, "Ghost One");
    await page
      .getByRole("button", { name: /Not a ghost/ })
      .first()
      .click();
    await expect.poll(async () => (await person(request, "Ghost One")).closed_as).toBeNull();
  });

  test("the Ghosted view lists them", async ({ page, request }) => {
    await ghost(page, request, "Ghost Two");
    await openPage(page);
    await view(page, /^Ghosted · \d+$/);
    await expect(page.getByRole("link", { name: "Ghost Two" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sam Patel" })).toBeHidden();
  });
});

test.describe("merging", () => {
  const merge = async (page: Page, keep: Named, other: string) => {
    await page.goto(`/people/${keep.id}`);
    await page.getByRole("button", { name: "Merge…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Choose a person").click();
    await page.getByRole("option", { name: new RegExp(`^${other}`) }).click();
    return dialog;
  };

  test("cancelling changes nothing", async ({ page, request }) => {
    const keep = await create(request, "contacts", { name: "Cancel Keep" });
    await create(request, "contacts", { name: "Cancel Other" });
    const dialog = await merge(page, keep, "Cancel Other");
    await expect(dialog.getByText("From Cancel Other to Cancel Keep:")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await people(request, "Cancel Other")).toHaveLength(1);
  });

  test("brings their details, applications and roles across, and removes the other", async ({
    page,
    request,
  }) => {
    const agency = await create(request, "agencies", { name: "Merge Agency" });
    const keep = await create(request, "contacts", {
      name: "Merge Keep",
      details: [{ kind: "email", value: "keep-me@example.com" }],
    });
    const other = await create(request, "contacts", {
      name: "Merge Other",
      title: "Their Title",
      agency_id: agency.id,
      favourite: true,
      details: [
        { kind: "email", value: "keep-me-too@example.com" },
        { kind: "phone", value: "+44 7700 900111" },
      ],
    });
    const co = await create(request, "companies", { name: "Merge Co" });
    await create(request, "roles", { company_id: co.id, title: "Merge Role", contact_id: other.id });
    const app = await create(request, "applications/quick", {
      company_name: "Merge App Co",
      role_title: "Merge App",
      route: "agency",
      agency_id: agency.id,
      recruiter_id: other.id,
      tags: [],
    });
    const dialog = await merge(page, keep, "Merge Other");
    await dialog.getByRole("button", { name: "Merge into Merge Keep" }).click();
    await expect(dialog).toBeHidden();
    expect(await people(request, "Merge Other")).toHaveLength(0);
    const kept = await person(request, "Merge Keep");
    expect(kept.details.map((d) => d.value).sort()).toEqual(
      ["+44 7700 900111", "keep-me-too@example.com", "keep-me@example.com"].sort(),
    );
    expect(kept).toMatchObject({ title: "Their Title", agency_id: agency.id, favourite: true });
    const detail = (await (await request.get(`/api/v1/applications/${app.id}`)).json()) as {
      recruiter_id: string;
    };
    expect(detail.recruiter_id).toBe(keep.id);
    await page.goto(`/people/${keep.id}`);
    await expect(page.getByRole("link", { name: "Merge Role" })).toBeVisible();
  });

  test("the kept person's own fields win", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Win Agency" });
    const otherAgency = await create(request, "agencies", { name: "Lose Agency" });
    const keep = await create(request, "contacts", {
      name: "Win Keep",
      title: "Keep Title",
      agency_id: agency.id,
    });
    await create(request, "contacts", { name: "Win Other", title: "Other Title", agency_id: otherAgency.id });
    const dialog = await merge(page, keep, "Win Other");
    await dialog.getByRole("button", { name: "Merge into Win Keep" }).click();
    await expect(dialog).toBeHidden();
    expect(await person(request, "Win Keep")).toMatchObject({ title: "Keep Title", agency_id: agency.id });
  });
});

test.describe("deleting a person", () => {
  test("cancelling keeps them", async ({ page, request }) => {
    const made = await create(request, "contacts", { name: "Delete Cancel" });
    await page.goto(`/people/${made.id}`);
    let asked = "";
    page.once("dialog", (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect.poll(() => asked).toContain("Delete Cancel");
    await expect(page.getByRole("heading", { name: "Delete Cancel", level: 2 })).toBeVisible();
    expect(await people(request, "Delete Cancel")).toHaveLength(1);
  });

  test("removes them and their calls, unlinking the rest, which stay", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/\/summary/); // KNOWN BUG, fix-deleted-person-404: a refetch after the delete
    const agency = await create(request, "agencies", { name: "Gone Agency" });
    const made = await create(request, "contacts", { name: "Gone Person", agency_id: agency.id });
    const co = await create(request, "companies", { name: "Gone Co" });
    await create(request, "roles", { company_id: co.id, title: "Gone Role", contact_id: made.id });
    await create(request, "meetings", {
      contact_id: made.id,
      title: "Gone call",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const app = await create(request, "applications/quick", {
      company_name: "Gone App Co",
      role_title: "Gone App",
      route: "agency",
      agency_id: agency.id,
      recruiter_id: made.id,
      tags: [],
    });
    await page.goto(`/people/${made.id}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/recruiters$/);
    await expect(page.getByRole("link", { name: "Gone Person" })).toBeHidden();
    expect(await people(request, "Gone Person")).toHaveLength(0);
    const detail = (await (await request.get(`/api/v1/applications/${app.id}`)).json()) as {
      recruiter_id: string | null;
      agency_name: string | null;
    };
    expect(detail).toMatchObject({ recruiter_id: null, agency_name: "Gone Agency" });
    const calls = await list<{ title: string }>(request, "meetings");
    expect(calls.map((c) => c.title)).not.toContain("Gone call");
    const roles = await list<{ title: string; contact_id: string | null }>(request, "roles");
    expect(roles.find((r) => r.title === "Gone Role")?.contact_id).toBeNull();
    expect(await agencies(request, "Gone Agency")).toHaveLength(1);
  });
});

test.describe("a person's page", () => {
  test("lists their applications, roles and details, and links to them", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Show Agency" });
    const made = await create(request, "contacts", {
      name: "Show Person",
      title: "Lead Consultant",
      agency_id: agency.id,
    });
    await create(request, "applications/quick", {
      company_name: "Show Co",
      role_title: "Show App",
      route: "agency",
      agency_id: agency.id,
      recruiter_id: made.id,
      tags: [],
    });
    await page.goto(`/people/${made.id}`);
    await expect(page.getByText("Lead Consultant").first()).toBeVisible();
    await page.getByRole("link", { name: "Show Agency" }).first().click();
    await expect(page).toHaveURL(/\/agencies\//);
    await page.goBack();
    await expect(page.getByText("Show App").first()).toBeVisible();
    await page.getByRole("link", { name: "All people" }).click();
    await expect(page).toHaveURL(/\/recruiters$/);
  });

  test("an address that doesn't exist says so", async ({ page, problems }) => {
    problems.allow(/no-such-person/);
    await page.goto("/people/no-such-person");
    await expect(page.getByText("Couldn't load this person.")).toBeVisible({ timeout: 15_000 });
  });
});
