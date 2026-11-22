"""Build docs/social-preview.png, the card GitHub shows when the repo is shared (1280x640).

    python3 scripts/social_preview/make_card.py [--out card.png]

Needs google-chrome (headless), the Inter and Inter Display fonts installed, and the frontend's
packages (`pnpm --dir frontend install`, for JetBrains Mono). The card is card.html rendered by
Chrome. After building, upload the PNG by hand in the repo's Settings > General > Social preview;
the website copies it as its og:image.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parents[1] / "docs" / "social-preview.png"
MONO = HERE.parents[1] / "frontend" / "node_modules" / "@fontsource-variable" / "jetbrains-mono"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--out", type=Path, default=OUT)
    args = parser.parse_args()
    if not shutil.which("google-chrome"):
        sys.exit("Missing google-chrome: install Google Chrome first.")
    if not MONO.exists():
        sys.exit("Missing the card's font: run `pnpm --dir frontend install` first.")
    with tempfile.TemporaryDirectory() as profile:
        subprocess.run(
            [
                "google-chrome",
                "--headless=new",
                "--no-sandbox",
                f"--user-data-dir={profile}",
                "--window-size=1280,640",
                "--hide-scrollbars",
                "--force-device-scale-factor=1",
                "--allow-file-access-from-files",
                "--virtual-time-budget=3000",
                f"--screenshot={args.out.resolve()}",
                (HERE / "card.html").as_uri(),
            ],
            check=True,
            capture_output=True,
        )
    print(f"Wrote {args.out}")


if __name__ == "__main__":
    main()
