import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Notes, links and files: on every kind of page, with real uploads and downloads, what happens
// when what they're attached to goes, and the Notes page. Each test uses its own names.

interface NoteSummary {
  id: string;
  title: string;
  links: string[];
}
interface Note extends NoteSummary {
  body: string;
  updated_at: string;
}
interface LinkItem {
  id: string;
  url: string;
  title: string | null;
  kind: string;
}
interface Attachment {
  id: string;
  original_name: string;
  url: string;
}
type EntityKind = "application" | "company" | "agency" | "contact" | "role";

const API = "/api/v1";
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const getJson = async <T>(request: APIRequestContext, path: string) =>
  (await (await request.get(`${API}/${path}`)).json()) as T;
const application = (request: APIRequestContext, company: string, role = "Noted Role") =>
  post<{ id: string; role_id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: role,
    route: "direct",
    tags: [],
  });
const company = (request: APIRequestContext, name: string) =>
  post<{ id: string }>(request, "companies", { name });
const notesCalled = async (request: APIRequestContext, title: string) =>
  (await getJson<NoteSummary[]>(request, "notes")).filter((n) => n.title === title);
const makeNote = (request: APIRequestContext, title: string, data: object = {}) =>
  post<Note>(request, "notes", { title, body: "", links: [], ...data });
const linksOn = (request: APIRequestContext, kind: EntityKind, id: string) =>
  getJson<LinkItem[]>(request, `links?entity_type=${kind}&entity_id=${id}`);
const filesOn = (request: APIRequestContext, kind: EntityKind, id: string) =>
  getJson<Attachment[]>(request, `attachments?entity_type=${kind}&entity_id=${id}`);
const attach = async (
  request: APIRequestContext,
  kind: EntityKind,
  id: string,
  name: string,
  body: string,
) => {
  const made = await request.post(`${API}/attachments`, {
    multipart: {
      entity_type: kind,
      entity_id: id,
      file: { name, mimeType: "text/plain", buffer: Buffer.from(body) },
    },
  });
  expect(made.ok(), "POST attachment").toBe(true);
};

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
const card = (page: Page, name: "Notes" | "Links" | "Files") =>
  page
    .locator(".mantine-Card-root")
    .filter({ has: page.getByRole("heading", { name, exact: true, level: 4 }) })
    .last();
