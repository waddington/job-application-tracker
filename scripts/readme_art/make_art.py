"""Build the README's artwork: three SVGs, each in English and Simplified Chinese.

    uv run --with 'fonttools[woff]' --with uharfbuzz python scripts/readme_art/make_art.py

Writes docs/screenshots/readme-hero.svg, readme-stages.svg and readme-data.svg, and their twins under
docs/screenshots/zh-CN/ (the only place tests/test_readme_parity.py looks for Chinese images).

- Original art in the website's palette (docs/rfc/website-redesign.md). Light only.
- Text is drawn as outlines, so it looks the same everywhere: an SVG shown as an image can't load
  fonts. Inter and JetBrains Mono come from the frontend's packages (`pnpm --dir frontend install`);
  Chinese from Noto Sans CJK's two collections, Regular and Bold. If they aren't at the Debian/Ubuntu
  path, set NOTO_CJK to a pattern with {} where the style goes: NOTO_CJK=/path/NotoSansCJK-{}.ttc.
- The still picture is the final state. Motion plays once, in under 5 seconds, and only when the
  reader allows motion (prefers-reduced-motion).
- The names are the demo data's, made up (scripts/seed_demo.py).
- Check every change with DAST before it's committed (docs/agents/working-with-kai.md): this
  Inter build has no serifed I, so "AI" would read "Al"; the script draws the serifs itself.
"""

from __future__ import annotations

import io
import os
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.ttLib import TTCollection, TTFont
from fontTools.varLib import instancer

ROOT = Path(__file__).resolve().parents[2]
FONTS = ROOT / "frontend" / "node_modules" / "@fontsource-variable"
NOTO = os.environ.get("NOTO_CJK", "/usr/share/fonts/opentype/noto/NotoSansCJK-{}.ttc")
OUT = {"en": ROOT / "docs" / "screenshots", "zh": ROOT / "docs" / "screenshots" / "zh-CN"}

C = dict(
    page="#f4f1fb",
    page2="#fcf6f0",
    ink="#2a1e3f",
    soft="#665c78",
    card="#ffffff",
    well="#faf8fe",
    line="#b9aed0",
    lilac="#e9e4f8",
    sky="#dde8f7",
    butter="#f8efcd",
    pink="#f6e0e5",
    mint="#d9efe3",
    apricot="#f7e5d3",
)

