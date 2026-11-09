"""Before-and-after screenshots for a PR that changes the UI (tools/dev/pr_shots.sh runs this).

A view is "<label>=<path>[@375][@full][@light][@sel=<css>][@click=<text>]":
  label       what the row is called in the table ("Board card, not booked")
  path        the page, e.g. /applications?view=board; {application:Contoso} and the like are looked
              up by name in the demo data (scripts/i18n/translate/screenshots.py)
  @375        phone width (1440 px otherwise)        @full   the whole page, not just the first screen
  @light      light mode (dark otherwise)            @sel=   only the first element matching this CSS
  @click=     click the first element with this text first (to open a menu or dialog)

  shoot <base url> <out dir> <view>...     one PNG per view, named after its label
  upload <dir> <branch> <view>...          <dir>/before and <dir>/after go on the pr-shots branch under
                                           <branch>/, and the Item / Before / After table is printed

Demo data only: the shots come from a seeded demo folder, never Kai's tracker.
"""

import base64
import json
import re
import subprocess
import sys
from dataclasses import dataclass, replace
from pathlib import Path

REPO = "waddington/job-application-tracker"
SHOTS_BRANCH = "pr-shots"
RAW = f"https://raw.githubusercontent.com/{REPO}"


@dataclass(frozen=True)
class View:
    label: str
    path: str
    width: int = 1440
    full: bool = False
    scheme: str = "dark"
    sel: str | None = None
    click: str | None = None

    @property
    def slug(self) -> str:
        return re.sub(r"[^a-z0-9]+", "-", self.label.lower()).strip("-") or "view"


def parse_view(spec: str) -> View:
    """ "Board card=/applications?view=board@375@sel=.card" -> View."""
    label, sep, rest = spec.partition("=")
    if not sep or not label.strip() or not rest.startswith(("/", "{")):
        raise ValueError(f"not a view (want <label>=<path>[@options]): {spec!r}")
    path, *opts = rest.split("@")
    view = View(label=label.strip(), path=path)
    for opt in opts:
        key, _, value = opt.partition("=")
        if key == "375":
            view = replace(view, width=375)
        elif key == "full":
            view = replace(view, full=True)
        elif key == "light":
            view = replace(view, scheme="light")
        elif key in ("sel", "click") and value:
            view = replace(view, **{key: value})
        else:
            raise ValueError(f"unknown option {opt!r} in {spec!r}")
    return view


def table(views: list[View], sha: str, folder: str, have: set[str]) -> str:
    """The Markdown table for the PR body. A side with no image (a view new or gone) says so."""

    def cell(side: str, view: View) -> str:
        name = f"{side}/{view.slug}.png"
        return f"![{view.label}, {side}]({RAW}/{sha}/{folder}/{name})" if name in have else "(none)"

    rows = [f"| {v.label} | {cell('before', v)} | {cell('after', v)} |" for v in views]
    return "\n".join(["| Item | Before | After |", "| --- | --- | --- |", *rows])


def shoot(base: str, out: Path, views: list[View]) -> None:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/i18n/translate"))
    from playwright.sync_api import sync_playwright
    from screenshots import resolve  # the demo-data name lookup

    out.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for v in views:
            ctx = browser.new_context(
                viewport={"width": v.width, "height": 900}, color_scheme=v.scheme, reduced_motion="reduce"
            )
            page = ctx.new_page()
            page.goto(base + resolve(base, v.path), wait_until="networkidle")
            page.wait_for_timeout(800)
            target = out / f"{v.slug}.png"
            try:
                if v.click:
                    page.get_by_text(v.click, exact=True).first.click()
                    page.wait_for_timeout(600)
                if v.sel:
                    page.locator(v.sel).first.screenshot(path=str(target), timeout=5000)
                else:
                    page.screenshot(path=str(target), full_page=v.full)
                print(target)
            except Exception as e:  # a view new in the branch has nothing to show on main, and that's fine
                print(f"{v.label}: no shot ({str(e).splitlines()[0][:120]})")
            ctx.close()
        browser.close()


def gh(method: str, path: str, body: dict | None = None) -> dict:
    out = subprocess.run(
        ["gh", "api", "-X", method, f"repos/{REPO}/{path}", *(["--input", "-"] if body else [])],
        input=json.dumps(body) if body else None,
        capture_output=True,
        text=True,
    )
    if out.returncode:
        raise RuntimeError(f"gh api {method} {path}: {out.stderr.strip()[:200]}")
    return json.loads(out.stdout) if out.stdout.strip() else {}


def upload(folder_on_disk: Path, branch: str, views: list[View]) -> str:
    """Adds <branch>/before and <branch>/after to the pr-shots branch (made on first use) and returns the table."""
    folder = branch.removeprefix("worktree-")
    files = sorted(p for side in ("before", "after") for p in (folder_on_disk / side).glob("*.png"))
    if not files:
        sys.exit("no screenshots to upload")

    def blob(p: Path) -> str:
        return gh("POST", "git/blobs", {"content": base64.b64encode(p.read_bytes()).decode(), "encoding": "base64"})[
            "sha"
        ]

    tree = [
        {"path": f"{folder}/{p.parent.name}/{p.name}", "mode": "100644", "type": "blob", "sha": blob(p)} for p in files
    ]
    try:
        head = gh("GET", f"git/ref/heads/{SHOTS_BRANCH}")["object"]["sha"]
        base_tree = gh("GET", f"git/commits/{head}")["tree"]["sha"]
    except RuntimeError:
        head = base_tree = None
    new_tree = gh("POST", "git/trees", {"tree": tree, **({"base_tree": base_tree} if base_tree else {})})
    commit = gh(
        "POST",
        "git/commits",
        {"message": f"Screenshots for {branch}", "tree": new_tree["sha"], "parents": [head] if head else []},
    )
    if head:
        gh("PATCH", f"git/refs/heads/{SHOTS_BRANCH}", {"sha": commit["sha"]})
    else:
        gh("POST", "git/refs", {"ref": f"refs/heads/{SHOTS_BRANCH}", "sha": commit["sha"]})
    have = {f"{p.parent.name}/{p.name}" for p in files}
    return table(views, commit["sha"], folder, have)


def main(argv: list[str]) -> None:
    if len(argv) < 4 or argv[0] not in ("shoot", "upload"):
        sys.exit(__doc__)
    views = [parse_view(s) for s in argv[3:]]
    if len({v.slug for v in views}) != len(views):
        sys.exit("two views have the same label")
    if argv[0] == "shoot":
        shoot(argv[1].rstrip("/"), Path(argv[2]), views)
    else:
        print(upload(Path(argv[1]), argv[2], views))


if __name__ == "__main__":
    main(sys.argv[1:])
