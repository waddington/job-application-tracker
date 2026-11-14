"""Write the translated JSON from the translate workflow's result, plus any review fixes.

Usage: uv run python scripts/i18n/translate/assemble.py <lang> <ns> [fixes.json ...]

Reads var/i18n/<lang>/<ns>/translate.json (save the workflow's result there). Refuses to write if a key
is missing or extra, a [TRANSLATE] marker is left, or a placeholder or tag differs from the English.
Writes frontend/src/locales/<lang>/<ns>.json, and translated.json plus areas/<id>.pairs.json for the review.
"""

import json
import sys
from pathlib import Path

from common import LOCALES, fill, problems, read_json, start_file, work_dir, write_json


def collect(result: dict, fixes: list[dict]) -> dict[str, str]:
    """Each area's translations, then the consistency pass's changes, then fixes, later ones winning."""
    texts: dict[str, str] = {}
    for area in result["results"]:
        for t in area.get("translations") or []:
            texts[t["key"]] = t["text"]
    for change in (result.get("consistency") or {}).get("changes") or []:
        texts[change["key"]] = change["to"]
    for f in fixes:
        texts.update(f)
    return texts


def main(lang: str, ns: str, *fix_files: str) -> None:
    work = work_dir(lang, ns)
    english = read_json(work / "flat.json")
    # A bare name is looked up in the work folder.
    paths = [Path(f) if Path(f).exists() else work / f for f in fix_files]
    texts = collect(read_json(work / "translate.json"), [read_json(p) for p in paths])
    found = problems(english, texts)
    if found:
        sys.exit("not written:\n  " + "\n  ".join(found))
    (LOCALES / lang / f"{ns}.json").write_text(
        json.dumps(fill(read_json(start_file(lang, ns)), texts), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    write_json(work / "translated.json", texts)
    for area in read_json(work / "areas.json"):
        keys = read_json(work / "areas" / f"{area['id']}.json")
        write_json(work / "areas" / f"{area['id']}.pairs.json", {k: {"en": v, lang: texts[k]} for k, v in keys.items()})
    print(f"wrote {ns}.json: {len(texts)} strings")


if __name__ == "__main__":
    main(*sys.argv[1:])