WORDS = {
    "en": dict(
        name="Job Application Tracker",
        head=("Track every application,", "recruiter and interview."),
        sub="A job search tracker that runs on your own computer.",
        nos=["No AI.", "No cloud.", "No account.", "No tracking."],
        rec=("AM", "Alex Morgan", "Northwind Talent · 3 roles pitched"),
        app=("C", "Contoso", "Senior Backend Engineer"),
        stage_now="Interviewing",
        intv=("24", "Round 3 · System design", "Tue 14:00"),
        links=("pitched", "booked"),
        flow="How an application moves",
        ends="or it ends",
        stages=["Interested", "Applied", "Screen", "Interviewing", "Final", "Offer", "Accepted"],
        ended=["Declined", "Rejected", "Withdrawn", "Ghosted"],
        anyway="Any stage to any stage. Every move timestamped, with undo.",
        data="Where your data lives",
        browser="Your browser",
        the_app="The app",
        folder="Your folder",
        remote="Your private remote",
        optional="only if you want it",
        local="all on your computer",
        alt_hero="Job Application Tracker: track every application, recruiter and interview. A recruiter pitched a "
        "role, you applied, an interview got booked. A job search tracker that runs on your own computer. "
        "No AI. No cloud. No account. No tracking.",
        alt_stages="How an application moves: Interested, Applied, Screen, Interviewing, Final, Offer, Accepted; or it "
        "ends as Declined, Rejected, Withdrawn or Ghosted. Any stage to any stage, every move timestamped, with undo.",
        alt_data="Where your data lives: your browser talks to the app on 127.0.0.1, which keeps everything in your "
        "folder (tracker.sqlite3, export/*.jsonl, notes/*.md, files/), all on your computer; jat push copies it to "
        "your private remote, only if you want it.",
    ),
    "zh": dict(
        name="求职申请追踪器",
        head=("申请、招聘顾问、面试，", "全都记在一处。"),
        sub="一个运行在你自己电脑上的求职追踪器。",
        nos=["不用 AI。", "不上云。", "无需账号。", "不追踪你。"],
        rec=("林", "林雨桐", "招聘顾问 · 推荐了 3 个职位"),
        app=("墨", "墨砚软件", "高级后端工程师"),
        stage_now="面试中",
        intv=("24", "第 3 轮 · 系统设计", "周二 14:00"),
        links=("推荐", "约面"),
        flow="一份申请怎样推进",
        ends="或者就此结束",
        stages=["感兴趣", "已投递", "初筛", "面试中", "终面", "已获 Offer", "已接受"],
        ended=["已婉拒", "未通过", "已撤回", "已失联"],
        anyway="任意阶段之间都能移动。每次变动都记下时间，也能撤销。",
        data="你的数据存在哪里",
        browser="你的浏览器",
        the_app="这个应用",
        folder="你的文件夹",
        remote="你的私有远程仓库",
        optional="需要时才用",
        local="全都在你的电脑上",
        alt_hero="求职申请追踪器：申请、招聘顾问、面试，全都记在一处。招聘顾问推荐了一个职位，你投递了，约好了面试。"
        "一个运行在你自己电脑上的求职追踪器。不用 AI。不上云。无需账号。不追踪你。",
        alt_stages="一份申请怎样推进：感兴趣、已投递、初筛、面试中、终面、已获 Offer、已接受；"
        "或者以已婉拒、未通过、已撤回或已失联结束。任意阶段之间都能移动，每次变动都记下时间，也能撤销。",
        alt_data="你的数据存在哪里：你的浏览器连接运行在 127.0.0.1 上的这个应用，"
        "所有内容都存在你的文件夹里（tracker.sqlite3、export/*.jsonl、notes/*.md、files/），"
        "全都在你的电脑上；需要时才用 jat push 复制到你的私有远程仓库。",
    ),
}


class Face:
    def __init__(self, font: TTFont):
        font.flavor = None
        buf = io.BytesIO()
        font.save(buf)
        data = buf.getvalue()
        self.font = TTFont(io.BytesIO(data))
        self.hb = hb.Font(hb.Face(data))
        self.upm = self.font["head"].unitsPerEm
        self.cmap = self.font.getBestCmap()
        self.glyphs = self.font.getGlyphSet()
        self.order = self.font.getGlyphOrder()


def variable(path: str, weight: int) -> Face:
    file = FONTS / path
    if not file.exists():
        raise SystemExit(f"Missing {file}: run `pnpm --dir frontend install` first.")
    return Face(instancer.instantiateVariableFont(TTFont(file), {"wght": weight}))


def cjk(style: str) -> Face:
    if "{}" not in NOTO:
        raise SystemExit("NOTO_CJK needs {} where the style goes, e.g. /path/NotoSansCJK-{}.ttc")
    file = Path(NOTO.format(style))
    if not file.exists():
        raise SystemExit(f"Missing {file}: install Noto Sans CJK, or point NOTO_CJK at its collections.")
    fonts = TTCollection(str(file)).fonts
    return Face(next(f for f in fonts if f["name"].getDebugName(1).endswith(" SC")))


SANS = {w: variable("inter/files/inter-latin-wght-normal.woff2", w) for w in (300, 400, 600)}
MONO = variable("jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2", 500)
REG, BOLD = cjk("Regular"), cjk("Bold")


