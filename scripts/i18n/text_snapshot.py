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
    browser.close()

with open(OUT, "w") as f:
    json.dump(snap, f, indent=1, ensure_ascii=False)
print(f"{len(snap)} views -> {OUT}")
