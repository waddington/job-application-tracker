import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Roles: creating and editing with every mix of company, person, call and pay, then deciding on
// them. Each test uses its own named company and people, so tests can't disturb one another.

interface Named {
  id: string;
  name: string;
  agency_id?: string | null;
  company_id?: string | null;
}
interface Role {
  id: string;
  title: string;
  company_id: string;
  company_name: string;
  contact_id: string | null;
  meeting_id: string | null;
  url: string | null;
  location: string | null;
  work_mode: string | null;
  employment_type: string | null;
  salary_min: number | null;
  salary_max: number | null;
  day_rate: number | null;
  ir35: string | null;
  description: string | null;
  decision: string | null;
  decision_reason: string | null;
  status: string;
  closed_as: string | null;
  application_ids: string[];
}
interface App {
  id: string;
  role_title: string;
  stage: string;
  route: string;
  applied_on: string | null;
  recruiter_id: string | null;
  recruiter_name: string | null;
  agency_name: string | null;
}

const api = {
  create: async (request: APIRequestContext, path: string, data: object) => {
    const made = await request.post(`/api/v1/${path}`, { data });
    expect(made.ok(), `POST ${path}`).toBe(true);
    return (await made.json()) as Named;
  },
  list: async <T>(request: APIRequestContext, path: string) =>
    (await (await request.get(`/api/v1/${path}`)).json()) as T[],
};
const company = (request: APIRequestContext, name: string) => api.create(request, "companies", { name });
const role = async (request: APIRequestContext, title: string) =>
  (await api.list<Role>(request, "role-summaries")).find((r) => r.title === title) as Role;
const applicationOf = async (request: APIRequestContext, title: string) =>
  (await api.list<App>(request, "applications")).find((a) => a.role_title === title) as App;
const named = async (request: APIRequestContext, path: string, name: string) =>
  (await api.list<Named>(request, path)).filter((x) => x.name === name);

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const view = (page: Page, name: string) =>
  page.locator(".mantine-SegmentedControl-root").getByText(name, { exact: true }).click();