class Svg:
    def __init__(self, w: int, h: int, lang: str):
        self.w, self.h, self.lang, self.t = w, h, lang, WORDS[lang]
        self.body: list[str] = []
        self.defs: list[str] = []
        self.css: list[str] = []
        self.ids: dict[tuple[int, int], str] = {}

    def glyph(self, face: Face, gid: int) -> str:
        key = (id(face), gid)
        if key not in self.ids:
            pen = SVGPathPen(face.glyphs, lambda v: str(round(v)))
            face.glyphs[face.order[gid]].draw(pen)
            self.ids[key] = f"g{len(self.ids)}"
            self.defs.append(f'<path id="{self.ids[key]}" d="{pen.getCommands()}"/>')
        return self.ids[key]

    def shape(self, text: str, size: float, weight: int = 400, mono: bool = False):
        """Glyphs placed along a line: Latin in Inter (or JetBrains Mono), the rest in Noto Sans CJK."""
        main = MONO if mono else SANS[weight]
        runs: list[list] = []
        for ch in text:
            face = main if ord(ch) in main.cmap else (BOLD if weight >= 600 else REG)
            if runs and runs[-1][0] is face:
                runs[-1][1] += ch
            else:
                runs.append([face, ch])
        x, placed = 0.0, []
        for face, run in runs:
            buf = hb.Buffer()
            buf.add_str(run)
            buf.guess_segment_properties()
            hb.shape(face.hb, buf, {"kern": True})
            k = size / face.upm
            prev = None
            for info, pos in zip(buf.glyph_infos, buf.glyph_positions, strict=True):
                name, c = face.order[info.codepoint], info.cluster
                alone = (c < 2 or not run[c - 2].isalpha()) and (c + 1 >= len(run) or not run[c + 1].isalpha())
                if name == "I" and prev == "A" and alone and not mono:
                    # The word "AI": add the serifs Inter's cv08 would, so it can't read "Al".
                    bounds = BoundsPen(face.glyphs)
                    face.glyphs["I"].draw(bounds)
                    x0, y0, x1, y1 = bounds.bounds
                    stem = x1 - x0
                    x += stem * 1.1 * k
                    placed.append(("serif", (x0 - stem * 1.1, x1 + stem * 1.1, y0, y1, stem * 0.92), x, 0.0, k))
                    placed.append((face, info.codepoint, x + pos.x_offset * k, pos.y_offset * k, k))
                    x += (pos.x_advance + stem * 1.1) * k
                else:
                    placed.append((face, info.codepoint, x + pos.x_offset * k, pos.y_offset * k, k))
                    x += pos.x_advance * k
                prev = name
        return x, placed

    def text(self, x, y, text, size, weight=400, fill="ink", mono=False, anchor="start", room=None) -> float:
        width, placed = self.shape(text, size, weight, mono)
        if room is not None and width > room:
            raise SystemExit(f"{self.lang}: {text!r} is {width:.0f} px wide, room for {room:.0f}")
        x -= width / 2 if anchor == "middle" else 0
        parts = []
        for face, g, gx, gy, k in placed:
            if face == "serif":
                a, b, lo, hi, th = g
                for yy in (lo, hi - th):
                    parts.append(
                        f'<rect x="{x + gx + a * k:.1f}" y="{y - (yy + th) * k:.1f}" '
                        f'width="{(b - a) * k:.1f}" height="{th * k:.1f}"/>'
                    )
            elif face.order[g] != "space":
                parts.append(
                    f'<use href="#{self.glyph(face, g)}" transform="translate({x + gx:.1f} {y - gy:.1f}) '
                    f'scale({k:.4f} {-k:.4f})"/>'
                )
        self.add(f'<g fill="{C[fill]}">{"".join(parts)}</g>')
        return width

    def add(self, s: str) -> None:
        self.body.append(s)

    def rect(self, x, y, w, h, fill, r=14, extra="") -> None:
        self.add(
            f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" rx="{r}" '
            f'fill="{C.get(fill, fill)}" {extra}/>'
        )

    def card(self, x, y, w, h) -> None:
        self.rect(x, y, w, h, "card", 22, f'stroke="{C["lilac"]}" stroke-width="2"')

    def pill(self, right, y, label, tone, size=11.5, h=24) -> None:
        w = self.shape(label, size, 600)[0] + 22
        self.rect(right - w, y, w, h, tone, h / 2)
        self.text(right - w + 11, y + h / 2 + size * 0.36, label, size, 600)

    def arrow(self, x1, y, x2, dash=False) -> None:
        d = ' stroke-dasharray="6 7"' if dash else ""
        self.add(
            f'<path d="M{x1} {y}H{x2}" fill="none" stroke="{C["line"]}" stroke-width="2.5"{d}/>'
            f'<path d="M{x2 - 8} {y - 7}L{x2} {y}L{x2 - 8} {y + 7}" fill="none" '
            f'stroke="{C["line"]}" stroke-width="2.5"/>'
        )

    def logo(self, x, y, size) -> None:
        self.add(
            f'<g transform="translate({x} {y}) scale({size / 24})">'
            '<rect width="24" height="24" rx="6" fill="url(#logo)"/>'
            '<g fill="none" stroke="#fff" stroke-width="2"><circle cx="12" cy="12" r="8"/>'
            '<circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/></g></g>'
        )

    def begin(self, cls: str) -> None:
        self.add(f'<g class="{cls}">')

    def end(self) -> None:
        self.add("</g>")

    def fade(self, cls, delay, dx=0, dy=14, dur=0.6) -> None:
        """Comes in from (dx, dy) once; the still picture has it in place."""
        self.css.append(
            f"@keyframes {cls}{{from{{opacity:0;transform:translate({dx}px,{dy}px)}}}}"
            f".{cls}{{animation:{cls} {dur}s {delay}s both cubic-bezier(.22,.61,.24,1)}}"
        )

    def save(self, name: str, alt: str) -> None:
        css = f"<style>@media (prefers-reduced-motion:no-preference){{{''.join(self.css)}}}</style>" if self.css else ""
        alt = alt.replace("&", "&amp;").replace("<", "&lt;")
        path = OUT[self.lang] / name
        path.write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" '
            f'width="{self.w}" height="{self.h}" role="img"><title>{alt}</title>{css}<defs>'
            f'<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{C["page"]}"/>'
            f'<stop offset="1" stop-color="{C["page2"]}"/></linearGradient>'
            '<linearGradient id="logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4a3a68"/>'
            '<stop offset="1" stop-color="#8c74d8"/></linearGradient>'
            f'{"".join(self.defs)}</defs><rect width="{self.w}" height="{self.h}" rx="34" fill="url(#bg)"/>'
            f"{''.join(self.body)}</svg>\n",
            encoding="utf-8",
        )
        print(path.relative_to(ROOT), f"{path.stat().st_size // 1024} KB")


