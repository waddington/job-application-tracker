"""Record every user-visible string on a set of pages, to diff before and after an i18n cutover.

Proves a cutover changed no English (docs/rfc/i18n.md §15):

    uv run python scripts/seed_demo.py /tmp/x/demo          # made-up data, the same both times
    # build main's frontend, then:
    uv run jat --data-dir /tmp/x/demo serve --port 8889
    uv run --with playwright python scripts/i18n/text_snapshot.py http://127.0.0.1:8889 before.json
    # build the branch's frontend, restart the server, then:
    uv run --with playwright python scripts/i18n/text_snapshot.py http://127.0.0.1:8889 after.json
    python3 scripts/i18n/text_diff.py before.json after.json   # "0 view parts differ"

Take both on the same day (the demo data is dated to today). For each page (and a few opened
dialogs and menus) it saves the page's innerText and every aria-label, title, placeholder and
alt in document order. It only reads: the dialogs it opens are closed again with Escape,
window.confirm is always cancelled, and nothing is ever saved. Needs the system Chrome.
"""

import json
import sys
import time

from playwright.sync_api import sync_playwright

BASE, OUT = sys.argv[1], sys.argv[2]

ATTRS = """() => {
  const out = [];
  for (const el of document.querySelectorAll('[aria-label],[title],[placeholder],[alt]')) {
    for (const a of ['aria-label', 'title', 'placeholder', 'alt']) {
      const v = el.getAttribute(a);
      if (v) out.push(a + '=' + v);
    }
  }
  return out;
}"""


def grab(page):
    time.sleep(1.2)
    return {"text": page.evaluate("() => document.body.innerText"), "attrs": page.evaluate(ATTRS)}


LINKS = """(prefix) => [...new Set(
  [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')).filter((h) => h.startsWith(prefix))
)]"""


def visit(page, path):
    page.goto(BASE + path)
    page.wait_for_load_state("networkidle")


