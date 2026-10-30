import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Offers: adding, revising, editing and deleting them on an application, permanent, contract and
// fixed term, then comparing them. Each test makes its own application. The Offers page shows
// every test's offers, so its checks look at one company's column.

interface Offer {
  id: string;
  status: string;
  employment_type: string | null;
  currency: string | null;
  salary: number | null;
  bonus: number | null;
  equity: string | null;
  equity_value: number | null;
  pension_percent: number | null;
  holiday_days: number | null;
  day_rate: number | null;
  ir35: string | null;
  contract_months: number | null;
  benefits: string | null;
  notes: string | null;
  annual_value: number | null;
  received_on: string | null;
  respond_by: string | null;
}

const API = "/api/v1";
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const application = (request: APIRequestContext, company: string, role = "Offered Role") =>
  post<{ id: string; role_id?: string }>(request, "applications/quick", {
    company_name: company,
    role_title: role,
    route: "direct",
    tags: [],
  });
const addOffer = (request: APIRequestContext, applicationId: string, data: object) =>
  post<Offer>(request, `applications/${applicationId}/offers`, { currency: "GBP", ...data });
const offersOf = async (request: APIRequestContext, applicationId: string) =>
  (await (await request.get(`${API}/offers?application_id=${applicationId}&latest=false`)).json()) as Offer[];
const dayFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toLocaleDateString("en-CA"); // YYYY-MM-DD, local

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
const theDialog = (page: Page) => page.locator(".mantine-Modal-content");
const watchWrites = (page: Page) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return writes;
};
const menu = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true });
const card = (page: Page) =>
  page
    .locator(".mantine-Card-root")
    .filter({ has: page.getByRole("heading", { name: "Offer", exact: true }) })
    .first();
const openApplication = async (page: Page, id: string) => {
  await page.goto(`/applications/${id}`);
  await expect(card(page).getByRole("button", { name: /^Add (a revised )?offer$/ })).toBeVisible();
};
const newOffer = async (page: Page) => {
  await card(page)
    .getByRole("button", { name: /^Add (a revised )?offer$/ })
    .click();
  const dialog = theDialog(page);
  await expect(dialog.getByText("Add an offer")).toBeVisible();
  return dialog;
};
const submit = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Add offer", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const saveEdit = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Save offer", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const kind = (dialog: Locator, name: "Permanent" | "Contract" | "Fixed term") =>
  dialog.getByText(name, { exact: true }).click();
const pick = async (page: Page, dialog: Locator, label: string, option: string) => {
  await dialog.getByLabel(label, { exact: true }).first().click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const openOffers = async (page: Page) => {
  await page.goto("/offers");
  await expect(page.getByRole("rowheader", { name: "Worth a year" })).toBeVisible();
};
/** One row's cell in one company's column on the Offers page. */
const cellOf = async (page: Page, company: string, row: string) => {
  const headers = page.getByRole("columnheader");
  await expect(headers.filter({ hasText: company })).toHaveCount(1);
  const names = await headers.allInnerTexts();
  const index = names.findIndex((name) => name.includes(company));
  // The first column of a row is its row header, so the rest count from one less.
  return page
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: row, exact: true }) })
    .getByRole("cell")
    .nth(index - 1);
};

const cellHas = (page: Page, company: string, row: string, text: string) =>
  expect(async () => {
    await expect(await cellOf(page, company, row)).toContainText(text, { timeout: 1_000 });
  }).toPass();