def hero(s: Svg) -> None:
    """The name and headline, and a recruiter's pitch becoming an application and then an interview."""
    t = s.t
    s.logo(64, 56, 42)
    s.text(122, 85, t["name"], 22, 600)
    s.text(64, 172, t["head"][0], 46, 300, room=580)
    s.text(64, 230, t["head"][1], 46, 300, room=580)
    s.text(64, 282, t["sub"], 18, fill="soft", room=580)
    x = 64
    for i, no in enumerate(t["nos"]):
        s.begin(f"no{i}")
        x += s.text(x, 344, no, 19, 600) + 13
        s.end()
        s.fade(f"no{i}", 0.3 + i * 0.25, 0, 10)
    w, h = 340, 88
    spots = [(668, 40), (740, 162), (812, 284)]
    for i, ((x, y), (nx, ny)) in enumerate(zip(spots, spots[1:], strict=False)):
        lx, ly = x + 64, y + h + 6
        s.begin(f"l{i}")
        s.add(
            f'<path d="M{lx} {ly}V{ny + h / 2}H{nx - 12}" fill="none" stroke="{C["line"]}" stroke-width="2.5"/>'
            f'<path d="M{nx - 20} {ny + h / 2 - 7}L{nx - 12} {ny + h / 2}L{nx - 20} {ny + h / 2 + 7}" fill="none" '
            f'stroke="{C["line"]}" stroke-width="2.5"/>'
        )
        s.text(lx + 12, ly + 24, t["links"][i], 14, 600, fill="soft", mono=s.lang == "en")
        s.end()
        s.fade(f"l{i}", 0.95 + i * 0.7, 0, -6, 0.5)
    cards = [(t["rec"], "butter", True), (t["app"], "sky", False), (t["intv"], "mint", False)]
    for i, ((x, y), ((mark, a, b), tone, round_)) in enumerate(zip(spots, cards, strict=True)):
        s.begin(f"c{i}")
        s.card(x, y, w, h)
        if round_:
            s.add(f'<circle cx="{x + 42}" cy="{y + h / 2}" r="25" fill="{C[tone]}"/>')
        else:
            s.rect(x + 17, y + h / 2 - 25, 50, 50, tone, 14)
        s.text(x + 42, y + h / 2 + 7, mark, 17 if len(mark) > 1 else 20, 600, anchor="middle")
        s.text(x + 82, y + 39, a, 17, 600, room=w - 96 - (110 if i == 1 else 0))
        s.text(x + 82, y + 64, b, 14, fill="soft", room=w - 96)
        if i == 1:
            s.pill(x + w - 14, y + 14, t["stage_now"], "lilac")
        s.end()
        s.fade(f"c{i}", 0.4 + i * 0.7, 0, 14, 0.6)
    s.save("readme-hero.svg", t["alt_hero"])


