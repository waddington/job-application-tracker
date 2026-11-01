import type { APIRequestContext, Locator, Page } from "@playwright/test";

import { expect, test } from "./fixtures";

// Rescheduling a booked round: the same dialog from every place one shows, who needed the change
// and why, and what the application's timeline keeps. Each test makes its own application.

interface Round {
  id: string;
  starts_at: string | null;
  rescheduled_count: number;
}
interface ApiEvent {
  kind: string;
  summary: string | null;
  occurred_at: string;
  data: { reschedule?: { from: string; to: string; by: string | null; reason: string | null } };
}

const API = "/api/v1";
const who = (dialog: Locator) => dialog.getByLabel(/^Who needed the change\?/).first();
const inDays = (days: number) =>
  new Date(Math.floor((Date.now() + days * 86_400_000) / 1000) * 1000).toISOString();
const post = async <T>(request: APIRequestContext, path: string, data: object) => {
  const made = await request.post(`${API}/${path}`, { data });
  expect(made.ok(), `POST ${path}`).toBe(true);
  return (await made.json()) as T;
};
const bookedRound = async (request: APIRequestContext, company: string, title: string, days = 6) => {
  const app = await post<{ id: string }>(request, "applications/quick", {
    company_name: company,
    role_title: "Tested Role",
    route: "direct",
    tags: [],
  });
  const round = await post<Round>(request, `applications/${app.id}/interviews`, {
    title,
    starts_at: inDays(days),
  });
  return { appId: app.id, round, label: `Round 1 · ${title}` };
};
const roundNow = async (request: APIRequestContext, id: string) =>
  (await (await request.get(`${API}/interviews/${id}`)).json()) as Round;
/** Each reschedule on the application's timeline, oldest first. */
const moves = async (request: APIRequestContext, appId: string) => {
  const detail = (await (await request.get(`${API}/applications/${appId}`)).json()) as { events: ApiEvent[] };
  return detail.events
    .filter((e) => e.kind === "interview" && e.summary?.includes("rescheduled"))
    .sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
};

const openDialog = async (page: Page, label: string, within: Page | Locator = page) => {
  await within.getByRole("button", { name: `Reschedule ${label}` }).click();
  const dialog = page.locator(".mantine-Modal-content");
  await expect(dialog.getByText(`Reschedule ${label}`)).toBeVisible();
  await dialog.getByText(`Reschedule ${label}`).click(); // also waits for it to stop moving
  return dialog;
};
const moveDay = async (page: Page, dialog: Locator) => {
  await dialog.getByLabel("New time", { exact: true }).first().click();
  const days = page.locator('[class*="DateTimePicker-day"]:not([data-outside]):not([data-selected])');
  await days.last().click();
  await page.locator('[class*="DateTimePicker-submitButton"]').click();
};
/** A day next to the current one: unlike moveDay, it stays within Today's two weeks. */
const moveOneDay = async (page: Page, dialog: Locator) => {
  await dialog.getByLabel("New time", { exact: true }).first().click();
  const days = page.locator('[class*="DateTimePicker-day"]:not([data-outside])');
  const selected = await days.evaluateAll((all) => all.findIndex((d) => d.hasAttribute("data-selected")));
  await days.nth(selected > 0 ? selected - 1 : selected + 1).click();
  await page.locator('[class*="DateTimePicker-submitButton"]').click();
};
const MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split(" ");
const dayMonth = (iso: string | null) => {
  // The page runs in Europe/London (playwright.config.ts), whatever this machine's zone is.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "numeric",
  }).formatToParts(new Date(iso ?? ""));
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return `${part("day")} ${MONTHS[part("month") - 1]}`;
};
/** "Tue 3 Nov, 10:00", as a move's line writes it. */
const dayTime = (iso: string | null | undefined) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso ?? ""));
  const part = (type: string) => parts.find((p) => p.type === type)?.value;
  return `${part("weekday")} ${dayMonth(iso ?? null)}, ${part("hour")}:${part("minute")}`;
};
const pickWho = async (page: Page, dialog: Locator, option: string) => {
  await who(dialog).click();
  await page.getByRole("option", { name: option, exact: true }).click();
};
const submit = (dialog: Locator) => dialog.getByRole("button", { name: "Reschedule", exact: true }).click();

