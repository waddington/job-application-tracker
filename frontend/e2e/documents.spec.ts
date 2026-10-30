import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Documents: creating CVs and cover letters, versions with real files, what can't be deleted, and
// CV files becoming versions. Recording a version on an application is mostly in
// application-page.spec.ts: here it's what that does to this page, in both directions.

interface Version {
  id: string;
  label: string;
  notes: string | null;
  used_in: number;
  file: { original_name: string; url: string; size: number } | null;
}
interface Doc {
  id: string;
  kind: string;
  name: string;
  versions: Version[];
}
interface CvFile {
  sha256: string;
  name: string;
  version: { label: string; document_name: string } | null;
}

const API = "/api/v1";
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const list = async <T>(request: APIRequestContext, path: string) =>
  (await (await request.get(`${API}/${path}`)).json()) as T[];
const docsCalled = (request: APIRequestContext, name: string) =>
  list<Doc>(request, "documents").then((all) => all.filter((d) => d.name === name));
const makeDoc = (request: APIRequestContext, name: string, kind = "cv") =>
  post<Doc>(request, "documents", { name, kind });
const makeVersion = async (request: APIRequestContext, id: string, label: string) => {
  const made = await request.post(`${API}/documents/${id}/versions`, { multipart: { label } });
  expect(made.ok(), "POST version").toBe(true);
  return (await made.json()) as Version;
};
const application = (request: APIRequestContext, company: string, role = "Applied Role") =>
  post<{ id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: role,
    route: "direct",
    tags: [],
  });
const send = (request: APIRequestContext, appId: string, versionId: string) =>
  post<{ id: string }>(request, `applications/${appId}/documents`, {
    document_version_id: versionId,
    sent_on: "2026-02-04",
  });
const attach = async (
  request: APIRequestContext,
  name: string,
  entity_type: string,
  entity_id: string,
  body = `made-up file ${name}`,
) => {
  const made = await request.post(`${API}/attachments`, {
    multipart: {
      entity_type,
      entity_id,
      file: { name, mimeType: "application/pdf", buffer: Buffer.from(body) },
    },
  });
  expect(made.ok(), "POST attachment").toBe(true);
};
const cvFile = async (request: APIRequestContext, name: string) =>
  (await list<CvFile>(request, "cv-files")).find((f) => f.name === name);

const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));
const theDialog = (page: Page) => page.locator(".mantine-Modal-content");
const menu = (page: Page, name: string) =>
  page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name, exact: true });
const watchWrites = (page: Page) => {
  const writes: string[] = [];
  page.on("request", (r) => {
    if (r.method() !== "GET") writes.push(`${r.method()} ${new URL(r.url()).pathname}`);
  });
  return writes;
};
/** Goes to a page without reloading the app, as following a link would. */
const inApp = (page: Page, path: string) =>
  page.evaluate((to) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
const openDocuments = async (page: Page) => {
  await page.goto("/documents");
  await expect(page.getByRole("heading", { name: "Backend CV", level: 4 })).toBeVisible();
};
const card = (page: Page, name: string) =>
  page
    .locator(".mantine-Card-root")
    .filter({ has: page.getByRole("heading", { name, exact: true, level: 4 }) })
    .first();
const newDocument = async (page: Page) => {
  await page.getByRole("button", { name: "New document" }).click();
  const dialog = theDialog(page);
  await expect(dialog.getByText("New document")).toBeVisible();
  return dialog;
};
const create = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Create" }).click();
  await expect(dialog).toBeHidden();
};
const newVersion = async (page: Page, docName: string) => {
  await card(page, docName).getByRole("button", { name: "New version" }).click();
  const dialog = theDialog(page);
  await expect(dialog.getByText(`New version of ${docName}`)).toBeVisible();
  return dialog;
};
const addVersion = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Add version" }).click();
  await expect(dialog).toBeHidden();
};
const chooseFile = async (page: Page, dialog: Locator, name: string, body = "made-up file") => {
  const chooser = page.waitForEvent("filechooser");
  await dialog.getByRole("button", { name: /Choose the file|Change file/ }).click();
  await (await chooser).setFiles({ name, mimeType: "text/plain", buffer: Buffer.from(body) });
};
const answer = (page: Page, accept: boolean) => {
  let asked = "";
  page.once("dialog", (d) => {
    asked = d.message();
    void (accept ? d.accept() : d.dismiss());
  });
  return () => asked;
};

