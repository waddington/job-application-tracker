import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// The Applications page as a list: filters, search, sorting, the quick view and New application.
// Tests in this file can add applications, so they check what shows and what doesn't, not counts.

const row = (page: Page, role: string, company: string) => page.getByLabel(`Open ${role} at ${company}`);
const CONTOSO = ["Senior Backend Engineer", "Contoso"] as const;
const LITWARE = ["Senior Software Engineer", "Litware"] as const;
const WIDE_WORLD = ["Senior Python Developer", "Wide World Importers"] as const;
const ADVENTURE = ["Backend Engineer (Go)", "Adventure Works"] as const;

/** Company names down the list, in order. */
const companies = (page: Page) => page.locator("tbody tr td:first-child p:first-child").allInnerTexts();

test.beforeEach(async ({ page }) => {
  await page.goto("/applications?view=list");
  await expect(row(page, ...CONTOSO)).toBeVisible();
});

test.describe("the list", () => {
  test("shows each application's company, role, route, stage and tags", async ({ page }) => {
    for (const heading of ["Company / role", "Route", "Stage", "Last activity", "Tags"]) {
      await expect(page.getByRole("columnheader", { name: heading })).toBeVisible();
    }
    const contoso = row(page, ...CONTOSO);
    await expect(contoso).toContainText("Alex Morgan · Northwind Talent");
    await expect(contoso).toContainText("Interviewing");
    await expect(contoso).toContainText("python");
    await expect(row(page, ...LITWARE)).toContainText("Referral");
    await expect(row(page, ...ADVENTURE)).toContainText("Direct");
  });

  test("flags what needs chasing and what has a reply to read", async ({ page }) => {
    await expect(row(page, ...LITWARE)).toContainText("needs chasing");
    await expect(row(page, "Staff Platform Engineer", "Fabrikam")).toContainText("reply to read");
    await expect(row(page, ...ADVENTURE)).not.toContainText("needs chasing");
  });

  test("counts what it lists", async ({ page }) => {
    const shown = await page.locator("tbody tr").count();
    await expect(page.locator("main").locator(".mantine-Badge-root").first()).toHaveText(String(shown));
  });
});

test.describe("searching", () => {
  const search = (page: Page) => page.getByPlaceholder("Search company, role, recruiter…");

  test("finds by company", async ({ page }) => {
    await search(page).fill("Contoso");
    await expect(row(page, ...LITWARE)).toBeHidden();
    await expect(row(page, ...CONTOSO)).toBeVisible();
  });

  test("finds by role", async ({ page }) => {
    await search(page).fill("Python Developer");
    await expect(row(page, ...CONTOSO)).toBeHidden();
    await expect(row(page, ...WIDE_WORLD)).toBeVisible();
  });

  test("finds by recruiter", async ({ page }) => {
    await search(page).fill("Sam Patel");
    await expect(row(page, ...CONTOSO)).toBeHidden();
    await expect(row(page, ...WIDE_WORLD)).toBeVisible();
  });

  test("says when nothing matches, and clearing it brings them back", async ({ page }) => {
    await search(page).fill("no such company anywhere");
    await expect(page.getByText("No applications match these filters")).toBeVisible();
    await expect(page.getByText("Try clearing a filter.")).toBeVisible();
    await search(page).clear();
    await expect(row(page, ...CONTOSO)).toBeVisible();
  });
});