/** Roles, showing all of them. Waits until the list has loaded. */
const openRoles = async (page: Page) => {
  await page.goto("/roles");
  await expect(page.getByRole("heading", { name: "Roles", level: 2 })).toBeVisible();
  await view(page, "All");
  await expect(page.getByRole("link", { name: "Data Engineer", exact: true })).toBeVisible();
};
const addDialog = async (page: Page) => {
  await page.getByRole("button", { name: "Add role" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Add a role to decide on")).toBeVisible();
  return dialog;
};
const pickCompany = async (page: Page, dialog: Locator, name: string) => {
  await dialog.getByLabel("Company").first().click();
  await page.getByRole("option", { name, exact: true }).click();
};
const pickPerson = async (page: Page, dialog: Locator, name: string) => {
  await dialog.getByPlaceholder("No one: you found it").click();
  await page.getByRole("option", { name, exact: true }).click();
};
const pickFrom = async (page: Page, dialog: Locator, label: string, option: string) => {
  await dialog.getByLabel(label, { exact: true }).first().click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const titleField = (dialog: Locator) => dialog.getByLabel("Role", { exact: true });
const submit = (dialog: Locator) => dialog.getByRole("button", { name: "Add role", exact: true }).click();
/** The line under a role's title in the list. */
const lineOf = (page: Page, title: string) =>
  page
    .locator("div")
    .filter({ has: page.getByRole("link", { name: title, exact: true }) })
    .filter({ has: page.getByRole("button", { name: `Edit ${title}` }) })
    .last();
const edit = async (page: Page, title: string) => {
  await page
    .getByRole("button", { name: `Edit ${title}` })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Edit ${title}`)).toBeVisible();
  // It opens with Company's list showing, over the fields below: click away, as a person would.
  await dialog.getByText("A role you might go for.").click();
  return dialog;
};
const save = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
};

test.describe("adding a role: what the form asks for", () => {
  test("a company and a title", async ({ page, request }) => {
    await openRoles(page);
    const dialog = await addDialog(page);
    const before = (await api.list<Role>(request, "role-summaries")).length;
    await submit(dialog);
    await expect(dialog.getByText("Which company? Type a new name to add it.")).toBeVisible();
    await expect(dialog.getByText("What's the role?")).toBeVisible();
    expect(await api.list<Role>(request, "role-summaries")).toHaveLength(before);
  });

  test("a job ad link that is a link", async ({ page, request }) => {
    await company(request, "Bad Link Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Bad Link Co");
    await titleField(dialog).fill("Bad Link Role");
    await dialog.getByLabel("Job ad link").fill("not a link");
    await submit(dialog);
    await expect(dialog.getByText("Links start with http:// or https://")).toBeVisible();
    expect(await role(request, "Bad Link Role")).toBeUndefined();
  });

  test("Cancel adds nothing", async ({ page, request }) => {
    await company(request, "Cancel Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Cancel Co");
    await titleField(dialog).fill("Cancel Role");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(await role(request, "Cancel Role")).toBeUndefined();
  });
});

test.describe("adding a role: company", () => {
  test("an existing company, with nothing else", async ({ page, request }) => {
    const co = await company(request, "Plain Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Plain Co");
    await titleField(dialog).fill("Plain Role");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("link", { name: "Plain Role", exact: true })).toBeVisible();
    expect(await role(request, "Plain Role")).toMatchObject({
      company_id: co.id,
      contact_id: null,
      status: "to_decide",
    });
    expect(await named(request, "companies", "Plain Co")).toHaveLength(1);
  });

  test("a company typed in the dialog is created, and shows on Companies", async ({ page, request }) => {
    await openRoles(page);
    const dialog = await addDialog(page);
    await dialog.getByLabel("Company").first().fill("Typed Co");
    await page.getByRole("option", { name: '+ Add "Typed Co"' }).click();
    await titleField(dialog).fill("Typed Role");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    const [co] = await named(request, "companies", "Typed Co");
    expect(await role(request, "Typed Role")).toMatchObject({ company_id: co?.id });
    await page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Companies" })
      .click();
    await page.getByLabel("Open Typed Co").click();
    await expect(page.getByRole("link", { name: "Typed Role", exact: true })).toBeVisible();
  });

  test("a company made in the dialog can be picked straight away for the next role", async ({
    page,
    request,
  }) => {
    await openRoles(page);
    let dialog = await addDialog(page);
    await dialog.getByLabel("Company").first().fill("Twice Co");
    await page.getByRole("option", { name: '+ Add "Twice Co"' }).click();
    await titleField(dialog).fill("Twice First");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    dialog = await addDialog(page);
    await pickCompany(page, dialog, "Twice Co");
    await titleField(dialog).fill("Twice Second");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    expect(await named(request, "companies", "Twice Co")).toHaveLength(1);
    expect((await role(request, "Twice Second")).company_name).toBe("Twice Co");
  });

  // KNOWN BUG (fix-duplicate-role on the roadmap): expected to fail until it is fixed. Only New
  // application reuses a role with the same title at the same company.
  test.fail(
    "the same title at the same company, added twice, doesn't make two roles",
    async ({ page, request, problems }) => {
      problems.allow(/\/api\/v1\/roles/); // a fix may refuse it
      await company(request, "Same Co");
      await openRoles(page);
      for (let i = 0; i < 2; i++) {
        const dialog = await addDialog(page);
        await pickCompany(page, dialog, "Same Co");
        await titleField(dialog).fill("Same Role");
        const posted = page.waitForResponse(
          (r) => r.url().endsWith("/api/v1/roles") && r.request().method() === "POST",
        );
        await submit(dialog);
        await posted;
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
      const all = await api.list<Role>(request, "role-summaries");
      expect(all.filter((r) => r.title === "Same Role")).toHaveLength(1);
    },
  );

  test("a double click on Add role adds one", async ({ page, request }) => {
    await company(request, "Double Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Double Co");
    await titleField(dialog).fill("Double Role");
    await dialog.getByRole("button", { name: "Add role", exact: true }).dblclick();
    await expect(dialog).toBeHidden();
    const all = await api.list<Role>(request, "role-summaries");
    expect(all.filter((r) => r.title === "Double Role")).toHaveLength(1);
  });
});

test.describe("adding a role: who told you", () => {
  test("a recruiter at an agency shows on the role and on their page", async ({ page, request }) => {
    const agency = await api.create(request, "agencies", { name: "Pitch Agency" });
    const person = await api.create(request, "contacts", { name: "Pitch Person", agency_id: agency.id });
    await company(request, "Pitch Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Pitch Co");
    await titleField(dialog).fill("Pitch Role");
    await pickPerson(page, dialog, "Pitch Person");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(lineOf(page, "Pitch Role")).toContainText("from Pitch Person (Pitch Agency)");
    await page.getByRole("link", { name: "Pitch Role", exact: true }).click();
    await expect(page.getByText("From", { exact: true }).locator("..")).toContainText(
      "Pitch Person at Pitch Agency",
    );
    await page.goto(`/people/${person.id}`);
    await expect(page.getByRole("link", { name: "Pitch Role", exact: true })).toBeVisible();
  });

  test("an independent recruiter, with no agency", async ({ page, request }) => {
    await api.create(request, "contacts", { name: "Solo Person" });
    await company(request, "Solo Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Solo Co");
    await titleField(dialog).fill("Solo Role");
    await pickPerson(page, dialog, "Solo Person");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(lineOf(page, "Solo Role")).toContainText("from Solo Person");
    await expect(lineOf(page, "Solo Role")).not.toContainText("(");
  });

  test("the call can only be chosen once there's a person, and belongs to them", async ({
    page,
    request,
  }) => {
    const person = await api.create(request, "contacts", { name: "Call Person" });
    const other = await api.create(request, "contacts", { name: "Other Caller" });
    const when = new Date(Date.now() - 2 * 86_400_000).toISOString();
    const call = await api.create(request, "meetings", {
      contact_id: person.id,
      title: "Intro chat",
      starts_at: when,
    });
    await api.create(request, "meetings", {
      contact_id: other.id,
      title: "Someone else's chat",
      starts_at: when,
    });
    await company(request, "Call Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await expect(dialog.getByPlaceholder("Pick who first")).toBeDisabled();
    await pickCompany(page, dialog, "Call Co");
    await titleField(dialog).fill("Call Role");
    await pickPerson(page, dialog, "Call Person");
    await dialog.getByPlaceholder("Not from a call").click();
    await expect(page.getByRole("option", { name: /^Intro chat/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Someone else's chat/ })).toBeHidden();
    await page.getByRole("option", { name: /^Intro chat · \d+ \w+$/ }).click();
    await submit(dialog);
    await expect(dialog).toBeHidden();
    expect((await role(request, "Call Role")).meeting_id).toBe(call.id);
    await page.getByRole("link", { name: "Call Role", exact: true }).click();
    await expect(page.getByText("From", { exact: true }).locator("..")).toContainText("· on ");
  });

  test("changing the person clears the call", async ({ page, request }) => {
    const person = await api.create(request, "contacts", { name: "First Caller" });
    await api.create(request, "contacts", { name: "Second Caller" });
    await api.create(request, "meetings", {
      contact_id: person.id,
      title: "Their chat",
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    await company(request, "Swap Call Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Swap Call Co");
    await titleField(dialog).fill("Swap Call Role");
    await pickPerson(page, dialog, "First Caller");
    await dialog.getByPlaceholder("Not from a call").click();
    await page.getByRole("option", { name: /^Their chat/ }).click();
    await dialog.getByLabel("Who told you about it").first().click();
    await page.getByRole("option", { name: "Second Caller", exact: true }).click();
    await submit(dialog);
    await expect(dialog).toBeHidden();
    expect(await role(request, "Swap Call Role")).toMatchObject({ meeting_id: null });
  });
});

test.describe("adding a role: the rest", () => {
  test("permanent pay and where it is", async ({ page, request }) => {
    await company(request, "Pay Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Pay Co");
    await titleField(dialog).fill("Pay Role");
    await dialog.getByLabel("Job ad link").fill("https://jobs.example.com/pay-role");
    await dialog.getByLabel("Location").fill("Leeds");
    await pickFrom(page, dialog, "Work mode", "In office");
    await pickFrom(page, dialog, "Type", "Permanent");
    await dialog.getByLabel("Salary from (£)").fill("80000");
    await dialog.getByLabel("Salary to (£)").fill("95000");
    await dialog.getByLabel("Notes").fill("Small **platform** team");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(lineOf(page, "Pay Role")).toContainText("£80k–£95k · in office · Leeds");
    expect(await role(request, "Pay Role")).toMatchObject({
      url: "https://jobs.example.com/pay-role",
      work_mode: "office",
      employment_type: "permanent",
      salary_min: 80000,
      salary_max: 95000,
      day_rate: null,
    });
    await page.getByRole("link", { name: "Pay Role", exact: true }).click();
    await expect(page.getByText("Permanent · In office")).toBeVisible();
    await expect(page.getByRole("link", { name: /jobs\.example\.com\/pay-role/ })).toHaveAttribute(
      "href",
      "https://jobs.example.com/pay-role",
    );
    await expect(page.locator("strong", { hasText: "platform" })).toBeVisible();
  });

  test("a contract asks for a day rate and IR35 instead", async ({ page, request }) => {
    await company(request, "Contract Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Contract Co");
    await titleField(dialog).fill("Contract Role");
    await dialog.getByLabel("Salary from (£)").fill("50000");
    await pickFrom(page, dialog, "Type", "Contract");
    await expect(dialog.getByLabel("Salary from (£)")).toBeHidden();
    await dialog.getByLabel("Day rate (£)").fill("650");
    await pickFrom(page, dialog, "IR35", "Inside");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(lineOf(page, "Contract Role")).toContainText("£650 a day, inside IR35");
    expect(await role(request, "Contract Role")).toMatchObject({
      employment_type: "contract",
      day_rate: 650,
      ir35: "inside",
      salary_min: null, // typed before it became a contract
    });
  });

  test("IR35 not sure isn't mentioned", async ({ page, request }) => {
    await company(request, "Unsure Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Unsure Co");
    await titleField(dialog).fill("Unsure Role");
    await pickFrom(page, dialog, "Type", "Contract");
    await dialog.getByLabel("Day rate (£)").fill("500");
    await pickFrom(page, dialog, "IR35", "Not sure");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(lineOf(page, "Unsure Role")).toContainText("£500 a day");
    await expect(lineOf(page, "Unsure Role")).not.toContainText("IR35");
  });

  test("a job description goes with the role, then on to its application", async ({ page, request }) => {
    await company(request, "File Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "File Co");
    await titleField(dialog).fill("File Role");
    await dialog.locator("input[type=file]").setInputFiles({
      name: "file-role-jd.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 made up"),
    });
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("img", { name: "1 file on File Role" })).toBeVisible();
    await page.getByRole("link", { name: "File Role", exact: true }).click();
    await expect(page.getByRole("link", { name: "file-role-jd.pdf" })).toBeVisible();
    await page.getByRole("button", { name: "Apply: File Role" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    await expect(page.getByText("From the role")).toBeVisible();
    await expect(page.getByRole("link", { name: "file-role-jd.pdf" })).toBeVisible();
  });

  test("Add and add another keeps who and clears the rest", async ({ page, request }) => {
    const person = await api.create(request, "contacts", { name: "Many Person" });
    const co = await company(request, "Many Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Many Co");
    await titleField(dialog).fill("Many First");
    await dialog.getByLabel("Location").fill("York");
    await pickPerson(page, dialog, "Many Person");
    await dialog.getByRole("button", { name: "Add and add another" }).click();
    await expect(titleField(dialog)).toHaveValue("");
    await expect(dialog.getByLabel("Location")).toHaveValue("");
    await expect(dialog.getByLabel("Who told you about it").first()).toHaveValue("Many Person");
    await titleField(dialog).fill("Many Second");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    const first = await role(request, "Many First");
    const second = await role(request, "Many Second");
    expect(second.contact_id).toBe(person.id);
    expect(second.company_id).toBe(co.id);
    expect(first.contact_id).toBe(person.id);
  });

  test("started from a person's page, it's about them", async ({ page, request }) => {
    const person = await api.create(request, "contacts", { name: "Start Person" });
    await company(request, "Start Person Co");
    await page.goto(`/people/${person.id}`);
    await page.getByRole("button", { name: "Add role" }).click();
    const dialog = page.getByRole("dialog");
    await pickCompany(page, dialog, "Start Person Co");
    await titleField(dialog).fill("Start Person Role");
    await submit(dialog);
    await expect(page.getByRole("link", { name: "Start Person Role" })).toBeVisible();
    expect((await role(request, "Start Person Role")).contact_id).toBe(person.id);
  });

  test("started from a company's page, it's at that company", async ({ page, request }) => {
    const co = await company(request, "Start Company Co");
    await page.goto(`/companies/${co.id}`);
    await page.getByRole("button", { name: "Add role" }).click();
    const dialog = page.getByRole("dialog");
    await titleField(dialog).fill("Start Company Role");
    await submit(dialog);
    await expect(page.getByRole("link", { name: "Start Company Role" })).toBeVisible();
    expect((await role(request, "Start Company Role")).company_id).toBe(co.id);
  });
});

test.describe("editing a role", () => {
  const seedRole = async (request: APIRequestContext, title: string, data: object = {}) => {
    const co = await company(request, `${title} Co`);
    return api.create(request, "roles", { company_id: co.id, title, ...data });
  };

  test("the form shows what's saved, and saving changes it", async ({ page, request }) => {
    await seedRole(request, "Edit Basics", { location: "Bath", work_mode: "remote" });
    await openRoles(page);
    const dialog = await edit(page, "Edit Basics");
    await expect(dialog.getByLabel("Location")).toHaveValue("Bath");
    await dialog.getByLabel("Location").fill("Bristol");
    await pickFrom(page, dialog, "Work mode", "Hybrid");
    await save(dialog);
    await expect(lineOf(page, "Edit Basics")).toContainText("hybrid · Bristol");
    expect(await role(request, "Edit Basics")).toMatchObject({ location: "Bristol", work_mode: "hybrid" });
  });

  test("clearing fields clears them", async ({ page, request }) => {
    await seedRole(request, "Edit Clear", {
      location: "Bath",
      url: "https://jobs.example.com/x",
      description: "Words",
    });
    await openRoles(page);
    const dialog = await edit(page, "Edit Clear");
    await dialog.getByLabel("Location").clear();
    await dialog.getByLabel("Job ad link").clear();
    await dialog.getByLabel("Notes").clear();
    await save(dialog);
    await expect
      .poll(async () => {
        const saved = await role(request, "Edit Clear");
        return [saved.location, saved.url, saved.description];
      })
      .toEqual([null, null, null]);
  });

  test("renaming keeps its identity", async ({ page, request }) => {
    const made = await seedRole(request, "Edit Rename");
    await openRoles(page);
    const dialog = await edit(page, "Edit Rename");
    await titleField(dialog).fill("Edit Renamed");
    await save(dialog);
    await expect(page.getByRole("link", { name: "Edit Renamed", exact: true })).toBeVisible();
    expect((await role(request, "Edit Renamed")).id).toBe(made.id);
    expect(await role(request, "Edit Rename")).toBeUndefined();
  });

  test("from salary to contract, and back, keeps only what applies", async ({ page, request }) => {
    await seedRole(request, "Edit Pay", {
      employment_type: "permanent",
      salary_min: 70000,
      salary_max: 80000,
    });
    await openRoles(page);
    let dialog = await edit(page, "Edit Pay");
    await pickFrom(page, dialog, "Type", "Contract");
    await dialog.getByLabel("Day rate (£)").fill("700");
    await save(dialog);
    await expect(lineOf(page, "Edit Pay")).toContainText("£700 a day");
    expect(await role(request, "Edit Pay")).toMatchObject({
      day_rate: 700,
      salary_min: null,
      salary_max: null,
    });
    dialog = await edit(page, "Edit Pay");
    await pickFrom(page, dialog, "Type", "Permanent");
    await dialog.getByLabel("Salary from (£)").fill("90000");
    await save(dialog);
    await expect(lineOf(page, "Edit Pay")).toContainText("£90k");
    expect(await role(request, "Edit Pay")).toMatchObject({ day_rate: null, ir35: null, salary_min: 90000 });
  });

  test("adding a person to a role that had none", async ({ page, request }) => {
    await seedRole(request, "Edit Add Person");
    const person = await api.create(request, "contacts", { name: "Added Person" });
    await openRoles(page);
    const dialog = await edit(page, "Edit Add Person");
    await pickPerson(page, dialog, "Added Person");
    await save(dialog);
    await expect(lineOf(page, "Edit Add Person")).toContainText("from Added Person");
    expect((await role(request, "Edit Add Person")).contact_id).toBe(person.id);
  });

  test("removing the person leaves it as one you found", async ({ page, request }) => {
    const person = await api.create(request, "contacts", { name: "Removed Person" });
    await seedRole(request, "Edit Remove Person", { contact_id: person.id });
    await openRoles(page);
    const dialog = await edit(page, "Edit Remove Person");
    // Choosing the selected name again takes it off.
    await dialog.getByLabel("Who told you about it").first().click();
    await page.getByRole("option", { name: "Removed Person", exact: true }).click();
    await save(dialog);
    await expect(lineOf(page, "Edit Remove Person")).not.toContainText("from Removed Person");
    expect((await role(request, "Edit Remove Person")).contact_id).toBeNull();
    expect(await named(request, "contacts", "Removed Person")).toHaveLength(1);
  });

  test("moving it to another company, including a new one", async ({ page, request }) => {
    await seedRole(request, "Edit Move Co");
    await openRoles(page);
    const dialog = await edit(page, "Edit Move Co");
    await dialog.getByLabel("Company").first().fill("Moved To Co");
    await page.getByRole("option", { name: '+ Add "Moved To Co"' }).click();
    await save(dialog);
    expect((await role(request, "Edit Move Co")).company_name).toBe("Moved To Co");
    await expect(lineOf(page, "Edit Move Co").getByRole("link", { name: "Moved To Co" })).toBeVisible();
  });

  test("the file field is only there when adding", async ({ page, request }) => {
    await seedRole(request, "Edit No File");
    await openRoles(page);
    const dialog = await edit(page, "Edit No File");
    await expect(dialog.getByRole("button", { name: "Add and add another" })).toBeHidden();
    await expect(dialog.locator("input[type=file]")).toHaveCount(0);
  });

  test("a failed save keeps the dialog and what you typed", async ({ page, request, problems }) => {
    problems.allow(/\/api\/v1\/roles\//);
    await seedRole(request, "Edit Fail");
    await openRoles(page);
    const dialog = await edit(page, "Edit Fail");
    await dialog.getByLabel("Location").fill("Nowhere");
    await page.route("**/api/v1/roles/*", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({ status: 500, json: { detail: "No" } })
        : route.fallback(),
    );
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("That didn't work")).toBeVisible();
    await expect(dialog.getByLabel("Location")).toHaveValue("Nowhere");
  });
});

test.describe("what a save leaves alone", () => {
  // KNOWN BUG (fix-add-another-role-carries-over on the roadmap): expected to fail until it is fixed.
  test.fail("Add and add another clears the type, work mode and IR35 too", async ({ page, request }) => {
    await company(request, "Carry Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Carry Co");
    await titleField(dialog).fill("Carry First");
    await pickFrom(page, dialog, "Work mode", "Remote");
    await pickFrom(page, dialog, "Type", "Contract");
    await dialog.getByLabel("Day rate (£)").fill("600");
    await pickFrom(page, dialog, "IR35", "Inside");
    await dialog.getByRole("button", { name: "Add and add another" }).click();
    await expect(titleField(dialog)).toHaveValue("");
    await titleField(dialog).fill("Carry Second");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    expect(await role(request, "Carry Second")).toMatchObject({
      work_mode: null,
      employment_type: null,
      ir35: null,
      day_rate: null,
    });
  });

  test("changing one field keeps all the others, and a decision", async ({ page, request }) => {
    const person = await api.create(request, "contacts", { name: "Round Trip Person" });
    const call = await api.create(request, "meetings", {
      contact_id: person.id,
      title: "Round trip call",
      starts_at: new Date(Date.now() - 86_400_000).toISOString(),
    });
    const co = await company(request, "Round Trip Co");
    const made = await api.create(request, "roles", {
      company_id: co.id,
      title: "Round Trip",
      url: "https://jobs.example.com/round-trip",
      location: "Bath",
      work_mode: "hybrid",
      employment_type: "permanent",
      salary_min: 70000,
      salary_max: 80000,
      currency: "GBP",
      contact_id: person.id,
      meeting_id: call.id,
      description: "Words about it",
      decision: "passed",
      decision_reason: "Too far",
    });
    const before = await role(request, "Round Trip");
    await page.goto("/roles");
    await view(page, "Passed");
    const dialog = await edit(page, "Round Trip");
    await dialog.getByLabel("Location").fill("Bristol");
    await save(dialog);
    const after = await role(request, "Round Trip");
    const unchanged = (r: Role) => ({ ...r, location: "", updated_at: "" });
    expect(after.id).toBe(made.id);
    expect(after.location).toBe("Bristol");
    expect(unchanged(after)).toEqual(unchanged(before));
  });

  test("a fixed-term role keeps its salary fields", async ({ page, request }) => {
    await company(request, "Fixed Co");
    await openRoles(page);
    const dialog = await addDialog(page);
    await pickCompany(page, dialog, "Fixed Co");
    await titleField(dialog).fill("Fixed Role");
    await pickFrom(page, dialog, "Type", "Fixed term");
    await dialog.getByLabel("Salary from (£)").fill("60000");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    expect(await role(request, "Fixed Role")).toMatchObject({
      employment_type: "fixed_term",
      salary_min: 60000,
    });
    await page.getByRole("link", { name: "Fixed Role", exact: true }).click();
    await expect(page.getByText("Fixed term", { exact: true })).toBeVisible();
  });
});

test.describe("a company made in the dialog", () => {
  test("stays even if you then cancel the role", async ({ page, request }) => {
    await openRoles(page);
    const dialog = await addDialog(page);
    await dialog.getByLabel("Company").first().fill("Left Behind Co");
    await page.getByRole("option", { name: '+ Add "Left Behind Co"' }).click();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(await named(request, "companies", "Left Behind Co")).toHaveLength(1);
  });
});

test.describe("a role's page", () => {
  test("Edit and Pass work from it too, and its applications are listed", async ({ page, request }) => {
    const co = await company(request, "Page Role Co");
    const made = await api.create(request, "roles", { company_id: co.id, title: "Page Role" });
    await page.goto(`/roles/${made.id}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByText("A role you might go for.").click();
    await dialog.getByLabel("Location").fill("Hull");
    await save(dialog);
    await expect(page.getByText("Hull")).toBeVisible();
    await page.getByRole("button", { name: "Pass: Page Role" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Pass", exact: true }).click();
    await expect(page.getByRole("button", { name: "Reconsider: Page Role" })).toBeVisible();
    await page.getByRole("button", { name: "Reconsider: Page Role" }).click();
    await page.getByRole("button", { name: "Apply: Page Role" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    await page.goto(`/roles/${made.id}`);
    await expect(page.getByRole("heading", { name: "Your application" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Page Role Co · Page Role" })).toBeVisible();
  });
});

test.describe("when a role's person changes, its applications follow only where they fit", () => {
  const start = async (page: Page, request: APIRequestContext, key: string) => {
    const agency = await api.create(request, "agencies", { name: `${key} Agency` });
    const first = await api.create(request, "contacts", { name: `${key} First`, agency_id: agency.id });
    const co = await company(request, `${key} Co`);
    const title = `${key} Role`;
    await api.create(request, "roles", { company_id: co.id, title, contact_id: first.id });
    await openRoles(page);
    await page.getByRole("button", { name: `Apply: ${title}` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    await openRoles(page);
    return { agency, first, title };
  };

  test("someone at the same agency takes over, noted on the timeline", async ({ page, request }) => {
    const { agency, title } = await start(page, request, "Follow");
    const next = await api.create(request, "contacts", { name: "Follow Second", agency_id: agency.id });
    await page.reload();
    await view(page, "All");
    const dialog = await edit(page, title);
    await dialog.getByLabel("Who told you about it").first().click();
    await page.getByRole("option", { name: "Follow Second", exact: true }).click();
    await expect(
      dialog.getByText(/Saving also gives this role's open applications the new person/),
    ).toBeVisible();
    await save(dialog);
    await expect.poll(async () => (await applicationOf(request, title)).recruiter_id).toBe(next.id);
    const app = await applicationOf(request, title);
    expect(app.agency_name).toBe("Follow Agency");
    await page.goto(`/applications/${app.id}`);
    await expect(page.getByText(/Follow Second/).first()).toBeVisible();
    const events = (
      (await (await request.get(`/api/v1/applications/${app.id}`)).json()) as {
        events: { summary: string | null }[];
      }
    ).events;
    expect(events.some((e) => e.summary?.includes("Follow Second"))).toBe(true);
  });

  test("taking the person off the role leaves the application alone", async ({ page, request }) => {
    const { first, title } = await start(page, request, "Drop");
    const dialog = await edit(page, title);
    await dialog.getByLabel("Who told you about it").first().click();
    await page.getByRole("option", { name: "Drop First", exact: true }).click();
    await save(dialog);
    await expect.poll(async () => (await role(request, title)).contact_id).toBeNull();
    expect((await applicationOf(request, title)).recruiter_id).toBe(first.id);
  });

  test("someone at another agency doesn't: the application keeps its person", async ({ page, request }) => {
    const { first, title } = await start(page, request, "Keep");
    const otherAgency = await api.create(request, "agencies", { name: "Keep Other Agency" });
    await api.create(request, "contacts", { name: "Keep Second", agency_id: otherAgency.id });
    await page.reload();
    await view(page, "All");
    const dialog = await edit(page, title);
    await dialog.getByLabel("Who told you about it").first().click();
    await page.getByRole("option", { name: "Keep Second", exact: true }).click();
    await save(dialog);
    await expect(lineOf(page, title)).toContainText("Keep Second");
    const app = await applicationOf(request, title);
    expect(app.recruiter_id).toBe(first.id);
    expect(app.agency_name).toBe("Keep Agency");
  });
});

test.describe("deciding", () => {
  const seed = async (request: APIRequestContext, title: string, data: object = {}) => {
    const co = await company(request, `${title} Co`);
    await api.create(request, "roles", { company_id: co.id, title, ...data });
  };

  test("Apply through a recruiter makes an application through them, dated today", async ({
    page,
    request,
  }) => {
    const agency = await api.create(request, "agencies", { name: "Apply Agency" });
    const person = await api.create(request, "contacts", { name: "Apply Person", agency_id: agency.id });
    await seed(request, "Apply Through", { contact_id: person.id });
    await openRoles(page);
    await page.getByRole("button", { name: "Apply: Apply Through" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Through Apply Agency (Apply Person).")).toBeVisible();
    await dialog.getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    expect(await applicationOf(request, "Apply Through")).toMatchObject({
      stage: "applied",
      route: "agency",
      applied_on: today(),
      recruiter_name: "Apply Person",
      agency_name: "Apply Agency",
    });
    expect(await role(request, "Apply Through")).toMatchObject({ status: "applied" });
  });

  test("Apply with an independent recruiter is direct, naming them", async ({ page, request }) => {
    const person = await api.create(request, "contacts", { name: "Indie Person" });
    await seed(request, "Apply Indie", { contact_id: person.id });
    await openRoles(page);
    await page.getByRole("button", { name: "Apply: Apply Indie" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Directly, with Indie Person as your contact.")).toBeVisible();
    await dialog.getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    expect(await applicationOf(request, "Apply Indie")).toMatchObject({
      route: "direct",
      recruiter_name: "Indie Person",
    });
  });

  test("Apply with no one is a direct application", async ({ page, request }) => {
    await seed(request, "Apply Direct");
    await openRoles(page);
    await page.getByRole("button", { name: "Apply: Apply Direct" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Directly.")).toBeVisible();
    await dialog.getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    expect(await applicationOf(request, "Apply Direct")).toMatchObject({
      route: "direct",
      recruiter_name: null,
    });
  });

  test("Apply's date follows the stage, until you set it", async ({ page, request }) => {
    await seed(request, "Apply Date");
    await openRoles(page);
    await page.getByRole("button", { name: "Apply: Apply Date" }).click();
    const dialog = page.getByRole("dialog");
    const applied = dialog.getByLabel("Applied on");
    await expect(applied).not.toHaveValue("");
    await pickFrom(page, dialog, "Stage", "Interested");
    await expect(applied).toHaveValue("");
    await pickFrom(page, dialog, "Stage", "Screen");
    await expect(applied).not.toHaveValue("");
    await applied.fill("7 Jul 2026");
    await page.keyboard.press("Tab");
    await pickFrom(page, dialog, "Stage", "Interested");
    await expect(applied).toHaveValue("7 Jul 2026");
    await dialog.getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    expect(await applicationOf(request, "Apply Date")).toMatchObject({
      stage: "interested",
      applied_on: "2026-07-07",
    });
  });

  test("Interested tracks it without applying, then applying moves it on", async ({ page, request }) => {
    await seed(request, "Keen Role");
    await openRoles(page);
    await page.getByRole("button", { name: "Interested: Keen Role" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Interested: Keen Role at Keen Role Co")).toBeVisible();
    await dialog.getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    const app = await applicationOf(request, "Keen Role");
    expect(app).toMatchObject({ stage: "interested", applied_on: null });
    expect((await role(request, "Keen Role")).status).toBe("interested");
    await page.goto("/roles");
    await view(page, "Interested");
    await expect(page.getByRole("link", { name: "Keen Role", exact: true })).toBeVisible();
    await expect(lineOf(page, "Keen Role").getByRole("link", { name: "Open application" })).toBeVisible();
    await page.goto(`/applications/${app.id}`);
    await page.getByRole("button", { name: "Move to…" }).click();
    await page.getByRole("menuitem", { name: "Applied", exact: true }).click();
    await expect.poll(async () => (await role(request, "Keen Role")).status).toBe("applied");
  });

  test("a role withdrawn while only interested says how it ended", async ({ page, request }) => {
    await seed(request, "Gone Role");
    await openRoles(page);
    await page.getByRole("button", { name: "Interested: Gone Role" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    await page.getByRole("button", { name: "Move to…" }).click();
    await page.getByRole("menuitem", { name: "Withdrawn", exact: true }).click();
    await expect.poll(async () => (await role(request, "Gone Role")).status).toBe("closed");
    await page.goto("/roles");
    await view(page, "Closed");
    await expect(lineOf(page, "Gone Role")).toContainText(/withdrawn/i);
  });

  test("Pass with a reason keeps it, and Reconsider brings it back", async ({ page, request }) => {
    await seed(request, "Pass Reason");
    await openRoles(page);
    await page.getByRole("button", { name: "Pass: Pass Reason" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Why? (optional)").fill("Too far");
    await dialog.getByRole("button", { name: "Pass", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(await role(request, "Pass Reason")).toMatchObject({
      status: "passed",
      decision_reason: "Too far",
    });
    await view(page, "Passed");
    await expect(lineOf(page, "Pass Reason")).toContainText("passed: Too far");
    await page.getByRole("button", { name: "Reconsider: Pass Reason" }).click();
    await expect(page.getByRole("button", { name: "Reconsider: Pass Reason" })).toBeHidden();
    expect(await role(request, "Pass Reason")).toMatchObject({ status: "to_decide", decision: null });
    await view(page, "To decide");
    await expect(page.getByRole("button", { name: "Pass: Pass Reason" })).toBeVisible();
  });

  test("Pass with no reason", async ({ page, request }) => {
    await seed(request, "Pass Plain");
    await openRoles(page);
    await page.getByRole("button", { name: "Pass: Pass Plain" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Pass", exact: true }).click();
    await expect.poll(async () => (await role(request, "Pass Plain")).status).toBe("passed");
    expect((await role(request, "Pass Plain")).decision_reason).toBeNull();
  });

  test("once there's an application, it offers that instead of the decisions", async ({ page, request }) => {
    await seed(request, "Has App");
    await openRoles(page);
    await page.getByRole("button", { name: "Apply: Has App" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Create application" }).click();
    await expect(page).toHaveURL(/\/applications\//);
    await openRoles(page);
    const line = lineOf(page, "Has App");
    await expect(line.getByRole("link", { name: "Open application" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply: Has App" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Delete Has App" })).toBeHidden();
  });
});

test.describe("each view", () => {
  test("shows only its own roles, and the seed's are where they belong", async ({ page }) => {
    await page.goto("/roles");
    await expect(page.getByRole("link", { name: "Founding Backend Engineer" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Contract SRE" })).toBeHidden();
    await view(page, "Passed");
    await expect(page.getByRole("link", { name: "Contract SRE" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Founding Backend Engineer" })).toBeHidden();
    await view(page, "Applied");
    await expect(page.getByRole("link", { name: "Senior Backend Engineer" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Contract SRE" })).toBeHidden();
  });
});

test.describe("a role's to-dos and deleting", () => {
  const seed = async (request: APIRequestContext, title: string) => {
    const co = await company(request, `${title} Co`);
    await api.create(request, "roles", { company_id: co.id, title });
  };

  test("a to-do from its line stays with it", async ({ page, request }) => {
    await seed(request, "Todo Role");
    await openRoles(page);
    await page.getByRole("button", { name: "Add a to-do about Todo Role" }).click();
    await page.getByLabel("New to-do").last().fill("Ask about the team");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("checkbox", { name: "Ask about the team" })).toBeVisible();
    await page.getByRole("link", { name: "Todo Role", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Ask about the team" })).toBeVisible();
  });

  test("deleting asks first, and cancelling keeps it", async ({ page, request }) => {
    await seed(request, "Delete Keep");
    await openRoles(page);
    let asked = "";
    page.once("dialog", (dialog) => {
      asked = dialog.message();
      void dialog.dismiss();
    });
    await page.getByRole("button", { name: "Delete Delete Keep" }).click();
    await expect
      .poll(() => asked)
      .toBe("Delete the role Delete Keep at Delete Keep Co? Passing on it keeps a record instead.");
    expect(await role(request, "Delete Keep")).toBeTruthy();
  });

  test("deleting from the list removes it, leaving the company", async ({ page, request }) => {
    await seed(request, "Delete Gone");
    await openRoles(page);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete Delete Gone" }).click();
    await expect(page.getByRole("link", { name: "Delete Gone", exact: true })).toBeHidden();
    expect(await role(request, "Delete Gone")).toBeUndefined();
    expect(await named(request, "companies", "Delete Gone Co")).toHaveLength(1);
  });

  test("deleting from its page goes back to Roles", async ({ page, request }) => {
    await seed(request, "Delete Page");
    await openRoles(page);
    await page.getByRole("link", { name: "Delete Page", exact: true }).click();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).toHaveURL(/\/roles$/);
    expect(await role(request, "Delete Page")).toBeUndefined();
  });

  test("an address that doesn't exist says so", async ({ page, problems }) => {
    problems.allow(/no-such-role/);
    await page.goto("/roles/no-such-role");
    await expect(page.getByText("Couldn't load this role. It may have been deleted.")).toBeVisible();
  });
});
