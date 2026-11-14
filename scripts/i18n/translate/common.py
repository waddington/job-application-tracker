"""Shared helpers for the translation scripts (see README.md here).

Work files go in var/i18n/<lang>/<ns>/ (git-ignored): the English keys, the screen areas, the
screenshots, the workflow results. Nothing there is committed; it's rebuilt from the code each run.
"""

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EN = ROOT / "frontend" / "src" / "locales" / "en"
LOCALES = ROOT / "frontend" / "src" / "locales"
PAGES = Path(__file__).with_name("pages.json")

# {{name}}, and tags like <b>, </b>, <person/>.
PLACEHOLDER = re.compile(r"\{\{\s*[\w.]+\s*\}\}|</?\w+\s*/?>")
MARKER = "[TRANSLATE] "


def work_dir(lang: str, ns: str) -> Path:
    return ROOT / "var" / "i18n" / lang / ns


def start_file(lang: str, ns: str) -> Path:
    """The file new_language.mjs wrote, every line marked [TRANSLATE]: the shape to fill in."""
    return ROOT / "var" / "i18n" / lang / "start" / lang / f"{ns}.json"


def flatten(tree: dict, prefix: tuple = ()) -> dict[str, str]:
    """{"a": {"b": "x"}} -> {"a.b": "x"}, in file order."""
    out: dict[str, str] = {}
    for key, value in tree.items():
        path = (*prefix, key)
        if isinstance(value, dict):
            out.update(flatten(value, path))
        else:
            out[".".join(path)] = value
    return out


def fill(tree: dict, texts: dict[str, str], prefix: tuple = ()) -> dict:
    """The tree's shape with each leaf replaced by texts["a.b"]."""
    return {
        key: fill(value, texts, (*prefix, key)) if isinstance(value, dict) else texts[".".join((*prefix, key))]
        for key, value in tree.items()
    }


def tokens(text: str) -> Counter:
    """Each placeholder and tag, counted: a tag used twice must stay twice."""
    return Counter(t.replace(" ", "") for t in PLACEHOLDER.findall(text))


def tokens_differ(english: str, translated: str) -> bool:
    """True if a placeholder or tag was dropped, added or changed. {{count}} may be dropped (a language may
    write the number in words) but not added."""
    en, tr = tokens(english), tokens(translated)
    en["{{count}}"] = min(en["{{count}}"], tr["{{count}}"])
    return +en != +tr


def problems(english: dict[str, str], translated: dict[str, str]) -> list[str]:
    """What's wrong with a translation: missing or extra keys, markers left, placeholders or tags changed.

    The catalog test checks keys and placeholders but not tags, so this does both before anything is written.
    """
    found = [f"missing: {k}" for k in english if k not in translated]
    found += [f"not in English: {k}" for k in translated if k not in english]
    found += [f"still marked: {k}" for k, v in translated.items() if "[TRANSLATE]" in v]
    found += [
        f"placeholders or tags differ in {k}: {sorted(tokens(english[k]).elements())} vs "
        f"{sorted(tokens(translated[k]).elements())}"
        for k in english
        if k in translated and tokens_differ(english[k], translated[k])
    ]
    return found


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