test.describe("who needed the change", () => {
  test("is saved with the reason and shown after a reload", async ({ page, request }) => {
    const { appId, round, label } = await bookedRound(request, "Who Saved Co", "Who saved");
    await page.goto(`/applications/${appId}`);
    const dialog = await openDialog(page, label);
    await moveDay(page, dialog);
    await pickWho(page, dialog, "Them");
    await dialog.getByLabel("Why? (optional)").fill("Their manager is away");
    await submit(dialog);
    await expect(dialog).toBeHidden();

    await page.reload();
    await expect(page.getByText(/They needed the change · Their manager is away$/)).toBeVisible();
    const [move] = await moves(request, appId);
    expect(move?.data.reschedule).toMatchObject({ by: "them", reason: "Their manager is away" });
    expect(Date.parse(move?.data.reschedule?.from ?? "")).toBe(Date.parse(round.starts_at ?? ""));
    expect(Date.parse(move?.data.reschedule?.to ?? "")).toBe(
      Date.parse((await roundNow(request, round.id)).starts_at ?? ""),
    );
  });

  test("offers each choice, in plain words, with no reason needed", async ({ page, request }) => {
    const { appId, label } = await bookedRound(request, "Who Options Co", "Options");
    await page.goto(`/applications/${appId}`);
    const dialog = await openDialog(page, label);
    await who(dialog).click();
    for (const option of ["Me", "Them", "Both of us", "Neither of us"]) {
      await expect(page.getByRole("option", { name: option, exact: true })).toBeVisible();
    }
    await page.getByRole("option", { name: "Neither of us", exact: true }).click();
    await moveDay(page, dialog);
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(page.getByText(/ · Not down to either of you$/)).toBeVisible();
  });

  test("a second reschedule keeps the first one's who and why", async ({ page, request }) => {
    const { appId, round, label } = await bookedRound(request, "Twice Moved Co", "Twice");
    await page.goto(`/applications/${appId}`);
    let dialog = await openDialog(page, label);
    await moveDay(page, dialog);
    await pickWho(page, dialog, "Them");
    await dialog.getByLabel("Why? (optional)").fill("First clash");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await roundNow(request, round.id)).rescheduled_count).toBe(1);

    dialog = await openDialog(page, label);
    // Starts empty: the last move's answer isn't this one's.
    await expect(who(dialog)).toHaveValue("");
    await expect(dialog.getByLabel("Why? (optional)")).toHaveValue("");
    await moveDay(page, dialog);
    await pickWho(page, dialog, "Me");
    await submit(dialog);
    await expect(dialog).toBeHidden();

    const saved = await moves(request, appId);
    expect(saved.map((m) => m.data.reschedule?.by).sort()).toEqual(["me", "them"]);
    const byThem = saved.find((m) => m.data.reschedule?.by === "them");
    const byMe = saved.find((m) => m.data.reschedule?.by === "me");
    expect(Date.parse(byMe?.data.reschedule?.from ?? "")).toBe(Date.parse(byThem?.data.reschedule?.to ?? ""));
  });

  test("a move with no who, like an old one, says nothing about who", async ({ page, request }) => {
    const { appId, round, label } = await bookedRound(request, "Old Move Co", "Old move");
    const patched = await request.patch(`${API}/interviews/${round.id}`, { data: { starts_at: inDays(8) } });
    expect(patched.ok()).toBe(true);
    await page.goto(`/applications/${appId}`);
    await expect(page.getByText(`${label} rescheduled`, { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/^Moved from .+, \d\d:\d\d$/)).toBeVisible();
    await expect(page.getByText(/needed the change|not down to either/i)).toHaveCount(0);
    await expect(page.locator(".mantine-Card-root").getByText("Rescheduled", { exact: true })).toBeVisible();
  });
});