test.describe("filtering", () => {
  const pick = async (page: Page, placeholder: string, option: string) => {
    await page.getByPlaceholder(placeholder).click();
    await page.getByRole("option", { name: option, exact: true }).click();
  };

  test("by stage, several at once", async ({ page }) => {
    await pick(page, "All stages", "Offer");
    await expect(row(page, ...CONTOSO)).toBeHidden();
    await expect(row(page, ...LITWARE)).toBeVisible();
    await page.getByRole("option", { name: "Interviewing", exact: true }).click();
    await expect(row(page, ...CONTOSO)).toBeVisible();
    await expect(row(page, ...LITWARE)).toBeVisible();
    await expect(row(page, ...ADVENTURE)).toBeHidden();
  });

  test("by route", async ({ page }) => {
    await pick(page, "Any route", "Referral");
    await expect(row(page, ...CONTOSO)).toBeHidden();
    await expect(row(page, ...LITWARE)).toBeVisible();
  });

  test("by the recruiter route", async ({ page }) => {
    await pick(page, "Any route", "Recruiter");
    await expect(row(page, ...LITWARE)).toBeHidden();
    await expect(row(page, ...CONTOSO)).toBeVisible();
  });

  test("by agency", async ({ page }) => {
    await pick(page, "Any agency", "Blue Yonder Recruitment");
    await expect(row(page, ...CONTOSO)).toBeHidden();
    await expect(row(page, ...WIDE_WORLD)).toBeVisible();
  });

  test("Needs chasing shows only those", async ({ page }) => {
    await page.getByLabel("Needs chasing").check({ force: true });
    await expect(row(page, ...ADVENTURE)).toBeHidden();
    await expect(row(page, ...LITWARE)).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows.filter({ hasText: "needs chasing" })).toHaveCount(await rows.count());
  });

  test("Archived shows archived ones instead of the rest", async ({ page, request }) => {
    const all = await (await request.get("/api/v1/applications")).json();
    const alpine = all.find((a: { company_name: string }) => a.company_name === "Alpine Ski House");
    await request.patch(`/api/v1/applications/${alpine.id}`, { data: { archived: true } });
    await page.reload();
    await expect(row(page, ...CONTOSO)).toBeVisible();
    await expect(row(page, "Site Reliability Engineer", "Alpine Ski House")).toBeHidden();
    await page.getByLabel("Archived").check({ force: true });
    await expect(row(page, "Site Reliability Engineer", "Alpine Ski House")).toBeVisible();
    await expect(row(page, ...CONTOSO)).toBeHidden();
    await request.patch(`/api/v1/applications/${alpine.id}`, { data: { archived: false } });
  });
});

test.describe("sorting", () => {
  test("by company", async ({ page }) => {
    const before = await companies(page);
    await page.getByRole("button", { name: "Company / role" }).click();
    await expect.poll(() => companies(page)).toEqual([...before].sort((a, b) => a.localeCompare(b)));
  });

  test("by last activity, either way", async ({ page, request }) => {
    // Days since activity, down the list. Rows with the same time can come in either order.
    const days = async () => {
      const all = await (await request.get("/api/v1/applications")).json();
      const byRole = new Map(
        all.map((a: { role_title: string; days_since_activity: number }) => [
          a.role_title,
          a.days_since_activity,
        ]),
      );
      const roles = await page.locator("tbody tr td:first-child p:nth-child(2)").allInnerTexts();
      return roles.map((role) => byRole.get(role) as number);
    };
    const ascending = (list: number[]) => [...list].sort((a, b) => a - b);
    await expect
      .poll(async () => {
        const d = await days();
        return d.join();
      })
      .toBe(ascending(await days()).join());
    await page.getByRole("button", { name: "Last activity" }).click();
    await expect
      .poll(async () => {
        const d = await days();
        return d.join();
      })
      .toBe(
        ascending(await days())
          .reverse()
          .join(),
      );
    await page.getByRole("button", { name: "Last activity" }).click();
    await expect
      .poll(async () => {
        const d = await days();
        return d.join();
      })
      .toBe(ascending(await days()).join());
  });

  test("by stage, in the workflow's order", async ({ page, request }) => {
    const workflow = await (await request.get("/api/v1/workflow")).json();
    const order: string[] = workflow.stages.map((stage: { name: string }) => stage.name.toLowerCase());
    await page.getByRole("button", { name: "Stage", exact: true }).click();
    const positions = async () => {
      const badges = await page
        .locator("tbody tr td:nth-child(3) .mantine-Badge-root:first-child")
        .allInnerTexts();
      return badges.map((badge) => order.indexOf(badge.toLowerCase()));
    };
    await expect
      .poll(async () => {
        const at = await positions();
        return at.join() === [...at].sort((a, b) => a - b).join() && at.length > 3;
      })
      .toBe(true);
  });
});

test.describe("list or board", () => {
  test("the choice is remembered", async ({ page }) => {
    await page.locator(".mantine-SegmentedControl-root").getByText("Board", { exact: true }).click();
    await expect(page.getByLabel("Applied column")).toBeVisible();
    await page.goto("/applications");
    await expect(page.getByLabel("Applied column")).toBeVisible();
    await page.locator(".mantine-SegmentedControl-root").getByText("List", { exact: true }).click();
    await expect(page.getByRole("columnheader", { name: "Route" })).toBeVisible();
    await page.goto("/applications");
    await expect(page.getByRole("columnheader", { name: "Route" })).toBeVisible();
  });
});