/** Goes to a page without reloading the app, as following a link would. */
const inApp = (page: Page, path: string) =>
  page.evaluate((to) => {
    window.history.pushState({}, "", to);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
const openNotes = async (page: Page) => {
  await page.goto("/notes");
  await expect(page.getByRole("heading", { name: "Notes", level: 2 })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Search notes" })).toBeVisible();
};
const newNote = async (page: Page) => {
  await page.getByRole("button", { name: "New note" }).click();
  const dialog = theDialog(page);
  await expect(dialog.getByText("New note")).toBeVisible();
  return dialog;
};
const addNote = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Add note" }).click();
  await expect(dialog).toBeHidden();
};
const saveNote = async (dialog: Locator) => {
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
  await expect(dialog).toBeHidden();
};
const editNote = async (page: Page, title: string) => {
  await page.getByRole("button", { name: `Edit ${title}` }).click();
  const dialog = theDialog(page);
  await expect(dialog.getByText("Edit note")).toBeVisible();
  return dialog;
};
const upload = async (page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) => {
  const chooser = page.waitForEvent("filechooser");
  await card(page, "Files").getByRole("button", { name: "Upload" }).click();
  await (await chooser).setFiles(files);
};
const text = (name: string, body: string) => ({ name, mimeType: "text/plain", buffer: Buffer.from(body) });

let made = 0; // each test its own names
/** Makes one thing of each kind and says where its page is. */
const PAGES: {
  kind: EntityKind;
  make: (request: APIRequestContext) => Promise<{ id: string; path: string }>;
}[] = [
  {
    kind: "application",
    make: async (request) => {
      const app = await application(request, `Every Page App Co ${++made}`);
      return { id: app.id, path: `/applications/${app.id}` };
    },
  },
  {
    kind: "company",
    make: async (request) => {
      const thing = await company(request, `Every Page Co ${++made}`);
      return { id: thing.id, path: `/companies/${thing.id}` };
    },
  },
  {
    kind: "agency",
    make: async (request) => {
      const thing = await post<{ id: string }>(request, "agencies", { name: `Every Page Agency ${++made}` });
      return { id: thing.id, path: `/agencies/${thing.id}` };
    },
  },
  {
    kind: "contact",
    make: async (request) => {
      const thing = await post<{ id: string }>(request, "contacts", { name: `Every Page Person ${++made}` });
      return { id: thing.id, path: `/people/${thing.id}` };
    },
  },
  {
    kind: "role",
    make: async (request) => {
      const at = await company(request, `Every Page Role Co ${++made}`);
      const thing = await post<{ id: string }>(request, "roles", {
        company_id: at.id,
        title: `Every Page Role ${++made}`,
      });
      return { id: thing.id, path: `/roles/${thing.id}` };
    },
  },
];

for (const { kind, make } of PAGES) {
  test.describe(`on a ${kind}'s page`, () => {
    test("a note: added, read, edited, deleted", async ({ page, request }) => {
      const thing = await make(request);
      const title = `Note on ${kind}`;
      await page.goto(thing.path);
      const notes = card(page, "Notes");
      await expect(notes.getByText("No notes yet.")).toBeVisible();
      await notes.getByRole("button", { name: "Add note" }).click();
      let dialog = theDialog(page);
      await dialog.getByLabel("Title").fill(`  ${title} `);
      await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("Some **bold** words");
      await addNote(dialog);
      await expect(notes.getByText(title)).toBeVisible();
      const [saved] = await notesCalled(request, title);
      expect(saved?.links).toEqual([`${kind}:${thing.id}`]);
      await notes.getByRole("button", { name: title, expanded: false }).click();
      await expect(notes.locator("strong", { hasText: "bold" })).toBeVisible();

      dialog = await editNote(page, title);
      await expect(dialog.getByRole("textbox", { name: "Note", exact: true })).toHaveValue(
        /^Some \*\*bold\*\* words\n?$/,
      );
      await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("Other words");
      await saveNote(dialog);
      await expect(notes.getByText("Other words").first()).toBeVisible();
      await page.reload();
      await expect(card(page, "Notes").getByText(title)).toBeVisible();

      page.once("dialog", (d) => void d.accept());
      await page.getByRole("button", { name: `Delete ${title}` }).click();
      await expect(card(page, "Notes").getByText("No notes yet.")).toBeVisible();
      expect(await notesCalled(request, title)).toHaveLength(0);
    });

    test("a link: added, renamed, removed", async ({ page, request }) => {
      const thing = await make(request);
      await page.goto(thing.path);
      const links = card(page, "Links");
      await expect(links.getByText("Job ads, Google Docs, repos")).toBeVisible();
      await links.getByRole("textbox", { name: "Link URL" }).fill(" https://docs.example.com/brief ");
      await links.getByRole("textbox", { name: "Link title (optional)" }).fill("The brief");
      await links.getByRole("button", { name: "Add", exact: true }).click();
      const link = links.getByRole("link", { name: "The brief" });
      await expect(link).toHaveAttribute("href", /^https:\/\/docs\.example\.com\/brief/);
      await expect(links.getByRole("textbox", { name: "Link URL" })).toHaveValue("");
      await links.getByRole("button", { name: "Rename The brief" }).click();
      await links.getByRole("textbox", { name: "Link title", exact: true }).fill("Better brief");
      await page.keyboard.press("Enter");
      await expect(links.getByRole("link", { name: "Better brief" })).toBeVisible();
      expect(await linksOn(request, kind, thing.id)).toMatchObject([{ title: "Better brief" }]);
      await page.reload();
      await expect(card(page, "Links").getByRole("link", { name: "Better brief" })).toBeVisible();
      await card(page, "Links").getByRole("button", { name: "Remove Better brief" }).click();
      await expect(card(page, "Links").getByText("Job ads, Google Docs, repos")).toBeVisible();
      expect(await linksOn(request, kind, thing.id)).toHaveLength(0);
    });

    test("a file: uploaded, downloaded as it was, deleted", async ({ page, request }) => {
      const thing = await make(request);
      const name = `upload-${kind}.txt`;
      await page.goto(thing.path);
      await expect(card(page, "Files").getByRole("button", { name: "Upload" })).toBeVisible();
      await upload(page, [text(name, `Made up contents for ${kind}`)]);
      const link = card(page, "Files").getByRole("link", { name });
      await expect(link).toBeVisible();
      const got = await request.get((await link.getAttribute("href")) ?? "");
      expect(await got.text()).toBe(`Made up contents for ${kind}`);
      expect(await filesOn(request, kind, thing.id)).toMatchObject([{ original_name: name }]);
      await page.reload();
      page.once("dialog", (d) => void d.accept());
      await card(page, "Files")
        .getByRole("button", { name: `Delete ${name}` })
        .click();
      await expect(card(page, "Files").getByRole("link", { name })).toBeHidden();
      expect(await filesOn(request, kind, thing.id)).toHaveLength(0);
    });
  });
}

test.describe("writing a note", () => {
  test("asks for a title", async ({ page }) => {
    await openNotes(page);
    const writes = watchWrites(page);
    const dialog = await newNote(page);
    await dialog.getByRole("button", { name: "Add note" }).click();
    await expect(dialog.getByText("Give it a title")).toBeVisible();
    await dialog.getByLabel("Title").fill("   ");
    await dialog.getByRole("button", { name: "Add note" }).click();
    await expect(dialog.getByText("Give it a title")).toBeVisible();
    expect(writes).toEqual([]);
  });

  test("Preview shows the Markdown, and what's typed comes back", async ({ page }) => {
    await openNotes(page);
    const dialog = await newNote(page);
    await dialog.getByRole("tab", { name: "Preview" }).click();
    await expect(dialog.getByText("Nothing to preview yet.")).toBeVisible();
    await dialog.getByRole("tab", { name: "Write" }).click();
    await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("- one\n- **two**");
    await dialog.getByRole("tab", { name: "Preview" }).click();
    await expect(dialog.locator("li")).toHaveCount(2);
    await expect(dialog.locator("strong", { hasText: "two" })).toBeVisible();
    await dialog.getByRole("tab", { name: "Write" }).click();
    await expect(dialog.getByRole("textbox", { name: "Note", exact: true })).toHaveValue("- one\n- **two**");
  });

  test("Cancel and Escape save nothing, and the next one starts empty", async ({ page }) => {
    await openNotes(page);
    const writes = watchWrites(page);
    let dialog = await newNote(page);
    await dialog.getByLabel("Title").fill("Never saved");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    dialog = await newNote(page);
    await expect(dialog.getByLabel("Title")).toHaveValue("");
    await dialog.getByLabel("Title").fill("Never saved either");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
  });

  test("a note with no words says so when opened", async ({ page, request }) => {
    await makeNote(request, "Wordless note");
    await openNotes(page);
    await page.getByRole("button", { name: "Wordless note", expanded: false }).click();
    await expect(page.getByText("(empty)")).toBeVisible();
  });

  test("attached to two things, it shows on both; taken off one, it stays on the other", async ({
    page,
    request,
  }) => {
    const one = await company(request, "Note One Co");
    const two = await post<{ id: string }>(request, "agencies", { name: "Note Two Agency" });
    await page.goto(`/companies/${one.id}`);
    await card(page, "Notes").getByRole("button", { name: "Add note" }).click();
    let dialog = theDialog(page);
    await dialog.getByLabel("Title").fill("Shared note");
    await expect(dialog.getByText("Note One Co")).toBeVisible();
    await dialog
      .getByPlaceholder("Applications, companies, people…")
      .or(dialog.getByLabel("Attached to"))
      .first()
      .click();
    await page.getByRole("option", { name: "Note Two Agency", exact: true }).click();
    await dialog.getByLabel("Title").click();
    await addNote(dialog);
    await page.goto(`/agencies/${two.id}`);
    await expect(card(page, "Notes").getByText("Shared note")).toBeVisible();
    dialog = await editNote(page, "Shared note");
    await dialog.getByLabel("Attached to").first().click();
    await page.getByRole("option", { name: "Note Two Agency", exact: true }).click();
    await dialog.getByText("Edit note").click();
    await saveNote(dialog);
    await expect(card(page, "Notes").getByText("No notes yet.")).toBeVisible();
    await page.goto(`/companies/${one.id}`);
    await expect(card(page, "Notes").getByText("Shared note")).toBeVisible();
  });

  test("a note on a role keeps it when edited, though the picker doesn't list roles", async ({
    page,
    request,
  }) => {
    const at = await company(request, "Kept Link Co");
    const role = await post<{ id: string }>(request, "roles", { company_id: at.id, title: "Kept Link Role" });
    await makeNote(request, "Role link note", { links: [`role:${role.id}`] });
    await page.goto(`/roles/${role.id}`);
    const dialog = await editNote(page, "Role link note");
    await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("Edited");
    await saveNote(dialog);
    expect((await notesCalled(request, "Role link note"))[0]?.links).toEqual([`role:${role.id}`]);
  });

  test("changed elsewhere since it opened: refused, with why, and your words stay", async ({
    page,
    request,
    problems,
  }) => {
    problems.allow(/409.*\/api\/v1\/notes/);
    const made2 = await makeNote(request, "Clash note", { body: "First" });
    await openNotes(page);
    const dialog = await editNote(page, "Clash note");
    await pause(1100); // timestamps are in whole seconds
    await request.patch(`${API}/notes/${made2.id}`, { data: { body: "From elsewhere" } });
    await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("Mine");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/This note changed since you opened it/).first()).toBeVisible();
    await expect(dialog.getByRole("textbox", { name: "Note", exact: true })).toHaveValue("Mine");
    expect((await getJson<Note>(request, `notes/${made2.id}`)).body.trim()).toBe("From elsewhere");
  });

  // KNOWN BUG (fix-note-reopen-stale on the roadmap): expected to fail until it is fixed.
  test.fail(
    "reopening straight after saving shows what was saved, and saves again",
    async ({ page, request }) => {
      const made2 = await makeNote(request, "Reopened note", { body: "First" });
      await openNotes(page);
      await page.route(`**${API}/notes/${made2.id}`, async (route) => {
        if (route.request().method() === "GET") await pause(1000);
        await route.continue();
      });
      let dialog = await editNote(page, "Reopened note");
      await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("Second");
      await saveNote(dialog);
      dialog = await editNote(page, "Reopened note");
      await expect(dialog.getByRole("textbox", { name: "Note", exact: true })).toHaveValue(/^Second\n?$/);
      await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("Third");
      await saveNote(dialog);
      expect((await getJson<Note>(request, `notes/${made2.id}`)).body.trim()).toBe("Third");
    },
  );

  test("a double click on a slow save adds one", async ({ page, request }) => {
    await page.route(`**${API}/notes`, async (route) => {
      if (route.request().method() === "POST") await pause(800);
      await route.continue();
    });
    await openNotes(page);
    const dialog = await newNote(page);
    await dialog.getByLabel("Title").fill("Double note");
    await dialog.getByRole("button", { name: "Add note" }).dblclick();
    await expect(dialog).toBeHidden();
    await pause(300);
    expect(await notesCalled(request, "Double note")).toHaveLength(1);
  });

  test("saying no to a delete keeps it", async ({ page, request }) => {
    await makeNote(request, "Kept note");
    await openNotes(page);
    const writes = watchWrites(page);
    let asked = "";
    page.once("dialog", (d) => {
      asked = d.message();
      void d.dismiss();
    });
    await page.getByRole("button", { name: "Delete Kept note" }).click();
    await expect.poll(() => asked).toContain('Delete "Kept note"?');
    await pause(200);
    expect(writes).toEqual([]);
  });
});