test.describe("each move on the timelines", () => {
  const expectBoth = async (page: Page, appId: string, label: string, lines: string[]) => {
    await page.goto(`/applications/${appId}`);
    for (const line of lines) await expect(page.getByText(line, { exact: true })).toBeVisible();
    await expect(page.getByText(`${label} rescheduled`, { exact: true })).toHaveCount(lines.length);
    await page.goto("/timeline");
    for (const line of lines) await expect(page.getByText(line, { exact: true })).toBeVisible();
    await expect(page.getByText(`${label} rescheduled`, { exact: true })).toHaveCount(lines.length);
    await expect(page.getByText(new RegExp(`^${label} rescheduled .`))).toHaveCount(0);
  };

  test("both timelines show the move after a reload", async ({ page, request }) => {
    const { appId, label } = await bookedRound(request, "Both Timelines Co", "Both timelines");
    await page.goto(`/applications/${appId}`);
    const dialog = await openDialog(page, label);
    await moveDay(page, dialog);
    await pickWho(page, dialog, "Them");
    await dialog.getByLabel("Why? (optional)").fill("Both timelines clash");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await page.reload();

    const [move] = await moves(request, appId);
    const saved = move?.data.reschedule;
    await expectBoth(page, appId, label, [
      `Moved from ${dayTime(saved?.from)} to ${dayTime(saved?.to)} · They needed the change · Both timelines clash`,
    ]);
    await page.reload();
    await expect(page.getByText(/ · They needed the change · Both timelines clash$/)).toBeVisible();
  });

  test("a second move keeps the first's details", async ({ page, request }) => {
    const { appId, round, label } = await bookedRound(request, "Second Move Co", "Second move");
    const move = async (data: object, count: number) => {
      const patched = await request.patch(`${API}/interviews/${round.id}`, { data });
      expect(patched.ok()).toBe(true);
      expect(((await patched.json()) as Round).rescheduled_count).toBe(count);
    };
    const first = inDays(8);
    const second = inDays(10);
    await move(
      { starts_at: first, reschedule_by: "mutual", reschedule_reason: "Second move first clash" },
      1,
    );
    await move({ starts_at: second, reschedule_by: "me" }, 2);
    await expectBoth(page, appId, label, [
      `Moved from ${dayTime(round.starts_at)} to ${dayTime(first)} · You both needed the change · Second move first clash`,
      `Moved from ${dayTime(first)} to ${dayTime(second)} · You needed the change`,
    ]);
  });

  test("an old-style round shows only the old text", async ({ page, request }) => {
    const { appId, label } = await bookedRound(request, "Old Style Co", "Old style");
    const old = `${label} rescheduled: An old clash`;
    // What the app saved before moves were recorded: words, and no record of the move.
    await post(request, `applications/${appId}/activities`, { kind: "interview", summary: old });
    for (const path of [`/applications/${appId}`, "/timeline"]) {
      await page.goto(path);
      const words = page.getByText(old, { exact: true });
      await expect(words).toBeVisible();
      await expect(words.locator("..")).not.toContainText("Moved from");
    }
    await page.goto(`/applications/${appId}`);
    await expect(page.getByText(/^Moved from/)).toHaveCount(0);
  });
});

test.describe("what the dialog asks", () => {
  test("asks for who before it saves, and sends nothing until then", async ({ page, request }) => {
    const { appId, round, label } = await bookedRound(request, "Who Required Co", "Required");
    await page.goto(`/applications/${appId}`);
    const dialog = await openDialog(page, label);
    await moveDay(page, dialog);
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") writes.push(r.url());
    });
    await submit(dialog);
    await expect(dialog.getByText("Choose who needed the change")).toBeVisible();
    expect(writes).toEqual([]);
    await pickWho(page, dialog, "Both of us");
    await expect(dialog.getByText("Choose who needed the change")).toBeHidden();
    await submit(dialog);
    await expect(dialog).toBeHidden();
    expect((await roundNow(request, round.id)).rescheduled_count).toBe(1);
  });

  test("Cancel saves nothing, and the next open starts empty", async ({ page, request }) => {
    const { appId, round, label } = await bookedRound(request, "Cancelled Move Co", "Called off");
    await page.goto(`/applications/${appId}`);
    const dialog = await openDialog(page, label);
    await moveDay(page, dialog);
    await pickWho(page, dialog, "Them");
    await dialog.getByLabel("Why? (optional)").fill("Never mind");
    const writes: string[] = [];
    page.on("request", (r) => {
      if (r.method() !== "GET") writes.push(r.url());
    });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(writes).toEqual([]);
    const after = await roundNow(request, round.id);
    expect(after.starts_at).toBe(round.starts_at);
    expect(after.rescheduled_count).toBe(0);
    expect(await moves(request, appId)).toEqual([]);

    const again = await openDialog(page, label);
    await expect(who(again)).toHaveValue("");
    await expect(again.getByLabel("Why? (optional)")).toHaveValue("");
  });

  test("a reason can't run past its limit", async ({ page, request }) => {
    const { appId, label } = await bookedRound(request, "Long Reason Co", "Long reason");
    await page.goto(`/applications/${appId}`);
    const dialog = await openDialog(page, label);
    await expect(dialog.getByLabel("Why? (optional)")).toHaveAttribute("maxlength", "500");
  });
});