test.describe("the quick view", () => {
  test("opens from a row, with the application and its timeline", async ({ page }) => {
    await row(page, ...CONTOSO).click();
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: CONTOSO[0] })).toBeVisible();
    await expect(drawer.getByText("Route:")).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "At a glance" })).toBeVisible();
    await expect(drawer.getByText("Log activity")).toBeVisible();
    await expect(drawer.getByText(/^Added as /)).toBeVisible();
  });

  test("opens from the keyboard, and Escape closes it", async ({ page }) => {
    await row(page, ...CONTOSO).focus();
    await page.keyboard.press("Enter");
    const drawer = page.getByRole("dialog");
    await expect(drawer.getByRole("heading", { name: CONTOSO[0] })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
  });

  test("Open full page goes to the application", async ({ page }) => {
    await row(page, ...CONTOSO).click();
    await page.getByRole("dialog").getByRole("link", { name: "Open full page" }).click();
    await expect(page).toHaveURL(/\/applications\/[^/]+$/);
    await expect(page.getByRole("button", { name: "Save details" })).toBeVisible();
  });

  test("logging activity from it shows on its timeline", async ({ page }) => {
    await row(page, ...CONTOSO).click();
    const drawer = page.getByRole("dialog");
    await drawer.getByPlaceholder("What happened?").fill("Rang about next steps");
    await drawer.getByRole("button", { name: "Log call" }).click();
    await expect(drawer.getByText("Rang about next steps")).toBeVisible();
    await page.reload();
    await row(page, ...CONTOSO).click();
    await expect(page.getByRole("dialog").getByText("Rang about next steps")).toBeVisible();
    await expect(row(page, ...CONTOSO)).toContainText("today");
  });
});

test.describe("New application", () => {
  const open = async (page: Page) => {
    await page.getByRole("banner").getByRole("button", { name: "New application" }).click();
    return page.getByRole("dialog");
  };

  test("asks for a company and a role", async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(dialog.getByText("Which company?")).toBeVisible();
    await expect(dialog.getByText("What's the role?")).toBeVisible();
    await expect(dialog).toBeVisible();
  });

  test("refuses a link that isn't one", async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Company").fill("Trey Research");
    await dialog.getByLabel("Role", { exact: true }).fill("Tester");
    await dialog.getByLabel("Job ad link").fill("not a link");
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(dialog.getByText("Links start with http:// or https://")).toBeVisible();
  });

  test("through a recruiter, it asks for the agency or the person", async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Company").fill("Trey Research");
    await dialog.getByLabel("Role", { exact: true }).fill("Tester");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(dialog.getByText("Add the agency or recruiter")).toBeVisible();
  });

  test("says what will be added new", async ({ page }) => {
    const dialog = await open(page);
    await expect(dialog.getByText("Pick one or type a new name")).toBeVisible();
    await dialog.getByLabel("Company").fill("Brand New Ltd");
    await expect(dialog.getByText("New company: it's added for you")).toBeVisible();
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Brand New Agency");
    await expect(dialog.getByText("New agency: it's added for you")).toBeVisible();
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Morgan Smith");
    await expect(dialog.getByText("New person: they're added for you")).toBeVisible();
  });

  test("warns about the same job, without stopping you", async ({ page }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Company").fill("Contoso");
    await dialog.getByLabel("Role", { exact: true }).fill(CONTOSO[0]);
    await expect(dialog.getByText("You may have applied for this already")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Add application" })).toBeEnabled();
  });

  test("Cancel adds nothing", async ({ page, request }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Company").fill("Never Added Ltd");
    await dialog.getByLabel("Role", { exact: true }).fill("Ghost Writer");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    const all = await (await request.get("/api/v1/applications")).json();
    expect(all.map((a: { company_name: string }) => a.company_name)).not.toContain("Never Added Ltd");
  });

  test("adds one through a new agency and recruiter, creating them too", async ({ page, request }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Company").fill("Humongous Insurance");
    await dialog.getByLabel("Role", { exact: true }).fill("Platform Lead");
    await dialog.getByLabel("Job ad link").fill("https://jobs.example.com/platform-lead");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Lucerne Recruiting");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Casey Jones");
    await dialog.getByLabel("Tags").fill("insurance");
    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(page.getByText("Application added")).toBeVisible();
    await expect(page.getByText("Platform Lead at Humongous Insurance")).toBeVisible();

    const roles = await (await request.get("/api/v1/roles")).json();
    expect(roles.find((r: { title: string }) => r.title === "Platform Lead").url).toBe(
      "https://jobs.example.com/platform-lead",
    );
    const all = await (await request.get("/api/v1/applications")).json();
    const added = all.find((a: { role_title: string }) => a.role_title === "Platform Lead");
    expect(added).toMatchObject({
      company_name: "Humongous Insurance",
      route: "agency",
      agency_name: "Lucerne Recruiting",
      recruiter_name: "Casey Jones",
      tags: ["insurance"],
    });
  });

  test("adds a referral, with its applied date", async ({ page, request }) => {
    const dialog = await open(page);
    await dialog.getByLabel("Company").fill("Graphic Design Institute");
    await dialog.getByLabel("Role", { exact: true }).fill("Design Engineer");
    await dialog.getByRole("radiogroup").getByText("Referral", { exact: true }).click();
    await dialog.getByLabel("Applied on").fill("3 Mar 2026");
    await page.keyboard.press("Tab"); // Escape would close the dialog
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(page.getByText("Application added")).toBeVisible();
    const all = await (await request.get("/api/v1/applications")).json();
    const added = all.find((a: { role_title: string }) => a.role_title === "Design Engineer");
    expect(added).toMatchObject({ route: "referral", applied_on: "2026-03-03" });
  });
});