snap = {}
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome")
    page = browser.new_page(viewport={"width": 1400, "height": 1000}, reduced_motion="reduce")
    page.on("dialog", lambda d: d.dismiss())  # window.confirm: always cancel

    pages = ["/", "/roles", "/applications", "/applications?view=board", "/interviews", "/offers"]
    pages += ["/recruiters", "/companies", "/documents", "/notes", "/insights", "/timeline", "/no-such-page"]
    for path in pages:
        visit(page, path)
        snap[path] = grab(page)

    # Detail pages reached from links, so the ids don't matter: applications from Today, people
    # from Recruiters.
    for start, prefix, name, most in [
        ("/", "/applications/", "application", 4),
        ("/recruiters", "/people/", "person", 3),
    ]:
        visit(page, start)
        for n, href in enumerate(page.evaluate(LINKS, prefix)[:most]):
            visit(page, href)
            snap[f"{name}#{n}"] = grab(page)

    # Today's dialogs and menus (opened and closed again, never confirmed).
    page.goto(BASE + "/")
    page.wait_for_load_state("networkidle")

    def opened(name, click):
        try:
            click()
            snap["today+" + name] = grab(page)
        except Exception as e:  # noqa: BLE001 - a missing button is recorded, not fatal
            snap["today+" + name] = {"text": f"(couldn't open: {type(e).__name__})", "attrs": []}
        page.keyboard.press("Escape")
        time.sleep(0.4)

    opened("how-it-works", lambda: page.get_by_role("button", name="How it works").first.click(timeout=3000))
    opened("follow-up-menu", lambda: page.locator("[aria-label^='Follow up on ']").first.click(timeout=3000))
    opened("snooze-menu", lambda: page.locator("[aria-label^='Snooze ']").first.click(timeout=3000))
    opened("happened", lambda: page.get_by_role("button", name="Happened").first.click(timeout=3000))
    opened("didnt-happen", lambda: page.get_by_role("button", name="Didn't happen").first.click(timeout=3000))
    opened("done-recently", lambda: page.get_by_role("button", name="Done recently").first.click(timeout=3000))

    # Applications: the quick view and its Move to… menu, the board's switches, New application
    # with each route, and the application page's Move to… menu.
    def step(name, *clicks):
        try:
            for click in clicks:
                click()
                time.sleep(0.3)
            snap[name] = grab(page)
        except Exception as e:  # noqa: BLE001
            snap[name] = {"text": f"(couldn't open: {type(e).__name__})", "attrs": []}

    visit(page, "/applications?view=list")
    step("applications+quick-view", lambda: page.locator("[aria-label^='Open ']").first.click(timeout=3000))
    step("applications+quick-view-move", lambda: page.get_by_role("button", name="Move to…").first.click(timeout=3000))
    page.keyboard.press("Escape")
    page.keyboard.press("Escape")
    time.sleep(0.4)
    visit(page, "/applications?view=board")
    step(
        "applications+board-closed-rounds",
        lambda: page.get_by_label("Show closed stages").click(timeout=3000),
        lambda: page.get_by_label("A column per interview round").click(timeout=3000),
    )
    page.get_by_label("A column per interview round").click(timeout=3000)  # back to the default
    visit(page, "/applications?view=list")
    new = page.get_by_role("button", name="New application").first
    step("applications+new", lambda: new.click(timeout=3000))
    step("applications+new-errors", lambda: page.get_by_role("button", name="Add application").click(timeout=3000))
    step("applications+new-agency", lambda: page.get_by_text("Through a recruiter").click(timeout=3000))
    dialog = page.get_by_role("dialog")
    step("applications+new-referral", lambda: dialog.get_by_text("Referral", exact=True).click(timeout=3000))
    page.keyboard.press("Escape")
    time.sleep(0.4)
    visit(page, "/")
    first_app = page.evaluate(LINKS, "/applications/")[:1]
    if first_app:
        visit(page, first_app[0])
        step("application+move", lambda: page.get_by_role("button", name="Move to…").first.click(timeout=3000))
    page.keyboard.press("Escape")

    # Roles: each view, a role's page, and the dialogs (add with its errors and contract fields,
    # edit, apply, interested, pass), each closed again.
    def view(name):
        page.locator(".mantine-SegmentedControl-root").get_by_text(name, exact=True).click(timeout=3000)

    visit(page, "/roles")
    for name in ["Interested", "Applied", "Closed", "Passed", "All"]:
        step("roles+" + name.lower(), lambda name=name: view(name))
    for n, href in enumerate(page.evaluate(LINKS, "/roles/")[:3]):
        visit(page, href)
        snap[f"role#{n}"] = grab(page)
    visit(page, "/roles")
    view("All")
    time.sleep(0.5)
    step("roles+add", lambda: page.get_by_role("button", name="Add role").first.click(timeout=3000))
    add_role = page.get_by_role("dialog").get_by_role("button", name="Add role")
    step("roles+add-errors", lambda: add_role.click(timeout=3000))
    step(
        "roles+add-contract",
        lambda: page.get_by_role("dialog").get_by_label("Type").click(timeout=3000),
        lambda: page.get_by_role("option", name="Contract").click(timeout=3000),
    )
    page.keyboard.press("Escape")
    page.keyboard.press("Escape")
    time.sleep(0.4)
    for name, label in [("edit", "Edit "), ("apply", "Apply: "), ("interested", "Interested: "), ("pass", "Pass: ")]:
        step("roles+" + name, lambda label=label: page.locator(f"[aria-label^='{label}']").first.click(timeout=3000))
        # Twice: the first may only close a dropdown inside the dialog.
        page.keyboard.press("Escape")
        page.keyboard.press("Escape")
        time.sleep(0.4)
    browser.close()

with open(OUT, "w") as f:
    json.dump(snap, f, indent=1, ensure_ascii=False)
print(f"{len(snap)} views -> {OUT}")
# A step that couldn't open compares nothing: say so, so "0 differ" isn't taken on trust.
missed = [name for name, view in snap.items() if view["text"].startswith("(couldn't open")]
if missed:
    print("couldn't open: " + ", ".join(missed))
    sys.exit(1)