test.describe("adding an offer", () => {
  test("permanent: the whole package, kept after a reload, and worked out", async ({ page, request }) => {
    const app = await application(request, "Package Co");
    await openApplication(page, app.id);
    await expect(page.getByText("No offer yet.")).toBeVisible();
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("100000");
    await dialog.getByLabel("Bonus (expected, a year)").fill("10000");
    await dialog.getByLabel("Employer pension (%)").fill("6");
    await dialog.getByLabel("Equity", { exact: true }).fill("0.1% over 4 years");
    await dialog.getByLabel("Equity worth (a year)").fill("5000");
    await dialog.getByLabel("Holiday (days)").fill("28");
    await dialog.getByLabel("Benefits").fill("Private health");
    await dialog.getByLabel("Notes").fill("Good team");
    await submit(dialog);
    await expect(card(page).getByText("Worth about £121,000 a year in total")).toBeVisible();
    await expect(card(page).getByText("Deciding")).toBeVisible();
    await expect(
      card(page).getByText(/Bonus £10,000 · Pension 6% · Equity: 0\.1% over 4 years · 28 days/),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Add a revised offer" })).toBeVisible();
    await page.reload();
    await expect(card(page).getByText("Worth about £121,000 a year in total")).toBeVisible();
    expect((await offersOf(request, app.id))[0]).toMatchObject({
      status: "pending",
      employment_type: "permanent",
      currency: "GBP",
      salary: 100000,
      annual_value: 121000,
      benefits: "Private health",
      notes: "Good team",
      received_on: dayFromNow(0),
    });
  });

  test("contract: a day rate, IR35 and a length, and no salary fields", async ({ page, request }) => {
    const app = await application(request, "Contract Offer Co");
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await kind(dialog, "Contract");
    await expect(dialog.getByLabel("Base salary")).toBeHidden();
    await dialog.getByLabel("Day rate").fill("600");
    await pick(page, dialog, "IR35", "Outside");
    await dialog.getByLabel("Length (months)").fill("6");
    await submit(dialog);
    await expect(card(page).getByText("About £132,000 a year at 220 working days")).toBeVisible();
    await expect(card(page).getByText(/IR35 outside · 6 months/)).toBeVisible();
    expect((await offersOf(request, app.id))[0]).toMatchObject({
      employment_type: "contract",
      day_rate: 600,
      ir35: "outside",
      contract_months: 6,
      salary: null,
    });
  });

  test("fixed term: a salary package with a length", async ({ page, request }) => {
    const app = await application(request, "Fixed Term Co");
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await expect(dialog.getByLabel("Length (months)")).toBeHidden();
    await kind(dialog, "Fixed term");
    await dialog.getByLabel("Base salary").fill("70000");
    await dialog.getByLabel("Length (months)").fill("12");
    await submit(dialog);
    await expect(card(page).getByText("Worth about £70,000 a year in total")).toBeVisible();
    expect((await offersOf(request, app.id))[0]).toMatchObject({
      employment_type: "fixed_term",
      salary: 70000,
      contract_months: 12,
      day_rate: null,
    });
  });

  test("starts as the kind of job the role is", async ({ page, request }) => {
    const company = await post<{ id: string }>(request, "companies", { name: "Role Kind Co" });
    await post(request, "roles", { company_id: company.id, title: "Kind Role", employment_type: "contract" });
    const app = await application(request, "Role Kind Co", "Kind Role");
    const roles = page.waitForResponse((r) => new URL(r.url()).pathname === `${API}/roles`);
    await openApplication(page, app.id);
    await roles;
    await pause(100);
    const dialog = await newOffer(page);
    await expect(dialog.getByLabel("Day rate")).toBeVisible();
    await expect(dialog.getByLabel("Base salary")).toBeHidden();
  });

  test("what's typed for another kind isn't saved", async ({ page, request }) => {
    const app = await application(request, "Switched Kind Co");
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("90000");
    await dialog.getByLabel("Bonus (expected, a year)").fill("9000");
    await kind(dialog, "Contract");
    await dialog.getByLabel("Day rate").fill("500");
    await submit(dialog);
    expect((await offersOf(request, app.id))[0]).toMatchObject({ salary: null, bonus: null, day_rate: 500 });
  });

  test("a currency: three letters, saved in capitals, shown in full if it has no symbol", async ({
    page,
    request,
  }) => {
    const app = await application(request, "Currency Co");
    await openApplication(page, app.id);
    const writes = watchWrites(page);
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("80000");
    await dialog.getByLabel("Currency").fill("GB");
    await dialog.getByRole("button", { name: "Add offer", exact: true }).click();
    await expect(dialog.getByText("Three letters, like GBP")).toBeVisible();
    expect(writes).toEqual([]);
    await dialog.getByLabel("Currency").fill("chf");
    await submit(dialog);
    expect((await offersOf(request, app.id))[0]?.currency).toBe("CHF");
    await expect(card(page).getByText("80,000 CHF a year").first()).toBeVisible();
  });

  test("with no currency it still shows", async ({ page, request }) => {
    const app = await application(request, "No Currency Co");
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("80000");
    await dialog.getByLabel("Currency").fill("");
    await submit(dialog);
    expect((await offersOf(request, app.id))[0]?.currency).toBeNull();
    await expect(
      card(page)
        .getByText(/^80,000 +a year$/)
        .first(),
    ).toBeVisible();
    await expect(card(page).getByText(/undefined|null|NaN/)).toBeHidden();
  });

  test("with no figures at all it still shows", async ({ page, request }) => {
    const app = await application(request, "No Figures Co");
    await openApplication(page, app.id);
    await submit(await newOffer(page));
    await expect(card(page).getByText("Deciding")).toBeVisible();
    await expect(card(page).getByText(/Worth about/)).toBeHidden();
    await expect(card(page).getByText(/undefined|null|NaN/)).toBeHidden();
    await page.goto("/offers");
    const worth = await cellOf(page, "No Figures Co", "Worth a year");
    await expect(worth).not.toContainText(/undefined|null|NaN/);
  });

  test("a salary with pence gets a clear answer, and what you typed stays", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/422.*\/offers/);
    const app = await application(request, "Pence Co");
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("80000.50");
    await dialog.getByRole("button", { name: "Add offer", exact: true }).click();
    await expect(page.getByText("That didn't work").first()).toBeVisible();
    await expect(dialog.getByLabel("Base salary")).toHaveValue("80,000.5");
    expect(await offersOf(request, app.id)).toHaveLength(0);
  });

  test("Cancel and Escape add nothing, and the next one starts empty", async ({ page, request }) => {
    const app = await application(request, "No Offer Co");
    await openApplication(page, app.id);
    const writes = watchWrites(page);
    let dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("1000");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    dialog = await newOffer(page);
    await expect(dialog.getByLabel("Base salary")).toHaveValue("");
    await dialog.getByLabel("Base salary").fill("2000");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
    await expect(page.getByText("No offer yet.")).toBeVisible();
  });

  test("a double click on a slow save adds one", async ({ page, request }) => {
    const app = await application(request, "Double Offer Co");
    await page.route(`**${API}/applications/${app.id}/offers`, async (route) => {
      if (route.request().method() === "POST") await pause(800);
      await route.continue();
    });
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    const writes = watchWrites(page);
    await pause(300); // the dialog has stopped moving
    const box = await dialog.getByRole("button", { name: "Add offer", exact: true }).boundingBox();
    const [x, y] = [(box?.x ?? 0) + (box?.width ?? 0) / 2, (box?.y ?? 0) + (box?.height ?? 0) / 2];
    await page.mouse.click(x, y);
    await pause(60);
    await page.mouse.click(x, y);
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("button", { name: "Add a revised offer" })).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(await offersOf(request, app.id)).toHaveLength(1);
  });
});