test.describe("New application, each way of naming who's involved", () => {
  // Every route, with new and existing companies, agencies and people. Each checks what was saved
  // and that nothing was created twice.
  const open = async (page: Page) => {
    await page.getByRole("banner").getByRole("button", { name: "New application" }).click();
    return page.getByRole("dialog");
  };
  const list = async <T>(request: APIRequestContext, path: string): Promise<T[]> =>
    (await request.get(`/api/v1/${path}`)).json();
  const named = async (request: APIRequestContext, path: string, name: string) =>
    (await list<{ id: string; name: string; agency_id?: string; company_id?: string }>(request, path)).filter(
      (x) => x.name.toLowerCase() === name.toLowerCase(),
    );
  const saved = async (request: APIRequestContext, role: string) =>
    (await list<{ role_title: string }>(request, "applications")).find((a) => a.role_title === role);
  const add = async (page: Page, company: string, role: string) => {
    const dialog = await open(page);
    await dialog.getByLabel("Company").fill(company);
    await dialog.getByLabel("Role", { exact: true }).fill(role);
    return dialog;
  };
  const submit = async (page: Page, dialog: Locator, role: string, company: string) => {
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(page.getByText(`${role} at ${company}`)).toBeVisible();
  };

  test("an existing company isn't added again, whatever its capitals", async ({ page, request }) => {
    const dialog = await add(page, "contoso", "Perm Existing Company");
    await expect(dialog.getByText("Pick one or type a new name")).toBeVisible();
    await submit(page, dialog, "Perm Existing Company", "Contoso");
    expect(await named(request, "companies", "Contoso")).toHaveLength(1);
  });

  test("directly, with no one named", async ({ page, request }) => {
    const dialog = await add(page, "Perm Direct Ltd", "Perm Direct");
    await submit(page, dialog, "Perm Direct", "Perm Direct Ltd");
    expect(await saved(request, "Perm Direct")).toMatchObject({
      route: "direct",
      recruiter_name: null,
      agency_name: null,
    });
    expect(await named(request, "companies", "Perm Direct Ltd")).toHaveLength(1);
  });

  test("directly, with a new in-house person, who joins the company", async ({ page, request }) => {
    const dialog = await add(page, "Perm Inhouse Ltd", "Perm Inhouse");
    await dialog.getByLabel("Who reached out? (optional)").fill("Dana Inhouse");
    await expect(dialog.getByText("New person at the company")).toBeVisible();
    await submit(page, dialog, "Perm Inhouse", "Perm Inhouse Ltd");
    expect(await saved(request, "Perm Inhouse")).toMatchObject({
      route: "direct",
      recruiter_name: "Dana Inhouse",
    });
    const people = await named(request, "contacts", "Dana Inhouse");
    const [company] = await named(request, "companies", "Perm Inhouse Ltd");
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ company_id: company?.id, agency_id: null });
  });

  test("through a new agency with no person", async ({ page, request }) => {
    const dialog = await add(page, "Perm Agency Only Ltd", "Perm Agency Only");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Perm Solo Agency");
    await submit(page, dialog, "Perm Agency Only", "Perm Agency Only Ltd");
    expect(await saved(request, "Perm Agency Only")).toMatchObject({
      route: "agency",
      agency_name: "Perm Solo Agency",
      recruiter_name: null,
    });
    expect(await named(request, "agencies", "Perm Solo Agency")).toHaveLength(1);
  });

  test("through a new recruiter with no agency", async ({ page, request }) => {
    const dialog = await add(page, "Perm Recruiter Only Ltd", "Perm Recruiter Only");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Robin Solo");
    await submit(page, dialog, "Perm Recruiter Only", "Perm Recruiter Only Ltd");
    expect(await saved(request, "Perm Recruiter Only")).toMatchObject({
      route: "agency",
      agency_name: null,
      recruiter_name: "Robin Solo",
    });
    const people = await named(request, "contacts", "Robin Solo");
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ agency_id: null });
  });

  test("through an existing agency, with a new recruiter who joins it", async ({ page, request }) => {
    const dialog = await add(page, "Perm New Recruiter Ltd", "Perm New Recruiter");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Northwind Talent");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Quinn Newhire");
    await submit(page, dialog, "Perm New Recruiter", "Perm New Recruiter Ltd");
    expect(await named(request, "agencies", "Northwind Talent")).toHaveLength(1);
    const [agency] = await named(request, "agencies", "Northwind Talent");
    const people = await named(request, "contacts", "Quinn Newhire");
    expect(people).toHaveLength(1);
    expect(people[0]).toMatchObject({ agency_id: agency?.id });
    expect(await saved(request, "Perm New Recruiter")).toMatchObject({
      agency_name: "Northwind Talent",
      recruiter_name: "Quinn Newhire",
    });
  });

  test("through an existing agency and its existing recruiter, adding neither again", async ({
    page,
    request,
  }) => {
    const dialog = await add(page, "Perm Both Exist Ltd", "Perm Both Exist");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Northwind Talent");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Alex Morgan");
    await expect(dialog.getByText("New person: they're added for you")).toBeHidden();
    await submit(page, dialog, "Perm Both Exist", "Perm Both Exist Ltd");
    expect(await named(request, "agencies", "Northwind Talent")).toHaveLength(1);
    expect(await named(request, "contacts", "Alex Morgan")).toHaveLength(1);
    expect(await saved(request, "Perm Both Exist")).toMatchObject({
      agency_name: "Northwind Talent",
      recruiter_name: "Alex Morgan",
    });
  });

  test("by referral, which doesn't keep a recruiter typed before switching", async ({ page, request }) => {
    const dialog = await add(page, "Perm Referral Ltd", "Perm Referral");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Perm Dropped Agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Dropped Person");
    await dialog.getByRole("radiogroup").getByText("Referral", { exact: true }).click();
    await submit(page, dialog, "Perm Referral", "Perm Referral Ltd");
    expect(await saved(request, "Perm Referral")).toMatchObject({
      route: "referral",
      agency_name: null,
      recruiter_name: null,
    });
    expect(await named(request, "agencies", "Perm Dropped Agency")).toHaveLength(0);
    expect(await named(request, "contacts", "Dropped Person")).toHaveLength(0);
  });

  test("what it creates shows on the other pages", async ({ page }) => {
    const dialog = await add(page, "Perm Everywhere Ltd", "Perm Everywhere");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Perm Everywhere Agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Sky Everywhere");
    await submit(page, dialog, "Perm Everywhere", "Perm Everywhere Ltd");
    await page.goto("/companies");
    await expect(page.getByLabel("Open Perm Everywhere Ltd")).toBeVisible();
    await page.goto("/recruiters");
    await expect(page.getByRole("link", { name: "Sky Everywhere" })).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Perm Everywhere Agency" }).first()).toBeVisible();
    await page.goto("/roles");
    await page.locator(".mantine-SegmentedControl-root").getByText("All", { exact: true }).click();
    await expect(page.getByRole("link", { name: "Perm Everywhere", exact: true })).toBeVisible();
  });
});