def stages(s: Svg) -> None:
    """The default stages as board columns, a card arriving in each, and the ways it can end."""
    t = s.t
    s.text(48, 64, t["flow"], 28, 300)
    tones = ["lilac", "sky", "butter", "lilac", "pink", "mint", "mint"]
    for i, (label, tone) in enumerate(zip(t["stages"], tones, strict=True)):
        x = 48 + i * 159
        s.rect(x, 92, 148, 132, "well", 22)
        s.rect(x + 10, 102, 128, 30, tone, 15)
        s.text(x + 74, 122, label, 14.5, 600, anchor="middle", room=120)
        s.begin(f"b{i}")
        s.rect(x + 12, 146, 124, 60, "card" if i < 6 else "mint", 15)
        s.rect(x + 26, 164, 64, 8, "line", 4)
        s.rect(x + 26, 182, 38, 6, tone, 3)
        s.end()
        s.fade(f"b{i}", 0.2 + i * 0.4, -20, 0)
    s.text(48, 280, f"{t['ends']}{':' if s.lang == 'en' else '：'}", 16, fill="soft")
    x = 48 + s.shape(t["ends"] + ":", 16)[0] + 22
    for label in t["ended"]:
        w = s.shape(label, 14, 600)[0] + 28
        s.rect(x, 259, w, 31, "card", 15)
        s.text(x + 14, 280, label, 14, 600, fill="soft")
        x += w + 8
    s.text(x + 20, 280, t["anyway"], 14.5, fill="soft", room=1152 - x - 20)
    s.save("readme-stages.svg", t["alt_stages"])


def data(s: Svg) -> None:
    """The browser, the app on localhost and the data folder on your computer; a private remote if you want one."""
    t = s.t
    s.text(48, 64, t["data"], 28, 300)
    s.rect(36, 92, 798, 206, "well", 26)
    s.text(64, 276, t["local"], 16, fill="soft")
    s.rect(64, 120, 190, 122, "sky", 22)
    s.text(159, 174, t["browser"], 18, 600, anchor="middle", room=170)
    s.text(159, 204, "127.0.0.1", 14, fill="soft", mono=True, anchor="middle")
    s.arrow(264, 181, 310)
    s.rect(320, 120, 180, 122, "lilac", 22)
    s.logo(389, 136, 42)
    s.text(410, 208, t["the_app"], 18, 600, anchor="middle", room=160)
    s.arrow(510, 181, 556)
    s.rect(566, 112, 242, 162, "butter", 22)
    s.text(586, 144, t["folder"], 18, 600)
    for i, name in enumerate(["tracker.sqlite3", "export/*.jsonl", "notes/*.md", "files/"]):
        s.begin(f"k{i}")
        s.text(586, 176 + i * 26, name, 14, fill="soft", mono=True)
        s.end()
        s.fade(f"k{i}", 0.3 + i * 0.4, -8, 0)
    s.arrow(844, 181, 900, True)
    s.text(872, 160, "jat push", 12, fill="soft", mono=True, anchor="middle")
    s.add(
        f'<rect x="910" y="120" width="254" height="122" rx="22" fill="none" stroke="{C["line"]}" '
        'stroke-width="2.5" stroke-dasharray="6 7"/>'
    )
    s.text(1037, 174, t["remote"], 18, 600, anchor="middle", room=230)
    s.text(1037, 204, t["optional"], 15, fill="soft", anchor="middle")
    s.save("readme-data.svg", t["alt_data"])


def main() -> None:
    for lang in WORDS:
        hero(Svg(1200, 420, lang))
        stages(Svg(1200, 320, lang))
        data(Svg(1200, 324, lang))


if __name__ == "__main__":
    main()