test.describe("creating a document", () => {
  test("asks for a name", async ({ page }) => {
    await openDocuments(page);
    const writes = watchWrites(page);
    const dialog = await newDocument(page);
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(dialog.getByText("Name it, e.g. Backend CV")).toBeVisible();
    await dialog.getByLabel("Name").fill("   ");
    await dialog.getByRole("button", { name: "Create" }).click();
    await expect(dialog.getByText("Name it, e.g. Backend CV")).toBeVisible();
    expect(writes).toEqual([]);
  });

  for (const [label, kind, shown] of [
    ["CV", "cv", "CV"],
    ["Cover letter", "cover_letter", "Cover letter"],
    ["Other", "other", "Other"],
  ] as const) {
    test(`of kind ${label}: trimmed, saved, starts with no versions`, async ({ page, request }) => {
      const name = `Fresh ${label} Doc`;
      await openDocuments(page);
      const dialog = await newDocument(page);
      await dialog.getByText(label, { exact: true }).click();
      await dialog.getByLabel("Name").fill(`  ${name} `);
      await create(dialog);
      await expect(card(page, name).getByText(shown, { exact: true })).toBeVisible();
      await expect(card(page, name).getByText("No versions yet.")).toBeVisible();
      await expect(card(page, name).getByText("Where it was used (0)")).toBeVisible();
      expect(await docsCalled(request, name)).toMatchObject([{ kind, versions: [] }]);
      await page.reload();
      await expect(page.getByRole("heading", { name, level: 4 })).toBeVisible();
    });
  }

  test("closing it adds nothing, and the next one starts empty", async ({ page, request }) => {
    await openDocuments(page);
    const writes = watchWrites(page);
    let dialog = await newDocument(page);
    await dialog.getByLabel("Name").fill("Never Made Doc");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
    expect(await docsCalled(request, "Never Made Doc")).toHaveLength(0);
    dialog = await newDocument(page);
    await expect(dialog.getByLabel("Name")).toHaveValue("");
  });

  test("a double click on a slow save makes one", async ({ page, request }) => {
    await page.route(`**${API}/documents`, async (route) => {
      if (route.request().method() === "POST") await pause(800);
      await route.continue();
    });
    await openDocuments(page);
    const dialog = await newDocument(page);
    await dialog.getByLabel("Name").fill("Double Click Doc");
    await dialog.getByRole("button", { name: "Create" }).dblclick();
    await expect(dialog).toBeHidden();
    await pause(300);
    expect(await docsCalled(request, "Double Click Doc")).toHaveLength(1);
  });

  // KNOWN BUG (fix-duplicate-document-name on the roadmap): expected to fail until it is fixed.
  test.fail("the same name twice doesn't make a second", async ({ page, request, problems }) => {
    problems.allow(/4\d\d.*\/api\/v1\/documents/); // a fix may refuse it
    await makeDoc(request, "Twin Doc");
    await openDocuments(page);
    const dialog = await newDocument(page);
    await dialog.getByLabel("Name").fill("Twin Doc");
    const posted = page
      .waitForResponse((r) => r.request().method() === "POST", { timeout: 2_000 })
      .catch(() => undefined);
    // A fix may disable the button, or ask first.
    await dialog
      .getByRole("button", { name: "Create" })
      .click({ timeout: 1_000 })
      .catch(() => undefined);
    await posted;
    expect(await docsCalled(request, "Twin Doc")).toHaveLength(1);
  });
});