test.describe("New application, with people who already exist", () => {
  interface Named {
    id: string;
    name: string;
    agency_id?: string | null;
    company_id?: string | null;
  }
  const all = async (request: APIRequestContext, path: string): Promise<Named[]> =>
    (await request.get(`/api/v1/${path}`)).json();
  const count = async (request: APIRequestContext, path: string, name: string) =>
    (await all(request, path)).filter((x) => x.name.toLowerCase() === name.toLowerCase());
  const create = async (request: APIRequestContext, path: string, data: object): Promise<Named> => {
    const made = await request.post(`/api/v1/${path}`, { data });
    expect(made.ok()).toBe(true);
    return made.json();
  };
  const saved = async (request: APIRequestContext, role: string) =>
    ((await (await request.get("/api/v1/applications")).json()) as { role_title: string }[]).find(
      (a) => a.role_title === role,
    );
  const start = async (page: Page, company: string, role: string, through = false) => {
    await page.reload(); // so the form's lists include what the test just made through the API
    await page.getByRole("banner").getByRole("button", { name: "New application" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company").fill(company);
    await dialog.getByLabel("Role", { exact: true }).fill(role);
    if (through) await dialog.getByText("Through a recruiter").click();
    return dialog;
  };
  const submit = async (page: Page, dialog: Locator, role: string) => {
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(page.getByText("Application added")).toBeVisible();
    await expect(page.getByRole("heading", { name: role })).toBeVisible();
  };

  test("existing company, agency and recruiter: nothing is added twice", async ({ page, request }) => {
    const company = await create(request, "companies", { name: "Reuse Co" });
    const agency = await create(request, "agencies", { name: "Reuse Agency" });
    await create(request, "contacts", { name: "Reuse Person", agency_id: agency.id });
    const dialog = await start(page, "Reuse Co", "Reuse All", true);
    await dialog.getByLabel("Agency").fill("Reuse Agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Reuse Person");
    await submit(page, dialog, "Reuse All");
    expect((await count(request, "companies", "Reuse Co")).map((c) => c.id)).toEqual([company.id]);
    expect((await count(request, "agencies", "Reuse Agency")).map((a) => a.id)).toEqual([agency.id]);
    expect(await count(request, "contacts", "Reuse Person")).toHaveLength(1);
    expect(await saved(request, "Reuse All")).toMatchObject({
      agency_name: "Reuse Agency",
      recruiter_name: "Reuse Person",
    });
  });

  test("existing company with a new agency and recruiter", async ({ page, request }) => {
    await create(request, "companies", { name: "Half Co" });
    const dialog = await start(page, "Half Co", "Half New", true);
    await dialog.getByLabel("Agency").fill("Half Agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Half Person");
    await submit(page, dialog, "Half New");
    expect(await count(request, "companies", "Half Co")).toHaveLength(1);
    expect(await count(request, "agencies", "Half Agency")).toHaveLength(1);
    expect(await count(request, "contacts", "Half Person")).toHaveLength(1);
  });

  test("names in other capitals and with stray spaces aren't added twice", async ({ page, request }) => {
    await create(request, "companies", { name: "Caps Co" });
    const agency = await create(request, "agencies", { name: "Caps Agency" });
    await create(request, "contacts", { name: "Caps Person", agency_id: agency.id });
    const dialog = await start(page, "  caps co ", "Caps Test", true);
    await dialog.getByLabel("Agency").fill(" CAPS agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("caps PERSON ");
    await submit(page, dialog, "Caps Test");
    expect(await count(request, "companies", "Caps Co")).toHaveLength(1);
    expect(await count(request, "agencies", "Caps Agency")).toHaveLength(1);
    expect(await count(request, "contacts", "Caps Person")).toHaveLength(1);
  });

  test("an existing in-house person at the company is reused", async ({ page, request }) => {
    const company = await create(request, "companies", { name: "Inhouse Co" });
    await create(request, "contacts", { name: "Inhouse Person", company_id: company.id });
    const dialog = await start(page, "Inhouse Co", "Inhouse Reuse");
    await dialog.getByLabel("Who reached out? (optional)").fill("Inhouse Person");
    await expect(dialog.getByText("New person at the company")).toBeHidden();
    await submit(page, dialog, "Inhouse Reuse");
    expect(await count(request, "contacts", "Inhouse Person")).toHaveLength(1);
  });

  test("the same in-house name at another company is a new person", async ({ page, request }) => {
    const company = await create(request, "companies", { name: "First Co" });
    await create(request, "contacts", { name: "Shared Name", company_id: company.id });
    const dialog = await start(page, "Second Co", "Shared Name Role");
    await dialog.getByLabel("Who reached out? (optional)").fill("Shared Name");
    await expect(dialog.getByText("New person at the company")).toBeVisible();
    await submit(page, dialog, "Shared Name Role");
    expect(await count(request, "contacts", "Shared Name")).toHaveLength(2);
  });

  test("an existing recruiter named alone brings their agency", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Alone Agency" });
    await create(request, "contacts", { name: "Alone Person", agency_id: agency.id });
    const dialog = await start(page, "Alone Co", "Alone Test", true);
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Alone Person");
    await submit(page, dialog, "Alone Test");
    expect(await count(request, "contacts", "Alone Person")).toHaveLength(1);
    expect(await saved(request, "Alone Test")).toMatchObject({
      agency_name: "Alone Agency",
      recruiter_name: "Alone Person",
    });
  });

  // What happens today, pinned so a change is noticed: a person belongs to one agency, so the same
  // name at another agency is taken to be someone else.
  test("a recruiter's name under another agency makes a second person", async ({ page, request }) => {
    const agency = await create(request, "agencies", { name: "Home Agency" });
    await create(request, "agencies", { name: "Other Agency" });
    await create(request, "contacts", { name: "Moving Person", agency_id: agency.id });
    const dialog = await start(page, "Moving Co", "Moving Test", true);
    await dialog.getByLabel("Agency").fill("Other Agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Moving Person");
    await submit(page, dialog, "Moving Test");
    expect(await count(request, "contacts", "Moving Person")).toHaveLength(2);
    expect(await saved(request, "Moving Test")).toMatchObject({ agency_name: "Other Agency" });
  });

  test("two applications in a row reuse what the first created, without a reload", async ({
    page,
    request,
  }) => {
    let dialog = await start(page, "Row Co", "Row First", true);
    await dialog.getByLabel("Agency").fill("Row Agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Row Person");
    await submit(page, dialog, "Row First");
    await page.getByRole("banner").getByRole("button", { name: "New application" }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company").fill("Row Co");
    await dialog.getByLabel("Role", { exact: true }).fill("Row Second");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Row Agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Row Person");
    await submit(page, dialog, "Row Second");
    expect(await count(request, "companies", "Row Co")).toHaveLength(1);
    expect(await count(request, "agencies", "Row Agency")).toHaveLength(1);
    expect(await count(request, "contacts", "Row Person")).toHaveLength(1);
  });

  test("the same job again, past the warning, is a second application on one role", async ({
    page,
    request,
  }) => {
    const dialog = await start(page, "Again Co", "Again Role");
    await submit(page, dialog, "Again Role");
    const next = await start(page, "Again Co", "Again Role");
    await expect(next.getByText("You may have applied for this already")).toBeVisible();
    await submit(page, next, "Again Role");
    const apps = (await (await request.get("/api/v1/applications")).json()) as { role_title: string }[];
    expect(apps.filter((a) => a.role_title === "Again Role")).toHaveLength(2);
    const roles = (await (await request.get("/api/v1/roles")).json()) as { title: string }[];
    expect(roles.filter((r) => r.title === "Again Role")).toHaveLength(1);
  });

  test("switching to Directly drops the agency, and the person becomes in-house", async ({
    page,
    request,
  }) => {
    const dialog = await start(page, "Switch Co", "Switch Test", true);
    await dialog.getByLabel("Agency").fill("Switch Dropped Agency");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Switch Person");
    await dialog.getByRole("radiogroup").getByText("Directly", { exact: true }).click();
    await submit(page, dialog, "Switch Test");
    expect(await saved(request, "Switch Test")).toMatchObject({ route: "direct", agency_name: null });
    expect(await count(request, "agencies", "Switch Dropped Agency")).toHaveLength(0);
    const [company] = await count(request, "companies", "Switch Co");
    expect((await count(request, "contacts", "Switch Person"))[0]).toMatchObject({
      company_id: company?.id,
      agency_id: null,
    });
  });

  test("picking from the lists works, and recruiters narrow to the agency", async ({ page, request }) => {
    const chosen = await create(request, "agencies", { name: "Pick Agency" });
    const other = await create(request, "agencies", { name: "Unpicked Agency" });
    await create(request, "contacts", { name: "Pick Person", agency_id: chosen.id });
    await create(request, "contacts", { name: "Unpicked Person", agency_id: other.id });
    await create(request, "companies", { name: "Pick Co" });
    await page.reload();
    await page.getByRole("banner").getByRole("button", { name: "New application" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company").click();
    await page.getByRole("option", { name: "Pick Co", exact: true }).click();
    await dialog.getByLabel("Role", { exact: true }).fill("Pick Test");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").click();
    await page.getByRole("option", { name: "Pick Agency", exact: true }).click();
    await dialog.getByLabel("Recruiter", { exact: true }).click();
    await expect(page.getByRole("option", { name: "Unpicked Person", exact: true })).toBeHidden();
    await page.getByRole("option", { name: "Pick Person", exact: true }).click();
    await submit(page, dialog, "Pick Test");
    expect(await saved(request, "Pick Test")).toMatchObject({
      company_name: "Pick Co",
      agency_name: "Pick Agency",
      recruiter_name: "Pick Person",
    });
  });

  test("the stage you pick is the one it starts at", async ({ page, request }) => {
    const dialog = await start(page, "Stage Co", "Stage Test");
    await dialog.getByLabel("Stage", { exact: true }).click();
    await page.getByRole("option", { name: "Applied", exact: true }).click();
    await submit(page, dialog, "Stage Test");
    expect(await saved(request, "Stage Test")).toMatchObject({ stage: "applied" });
  });

  test("a failed save keeps what you typed, and trying again adds one", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/applications\/quick/);
    const dialog = await start(page, "Retry Co", "Retry Test");
    await page.route("**/api/v1/applications/quick", (route) =>
      route.fulfill({ status: 500, json: { detail: "Server says no" } }),
    );
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(page.getByText("That didn't work")).toBeVisible();
    await expect(dialog.getByLabel("Company")).toHaveValue("Retry Co");
    await page.unroute("**/api/v1/applications/quick");
    await submit(page, dialog, "Retry Test");
    const apps = (await (await request.get("/api/v1/applications")).json()) as { role_title: string }[];
    expect(apps.filter((a) => a.role_title === "Retry Test")).toHaveLength(1);
  });

  test("double-clicking Add adds one", async ({ page, request }) => {
    const dialog = await start(page, "Double Co", "Double Test");
    await dialog.getByRole("button", { name: "Add application" }).dblclick();
    await expect(page.getByText("Application added").first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "Double Test" })).toBeVisible();
    const apps = (await (await request.get("/api/v1/applications")).json()) as { role_title: string }[];
    expect(apps.filter((a) => a.role_title === "Double Test")).toHaveLength(1);
  });
});

test.describe("after adding one, moving around without reloading", () => {
  const menu = (page: Page, name: string) =>
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true });
  const addHere = async (page: Page, company: string, role: string) => {
    await page.getByRole("banner").getByRole("button", { name: "New application" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Company").fill(company);
    await dialog.getByLabel("Role", { exact: true }).fill(role);
    await dialog.getByRole("button", { name: "Add application" }).click();
    await expect(page.getByRole("heading", { name: role })).toBeVisible();
  };

  test("it's in the list", async ({ page }) => {
    await addHere(page, "Fresh List Ltd", "Fresh List");
    await menu(page, "Applications").click();
    await expect(row(page, "Fresh List", "Fresh List Ltd")).toBeVisible();
  });

  test("Today's numbers go up", async ({ page }) => {
    await menu(page, "Today").click();
    const active = page.getByText(/^\d+ active$/);
    await expect(active).toBeVisible();
    const before = Number.parseInt(await active.innerText(), 10);
    await addHere(page, "Fresh Today Ltd", "Fresh Today");
    await menu(page, "Today").click();
    await expect(page.getByText(`${before + 1} active`)).toBeVisible();
  });

  test("the company's page lists it", async ({ page }) => {
    await menu(page, "Companies").click();
    await page.getByLabel("Open Litware").click();
    await expect(page.getByRole("heading", { name: "Litware" }).first()).toBeVisible();
    await addHere(page, "Litware", "Fresh Company Role");
    await page.getByRole("link", { name: "Litware" }).first().click();
    await expect(page.getByText("Fresh Company Role").first()).toBeVisible();
  });

  test("the Timeline shows it", async ({ page }) => {
    await menu(page, "Timeline").click();
    await expect(page.getByRole("heading", { name: "Timeline", level: 2 })).toBeVisible();
    await addHere(page, "Fresh Timeline Ltd", "Fresh Timeline");
    await menu(page, "Timeline").click();
    await expect(page.getByText(/Fresh Timeline/).first()).toBeVisible();
  });
});

test.describe("with no applications", () => {
  test("invites you to add the first", async ({ page }) => {
    await page.route("**/api/v1/applications?*", (route) => route.fulfill({ json: [] }));
    await page.route("**/api/v1/applications", (route) => route.fulfill({ json: [] }));
    await page.goto("/applications?view=list");
    await expect(page.getByText("No applications yet")).toBeVisible();
    await expect(page.getByText("Add the first one: company, role and how you applied.")).toBeVisible();
    await page.getByRole("main").getByRole("button", { name: "New application" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});