test.describe("when what a note is on goes away", () => {
  test("the note stays, and can still be edited", async ({ page, request }) => {
    const gone = await company(request, "Gone Note Co");
    const made2 = await makeNote(request, "Orphan note", { links: [`company:${gone.id}`], body: "Before" });
    expect((await request.delete(`${API}/companies/${gone.id}`)).ok()).toBe(true);
    await openNotes(page);
    await expect(page.getByText("Orphan note")).toBeVisible();
    const dialog = await editNote(page, "Orphan note");
    await dialog.getByRole("textbox", { name: "Note", exact: true }).fill("After");
    const saved = page.waitForResponse((r) => r.request().method() === "PATCH");
    await dialog.getByRole("button", { name: "Save", exact: true }).click();
    expect((await saved).status()).toBe(200);
    expect((await getJson<Note>(request, `notes/${made2.id}`)).body.trim()).toBe("After");
  });
});

test.describe("when what a note is on is deleted", () => {
  // KNOWN BUG (fix-orphan-note-link on the roadmap): expected to fail until it is fixed.
  test.fail("it counts as a general note again", async ({ page, request }) => {
    const gone = await company(request, "Orphan General Co");
    await makeNote(request, "Orphan general", { links: [`company:${gone.id}`] });
    expect((await request.delete(`${API}/companies/${gone.id}`)).ok()).toBe(true);
    expect((await notesCalled(request, "Orphan general"))[0]?.links).toEqual([]);
    await openNotes(page);
    await page.getByText("General only").click();
    await expect(page.getByText("Orphan general")).toBeVisible();
  });
});

