"""The dashboard's look: colour tokens for both themes, the styles, and the theme switch.

Everything is inline: the dashboard loads nothing from the web, so it works offline.
"""

from __future__ import annotations

CSS = """
:root,:root[data-theme="dark"]{color-scheme:dark;--bg:#0a0d13;--grid:rgba(148,163,184,.045);--panel:#0f131b;
--panel-2:#141a24;--hover:#18202c;--line:#1d2430;--line-2:#2a3342;--ink:#e7ebf3;--ink-2:#a3adbe;--ink-3:#7f899b;
--accent:#8ea2ff;--on-pill:#0a0d13;--bug:#e46565;--planned:#7a8496;--building:#5aa2ef;--review:#d39a12;--done:#9085e9;
--blocked:#e46565;--ok:#1faa77;--warn:#d39a12;--bad:#e46565}
:root[data-theme="light"]{color-scheme:light;--bg:#f3f5f8;--grid:rgba(30,41,59,.045);--panel:#fff;--panel-2:#f7f8fa;
--hover:#eef1f6;--line:#e2e6ed;--line-2:#cdd4df;--ink:#0e1420;--ink-2:#4a5568;--ink-3:#667084;--accent:#3f55e0;
--on-pill:#fff;--bug:#c93636;--planned:#667084;--building:#2268bd;--review:#8f6400;--done:#5a48c4;--blocked:#c93636;
--ok:#13925f;--warn:#b77b00;--bad:#c93636}
*{box-sizing:border-box}
body{margin:0;background-color:var(--bg);background-image:linear-gradient(var(--grid) 1px,transparent 1px),
linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:24px 24px;background-attachment:fixed;
color:var(--ink);font:13px/1.45 system-ui,-apple-system,"Segoe UI",sans-serif;font-feature-settings:"tnum" 1}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:3px}
code{font:12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}
.skip{position:absolute;left:-999px}.skip:focus{left:12px;top:8px;background:var(--panel);padding:6px 10px;z-index:10}
.top{position:sticky;top:0;z-index:5;display:flex;flex-wrap:wrap;align-items:stretch;gap:0 20px;min-height:48px;
padding:0 20px;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(10px);
border-bottom:1px solid var(--line)}
.brand{display:flex;align-items:center;gap:8px;white-space:nowrap}
.mark{width:15px;height:15px}.mark circle{fill:none;stroke:var(--accent);stroke-width:1.8}.mark path{fill:var(--accent)}
.brand-name{font-weight:700;font-size:14px;letter-spacing:-.02em}.brand-sub{color:var(--ink-3);font-size:12px}
.tabs{display:flex;gap:2px}
.tab{display:flex;align-items:center;padding:0 11px;min-height:47px;color:var(--ink-2);font-weight:500;
border-bottom:2px solid transparent;margin-bottom:-1px}
.tab:hover{color:var(--ink);text-decoration:none}.tab.active{color:var(--ink);border-bottom-color:var(--accent)}
.top-right{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;margin-left:auto;padding:6px 0;font-size:12px}
.live{display:inline-flex;align-items:center;gap:7px;color:var(--ink-2)}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--ok);
box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 22%,transparent)}
.live.down .live-dot{background:var(--bad);box-shadow:0 0 0 3px color-mix(in srgb,var(--bad) 22%,transparent)}
.sources{display:inline-flex;gap:8px;font-size:11px;color:var(--ink-3)}
.src{display:inline-flex;align-items:center;gap:4px}.src i{width:6px;height:6px;border-radius:1px;background:var(--ok)}
.src.bad{color:var(--bad)}.src.bad i{background:var(--bad)}
.icon-btn{display:grid;place-items:center;width:28px;height:28px;padding:0;border:1px solid var(--line-2);
border-radius:6px;background:var(--panel);color:var(--ink-2);cursor:pointer}
.icon-btn:hover{color:var(--ink);border-color:var(--ink-3)}
.icon-btn svg{width:14px;height:14px;fill:currentColor;stroke:currentColor}
main{padding:20px;max-width:1500px;margin:0 auto}
.grid{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(min(320px,100%),1fr))}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px;min-width:0}
.panel h2{font-size:13px;font-weight:600;letter-spacing:-.01em;margin:0 0 8px}
.stats{display:flex;flex-wrap:wrap;gap:24px}.stat b{display:block;font-size:22px;letter-spacing:-.02em}
.stat span{color:var(--ink-3);font-size:12px}
.bar{height:6px;background:var(--line-2);border-radius:2px;overflow:hidden;margin:6px 0}
.bar i{display:block;height:100%;background:var(--done)}
.pill{display:inline-block;padding:0 8px;border-radius:10px;font-size:12px;color:var(--on-pill);white-space:nowrap}
.pill.bug{background:var(--bug)}.pill.planned{background:var(--planned)}.pill.building{background:var(--building)}
.pill.review{background:var(--review)}.pill.done{background:var(--done)}.pill.blocked{background:var(--blocked)}
ul.plain{list-style:none;margin:0;padding:0}ul.plain li{padding:6px 0;border-top:1px solid var(--line)}
ul.plain li:first-child{border-top:0}
.muted{color:var(--ink-3)}.small{font-size:12px}
.board{display:grid;gap:12px;grid-template-columns:repeat(6,minmax(180px,1fr));overflow-x:auto}
.col h2{display:flex;justify-content:space-between}
.card{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--planned);
border-radius:6px;padding:8px 10px;margin-bottom:8px}
.card.bug{border-left-color:var(--bug)}.card.building{border-left-color:var(--building)}
.card.review{border-left-color:var(--review)}.card.done{border-left-color:var(--done)}
.card.blocked{border-left-color:var(--blocked)}
.table-wrap{overflow-x:auto}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:6px 8px;border-top:1px solid var(--line);
vertical-align:top}th{color:var(--ink-3);font-weight:500;font-size:12px}
.errors{border-color:var(--bad)}.errors li{color:var(--bad)}
.filters{margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap}
.filters a{padding:2px 10px;border:1px solid var(--line-2);border-radius:12px;color:var(--ink-2)}
.filters a.active{background:var(--accent);color:var(--on-pill);border-color:var(--accent)}
@media (max-width:700px){.top{position:static;padding:0 16px}main{padding:16px}.board{grid-template-columns:repeat(6,85vw)}}
"""

# Runs before the first paint, so a saved theme never flashes the other one.
THEME_HEAD = """<script>(function(){var t=null;try{t=localStorage.getItem("pm-theme")}catch(e){}
if(t!=="light"&&t!=="dark"){t=matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"}
document.documentElement.setAttribute("data-theme",t)})()</script>"""

THEME_BUTTON = """<button class="icon-btn" id="theme" type="button" aria-label="Switch between light and dark"
title="Switch between light and dark"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5a6.5 6.5 0 1 0 0 13z"/>
<circle cx="8" cy="8" r="6.5" fill="none"/></svg></button>
<script>document.getElementById("theme").addEventListener("click",function(){var r=document.documentElement,
t=r.getAttribute("data-theme")==="light"?"dark":"light";r.setAttribute("data-theme",t);
try{localStorage.setItem("pm-theme",t)}catch(e){}})</script>"""
