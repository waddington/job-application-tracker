"""Build docs/screenshots/demo.gif: a quick tour, one scene per feature, with slides between.

    python3 scripts/demo_gif/make_demo_gif.py [--lang zh-CN] [--out preview.gif] [--hold 150]

Needs google-chrome (headless) and ImageMagick's `convert`. Each frame is scene.html rendered
by Chrome; the scenes are the screenshots in docs/screenshots (fictional demo data only), so
retake those first when the app changes. Edit SCENES in scene.html to change the tour.
--lang zh-CN builds docs/screenshots/zh-CN/demo.gif from the Chinese screenshots there, with
the Chinese captions (ZH and TEXT in scene.html).
"""

from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT = ROOT / "docs" / "screenshots" / "demo.gif"
LANGS = ("en", "zh-CN")  # en: docs/screenshots/; any other: docs/screenshots/<lang>/
# A new language also needs its captions in scene.html (as ZH), or it gets English captions.

HOLD = 150  # hundredths of a second each scene stays still
SLIDE = [0.2, 0.45, 0.7, 0.9]  # progress of the in-between frames
SLIDE_DELAY = 5  # hundredths of a second per in-between frame
WIDTH = 1000  # the GIF's width; scenes are 1280x720


def scene_count() -> int:
    html = (HERE / "scene.html").read_text(encoding="utf-8")
    body = html[html.index("const SCENES = [") : html.index("];", html.index("const SCENES = ["))]
    return len(re.findall(r"^\s*\{ (?:intro|title)", body, re.M))


def tools() -> tuple[list[str], list[str]]:
    """ImageMagick's commands: `magick` (7) when there is one, else `convert` and `identify` (6)."""
    missing = [t for t in ("google-chrome",) if not shutil.which(t)]
    if shutil.which("magick"):
        convert, identify = ["magick"], ["magick", "identify"]
    else:
        missing += [t for t in ("convert", "identify") if not shutil.which(t)]
        convert, identify = ["convert"], ["identify"]
    if missing:
        sys.exit(f"Missing {', '.join(missing)}: install Google Chrome and ImageMagick first.")
    return convert, identify


def render(url: str, png: Path, profile: str) -> None:
    result = subprocess.run(
        [
            "google-chrome",
            "--headless=new",
            "--no-sandbox",
            f"--user-data-dir={profile}",
            "--window-size=1280,720",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--allow-file-access-from-files",
            "--virtual-time-budget=4000",
            f"--screenshot={png}",
            url,
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0 or not png.exists():
        sys.exit(f"Chrome couldn't render {url}:\n{result.stderr}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--lang", choices=LANGS, default="en", help="the screenshots' and captions' language")
    parser.add_argument("--out", type=Path, help="where to write the GIF (default: the README's for that language)")
    parser.add_argument("--hold", type=int, default=HOLD, help="hundredths of a second per scene")
    args_in = parser.parse_args()
    lang, hold = args_in.lang, args_in.hold
    out = (args_in.out or (OUT if lang == "en" else OUT.parent / lang / OUT.name)).resolve()
    out.parent.mkdir(parents=True, exist_ok=True)
    convert, identify = tools()
    n = scene_count()
    base = (HERE / "scene.html").as_uri()
    extra = "" if lang == "en" else f"&lang={lang}"
    with tempfile.TemporaryDirectory() as tmp:
        frames: list[tuple[Path, int]] = []
        for i in range(n):
            still = Path(tmp) / f"{i:02d}-0.png"
            render(f"{base}?a={i}{extra}", still, f"{tmp}/chrome")
            frames.append((still, hold))
            for k, p in enumerate(SLIDE, start=1):
                png = Path(tmp) / f"{i:02d}-{k}.png"
                render(f"{base}?a={i}&b={(i + 1) % n}&p={p}{extra}", png, f"{tmp}/chrome")
                frames.append((png, SLIDE_DELAY))
            print(f"scene {i + 1}/{n}", flush=True)
        args = [*convert, "-loop", "0"]
        for png, delay in frames:
            args += ["-delay", str(delay), str(png)]
        args += ["-resize", f"{WIDTH}x", "-colors", "192", "-layers", "Optimize", str(out)]
        subprocess.run(args, check=True)
    count = subprocess.run([*identify, str(out)], capture_output=True, text=True, encoding="utf-8").stdout.count("\n")
    print(f"{out}: {count} frames, {out.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