test.describe("the Notes page", () => {
  test("search finds titles and text, and says when nothing matches", async ({ page, request }) => {
    await makeNote(request, "Zebra heading", { body: "plain" });
    await makeNote(request, "Other heading", { body: "mentions a quokka inside" });
    await openNotes(page);
    const search = page.getByRole("textbox", { name: "Search notes" });
    await search.fill("zebra");
    await expect(page.getByText("Other heading")).toBeHidden();
    await expect(page.getByText("Zebra heading")).toBeVisible();
    await search.fill("quokka");
    await expect(page.getByText("Other heading")).toBeVisible();
    await expect(page.getByText("Zebra heading")).toBeHidden();
    await search.fill("nothing has this word");
    await expect(page.getByText("No matches.")).toBeVisible();
  });

  test("General only leaves out what's attached", async ({ page, request }) => {
    const at = await company(request, "Scope Co");
    await makeNote(request, "Scope general");
    await makeNote(request, "Scope attached", { links: [`company:${at.id}`] });
    await openNotes(page);
    await expect(page.getByText("Scope attached")).toBeVisible();
    await page.getByText("General only").click();
    await expect(page.getByText("Scope attached")).toBeHidden();
    await expect(page.getByText("Scope general")).toBeVisible();
  });

  test("a note added on a company's page is here without a reload", async ({ page, request }) => {
    const at = await company(request, "Sync Note Co");
    await openNotes(page);
    await inApp(page, `/companies/${at.id}`);
    await card(page, "Notes").getByRole("button", { name: "Add note" }).click();
    const dialog = theDialog(page);
    await dialog.getByLabel("Title").fill("Synced note");
    await addNote(dialog);
    await menu(page, "Notes").click();
    await expect(page.getByText("Synced note")).toBeVisible();
  });
});

