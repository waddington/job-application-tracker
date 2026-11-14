"""Get one string file ready to translate. Usage: uv run python scripts/i18n/translate/prepare.py <lang> <ns>

- Copies the marked starting file into frontend/src/locales/<lang>/<ns>.json (new_language.mjs makes
  them afresh in var/i18n/<lang>/start/ each run), and lists it in that folder's index.ts.
- Writes var/i18n/<lang>/<ns>/: flat.json (key -> English), areas.json, areas/<id>.json.

Areas are what the translators and reviewers each take: the file's top-level groups, merged in order
up to MAX_AREA keys, so a reviewer sees one part of the screen at a time. An area under MIN_AREA keys
joins a neighbour, which can take it a few keys over MAX_AREA.
"""

import re
import shutil
import subprocess
import sys

from common import EN, LOCALES, ROOT, flatten, read_json, start_file, work_dir, write_json

MAX_AREA = 30
MIN_AREA = 5


def areas(flat: dict[str, str], ns: str, max_size: int = MAX_AREA, min_size: int = MIN_AREA) -> list[dict]:
    """Top-level groups, in file order, merged while they fit in max_size keys. An area smaller than
    min_size joins the one before it (or after it, if it's first), so no agent gets a couple of strings."""
    groups: dict[str, list[str]] = {}
    for key in flat:
        groups.setdefault(key.split(".")[0], []).append(key)
    chunks: list[tuple[list[str], list[str]]] = []
    for group, keys in groups.items():
        if chunks and len(chunks[-1][1]) + len(keys) <= max_size:
            chunks[-1][0].append(group)
            chunks[-1][1].extend(keys)
        else:
            chunks.append(([group], list(keys)))
    merged: list[tuple[list[str], list[str]]] = []
    for prefixes, keys in chunks:
        # The second test only ever holds for the first area: a small one after that has
        # already joined the area before it.
        if merged and (len(keys) < min_size or len(merged[-1][1]) < min_size):
            merged[-1][0].extend(prefixes)
            merged[-1][1].extend(keys)
        else:
            merged.append((list(prefixes), list(keys)))
    chunks = merged
    return [
        {
            "id": f"{ns}-{i + 1}",
            "desc": f"the {ns} strings under: {', '.join(prefixes)}",
            "prefixes": prefixes,
            "keys": keys,
        }
        for i, (prefixes, keys) in enumerate(chunks)
    ]


def index_ts(names: list[str]) -> str:
    """A language folder's index.ts listing exactly these files."""
    imports = "".join(f'import {n} from "./{n}.json";\n' for n in names)
    return imports + "\nexport default {\n" + "".join(f"  {n},\n" for n in names) + "};\n"


def main(lang: str, ns: str) -> None:
    # The code new_language.mjs accepts, checked here too since a folder named by it is deleted below.
    if lang == "en" or not re.fullmatch(r"[a-z]{2,3}(-[A-Za-z0-9]+)*", lang):
        sys.exit(f"not a language code: {lang!r}")
    if not re.fullmatch(r"[a-z]+", ns) or not (EN / f"{ns}.ts").exists():
        sys.exit(f"no English file {ns}.ts")
    # Made fresh every time, so keys English gained since the last file are there.
    start = start_file(lang, ns)
    shutil.rmtree(start.parents[1], ignore_errors=True)
    subprocess.run(
        ["node", "--experimental-strip-types", "scripts/i18n/new_language.mjs", lang, str(start.parents[1])],
        cwd=ROOT,
        check=True,
    )
    folder = LOCALES / lang
    target = folder / f"{ns}.json"
    if target.exists() and "[TRANSLATE]" not in target.read_text(encoding="utf-8"):
        sys.exit(f"{target} is already translated; delete it first to start again")
    folder.mkdir(parents=True, exist_ok=True)
    target.write_text(start.read_text(encoding="utf-8"), encoding="utf-8")
    names = sorted({p.stem for p in folder.glob("*.json")})
    (folder / "index.ts").write_text(index_ts(names), encoding="utf-8")

    pages = [p["name"] for p in read_json(ROOT / "scripts" / "i18n" / "translate" / "pages.json").get(ns, [])]
    flat = {k: v.removeprefix("[TRANSLATE] ") for k, v in flatten(read_json(start)).items()}
    work = work_dir(lang, ns)
    write_json(work / "flat.json", flat)
    meta = []
    for area in areas(flat, ns):
        write_json(work / "areas" / f"{area['id']}.json", {k: flat[k] for k in area["keys"]})
        meta.append(
            {
                "id": area["id"],
                "desc": area["desc"],
                "prefixes": area["prefixes"],
                "count": len(area["keys"]),
                "shots": pages,
            }
        )
    write_json(work / "areas.json", meta)
    print(f"{ns}: {len(flat)} keys in {len(meta)} areas ({', '.join(str(m['count']) for m in meta)}); pages: {pages}")
    if not pages:
        print(f"no pages for {ns} in pages.json: add some so translators and reviewers see it in place")


if __name__ == "__main__":
    main(*sys.argv[1:3])
