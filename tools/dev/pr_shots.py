"""Before-and-after screenshots for a PR that changes the UI (tools/dev/pr_shots.sh runs this).

A view is "<label>=<path>[@375][@full][@light][@sel=<css>][@click=<text>]":
  label       what the row is called in the table ("Board card, not booked")
  path        the page, e.g. /applications?view=board; {application:Contoso} and the like are looked
              up by name in the demo data (scripts/i18n/translate/screenshots.py)
  @375        phone width (1440 px otherwise)        @full   the whole page, not just the first screen
  @light      light mode (dark otherwise)            @sel=   only the first element matching this CSS
  @click=     click the first element with this text first (to open a menu or dialog)

  check <view>...                          checks the views (pr_shots.sh does this before building)
  shoot <base url> <out dir> <before|after> <view>...
                                           one PNG per view, named after its label. A view main doesn't
                                           have (its page is "Page not found", or its @sel/@click isn't
                                           there) is left out of "before", where the table says "(none)";
                                           missing from "after" it's an error, as the view is wrong.
  upload <dir> <branch> <view>...          <dir>/before and <dir>/after go on the pr-shots branch under
                                           <branch>/, and the Item / Before / After table is printed

Demo data only: the shots come from a seeded demo folder, never Kai's tracker.
"""

import base64
import hashlib
import json
import re
import subprocess
import sys
from dataclasses import dataclass, replace
from pathlib import Path

REPO = "waddington/job-application-tracker"
SHOTS_BRANCH = "pr-shots"
RAW = f"https://raw.githubusercontent.com/{REPO}"
NOT_FOUND = "Page not found"  # common:notFound.title in English, which the shots use


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
        """The file name: the label's Latin letters and digits, or a hash of it (a Chinese label has none)."""
        latin = re.sub(r"[^a-z0-9]+", "-", self.label.lower()).strip("-")
        return latin or "view-" + hashlib.sha1(self.label.encode()).hexdigest()[:8]


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


def parse_views(specs: list[str]) -> list[View]:
    views = [parse_view(s) for s in specs]
    if len({v.slug for v in views}) != len(views):
        raise ValueError("two views have the same label")
    return views


def table(views: list[View], sha: str, folder: str, have: set[str]) -> str:
    """The Markdown table for the PR body. A side with no image (a view new or gone) says so."""

    def cell(side: str, view: View) -> str:
        name = f"{side}/{view.slug}.png"
        alt = re.sub(r"[\[\]\n|]", " ", view.label)
        return f"![{alt}, {side}]({RAW}/{sha}/{folder}/{name})" if name in have else "(none)"

    rows = [f"| {v.label.replace('|', chr(92) + '|')} | {cell('before', v)} | {cell('after', v)} |" for v in views]
    return "\n".join(["| Item | Before | After |", "| --- | --- | --- |", *rows])


def shoot(base: str, out: Path, side: str, views: list[View]) -> list[str]:
    """Shoots each view; returns the labels with no shot."""
    sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts/i18n/translate"))
    from playwright.sync_api import sync_playwright
    from screenshots import resolve  # the demo-data name lookup

    out.mkdir(parents=True, exist_ok=True)
    missing = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome")
        for v in views:
            ctx = browser.new_context(
                viewport={"width": v.width, "height": 900}, color_scheme=v.scheme, reduced_motion="reduce"
            )
            page = ctx.new_page()
            target = out / f"{v.slug}.png"
            try:
                page.goto(base + resolve(base, v.path), wait_until="networkidle")
                page.wait_for_timeout(800)
                if page.get_by_role("heading", name=NOT_FOUND).count():
                    raise LookupError(NOT_FOUND)
                if v.click:
                    page.get_by_text(v.click, exact=True).first.click(timeout=5000)
                    page.wait_for_timeout(600)
                if v.sel:
                    page.locator(v.sel).first.screenshot(path=str(target), timeout=5000)
                else:
                    page.screenshot(path=str(target), full_page=v.full)
                print(f"{side}: {v.label}")
            except (Exception, SystemExit) as e:  # SystemExit: resolve() found no such name in the demo data
                missing.append(v.label)
                print(f"{side}: {v.label}: no shot ({str(e).splitlines()[0][:140] if str(e) else type(e).__name__})")
            ctx.close()
        browser.close()
    return missing


def gh(method: str, path: str, body: dict | None = None) -> dict:
    out = subprocess.run(
        ["gh", "api", "-X", method, f"repos/{REPO}/{path}", *(["--input", "-"] if body else [])],
        input=json.dumps(body) if body else None,
        capture_output=True,
        text=True,
    )
    if out.returncode:
        raise RuntimeError(f"gh api {method} {path}: {(out.stderr or out.stdout).strip()[:200]}")
    return json.loads(out.stdout) if out.stdout.strip() else {}


def shots_head() -> str | None:
    """The pr-shots branch's commit, or None when it doesn't exist yet (any other failure is raised)."""
    try:
        return gh("GET", f"git/ref/heads/{SHOTS_BRANCH}")["object"]["sha"]
    except RuntimeError as e:
        if "404" in str(e) or "Not Found" in str(e):
            return None
        raise


def upload(folder_on_disk: Path, branch: str, views: list[View]) -> str:
    """Adds <branch>/before and <branch>/after to the pr-shots branch (made on first use) and returns the table."""
    folder = branch.removeprefix("worktree-")
    if not folder:
        sys.exit("no branch name (a detached HEAD?)")
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
    for attempt in range(3):  # another PR's upload can move the branch between our read and our write
        head = shots_head()
        base_tree = {"base_tree": gh("GET", f"git/commits/{head}")["tree"]["sha"]} if head else {}
        new_tree = gh("POST", "git/trees", {"tree": tree, **base_tree})
        commit = gh(
            "POST",
            "git/commits",
            {"message": f"Screenshots for {branch}", "tree": new_tree["sha"], "parents": [head] if head else []},
        )
        try:
            if head:
                gh("PATCH", f"git/refs/heads/{SHOTS_BRANCH}", {"sha": commit["sha"]})
            else:
                gh("POST", "git/refs", {"ref": f"refs/heads/{SHOTS_BRANCH}", "sha": commit["sha"]})
            break
        except RuntimeError:
            if attempt == 2:
                raise
    have = {f"{p.parent.name}/{p.name}" for p in files}
    return table(views, commit["sha"], folder, have)


def main(argv: list[str]) -> None:
    cmd, args = (argv[0], argv[1:]) if argv else ("", [])
    try:
        if cmd == "check" and args:
            print(f"{len(parse_views(args))} views")
        elif cmd == "shoot" and len(args) >= 4 and args[2] in ("before", "after"):
            missing = shoot(args[0].rstrip("/"), Path(args[1]), args[2], parse_views(args[3:]))
            if missing and args[2] == "after":
                sys.exit(f"no shot on this branch for: {', '.join(missing)} (check the path, @sel and @click)")
        elif cmd == "upload" and len(args) >= 3:
            print(upload(Path(args[0]), args[1], parse_views(args[2:])))
        else:
            sys.exit(__doc__)
    except ValueError as e:
        sys.exit(str(e))


if __name__ == "__main__":
    main(sys.argv[1:])