test.describe("links", () => {
  const prepare = async (
    page: Page,
    request: APIRequestContext,
    name: string,
    title: string | null = "Old",
  ) => {
    const at = await company(request, name);
    await post(request, "links", {
      entity_type: "company",
      entity_id: at.id,
      url: "https://links.example.com/page",
      title,
    });
    await page.goto(`/companies/${at.id}`);
    return { at, links: card(page, "Links") };
  };

  test("refuses what isn't a link", async ({ page, request }) => {
    const at = await company(request, "Bad Link Page Co");
    await page.goto(`/companies/${at.id}`);
    const links = card(page, "Links");
    await expect(links.getByText("Job ads, Google Docs, repos")).toBeVisible();
    const writes = watchWrites(page);
    for (const bad of ["", "docs.example.com", "https://has space.example.com"]) {
      await links.getByRole("textbox", { name: "Link URL" }).fill(bad);
      await links.getByRole("button", { name: "Add", exact: true }).click();
      await expect(links.getByText("Paste a link starting with https://")).toBeVisible();
    }
    expect(writes).toEqual([]);
  });

  test("with no title it shows the site's name", async ({ page, request }) => {
    const { links } = await prepare(page, request, "Host Link Co", null);
    await expect(links.getByRole("link", { name: "links.example.com" })).toBeVisible();
  });

  test("a Google Doc or GitHub link is recognised", async ({ page, request }) => {
    const at = await company(request, "Kind Link Co");
    await page.goto(`/companies/${at.id}`);
    const links = card(page, "Links");
    await expect(links.getByText("Job ads, Google Docs, repos")).toBeVisible();
    await links.getByRole("textbox", { name: "Link URL" }).fill("https://docs.google.com/document/d/x");
    await links.getByRole("button", { name: "Add", exact: true }).click();
    await expect(links.getByRole("link").first()).toHaveAttribute("href", /docs\.google\.com/);
    expect((await linksOn(request, "company", at.id))[0]?.kind).toBe("google_doc");
  });

  test("Escape in a rename changes nothing", async ({ page, request }) => {
    const { at, links } = await prepare(page, request, "Escape Link Co");
    await links.getByRole("button", { name: "Rename Old" }).click();
    await links.getByRole("textbox", { name: "Link title", exact: true }).fill("Changed");
    await page.keyboard.press("Escape");
    await expect(links.getByRole("link", { name: "Old" })).toBeVisible();
    await pause(300);
    expect((await linksOn(request, "company", at.id))[0]?.title).toBe("Old");
  });

  // KNOWN BUG (fix-link-rename-cancel-saves on the roadmap): expected to fail until it is fixed.

  test.fail("the X in a rename changes nothing", async ({ page, request }) => {
    const { at, links } = await prepare(page, request, "Cancel Link Co");
    const writes = watchWrites(page);
    await links.getByRole("button", { name: "Rename Old" }).click();
    await links.getByRole("textbox", { name: "Link title", exact: true }).fill("Changed");
    await links.getByRole("button", { name: "Cancel" }).click();
    await expect(links.getByRole("textbox", { name: "Link title", exact: true })).toBeHidden();
    await pause(300);
    expect(writes).toEqual([]);
    expect((await linksOn(request, "company", at.id))[0]?.title).toBe("Old");
  });

  test("a rename is saved by Enter and by clicking away, once", async ({ page, request }) => {
    const { at, links } = await prepare(page, request, "Enter Link Co");
    const writes = watchWrites(page);
    await links.getByRole("button", { name: "Rename Old" }).click();
    await links.getByRole("textbox", { name: "Link title", exact: true }).fill("By Enter");
    await page.keyboard.press("Enter");
    await expect(links.getByRole("link", { name: "By Enter" })).toBeVisible();
    await pause(300);
    expect(writes).toHaveLength(1);
    await links.getByRole("button", { name: "Rename By Enter" }).click();
    await links.getByRole("textbox", { name: "Link title", exact: true }).fill("By blur");
    await page.getByRole("heading", { name: "Enter Link Co", level: 2 }).click();
    await expect(links.getByRole("link", { name: "By blur" })).toBeVisible();
    expect((await linksOn(request, "company", at.id))[0]?.title).toBe("By blur");
    expect(writes).toHaveLength(2);
  });

  // KNOWN BUG (fix-link-rename-tick-error on the roadmap): expected to fail until it is fixed.

  test.fail("the tick saves a rename, with no error", async ({ page, request }) => {
    const { at, links } = await prepare(page, request, "Tick Link Co");
    let release = () => {};
    const together = new Promise<void>((done) => {
      release = done;
      setTimeout(done, 1_000); // a fix sends just one
    });
    let held = 0;
    await page.route(`**${API}/links/*`, async (route) => {
      if (route.request().method() === "PATCH" && ++held === 2) release();
      if (route.request().method() === "PATCH") await together;
      await route.continue();
    });

    await links.getByRole("button", { name: "Rename Old" }).click();

    await links.getByRole("textbox", { name: "Link title", exact: true }).fill("By tick");

    await links.getByRole("button", { name: "Save title" }).click();

    await expect(links.getByRole("link", { name: "By tick" })).toBeVisible();

    expect((await linksOn(request, "company", at.id))[0]?.title).toBe("By tick");
  });

  test("emptying the title goes back to the site's name", async ({ page, request }) => {
    const { links } = await prepare(page, request, "Empty Title Co");
    await links.getByRole("button", { name: "Rename Old" }).click();
    await links.getByRole("textbox", { name: "Link title", exact: true }).fill("");
    await page.keyboard.press("Enter");
    await expect(links.getByRole("link", { name: "links.example.com" })).toBeVisible();
  });
});

