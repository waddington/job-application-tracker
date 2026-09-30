"""Run the PM dashboard: python3 -m tools.pm [--port 8767] [--root PATH]"""

import argparse
from pathlib import Path

from .server import serve

DEFAULT_ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    parser = argparse.ArgumentParser(description="Project-management dashboard for this repo.")
    parser.add_argument("--host", default="127.0.0.1", help="bind address (default: localhost only)")
    parser.add_argument("--port", type=int, default=8767)
    parser.add_argument("--root", type=Path, default=DEFAULT_ROOT, help="repo root containing docs/ROADMAP.yaml")
    parser.add_argument("--ttl", type=float, default=30, help="seconds to cache git/GitHub data")
    args = parser.parse_args()
    serve(args.root.resolve(), args.host, args.port, args.ttl)


if __name__ == "__main__":
    main()
