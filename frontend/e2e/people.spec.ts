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
/** A refusal from the contacts API: the request itself, and the browser's console line about it. */
const REFUSED = /409.*\/api\/v1\/contacts/;
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
  test.fail("the same name twice doesn't make a second agency", async ({ page, request, problems }) => {
    problems.allow(/\/api\/v1\/agencies/); // a fix may refuse it
    await create(request, "agencies", { name: "Twin Agency" });
    await openPage(page);
    await page.getByRole("button", { name: "New agency" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Twin Agency");
    const posted = page.waitForResponse(
      (r) => r.url().endsWith("/api/v1/agencies") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "Add agency" }).click();
    await posted;
    expect(await agencies(request, "Twin Agency")).toHaveLength(1);
  });

  // KNOWN BUG (fix-new-agency-keeps-draft on the roadmap): expected to fail until it is fixed.
  test.fail("closing it leaves nothing behind for next time", async ({ page }) => {
    await openPage(page);
    await page.getByRole("button", { name: "New agency" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill("Draft Agency");
    await dialog.getByLabel("Website").fill("https://draft.example.com");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "New agency" }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue("");
    await expect(dialog.getByLabel("Website")).toHaveValue("");
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

  test("the keyboard's way to + Add makes exactly one, and keeps the dialog open", async ({
    page,
    request,
  }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Keyboard Person");
    await dialog.getByLabel("Agency").first().fill("Keyboard Agency");
    await page.getByRole("option", { name: '+ Add "Keyboard Agency"' }).waitFor();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(dialog.getByLabel("Agency").first()).toHaveValue("Keyboard Agency");
    await expect(dialog).toBeVisible();
    expect(await agencies(request, "Keyboard Agency")).toHaveLength(1);
    await addPerson(dialog);
    const [agency] = await agencies(request, "Keyboard Agency");
    expect(await person(request, "Keyboard Person")).toMatchObject({ agency_id: agency?.id });
  });

  // Saving with a name typed but no option chosen mustn't quietly drop the agency.
  // KNOWN BUG (fix-typed-agency-lost on the roadmap): expected to fail until it is fixed.
  test.fail("an agency typed but not chosen isn't lost without a word", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Typed Person");
    await dialog.getByLabel("Agency").first().fill("Typed Agency");
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await page.waitForTimeout(800); // either outcome below is fine, so nothing to wait on
    const saved = await people(request, "Typed Person");
    if (saved.length) expect(saved[0]?.agency_id).not.toBeNull();
    else await expect(dialog).toBeVisible();
  });

  // KNOWN BUG (fix-typed-agency-lost on the roadmap): expected to fail until it is fixed.
  test.fail("Enter in the Agency box doesn't lose the typed agency either", async ({ page, request }) => {
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Entered Person");
    await dialog.getByLabel("Agency").first().fill("Entered Agency");
    await page.getByRole("option", { name: '+ Add "Entered Agency"' }).waitFor();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(800);
    const saved = await people(request, "Entered Person");
    if (saved.length) expect(saved[0]?.agency_id).not.toBeNull();
    else await expect(dialog).toBeVisible();
  });

  test("an existing agency in other capitals is the same one", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Capital Agency" });
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Capital Person");
    await dialog.getByLabel("Agency").first().fill("CAPITAL agency");
    await page.getByRole("option", { name: "Capital Agency", exact: true }).click();
    await expect(page.getByRole("option", { name: /^\+ Add/ })).toHaveCount(0);
    await addPerson(dialog);
    expect(await agencies(request, "Capital Agency")).toHaveLength(1);
    expect(await agencies(request, "CAPITAL agency")).toHaveLength(0);
    expect(await person(request, "Capital Person")).toMatchObject({ agency_id: agency.id });
  });

  // KNOWN BUG (fix-duplicate-agency-name on the roadmap): expected to fail until it is fixed.
  test.fail("an existing agency with a stray inner space isn't offered as new", async ({ page, request }) => {
    await create(request, "agencies", { name: "Spaced Agency" });
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Agency").first().fill("Spaced  Agency");
    await page.getByRole("option").first().waitFor();
    await expect(page.getByRole("option", { name: /^\+ Add/ })).toHaveCount(0);
  });

  // KNOWN BUG (fix-duplicate-agency-name on the roadmap): expected to fail until it is fixed.
  test.fail(
    "typing an agency's name before the list has loaded doesn't make a second",
    async ({ page, request }) => {
      await create(request, "agencies", { name: "Slow Agency" });
      const made = await create(request, "contacts", { name: "Slow Person" });
      await page.route("**/api/v1/agencies", async (route) => {
        await new Promise((done) => setTimeout(done, 2000));
        await route.continue();
      });
      const dialog = await editFromPage(page, made.id, "Slow Person");
      await dialog.getByLabel("Agency").first().fill("Slow Agency");
      const early = page.getByRole("option", { name: '+ Add "Slow Agency"' });
      // Offered while the list is still loading? Then taking it is what someone would do.
      await early.waitFor({ timeout: 1000 }).then(
        () => early.click(),
        () => undefined,
      );
      await page.waitForTimeout(2500); // the list has arrived, and anything made has saved
      expect(await agencies(request, "Slow Agency")).toHaveLength(1);
    },
  );

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
    await expect(page.getByRole("link", { name: "Company Person", exact: true })).toBeVisible();
    await page.goto(`/companies/${company.id}`);
    await expect(page.getByRole("link", { name: "Company Person", exact: true })).toBeVisible();
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
    problems.allow(REFUSED);
    await create(request, "contacts", {
      name: "Email Owner",
      details: [{ kind: "email", value: "taken@example.com" }],
    });
    await openPage(page);
    const dialog = await newPerson(page);
    await dialog.getByLabel("Name").fill("Email Copier");
    await dialog.getByLabel("Value").first().fill("taken@example.com");
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(page.getByText("Email Owner already has taken@example.com")).toBeVisible();
    await expect(dialog.getByLabel("Name")).toHaveValue("Email Copier");
    expect(await people(request, "Email Copier")).toHaveLength(0);
  });

  for (const [written, kind] of [
    ["SAME.MAIL@Example.com", "Email"],
    ["https://www.linkedin.com/in/same-profile/", "LinkedIn"],
    ["https://linkedin.com/in/same-profile?trk=1", "LinkedIn"],
  ] as const) {
    test(`${written} counts as the same as what someone else has`, async ({ page, request, problems }) => {
      problems.allow(REFUSED);
      const owner = "Same Owner";
      if (!(await people(request, owner)).length)
        await create(request, "contacts", {
          name: owner,
          details: [
            { kind: "email", value: "same.mail@example.com" },
            { kind: "linkedin", value: "https://www.linkedin.com/in/same-profile" },
          ],
        });
      await openPage(page);
      const dialog = await newPerson(page);
      await dialog.getByLabel("Name").fill("Same Copier");
      await dialog.getByLabel("Kind").first().click();
      await page.getByRole("option", { name: kind, exact: true }).click();
      await dialog.getByLabel("Value").first().fill(written);
      await dialog.getByRole("button", { name: "Add person", exact: true }).click();
      await expect(page.getByText(`${owner} already has ${written}`)).toBeVisible();
      expect(await people(request, "Same Copier")).toHaveLength(0);
    });
  }

  test("a mistake left in a cancelled form isn't there next time", async ({ page }) => {
    await openPage(page);
    let dialog = await newPerson(page);
    await dialog.getByRole("button", { name: "Add person", exact: true }).click();
    await expect(dialog.getByText("Who is it?")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    dialog = await newPerson(page);
    await expect(dialog.getByLabel("Name")).toBeVisible();
    await expect(dialog.getByText("Who is it?")).toBeHidden();
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

  test("a recruiter with details and a title, then given an agency, keeps them", async ({
    page,
    request,
  }) => {
    const made = await create(request, "contacts", {
      name: "Full Person",
      title: "Principal",
      details: [
        { kind: "email", value: "full@example.com", label: "work" },
        { kind: "phone", value: "+44 7700 900222" },
      ],
    });
    const agency = await create(request, "agencies", { name: "Full Agency" });
    const dialog = await editFromPage(page, made.id, "Full Person");
    await pick(page, dialog, "Agency", "Full Agency");
    await save(dialog);
    const saved = await person(request, "Full Person");
    expect(saved).toMatchObject({ agency_id: agency.id, title: "Principal" });
    expect(saved.details.map((d) => [d.kind, d.value, d.label])).toEqual([
      ["email", "full@example.com", "work"],
      ["phone", "+44 7700 900222", null],
    ]);
  });

  test("the X takes the agency off", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Cross Agency" });
    const made = await create(request, "contacts", { name: "Cross Person", agency_id: agency.id });
    const dialog = await editFromPage(page, made.id, "Cross Person");
    await dialog.locator(".mantine-InputClearButton-root").first().click();
    await expect(dialog.getByLabel("Agency").first()).toHaveValue("");
    await save(dialog);
    expect((await person(request, "Cross Person")).agency_id).toBeNull();
  });

  // KNOWN BUG (fix-emptied-agency-kept on the roadmap): expected to fail until it is fixed.
  test.fail("emptying the Agency box takes the agency off", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Emptied Agency" });
    const made = await create(request, "contacts", { name: "Emptied Person", agency_id: agency.id });
    const dialog = await editFromPage(page, made.id, "Emptied Person");
    await dialog.getByLabel("Agency").first().fill("");
    await save(dialog);
    expect((await person(request, "Emptied Person")).agency_id).toBeNull();
  });

  test("an agency made inside the dialog stays after Cancel, but they aren't at it", async ({
    page,
    request,
  }) => {
    const made = await create(request, "contacts", { name: "Cancel Inline" });
    const dialog = await editFromPage(page, made.id, "Cancel Inline");
    await addInside(page, dialog, "Agency", "Cancel Inline Agency");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect((await person(request, "Cancel Inline")).agency_id).toBeNull();
    expect(await agencies(request, "Cancel Inline Agency")).toHaveLength(1);
  });

  test("Cancel sends nothing, and the form shows what's saved when reopened", async ({ page, request }) => {
    const made = await create(request, "contacts", { name: "Cancel Edit" });
    const dialog = await editFromPage(page, made.id, "Cancel Edit");
    const sent: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") sent.push(`${r.method()} ${r.url()}`);
    });
    await dialog.getByLabel("Name").fill("Cancel Changed");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(dialog.getByLabel("Name")).toHaveValue("Cancel Edit");
    expect(sent).toEqual([]);
  });

  // KNOWN BUG (fix-stale-edit-after-save on the roadmap): expected to fail until it is fixed.
  test.fail(
    "reopening straight after saving shows the new values, not the old ones",
    async ({ page, request }) => {
      const made = await create(request, "contacts", { name: "Stale Edit", title: "Old Title" });
      const dialog = await editFromPage(page, made.id, "Stale Edit");
      await page.route("**/contacts/*/summary", async (route) => {
        await new Promise((done) => setTimeout(done, 1000));
        await route.continue();
      });
      await dialog.getByLabel("Job title").fill("New Title");
      await save(dialog);
      await page.getByRole("button", { name: "Edit", exact: true }).click();
      await expect(dialog.getByLabel("Job title")).toHaveValue("New Title");
    },
  );

  test("the pencil on an agency's page moves them away", async ({ page, request }) => {
    const from = await create(request, "agencies", { name: "Pencil From" });
    const to = await create(request, "agencies", { name: "Pencil To" });
    await create(request, "contacts", { name: "Pencil Person", agency_id: from.id });
    await page.goto(`/agencies/${from.id}`);
    await page.getByRole("button", { name: "Edit Pencil Person" }).click();
    const dialog = page.getByRole("dialog");
    await pick(page, dialog, "Agency", "Pencil To");
    await save(dialog);
    await expect(page.getByRole("link", { name: "Pencil Person" })).toBeHidden();
    await page.goto(`/agencies/${to.id}`);
    await expect(page.getByRole("link", { name: "Pencil Person" })).toBeVisible();
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
    problems.allow(REFUSED);
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
    await expect(page.getByText("Owner Two already has owned@example.com")).toBeVisible();
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
    await expect(page.getByText("No matches.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Alex Morgan" })).toBeHidden();
  });
});