test.describe("files", () => {
  const onCompany = async (page: Page, request: APIRequestContext, name: string) => {
    const at = await company(request, name);
    await page.goto(`/companies/${at.id}`);
    await expect(card(page, "Files").getByText(/Drop files here/)).toBeVisible();
    return at;
  };

  test("several at once, named and sized", async ({ page, request }) => {
    const at = await onCompany(page, request, "Many Files Co");
    await upload(page, [text("first.txt", "1"), text("second.txt", "22")]);
    await expect(card(page, "Files").getByRole("link", { name: "first.txt" })).toBeVisible();
    await expect(card(page, "Files").getByRole("link", { name: "second.txt" })).toBeVisible();
    await expect(card(page, "Files").getByText(/^2 B ·/)).toBeVisible();
    expect(await filesOn(request, "company", at.id)).toHaveLength(2);
  });

  test("dropping a file on the card uploads it", async ({ page, request }) => {
    const at = await onCompany(page, request, "Dropped File Co");
    const data = await page.evaluateHandle(() => {
      const transfer = new DataTransfer();
      transfer.items.add(new File(["dropped"], "dropped.txt", { type: "text/plain" }));
      return transfer;
    });
    await card(page, "Files").dispatchEvent("dragover", { dataTransfer: data });
    await card(page, "Files").dispatchEvent("drop", { dataTransfer: data });
    await expect(card(page, "Files").getByRole("link", { name: "dropped.txt" })).toBeVisible();
    expect(await filesOn(request, "company", at.id)).toHaveLength(1);
  });

  test("the same file twice: deleting one leaves the other readable", async ({ page, request }) => {
    const at = await onCompany(page, request, "Twice File Co");
    await upload(page, [text("twice-a.txt", "the same bytes")]);
    await expect(card(page, "Files").getByRole("link", { name: "twice-a.txt" })).toBeVisible();
    await upload(page, [text("twice-b.txt", "the same bytes")]);
    await expect(card(page, "Files").getByRole("link", { name: "twice-b.txt" })).toBeVisible();
    page.once("dialog", (d) => void d.accept());
    await card(page, "Files").getByRole("button", { name: "Delete twice-a.txt" }).click();
    await expect(card(page, "Files").getByRole("link", { name: "twice-a.txt" })).toBeHidden();
    const [left] = await filesOn(request, "company", at.id);
    expect(await (await request.get(left?.url ?? "")).text()).toBe("the same bytes");
  });

  test("a name with a path in it keeps only the name", async ({ request }) => {
    const at = await company(request, "Path Name Co");
    await attach(request, "company", at.id, "../../up-and-out.txt", "made up");
    expect((await filesOn(request, "company", at.id))[0]?.original_name).toBe("up-and-out.txt");
  });

  test("an empty file is taken", async ({ page, request }) => {
    const at = await onCompany(page, request, "Empty File Co");
    await upload(page, [text("empty.txt", "")]);
    await expect(card(page, "Files").getByRole("link", { name: "empty.txt" })).toBeVisible();
    await expect(card(page, "Files").getByText(/^0 B ·/)).toBeVisible();
    expect(await filesOn(request, "company", at.id)).toHaveLength(1);
  });

  test("an exported email shows what it's about", async ({ page, request }) => {
    await onCompany(page, request, "Email File Co");
    const eml = [
      "From: Made Up Recruiter <recruiter@example.com>",
      "To: Someone <someone@example.com>",
      "Subject: A made up role",
      "Date: Mon, 2 Feb 2026 10:00:00 +0000",
      "Content-Type: text/plain",
      "",
      "Hello, here is a made up message.",
    ].join("\r\n");
    await upload(page, [{ name: "export.eml", mimeType: "message/rfc822", buffer: Buffer.from(eml) }]);
    const files = card(page, "Files");
    await expect(files.getByRole("link", { name: "A made up role" })).toBeVisible();
    await expect(files.getByText(/Hello, here is a made up message/)).toBeVisible();
    await expect(files.getByRole("button", { name: "Delete export.eml" })).toBeVisible();
  });

  test("an upload the server refuses is explained", async ({ page, request, problems }) => {
    problems.allow(/413.*\/api\/v1\/attachments/);
    await onCompany(page, request, "Too Big Co");
    await page.route(`**${API}/attachments`, (route) =>
      route.request().method() === "POST"
        ? route.fulfill({ status: 413, json: { detail: "That file is over the 50 MB limit" } })
        : route.continue(),
    );
    await upload(page, [text("big.txt", "pretend")]);
    await expect(page.getByText("That file is over the 50 MB limit").first()).toBeVisible();
    await expect(card(page, "Files").getByRole("link", { name: "big.txt" })).toBeHidden();
  });

  test("saying no to a delete keeps it", async ({ page, request }) => {
    await onCompany(page, request, "Kept File Co");
    await upload(page, [text("kept.txt", "kept")]);
    await expect(card(page, "Files").getByRole("link", { name: "kept.txt" })).toBeVisible();
    const writes = watchWrites(page);
    page.once("dialog", (d) => void d.dismiss());
    await card(page, "Files").getByRole("button", { name: "Delete kept.txt" }).click();
    await pause(300);
    expect(writes).toEqual([]);
    await expect(card(page, "Files").getByRole("link", { name: "kept.txt" })).toBeVisible();
  });

  test("a role's files show on its application, under their own heading", async ({ page, request }) => {
    const app = await application(request, "Inherit File Co", "Inherit File Role");
    const detail = await getJson<{ role_id: string }>(request, `applications/${app.id}`);
    await attach(request, "role", detail.role_id, "job-description.txt", "made up");
    await page.goto(`/applications/${app.id}`);
    await expect(card(page, "Files").getByRole("link", { name: "job-description.txt" })).toBeVisible();
    await expect(card(page, "Files").getByText("From the role")).toBeVisible();
  });
});