test.describe("revising and editing", () => {
  test("a revised offer goes on top, and the old one is marked earlier", async ({ page, request }) => {
    const app = await application(request, "Revised Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("90000");
    await submit(dialog);
    const inner = card(page).locator(".mantine-Card-root");
    await expect(inner).toHaveCount(2);
    await expect(inner.nth(0)).toContainText("£90,000");
    await expect(inner.nth(0)).not.toContainText("Earlier offer");
    await expect(inner.nth(1)).toContainText("£80,000");
    await expect(inner.nth(1)).toContainText("Earlier offer");
    await openOffers(page);
    await cellHas(page, "Revised Co", "Pay", "£90,000");
  });

  test("editing changes what was changed and keeps the rest, on every page", async ({ page, request }) => {
    const app = await application(request, "Edited Offer Co");
    await addOffer(request, app.id, {
      employment_type: "permanent",
      salary: 80000,
      bonus: 8000,
      benefits: "Kept benefits",
      received_on: dayFromNow(-2),
      respond_by: dayFromNow(5),
    });
    await openOffers(page);
    await page.getByRole("link", { name: "Edited Offer Co" }).click();
    await expect(
      card(page)
        .getByText(/£80,000/)
        .first(),
    ).toBeVisible();
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    const dialog = theDialog(page);
    await expect(dialog.getByLabel("Base salary")).toHaveValue("80,000");
    await dialog.getByLabel("Base salary").fill("85000");
    await saveEdit(dialog);
    await expect(
      card(page)
        .getByText(/£85,000/)
        .first(),
    ).toBeVisible();
    expect((await offersOf(request, app.id))[0]).toMatchObject({
      salary: 85000,
      bonus: 8000,
      benefits: "Kept benefits",
      received_on: dayFromNow(-2),
      respond_by: dayFromNow(5),
    });
    await menu(page, "Offers").click();
    await cellHas(page, "Edited Offer Co", "Pay", "£85,000");
  });

  test("Cancel sends nothing, and it reopens as saved", async ({ page, request }) => {
    const app = await application(request, "Steady Offer Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
    await openApplication(page, app.id);
    const writes = watchWrites(page);
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    const dialog = theDialog(page);
    await dialog.getByLabel("Base salary").fill("1");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    await expect(dialog.getByLabel("Base salary")).toHaveValue("80,000");
    expect(writes).toEqual([]);
  });

  test("permanent to contract: the salary goes, and so does the worth", async ({ page, request }) => {
    const app = await application(request, "Changed Kind Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 80000, pension_percent: 5 });
    await openApplication(page, app.id);
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    const dialog = theDialog(page);
    await kind(dialog, "Contract");
    await dialog.getByLabel("Day rate").fill("700");
    await saveEdit(dialog);
    await expect(card(page).getByText("About £154,000 a year at 220 working days")).toBeVisible();
    expect((await offersOf(request, app.id))[0]).toMatchObject({
      salary: null,
      pension_percent: null,
      day_rate: 700,
      annual_value: 154000,
    });
  });

  test("emptying a figure clears it", async ({ page, request }) => {
    const app = await application(request, "Cleared Figure Co");
    await addOffer(request, app.id, {
      employment_type: "permanent",
      salary: 80000,
      bonus: 8000,
      holiday_days: 25,
    });
    await openApplication(page, app.id);
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    const dialog = theDialog(page);
    await dialog.getByLabel("Bonus (expected, a year)").fill("");
    await dialog.getByLabel("Holiday (days)").fill("");
    await saveEdit(dialog);
    await expect(card(page).getByText("Worth about £80,000 a year in total")).toBeVisible();
    await expect(card(page).getByText(/Bonus/)).toBeHidden();
    expect((await offersOf(request, app.id))[0]).toMatchObject({ bonus: null, holiday_days: null });
  });

  test("the status shows, and the reply date only while deciding", async ({ page, request }) => {
    const app = await application(request, "Status Offer Co");
    await addOffer(request, app.id, {
      employment_type: "permanent",
      salary: 80000,
      respond_by: dayFromNow(5),
    });
    await openApplication(page, app.id);
    await expect(card(page).getByText(/^Reply by /)).toBeVisible();
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    const dialog = theDialog(page);
    await pick(page, dialog, "Status", "Accepted");
    await saveEdit(dialog);
    await expect(card(page).getByText("Accepted")).toBeVisible();
    await expect(card(page).getByText(/^Reply by /)).toBeHidden();
    expect((await offersOf(request, app.id))[0]?.status).toBe("accepted");
  });

  test("a status change and a new offer go on the timeline", async ({ page, request }) => {
    const app = await application(request, "Timeline Offer Co");
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("80000");
    await submit(dialog);
    await expect(page.getByText("Offer received: £80,000 a year").first()).toBeVisible();
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    await pick(page, theDialog(page), "Status", "Declined");
    await saveEdit(theDialog(page));
    await expect(page.getByText("Offer declined: £80,000 a year").first()).toBeVisible();
  });

  test("deleted meanwhile: it says so, and the dialog stays", async ({ page, request, problems }) => {
    problems.allow(/404.*\/api\/v1\/offers/);
    const app = await application(request, "Gone Offer Co");
    const made = await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
    await openApplication(page, app.id);
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    const dialog = theDialog(page);
    await expect(dialog.getByText("Edit offer")).toBeVisible();
    await request.delete(`${API}/offers/${made.id}`);
    await dialog.getByRole("button", { name: "Save offer" }).click();
    await expect(page.getByText("That didn't work").first()).toBeVisible();
    await expect(dialog.getByLabel("Base salary")).toHaveValue("80,000");
  });
});

test.describe("deleting", () => {
  test("saying no keeps it", async ({ page, request }) => {
    const app = await application(request, "Kept Offer Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
    await openApplication(page, app.id);
    const writes = watchWrites(page);
    let asked = "";
    page.once("dialog", (d) => {
      asked = d.message();
      void d.dismiss();
    });
    await card(page).getByRole("button", { name: "Delete offer" }).click();
    await expect.poll(() => asked).toBe("Delete this offer?");
    await pause(200);
    expect(writes).toEqual([]);
    await expect(
      card(page)
        .getByText(/£80,000/)
        .first(),
    ).toBeVisible();
  });

  test("deleting the revised one brings the earlier one back on top", async ({ page, request }) => {
    const app = await application(request, "Back On Top Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
    await pause(10);
    await addOffer(request, app.id, { employment_type: "permanent", salary: 90000 });
    await openApplication(page, app.id);
    const inner = card(page).locator(".mantine-Card-root");
    await expect(inner).toHaveCount(2);
    page.once("dialog", (d) => void d.accept());
    await card(page).getByRole("button", { name: "Delete offer" }).first().click();
    await expect(inner).toHaveCount(1);
    await expect(inner.first()).toContainText("£80,000");
    await expect(inner.first()).not.toContainText("Earlier offer");
    await menu(page, "Offers").click();
    await cellHas(page, "Back On Top Co", "Pay", "£80,000");
  });

  test("deleting the last one leaves the application offerless, and off Offers", async ({
    page,
    request,
  }) => {
    const app = await application(request, "Last Offer Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
    await openOffers(page);
    await page.getByRole("link", { name: "Last Offer Co" }).click();
    page.once("dialog", (d) => void d.accept());
    await card(page).getByRole("button", { name: "Delete offer" }).click();
    await expect(page.getByText("No offer yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Add offer", exact: true })).toBeVisible();
    await menu(page, "Offers").click();
    await expect(page.getByRole("rowheader", { name: "Worth a year" })).toBeVisible();
    await expect(page.getByRole("columnheader").filter({ hasText: "Last Offer Co" })).toHaveCount(0);
  });

  test("deleting the application takes its offers", async ({ page, request }) => {
    const app = await application(request, "Whole Offer Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
    await request.delete(`${API}/applications/${app.id}`);
    await openOffers(page);
    await expect(page.getByRole("columnheader").filter({ hasText: "Whole Offer Co" })).toHaveCount(0);
  });
});

test.describe("comparing", () => {
  test("every row shows what's set, and a dash for what isn't", async ({ page, request }) => {
    const full = await application(request, "Compare Full Co");
    await addOffer(request, full.id, {
      employment_type: "permanent",
      salary: 100000,
      bonus: 10000,
      pension_percent: 6,
      equity: "Options",
      equity_value: 5000,
      holiday_days: 28,
      benefits: "Dental",
      notes: "Near home",
    });
    const day = await application(request, "Compare Day Co");
    await addOffer(request, day.id, {
      employment_type: "contract",
      day_rate: 600,
      ir35: "inside",
      contract_months: 6,
    });
    await openOffers(page);
    const expected: [string, string, string][] = [
      ["Worth a year", "£121,000", "£132,000"],
      ["Status", "Deciding", "Deciding"],
      ["Bonus", "£10,000", "—"],
      ["Employer pension", "6%", "—"],
      ["Equity", "Options", "—"],
      ["Holiday", "28 days", "—"],
      ["IR35", "—", "inside"],
      ["Length", "—", "6 months"],
      ["Benefits", "Dental", "—"],
      ["Notes", "Near home", "—"],
    ];
    for (const [row, fullValue, dayValue] of expected) {
      await cellHas(page, "Compare Full Co", row, fullValue);
      await cellHas(page, "Compare Day Co", row, dayValue);
    }
  });

  test("Highest goes to the most in the main currency, not a bigger number in another", async ({
    page,
    request,
  }) => {
    const pounds = await application(request, "Highest Pounds Co");
    await addOffer(request, pounds.id, { employment_type: "permanent", salary: 5_000_000 });
    const yen = await application(request, "Highest Yen Co");
    await addOffer(request, yen.id, { employment_type: "permanent", currency: "JPY", salary: 90_000_000 });
    await openOffers(page);
    const worth = (company: string) => cellOf(page, company, "Worth a year");
    await expect(await worth("Highest Pounds Co")).toContainText("Highest");
    await expect(await worth("Highest Yen Co")).not.toContainText("Highest");
  });

  test("declined and withdrawn hide until asked for; accepted stays", async ({ page, request }) => {
    const declined = await application(request, "Declined Offer Co");
    await addOffer(request, declined.id, { status: "declined", employment_type: "permanent", salary: 1000 });
    const withdrawn = await application(request, "Withdrawn Offer Co");
    await addOffer(request, withdrawn.id, {
      status: "withdrawn",
      employment_type: "permanent",
      salary: 1000,
    });
    const accepted = await application(request, "Accepted Offer Co");
    await addOffer(request, accepted.id, { status: "accepted", employment_type: "permanent", salary: 1000 });
    await openOffers(page);
    const column = (name: string) => page.getByRole("columnheader").filter({ hasText: name });
    await expect(column("Accepted Offer Co")).toHaveCount(1);
    await expect(column("Declined Offer Co")).toHaveCount(0);
    await expect(column("Withdrawn Offer Co")).toHaveCount(0);
    await page.getByLabel("Show declined and withdrawn").check({ force: true });
    await expect(column("Declined Offer Co")).toHaveCount(1);
    await expect(column("Withdrawn Offer Co")).toHaveCount(1);
  });

  test("a revised offer replaces the old one, even when the old one was declined", async ({
    page,
    request,
  }) => {
    const app = await application(request, "Second Try Co");
    await addOffer(request, app.id, { status: "declined", employment_type: "permanent", salary: 1000 });
    await pause(10);
    await addOffer(request, app.id, { employment_type: "permanent", salary: 2000 });
    await openOffers(page);
    await cellHas(page, "Second Try Co", "Pay", "£2,000");
  });

  test("a company's new name shows here without a reload", async ({ page, request }) => {
    const app = await application(request, "Offer Before Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 1000 });
    await openOffers(page);
    await expect(page.getByRole("link", { name: "Offer Before Co" })).toBeVisible();
    await page.getByRole("link", { name: "Offer Before Co" }).click();
    await page.getByRole("link", { name: "Offer Before Co" }).first().click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await theDialog(page).getByLabel("Name").fill("Offer After Co");
    await theDialog(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Offer After Co", level: 2 })).toBeVisible();
    await menu(page, "Offers").click();
    await expect(page.getByRole("link", { name: "Offer After Co" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Offer Before Co" })).toHaveCount(0);
  });
});

test.describe("more permutations", () => {
  test("contract to fixed term keeps the length; fixed term to permanent drops it", async ({
    page,
    request,
  }) => {
    const app = await application(request, "Length Co");
    await addOffer(request, app.id, { employment_type: "contract", day_rate: 500, contract_months: 6 });
    await openApplication(page, app.id);
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    const dialog = theDialog(page);
    await kind(dialog, "Fixed term");
    await dialog.getByLabel("Base salary").fill("60000");
    await saveEdit(dialog);
    await expect(card(page).getByText(/6 months/)).toBeVisible();
    expect((await offersOf(request, app.id))[0]).toMatchObject({
      contract_months: 6,
      day_rate: null,
      salary: 60000,
    });
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    await kind(dialog, "Permanent");
    await saveEdit(dialog);
    await expect(card(page).getByText(/6 months/)).toBeHidden();
    expect((await offersOf(request, app.id))[0]?.contract_months).toBeNull();
  });

  test("dates typed in the form are saved, and show", async ({ page, request }) => {
    const app = await application(request, "Dated Offer Co");
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("60000");
    await dialog.getByLabel("Reply by").fill("4 February 2030");
    await page.keyboard.press("Tab");
    await dialog.getByLabel("Start date").fill("1 March 2030");
    await page.keyboard.press("Tab");
    await dialog.getByLabel("Received").fill("");
    await page.keyboard.press("Tab");
    await dialog.getByText("Add an offer").click(); // the calendar covers the buttons
    await submit(dialog);
    await expect(card(page).getByText(/Starts 1 Mar 2030/)).toBeVisible();
    await expect(card(page).getByText("Reply by 4 Feb 2030")).toBeVisible();
    expect((await offersOf(request, app.id))[0]).toMatchObject({
      respond_by: "2030-02-04",
      start_on: "2030-03-01",
      received_on: null,
    });
  });

  // KNOWN BUG (fix-contract-no-rate-hides-ir35 on the roadmap): expected to fail until it is fixed.
  test.fail("a contract with no day rate yet still shows its IR35", async ({ page, request }) => {
    const app = await application(request, "No Rate Co");
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await kind(dialog, "Contract");
    await pick(page, dialog, "IR35", "Outside");
    await dialog.getByLabel("Length (months)").fill("6");
    await submit(dialog);
    await expect(card(page).getByText(/IR35 outside/)).toBeVisible();
  });

  // KNOWN BUG (fix-offer-no-kind-loses-rate on the roadmap): expected to fail until it is fixed.
  test.fail(
    "an offer with a day rate and no kind keeps its rate through a save",
    async ({ page, request }) => {
      const app = await application(request, "No Kind Co");
      await addOffer(request, app.id, { day_rate: 600 });
      await openApplication(page, app.id);
      await card(page).getByRole("button", { name: "Edit offer" }).click();
      await saveEdit(theDialog(page));
      expect((await offersOf(request, app.id))[0]?.day_rate).toBe(600);
    },
  );

  // KNOWN BUG (fix-stale-edit-after-save on the roadmap): expected to fail until it is fixed.
  test.fail("reopening straight after saving shows the new figure", async ({ page, request }) => {
    const app = await application(request, "Reopen Offer Co");
    await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
    await openApplication(page, app.id);
    await page.route(`**${API}/offers?*`, async (route) => {
      await pause(1000);
      await route.continue();
    });
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    const dialog = theDialog(page);
    await dialog.getByLabel("Base salary").fill("85000");
    await saveEdit(dialog);
    await card(page).getByRole("button", { name: "Edit offer" }).click();
    await expect(dialog.getByLabel("Base salary")).toHaveValue("85,000");
  });

  test("Enter pressed twice on a slow save adds one", async ({ page, request }) => {
    const app = await application(request, "Enter Offer Co");
    await page.route(`**${API}/applications/${app.id}/offers`, async (route) => {
      if (route.request().method() === "POST") await pause(800);
      await route.continue();
    });
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await dialog.getByLabel("Base salary").fill("70000");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await pause(1000);
    expect(await offersOf(request, app.id)).toHaveLength(1);
  });

  // KNOWN BUG (fix-offer-kind-before-roles on the roadmap): expected to fail until it is fixed.
  test.fail("the offer's kind is right even if roles are slow to load", async ({ page, request }) => {
    const company = await post<{ id: string }>(request, "companies", { name: "Slow Roles Co" });
    await post(request, "roles", {
      company_id: company.id,
      title: "Slow Kind Role",
      employment_type: "contract",
    });
    const app = await application(request, "Slow Roles Co", "Slow Kind Role");
    await page.route(`**${API}/roles`, async (route) => {
      await pause(1500);
      await route.continue();
    });
    await openApplication(page, app.id);
    const dialog = await newOffer(page);
    await expect(dialog.getByLabel("Day rate")).toBeVisible({ timeout: 3_000 });
  });

  // KNOWN BUG (fix-offer-loading-says-none on the roadmap): expected to fail until it is fixed.
  test.fail(
    "an application with an offer never says it has none while loading",
    async ({ page, request }) => {
      const app = await application(request, "Loading Offer Co");
      await addOffer(request, app.id, { employment_type: "permanent", salary: 80000 });
      await page.route(`**${API}/offers?*`, async (route) => {
        await pause(1000);
        await route.continue();
      });
      await page.goto(`/applications/${app.id}`);
      await expect(card(page).getByRole("button", { name: /^Add/ })).toBeVisible();
      await expect(page.getByText("No offer yet.")).toBeHidden({ timeout: 200 });
    },
  );

  // KNOWN BUG (fix-offer-plurals on the roadmap): expected to fail until it is fixed.
  test.fail("one of something isn't plural", async ({ page, request }) => {
    const app = await application(request, "Singular Co");
    await addOffer(request, app.id, {
      employment_type: "fixed_term",
      salary: 60000,
      contract_months: 1,
      holiday_days: 1,
    });
    await openApplication(page, app.id);
    await expect(card(page).getByText(/1 day's holiday/)).toBeVisible();
    await expect(card(page).getByText(/1 month(?!s)/)).toBeVisible();
  });
});
