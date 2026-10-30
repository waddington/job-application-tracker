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

  test("by stage, in the workflow's order", async ({ page }) => {
    await page.getByRole("button", { name: "Stage", exact: true }).click();
    await expect.poll(async () => (await companies(page)).at(0)).toBe("Northwind Traders"); // Interested
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
    (await list<{ name: string }>(request, path)).filter((x) => x.name.toLowerCase() === name.toLowerCase());
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
    const [person] = await named(request, "contacts", "Dana Inhouse");
    const [company] = await named(request, "companies", "Perm Inhouse Ltd");
    expect(person).toMatchObject({ company_id: (company as unknown as { id: string }).id, agency_id: null });
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
    expect((await named(request, "contacts", "Robin Solo"))[0]).toMatchObject({ agency_id: null });
  });

  test("through an existing agency, with a new recruiter who joins it", async ({ page, request }) => {
    const dialog = await add(page, "Perm New Recruiter Ltd", "Perm New Recruiter");
    await dialog.getByText("Through a recruiter").click();
    await dialog.getByLabel("Agency").fill("Northwind Talent");
    await dialog.getByLabel("Recruiter", { exact: true }).fill("Quinn Newhire");
    await submit(page, dialog, "Perm New Recruiter", "Perm New Recruiter Ltd");
    expect(await named(request, "agencies", "Northwind Talent")).toHaveLength(1);
    const [agency] = await named(request, "agencies", "Northwind Talent");
    expect((await named(request, "contacts", "Quinn Newhire"))[0]).toMatchObject({
      agency_id: (agency as unknown as { id: string }).id,
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
    await expect(page.getByRole("link", { name: "Sky Everywhere" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Perm Everywhere Agency" }).first()).toBeVisible();
    await page.goto("/roles");
    await page.locator(".mantine-SegmentedControl-root").getByText("All", { exact: true }).click();
    await expect(page.getByRole("link", { name: "Perm Everywhere", exact: true })).toBeVisible();
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