test.describe("files that shouldn't open as pages", () => {
  test("an HTML file downloads under its own name, and can't run here", async ({ page, request }) => {
    const at = await company(request, "Html File Co");
    await page.goto(`/companies/${at.id}`);
    await expect(card(page, "Files").getByText(/Drop files here/)).toBeVisible();
    await upload(page, [
      { name: "page.html", mimeType: "text/html", buffer: Buffer.from("<h1>made up</h1>") },
    ]);
    const link = card(page, "Files").getByRole("link", { name: "page.html" });
    await expect(link).toBeVisible();
    const download = page.waitForEvent("download");
    await link.click();
    expect((await download).suggestedFilename()).toBe("page.html");
    const got = await request.get((await link.getAttribute("href")) ?? "");
    expect(got.headers()["content-disposition"]).toContain("attachment");
    expect(got.headers()["content-type"]).not.toContain("text/html");
    expect(got.headers()["x-content-type-options"]).toBe("nosniff");
  });

  // KNOWN BUG (fix-file-delete-reason-lost on the roadmap): expected to fail until it is fixed.
  test.fail("a refused delete says why", async ({ page, request, problems }) => {
    problems.allow(/409.*\/api\/v1\/attachments/);
    const at = await company(request, "Refused File Co");
    await attach(request, "company", at.id, "refused.txt", "made up");
    await page.route(`**${API}/attachments/*`, (route) =>
      route.request().method() === "DELETE"
        ? route.fulfill({ status: 409, json: { detail: "delete that version instead" } })
        : route.continue(),
    );
    await page.goto(`/companies/${at.id}`);
    page.once("dialog", (d) => void d.accept());
    await card(page, "Files").getByRole("button", { name: "Delete refused.txt" }).click();
    await expect(page.getByText("delete that version instead").first()).toBeVisible({ timeout: 3_000 });
  });
});