test.describe("the button is wherever a booked round shows", () => {
  test("Interviews: a round moved from here is saved", async ({ page, request }) => {
    const { appId, label } = await bookedRound(request, "From Interviews Co", "On interviews");
    await page.goto("/interviews");
    const dialog = await openDialog(page, label);
    await moveDay(page, dialog);
    await pickWho(page, dialog, "Me");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await moves(request, appId))[0]?.data.reschedule?.by).toBe("me");
  });

  test("Interviews on a phone: the table scrolls to the button instead of cutting it off", async ({
    page,
    request,
  }) => {
    const { label } = await bookedRound(request, "Phone Width Co", "On a phone");
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto("/interviews");
    const button = page.getByRole("button", { name: `Reschedule ${label}` });
    await expect(button).toBeVisible();
    const scroller = page.locator(".mantine-ScrollArea-viewport").filter({ has: button });
    await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(async () => {
      const box = await button.boundingBox();
      expect((box?.x ?? 999) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
    }).toPass();
  });

  test("Today: a round coming up, and one awaiting its outcome", async ({ page, request }) => {
    const soon = await bookedRound(request, "From Today Co", "On today");
    const past = await bookedRound(request, "From Today Past Co", "Past today", -1);
    await page.goto("/");
    await expect(page.getByRole("button", { name: `Reschedule ${past.label}` })).toBeVisible();
    const dialog = await openDialog(page, soon.label);
    await moveOneDay(page, dialog);
    await pickWho(page, dialog, "Them");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await moves(request, soon.appId))[0]?.data.reschedule?.by).toBe("them");
    // The new time is on the row with no reload.
    const moved = await roundNow(request, soon.round.id);
    const line = page
      .locator(".mantine-Stack-root")
      .filter({ has: page.getByRole("button", { name: `Reschedule ${soon.label}` }) })
      .last();
    await expect(line).toContainText(dayMonth(moved.starts_at));
    await expect(line).not.toContainText(dayMonth(soon.round.starts_at));
  });

  test("the quick view: moves the round, and its end with it", async ({ page, request }) => {
    const { appId, round, label } = await bookedRound(request, "From Quick View Co", "On quick view");
    const withEnd = await request.patch(`${API}/interviews/${round.id}`, {
      data: { ends_at: new Date(Date.parse(round.starts_at ?? "") + 3_600_000).toISOString() },
    });
    expect(withEnd.ok()).toBe(true);
    await page.goto("/applications");
    await page.getByRole("row").filter({ hasText: "From Quick View Co" }).click();
    const drawer = page.getByRole("dialog").filter({ hasText: "From Quick View Co" });
    const dialog = await openDialog(page, label, drawer);
    await moveDay(page, dialog);
    await pickWho(page, dialog, "Both of us");
    await submit(dialog);
    await expect(dialog).toBeHidden();
    await expect(drawer).toBeVisible();
    await expect.poll(async () => (await moves(request, appId))[0]?.data.reschedule?.by).toBe("mutual");
    const moved = (await roundNow(request, round.id)) as Round & { ends_at: string };
    expect(Date.parse(moved.ends_at) - Date.parse(moved.starts_at ?? "")).toBe(3_600_000);
    // The quick view's round shows the new day straight away, and still does after a page refresh.
    const badge = (where: Locator) => where.getByText(new RegExp(`^${label} · `));
    await expect(badge(drawer)).toContainText(dayMonth(moved.starts_at));
    await page.reload();
    await page.getByRole("row").filter({ hasText: "From Quick View Co" }).click();
    await expect(badge(drawer)).toContainText(dayMonth(moved.starts_at));
  });

  test("not on a round with no time, or one that's finished", async ({ page, request }) => {
    const { appId, label } = await bookedRound(request, "Not Booked Co", "Finished");
    const interviews = `applications/${appId}/interviews`;
    await post(request, interviews, { title: "Undated" });
    const done = await post<Round>(request, interviews, {
      title: "Done one",
      starts_at: inDays(-3),
      status: "done",
    });
    expect(done.id).toBeTruthy();
    await page.goto(`/applications/${appId}`);
    await expect(page.getByRole("button", { name: `Reschedule ${label}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Round 2 · Undated" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Edit Round 3 · Done one" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reschedule Round 2 · Undated" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Reschedule Round 3 · Done one" })).toBeHidden();
  });
});