test.describe("versions", () => {
  test("the label is suggested, and needed", async ({ page, request }) => {
    const doc = await makeDoc(request, "Label Doc");
    await makeVersion(request, doc.id, "v1");
    await openDocuments(page);
    const writes = watchWrites(page);
    const dialog = await newVersion(page, "Label Doc");
    await expect(dialog.getByLabel("Label")).toHaveValue("v2");
    await dialog.getByLabel("Label").fill("  ");
    await dialog.getByRole("button", { name: "Add version" }).click();
    await expect(dialog.getByText("Label it, e.g. v3 (fintech)")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("with no file: label and what changed, newest first", async ({ page, request }) => {
    const doc = await makeDoc(request, "Order Doc");
    await makeVersion(request, doc.id, "older");
    await openDocuments(page);
    const dialog = await newVersion(page, "Order Doc");
    await dialog.getByLabel("Label").fill(" newer ");
    await dialog.getByLabel("What changed").fill("Leads with payments");
    await addVersion(dialog);
    await expect(card(page, "Order Doc").getByText(/Leads with payments/)).toBeVisible();
    const [saved] = await docsCalled(request, "Order Doc");
    expect(saved?.versions.map((v) => v.label)).toEqual(["newer", "older"]);
    expect(saved?.versions[0]).toMatchObject({ notes: "Leads with payments", file: null });
    await expect(card(page, "Order Doc").getByText("No versions yet.")).toBeHidden();
  });

  test("with a real file: named, sized, and it downloads what was uploaded", async ({ page, request }) => {
    await makeDoc(request, "File Doc");
    await openDocuments(page);
    const dialog = await newVersion(page, "File Doc");
    await expect(dialog.getByText("Optional, but handy")).toBeVisible();
    await chooseFile(page, dialog, "made-up-cv.md", "Made up contents");
    await expect(dialog.getByText(/made-up-cv\.md \(/)).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Change file" })).toBeVisible();
    await addVersion(dialog);
    const link = card(page, "File Doc").getByRole("link", { name: /made-up-cv\.md/ });
    await expect(link).toBeVisible();
    const href = await link.getAttribute("href");
    const got = await request.get(href ?? "");
    expect(got.ok()).toBe(true);
    expect(await got.text()).toBe("Made up contents");
    await page.reload();
    await expect(card(page, "File Doc").getByRole("link", { name: /made-up-cv\.md/ })).toBeVisible();
  });

  test("the same file on two versions: each keeps it, deleting one leaves the other", async ({
    page,
    request,
  }) => {
    await makeDoc(request, "Same File Doc");
    await openDocuments(page);
    for (const label of ["one", "two"]) {
      const dialog = await newVersion(page, "Same File Doc");
      await dialog.getByLabel("Label").fill(label);
      await chooseFile(page, dialog, "same-file.md", "Identical contents");
      await addVersion(dialog);
      await expect(card(page, "Same File Doc").getByText(label, { exact: true })).toBeVisible();
    }
    answer(page, true);
    await page.getByRole("button", { name: "Delete two" }).click();
    await expect(card(page, "Same File Doc").getByText("two", { exact: true })).toBeHidden();
    const [left] = await docsCalled(request, "Same File Doc");
    const got = await request.get(left?.versions[0]?.file?.url ?? "");
    expect(got.ok()).toBe(true);
    expect(await got.text()).toBe("Identical contents");
  });

  test("closing adds nothing", async ({ page, request }) => {
    await makeDoc(request, "Closed Version Doc");
    await openDocuments(page);
    const writes = watchWrites(page);
    const dialog = await newVersion(page, "Closed Version Doc");
    await dialog.getByLabel("What changed").fill("Nothing");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
  });

  test("deleting asks first; saying no keeps it, yes removes it and its file", async ({ page, request }) => {
    const doc = await makeDoc(request, "Drop Version Doc");
    await makeVersion(request, doc.id, "keeper");
    await openDocuments(page);
    const dialog = await newVersion(page, "Drop Version Doc");
    await dialog.getByLabel("Label").fill("dropped");
    await chooseFile(page, dialog, "dropped.md");
    await addVersion(dialog);
    const writes = watchWrites(page);
    let asked = answer(page, false);
    await page.getByRole("button", { name: "Delete dropped" }).click();
    await expect.poll(() => asked()).toBe("Delete dropped?");
    await pause(200);
    expect(writes).toEqual([]);
    const [before] = await docsCalled(request, "Drop Version Doc");
    const url = before?.versions.find((v) => v.label === "dropped")?.file?.url ?? "";
    asked = answer(page, true);
    await page.getByRole("button", { name: "Delete dropped" }).click();
    await expect(card(page, "Drop Version Doc").getByText("dropped", { exact: true })).toBeHidden();
    expect((await docsCalled(request, "Drop Version Doc"))[0]?.versions.map((v) => v.label)).toEqual([
      "keeper",
    ]);
    expect((await request.get(url)).status()).toBe(404);
  });

  // KNOWN BUG (fix-version-label-repeats on the roadmap): expected to fail until it is fixed.
  test.fail("the suggested label doesn't repeat one that's there", async ({ page, request }) => {
    const doc = await makeDoc(request, "Gap Label Doc");
    const first = await makeVersion(request, doc.id, "v1");
    await makeVersion(request, doc.id, "v2");
    expect((await request.delete(`${API}/documents/versions/${first.id}`)).ok()).toBe(true);
    await openDocuments(page);
    const dialog = await newVersion(page, "Gap Label Doc");
    await expect(dialog.getByLabel("Label")).not.toHaveValue("v2");
  });
});

test.describe("deleting a document", () => {
  test("saying no keeps it", async ({ page, request }) => {
    await makeDoc(request, "Kept Doc");
    await openDocuments(page);
    const writes = watchWrites(page);
    const asked = answer(page, false);
    await page.getByRole("button", { name: "Delete Kept Doc" }).click();
    await expect.poll(() => asked()).toBe("Delete Kept Doc and all its versions?");
    await pause(200);
    expect(writes).toEqual([]);
    expect(await docsCalled(request, "Kept Doc")).toHaveLength(1);
  });

  test("saying yes removes it and its versions' files, and it isn't offered any more", async ({
    page,
    request,
  }) => {
    const app = await application(request, "Offered Doc Co");
    await makeDoc(request, "Doomed Doc");
    await openDocuments(page);
    const dialog = await newVersion(page, "Doomed Doc");
    await chooseFile(page, dialog, "doomed.md");
    await addVersion(dialog);
    await expect(card(page, "Doomed Doc").getByRole("link", { name: /doomed\.md/ })).toBeVisible();
    const url = (await docsCalled(request, "Doomed Doc"))[0]?.versions[0]?.file?.url ?? "";
    answer(page, true);
    await page.getByRole("button", { name: "Delete Doomed Doc" }).click();
    await expect(page.getByRole("heading", { name: "Doomed Doc", level: 4 })).toBeHidden();
    expect(await docsCalled(request, "Doomed Doc")).toHaveLength(0);
    expect((await request.get(url)).status()).toBe(404);
    await page.goto(`/applications/${app.id}`);
    await card(page, "Documents sent").getByPlaceholder("Pick a CV or cover letter").click();
    await expect(page.getByRole("option", { name: "Backend CV · v2", exact: true })).toBeVisible();
    await expect(page.getByRole("option", { name: /^Doomed Doc/ })).toHaveCount(0);
  });
});

test.describe("what was sent, across pages", () => {
  test("a version added here is offered there, without a reload", async ({ page, request }) => {
    const app = await application(request, "New Version Co");
    await makeDoc(request, "Offered Doc");
    await page.goto(`/applications/${app.id}`);
    await card(page, "Documents sent").getByPlaceholder("Pick a CV or cover letter").click();
    await expect(page.getByRole("option", { name: "Backend CV · v2", exact: true })).toBeVisible();
    await menu(page, "Documents").click();
    await expect(page.getByRole("heading", { name: "Offered Doc", level: 4 })).toBeVisible();
    await addVersion(await newVersion(page, "Offered Doc"));
    await page.goBack();
    await card(page, "Documents sent").getByPlaceholder("Pick a CV or cover letter").click();
    await expect(page.getByRole("option", { name: "Offered Doc · v1", exact: true })).toBeVisible();
  });

  test("sent from an application: counted here, and where it went", async ({ page, request }) => {
    const app = await application(request, "Sent Doc Co", "Sent Doc Role");
    const doc = await makeDoc(request, "Sent Doc");
    await makeVersion(request, doc.id, "v1");
    await openDocuments(page); // seen first, so it has to refresh
    await expect(card(page, "Sent Doc").getByText("Where it was used (0)")).toBeVisible();
    await page.goto(`/applications/${app.id}`);
    const sent = card(page, "Documents sent");
    await sent.getByPlaceholder("Pick a CV or cover letter").click();
    await page.getByRole("option", { name: "Sent Doc · v1", exact: true }).click();
    await sent.getByRole("button", { name: "Add", exact: true }).click();
    await expect(sent.getByRole("link", { name: "Sent Doc", exact: true })).toBeVisible();
    await sent.getByRole("link", { name: "Sent Doc", exact: true }).click();
    const here = card(page, "Sent Doc");
    await expect(here.getByText("sent 1×")).toBeVisible();
    await here.getByText("Where it was used (1)").click();
    const where = here.getByRole("link", { name: "Sent Doc Co · Sent Doc Role" });
    await expect(where).toHaveAttribute("href", new RegExp(`/applications/${app.id}$`));
    await expect(here.getByText(/v1 ·.*·/)).toBeVisible();
  });

  test("once sent it can't be deleted, from here or by the server", async ({ page, request, problems }) => {
    problems.allow(/409.*\/api\/v1\/documents/);
    const app = await application(request, "Locked Doc Co");
    const doc = await makeDoc(request, "Locked Doc");
    const version = await makeVersion(request, doc.id, "locked");
    await send(request, app.id, version.id);
    await openDocuments(page);
    await expect(page.getByRole("button", { name: "Delete Locked Doc" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Delete locked", exact: true })).toBeDisabled();
    expect((await request.delete(`${API}/documents/${doc.id}`)).status()).toBe(409);
    expect((await request.delete(`${API}/documents/versions/${version.id}`)).status()).toBe(409);
  });

  test("sent since the page opened: the server refuses, and says why", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/409.*\/api\/v1\/documents/);
    const app = await application(request, "Stale Doc Co");
    const doc = await makeDoc(request, "Stale Doc");
    const version = await makeVersion(request, doc.id, "stale");
    await openDocuments(page);
    await expect(page.getByRole("button", { name: "Delete Stale Doc" })).toBeEnabled();
    await send(request, app.id, version.id);
    answer(page, true);
    await page.getByRole("button", { name: "Delete Stale Doc" }).click();
    await expect(page.getByText(/was sent with 1 application/).first()).toBeVisible();
    expect(await docsCalled(request, "Stale Doc")).toHaveLength(1);
    await expect(page.getByRole("heading", { name: "Stale Doc", level: 4 })).toBeVisible();
  });

  test("taken off the application, it can be deleted again", async ({ page, request }) => {
    const app = await application(request, "Freed Doc Co");
    const doc = await makeDoc(request, "Freed Doc");
    const version = await makeVersion(request, doc.id, "freed");
    await send(request, app.id, version.id);
    await openDocuments(page);
    await expect(page.getByRole("button", { name: "Delete freed", exact: true })).toBeDisabled();
    await page.goto(`/applications/${app.id}`);
    await card(page, "Documents sent").getByRole("button", { name: "Remove Freed Doc freed" }).click();
    await expect(card(page, "Documents sent").getByText(/Record which CV/)).toBeVisible();
    await menu(page, "Documents").click();
    await expect(page.getByRole("button", { name: "Delete freed", exact: true })).toBeEnabled();
    await expect(card(page, "Freed Doc").getByText("Where it was used (0)")).toBeVisible();
    await expect(card(page, "Freed Doc").getByText(/^sent /)).toBeHidden();
  });

  test("deleting the application frees it too", async ({ page, request }) => {
    const app = await application(request, "Gone App Doc Co");
    const doc = await makeDoc(request, "Gone App Doc");
    const version = await makeVersion(request, doc.id, "gone");
    await send(request, app.id, version.id);
    await request.delete(`${API}/applications/${app.id}`);
    await openDocuments(page);
    await expect(page.getByRole("button", { name: "Delete Gone App Doc" })).toBeEnabled();
  });

  test("a renamed company shows where it was used", async ({ page, request }) => {
    const app = await application(request, "Doc Before Co", "Doc Rename Role");
    const doc = await makeDoc(request, "Rename Doc");
    const version = await makeVersion(request, doc.id, "v1");
    await send(request, app.id, version.id);
    const company = (await list<{ id: string; name: string }>(request, "companies")).find(
      (c) => c.name === "Doc Before Co",
    );
    await openDocuments(page);
    await card(page, "Rename Doc").getByText("Where it was used (1)").click();
    await expect(page.getByRole("link", { name: "Doc Before Co · Doc Rename Role" })).toBeVisible();
    await inApp(page, `/companies/${company?.id}`);
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await theDialog(page).getByLabel("Name").fill("Doc After Co");
    await theDialog(page).getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Doc After Co", level: 2 })).toBeVisible();
    await menu(page, "Documents").click();
    await expect(page.getByRole("link", { name: "Doc After Co · Doc Rename Role" })).toBeVisible();
  });
});

test.describe("CV files you've attached", () => {
  const files = (page: Page) => card(page, "CV files you've attached");

  test("a file named like a CV shows, one that isn't doesn't", async ({ page, request }) => {
    const app = await application(request, "Listed File Co", "Listed File Role");
    await attach(request, "listed-cv.pdf", "application", app.id);
    await attach(request, "listed-photo.pdf", "application", app.id);
    await openDocuments(page);
    await expect(files(page).getByText("listed-cv.pdf")).toBeVisible();
    await expect(files(page).getByText("listed-photo.pdf")).toBeHidden();
    await expect(files(page).getByRole("link", { name: "Listed File Co · Listed File Role" })).toBeVisible();
  });

  test("the same file in two places counts, whatever it's called", async ({ page, request }) => {
    const one = await application(request, "Same Place One Co");
    const two = await application(request, "Same Place Two Co");
    await attach(request, "profile-a.pdf", "application", one.id, "same bytes");
    await attach(request, "profile-b.pdf", "application", two.id, "same bytes");
    await openDocuments(page);
    await expect(
      files(page)
        .getByText(/profile-[ab]\.pdf/)
        .first(),
    ).toBeVisible();
    await expect(files(page).getByText(/^For 2 applications:/)).toBeVisible();
  });

  test("attached on an application's page, it's here without a reload", async ({ page, request }) => {
    const app = await application(request, "Attached Now Co");
    await openDocuments(page);
    await inApp(page, `/applications/${app.id}`);
    const chooser = page.waitForEvent("filechooser");
    await card(page, "Files").getByRole("button", { name: "Upload" }).click();
    await (
      await chooser
    ).setFiles({ name: "attached-now-cv.pdf", mimeType: "application/pdf", buffer: Buffer.from("now") });
    await expect(page.getByText("attached-now-cv.pdf").first()).toBeVisible();
    await menu(page, "Documents").click();
    await expect(files(page).getByText("attached-now-cv.pdf")).toBeVisible();
  });

  test("Not a CV hides it for good, until asked for again", async ({ page, request }) => {
    const app = await application(request, "Not CV Co");
    await attach(request, "not-really-cv.pdf", "application", app.id);
    await openDocuments(page);
    const writes = watchWrites(page);
    await page.getByRole("button", { name: "not-really-cv.pdf is not a CV" }).click();
    await expect(files(page).getByText("not-really-cv.pdf")).toBeHidden();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Backend CV", level: 4 })).toBeVisible();
    await expect(files(page).getByText(/^Show \d+ you said/)).toBeVisible();
    await expect(files(page).getByText("not-really-cv.pdf")).toBeHidden();
    await files(page)
      .getByText(/^Show \d+ you said/)
      .click();
    await expect(files(page).getByText("not-really-cv.pdf")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("made a version of an existing CV, recorded on what's ticked", async ({ page, request }) => {
    const ticked = await application(request, "Ticked Co", "Ticked Role");
    const unticked = await application(request, "Unticked Co", "Unticked Role");
    await attach(request, "adopted-cv.pdf", "application", ticked.id, "adopted bytes");
    await attach(request, "adopted-copy-cv.pdf", "application", unticked.id, "adopted bytes");
    await openDocuments(page);
    await files(page)
      .locator("div")
      .filter({ hasText: "adopted-cv.pdf" })
      .filter({ has: page.getByRole("button", { name: "Make it a version" }) })
      .last()
      .getByRole("button", { name: "Make it a version" })
      .click();
    const dialog = theDialog(page);
    await expect(dialog.getByLabel("Add it to", { exact: true }).first()).toHaveValue("Backend CV");
    await expect(dialog.getByLabel("Version")).toHaveValue(/adopted(-copy)?-cv/);
    await dialog.getByLabel("Version").fill("adopted version");
    await dialog.getByLabel("Unticked Co · Unticked Role").uncheck();
    await dialog.getByRole("button", { name: "Make it a version" }).click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("adopted version is a version now, recorded as sent with 1 application."),
    ).toBeVisible();
    const [cv] = await docsCalled(request, "Backend CV");
    const version = cv?.versions.find((v) => v.label === "adopted version");
    expect(version).toMatchObject({ used_in: 1 });
    expect(version?.file).not.toBeNull();
    const applied = (await (await request.get(`${API}/applications/${ticked.id}`)).json()) as {
      documents: { version_label: string }[];
    };
    expect(applied.documents.map((d) => d.version_label)).toEqual(["adopted version"]);
    // The other application still hasn't got it: it comes back to be recorded.
    await expect(files(page).getByRole("button", { name: "Record as sent" })).toBeVisible();
    await expect(files(page).getByText(/This is Backend CV · adopted version/)).toBeVisible();
    await files(page).getByRole("button", { name: "Record as sent" }).click();
    await expect(dialog.getByLabel("Unticked Co · Unticked Role")).toBeChecked();
    await dialog.getByRole("button", { name: "Record as sent" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Recorded as sent with 1 application.").first()).toBeVisible();
    expect(await cvFile(request, "adopted-cv.pdf")).toBeUndefined();
  });

  test("made a version of a new CV, which then exists", async ({ page, request }) => {
    const app = await application(request, "New CV Co");
    await attach(request, "brand-new-cv.pdf", "application", app.id);
    await openDocuments(page);
    await page.getByText("brand-new-cv.pdf").first().waitFor();
    const row = files(page)
      .locator("div")
      .filter({ hasText: "brand-new-cv.pdf" })
      .filter({ has: page.getByRole("button", { name: "Make it a version" }) })
      .last();
    await row.getByRole("button", { name: "Make it a version" }).click();
    const dialog = theDialog(page);
    await dialog.getByLabel("Add it to", { exact: true }).first().click();
    await page.getByRole("option", { name: "A new CV…" }).click();
    await dialog.getByLabel("Name of the new CV").fill("  ");
    await expect(dialog.getByRole("button", { name: "Make it a version" })).toBeDisabled();
    await dialog.getByLabel("Name of the new CV").fill("Adopted New CV");
    await dialog.getByLabel("Version").fill("");
    await expect(dialog.getByRole("button", { name: "Make it a version" })).toBeDisabled();
    await dialog.getByLabel("Version").fill("first");
    await dialog.getByRole("button", { name: "Make it a version" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name: "Adopted New CV", level: 4 })).toBeVisible();
    expect(await docsCalled(request, "Adopted New CV")).toMatchObject([
      { kind: "cv", versions: [{ label: "first", used_in: 1 }] },
    ]);
    await expect(files(page).getByText("brand-new-cv.pdf")).toBeHidden();
  });

  test("Cancel changes nothing", async ({ page, request }) => {
    const app = await application(request, "Cancel Adopt Co");
    await attach(request, "cancelled-cv.pdf", "application", app.id);
    await openDocuments(page);
    const writes = watchWrites(page);
    const row = files(page)
      .locator("div")
      .filter({ hasText: "cancelled-cv.pdf" })
      .filter({ has: page.getByRole("button", { name: "Make it a version" }) })
      .last();
    await row.getByRole("button", { name: "Make it a version" }).click();
    await theDialog(page).getByRole("button", { name: "Cancel" }).click();
    await expect(theDialog(page)).toBeHidden();
    expect(writes).toEqual([]);
    expect(await cvFile(request, "cancelled-cv.pdf")).toMatchObject({ version: null });
  });
});

test.describe("more of what could go out of step", () => {
  test("Enter pressed twice on a slow save makes one", async ({ page, request }) => {
    await page.route(`**${API}/documents`, async (route) => {
      if (route.request().method() === "POST") await pause(800);
      await route.continue();
    });
    await openDocuments(page);
    const dialog = await newDocument(page);
    await dialog.getByLabel("Name").fill("Enter Twice Doc");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await pause(1000);
    expect(await docsCalled(request, "Enter Twice Doc")).toHaveLength(1);
  });

  test("deleting with Where it was used open makes no failed request", async ({ page, request }) => {
    await makeDoc(request, "Open Usage Doc");
    await openDocuments(page);
    await card(page, "Open Usage Doc").getByText("Where it was used (0)").click();
    await expect(card(page, "Open Usage Doc").getByText("Not sent with any application yet.")).toBeVisible();
    answer(page, true);
    await page.getByRole("button", { name: "Delete Open Usage Doc" }).click();
    await expect(page.getByRole("heading", { name: "Open Usage Doc", level: 4 })).toBeHidden();
    await pause(500); // the fixture fails the test on any failed request
  });

  test("after a refused delete, the page shows it was sent", async ({ page, request, problems }) => {
    problems.allow(/409.*\/api\/v1\/documents/);
    const app = await application(request, "Refreshed Doc Co");
    const doc = await makeDoc(request, "Refreshed Doc");
    const version = await makeVersion(request, doc.id, "sent later");
    await openDocuments(page);
    await expect(page.getByRole("button", { name: "Delete Refreshed Doc" })).toBeEnabled();
    await send(request, app.id, version.id);
    answer(page, true);
    await page.getByRole("button", { name: "Delete Refreshed Doc" }).click();
    await expect(page.getByText(/was sent with 1 application/).first()).toBeVisible();
    await expect(card(page, "Refreshed Doc").getByText("Where it was used (1)")).toBeVisible();
  });

  test("an application deleted on its page frees the document, without a reload", async ({
    page,
    request,
  }) => {
    const app = await application(request, "Freed In App Co");
    const doc = await makeDoc(request, "Freed In App Doc");
    const version = await makeVersion(request, doc.id, "v1");
    await send(request, app.id, version.id);
    await openDocuments(page);
    await expect(page.getByRole("button", { name: "Delete Freed In App Doc" })).toBeDisabled();
    await inApp(page, `/applications/${app.id}`);
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page).not.toHaveURL(new RegExp(app.id));
    await menu(page, "Documents").click();
    await expect(page.getByRole("button", { name: "Delete Freed In App Doc" })).toBeEnabled();
  });

  for (const [kind, label] of [
    ["role", "role"],
    ["contact", "person"],
  ] as const) {
    test(`a CV attached on a ${label}'s page is here without a reload`, async ({ page, request }) => {
      const name = `on-${label}-cv.pdf`;
      let path: string;
      if (kind === "role") {
        const at = await post<{ id: string }>(request, "companies", { name: "CV On Role Co" });
        const role = await post<{ id: string }>(request, "roles", { company_id: at.id, title: "CV On Role" });
        path = `/roles/${role.id}`;
      } else {
        const who = await post<{ id: string }>(request, "contacts", { name: "CV On Person" });
        path = `/people/${who.id}`;
      }
      await openDocuments(page);
      await inApp(page, path);
      const chooser = page.waitForEvent("filechooser");
      await card(page, "Files").getByRole("button", { name: "Upload" }).click();
      await (await chooser).setFiles({ name, mimeType: "application/pdf", buffer: Buffer.from(name) });
      await expect(card(page, "Files").getByRole("link", { name })).toBeVisible();
      await menu(page, "Documents").click();
      await expect(card(page, "CV files you've attached").getByText(name)).toBeVisible();
    });
  }

  test("adopted into a new CV with an existing name, it doesn't make a second", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/4\d\d.*\/api\/v1\/cv-files/); // a fix may refuse it
    const app = await application(request, "Adopt Twin Co");
    await attach(request, "adopt-twin-cv.pdf", "application", app.id);
    await makeDoc(request, "Adopt Twin");
    await openDocuments(page);
    const files = card(page, "CV files you've attached");
    await files
      .locator("div")
      .filter({ hasText: "adopt-twin-cv.pdf" })
      .filter({ has: page.getByRole("button", { name: "Make it a version" }) })
      .last()
      .getByRole("button", { name: "Make it a version" })
      .click();
    const dialog = theDialog(page);
    await dialog.getByLabel("Add it to", { exact: true }).first().click();
    await page.getByRole("option", { name: "A new CV…" }).click();
    await dialog.getByLabel("Name of the new CV").fill("Adopt Twin");
    const posted = page
      .waitForResponse((r) => r.request().method() === "POST", { timeout: 2_000 })
      .catch(() => undefined);
    await dialog
      .getByRole("button", { name: "Make it a version" })
      .click({ timeout: 1_000 })
      .catch(() => undefined);
    await posted;
    expect(await docsCalled(request, "Adopt Twin")).toHaveLength(1);
  });
});