test.describe("favourites", () => {
  test("starring from the tile files them under Favourites, first in the list", async ({ page, request }) => {
    const made = await create(request, "contacts", { name: "Zzz Star" });
    await openPage(page);
    await page.getByRole("button", { name: "Favourite: Zzz Star" }).click();
    await expect.poll(async () => (await person(request, "Zzz Star")).favourite).toBe(true);
    const names = page.getByRole("link");
    await expect
      .poll(async () => {
        const all = await names.allTextContents();
        const at = (name: string) => all.findIndex((text) => text.includes(name));
        return at("Zzz Star") >= 0 && at("Zzz Star") < at("Alex Morgan");
      })
      .toBe(true);
    await view(page, /^Favourites · \d+$/);
    await expect(page.getByRole("link", { name: "Zzz Star" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sam Patel" })).toBeHidden();
    await page.goto(`/people/${made.id}`);
    await page.getByRole("button", { name: "Favourite: Zzz Star" }).click();
    await expect.poll(async () => (await person(request, "Zzz Star")).favourite).toBe(false);
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

  test("calls, links, to-dos and notes come across, and shared things aren't doubled", async ({
    page,
    request,
  }) => {
    const keep = await create(request, "contacts", {
      name: "Moves Keep",
      details: [{ kind: "phone", value: "+44 7700 900444" }],
    });
    const other = await create(request, "contacts", {
      name: "Moves Other",
      details: [{ kind: "phone", value: "+44 7700 900444" }],
    });
    await create(request, "meetings", {
      contact_id: other.id,
      title: "Moved call",
      starts_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    const about = { entity_type: "contact", entity_id: other.id };
    await create(request, "links", { ...about, url: "https://moved.example.com/", title: "Moved link" });
    await create(request, "todos", { ...about, text: "Moved to-do" });
    await create(request, "notes", { title: "Moved note", links: [`contact:${other.id}`] });
    const app = await create(request, "applications/quick", {
      company_name: "Moves Co",
      role_title: "Moves App",
      tags: [],
    });
    for (const person of [keep, other]) {
      const added = await request.post(`/api/v1/applications/${app.id}/contacts`, {
        data: { contact_id: person.id, relation: "hiring_manager" },
      });
      expect(added.ok()).toBe(true);
    }
    const dialog = await merge(page, keep, "Moves Other");
    // Made while the dialog is open, so the merge is the first thing to meet it.
    await create(request, "notes", { title: "Late note", links: [`contact:${other.id}`] });
    await dialog.getByRole("button", { name: "Merge into Moves Keep" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Moves Keep", level: 2 })).toBeVisible();
    for (const text of ["Moved call", "Moved link", "Moved to-do", "Moved note", "Late note"])
      await expect(page.getByText(text).first()).toBeVisible();
    expect((await person(request, "Moves Keep")).details.map((d) => d.value)).toEqual(["+44 7700 900444"]);
    const detail = (await (await request.get(`/api/v1/applications/${app.id}`)).json()) as {
      contacts: { contact_id: string; relation: string }[];
    };
    expect(detail.contacts).toEqual([
      expect.objectContaining({ contact_id: keep.id, relation: "hiring_manager" }),
    ]);
  });

  // KNOWN BUG (fix-merge-nudge-old-linkedin on the roadmap): expected to fail until it is fixed.
  test.fail(
    "two people with different old-style LinkedIn profiles aren't called the same",
    async ({ page, request }) => {
      const keep = await create(request, "contacts", {
        name: "Pub First",
        details: [{ kind: "linkedin", value: "https://www.linkedin.com/pub/same-name/1/2/3" }],
      });
      await create(request, "contacts", {
        name: "Pub Second",
        details: [{ kind: "linkedin", value: "https://www.linkedin.com/pub/same-name/4/5/6" }],
      });
      await page.goto(`/people/${keep.id}`);
      await expect(page.getByRole("heading", { name: "Pub First", level: 2 })).toBeVisible();
      await page.getByRole("button", { name: "Merge…" }).click();
      await page.getByRole("dialog").getByPlaceholder("Choose a person").click();
      await expect(page.getByRole("option", { name: /^Pub Second/ })).toBeVisible();
      await expect(page.getByText("same LinkedIn")).toHaveCount(0);
    },
  );

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
    await expect(page.getByRole("link", { name: "Alex Morgan" }).first()).toBeVisible();
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
      details: [{ kind: "phone", value: "+44 7700 900333" }],
    });
    const co = await create(request, "companies", { name: "Show Role Co" });
    await create(request, "roles", { company_id: co.id, title: "Show Role", contact_id: made.id });
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
    await expect(page.getByText("+44 7700 900333")).toBeVisible();
    await expect(page.getByRole("link", { name: "Show Role" }).first()).toBeVisible();
    await page
      .getByRole("link", { name: /Show App/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/applications\//);
    await page.goBack();
    await page.getByRole("link", { name: "All people" }).click();
    await expect(page).toHaveURL(/\/recruiters$/);
  });

  test("an address that doesn't exist says so", async ({ page, problems }) => {
    problems.allow(/no-such-person/);
    await page.goto("/people/no-such-person");
    await expect(page.getByText("Couldn't load this person.")).toBeVisible({ timeout: 15_000 });
  });
});
