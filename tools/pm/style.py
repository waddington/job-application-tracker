"""The dashboard's look: colour tokens for both themes, the styles, and the theme switch.

Everything is inline: the dashboard loads nothing from the web, so it works offline.
"""

from __future__ import annotations

CSS = """
:root,:root[data-theme="dark"]{color-scheme:dark;--bg:#0a0d13;--grid:rgba(148,163,184,.045);--panel:#0f131b;
--panel-2:#141a24;--hover:#18202c;--line:#1d2430;--line-2:#2a3342;--ink:#e7ebf3;--ink-2:#a3adbe;--ink-3:#7f899b;
--accent:#8ea2ff;--on-pill:#0a0d13;--bug:#e46565;--planned:#7a8496;--building:#5aa2ef;--review:#d39a12;--done:#9085e9;
--blocked:#e46565;--ok:#1faa77;--warn:#d39a12;--bad:#e46565;
--c1:#3987e5;--c2:#d95926;--c3:#199e70;--c4:#c98500;--c5:#d55181;--c7:#9085e9;--c8:#5d6676}
:root[data-theme="light"]{color-scheme:light;--bg:#f3f5f8;--grid:rgba(30,41,59,.045);--panel:#fff;--panel-2:#f7f8fa;
--hover:#eef1f6;--line:#e2e6ed;--line-2:#cdd4df;--ink:#0e1420;--ink-2:#4a5568;--ink-3:#667084;--accent:#3f55e0;
--on-pill:#fff;--bug:#c93636;--planned:#667084;--building:#2268bd;--review:#8f6400;--done:#5a48c4;--blocked:#c93636;
--ok:#13925f;--warn:#b77b00;--bad:#c93636;
--c1:#2a78d6;--c2:#eb6834;--c3:#1baf7a;--c4:#eda100;--c5:#e87ba4;--c7:#4a3aa7;--c8:#97a0af}
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
.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(190px,100%),1fr));gap:1px;background:var(--line);
border:1px solid var(--line);border-radius:10px;overflow:hidden;margin-bottom:16px}
.kpi{background:var(--panel);padding:12px 16px;min-width:0}.kpi .label{color:var(--ink-2);font-size:12px}
.kpi b{display:block;font-size:24px;letter-spacing:-.02em}
.kpi b small{font-size:12px;font-weight:400;color:var(--ink-2)}
.kpi .note{color:var(--ink-3);font-size:12px}
.spark{display:flex;align-items:flex-end;gap:1px;height:20px;margin:4px 0}
.spark i{flex:1;min-height:1px;background:var(--building)}.spark i.none{background:var(--line-2)}
.ov-grid{display:grid;gap:16px;grid-template-columns:minmax(0,2fr) minmax(0,1fr);margin-bottom:16px;align-items:start}
.ov-main{display:grid;gap:16px;min-width:0}
.phase-row{display:grid;grid-template-columns:44px minmax(90px,200px) minmax(60px,1fr) 44px 130px;gap:10px;
align-items:center;padding:4px 0}
.phase-row .name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.phase-row .num{text-align:right}.now{color:var(--accent);font-size:11px;font-weight:400}
.segs{display:flex;height:8px;background:var(--line-2);border-radius:2px;overflow:hidden}
.segs i{display:block}.segs .done{background:var(--done)}.segs .review{background:var(--review)}
.segs .building{background:var(--building)}
.legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:8px;font-size:12px;color:var(--ink-2)}
.legend i{display:inline-block;width:8px;height:8px;border-radius:2px;margin-right:5px}
.legend .planned{background:var(--line-2)}.legend .building{background:var(--building)}
.legend .review{background:var(--review)}.legend .done{background:var(--done)}
.stage{text-align:center}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--line-2)}
.dot.past{background:var(--ink-3)}.dot.building{background:var(--building)}.dot.review{background:var(--review)}
.dot.done{background:var(--done)}.dot.at{box-shadow:0 0 0 3px color-mix(in srgb,currentColor 25%,transparent)}
ol.feed{list-style:none;margin:0;padding:0;max-height:760px;overflow-y:auto}
ol.feed li{display:grid;grid-template-columns:52px 14px minmax(0,1fr);gap:6px;padding:7px 0;
border-top:1px solid var(--line)}
ol.feed li:first-child{border-top:0}.feed .time{color:var(--ink-3);font-size:11px;padding-top:2px}
.feed .what,.feed .about{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.feed .about{color:var(--ink-3);font-size:12px}.feed .dot{margin-top:5px}
details>summary{cursor:pointer;font-weight:600}.gap{margin-bottom:16px}
.clip{display:block;max-width:440px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500}
.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}
.stack{display:grid;gap:16px;margin-bottom:16px}.rm-grid{display:grid;gap:16px;align-items:start;
grid-template-columns:repeat(auto-fit,minmax(min(420px,100%),1fr))}td.num,th.num{text-align:right;white-space:nowrap}
.tl-row{display:grid;grid-template-columns:minmax(120px,220px) minmax(0,1fr);gap:12px;align-items:center;height:26px}
.tl-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px}
.tl-head{height:20px}.tl-scale{position:relative;height:16px}.tl-mark{position:absolute;font-size:11px;color:var(--ink-3);
white-space:nowrap}
.tl-track{position:relative;height:100%;border-top:1px solid var(--line)}
.span{position:absolute;top:7px;height:12px;background:var(--line-2);border-radius:2px;overflow:hidden}
.span i{display:block;height:100%;background:var(--done)}
.tick{position:absolute;top:4px;height:18px;width:1px;background:var(--ink-2);opacity:.55}
.today{position:absolute;top:0;bottom:0;width:2px;background:var(--accent)}
svg.chart{display:block;width:100%;height:auto}svg.chart .grid{stroke:var(--line)}
svg.chart .axis{fill:var(--ink-3);font-size:12px}svg.chart polyline{fill:none;stroke-width:2}
svg.chart .ln-merged{stroke:var(--done)}svg.chart .ln-scope{stroke:var(--ink-3)}
svg.chart .ln-forecast{stroke:var(--done);stroke-width:2;stroke-dasharray:5 5}
svg.chart .today-line{stroke:var(--accent)}
.legend .key-merged{background:var(--done)}.legend .key-scope{background:var(--ink-3)}
.legend .key-forecast{background:repeating-linear-gradient(90deg,var(--done) 0 3px,transparent 3px 5px)}
details.panel>summary h2{display:inline;margin:0}
svg.chart .k-feat,.legend .k-feat{fill:var(--c1);background:var(--c1)}
svg.chart .k-fix,.legend .k-fix{fill:var(--c2);background:var(--c2)}
svg.chart .k-test,.legend .k-test{fill:var(--c3);background:var(--c3)}
svg.chart .k-docs,.legend .k-docs{fill:var(--c4);background:var(--c4)}
svg.chart .k-refactor,.legend .k-refactor{fill:var(--c5);background:var(--c5)}
svg.chart .k-chore,.legend .k-chore{fill:var(--c7);background:var(--c7)}
svg.chart .k-other,.legend .k-other{fill:var(--c8);background:var(--c8)}
svg.chart .add,.legend .add{fill:var(--c1);background:var(--c1)}
svg.chart .del,.legend .del{fill:var(--c2);background:var(--c2)}
.hbar{display:grid;grid-template-columns:minmax(80px,130px) minmax(40px,1fr) 80px;gap:8px;align-items:center;
padding:3px 0}
.hname{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.hbar .num{text-align:right}
.htrack{height:8px;background:var(--line);border-radius:2px;overflow:hidden}
.htrack i{display:block;height:100%;background:var(--building)}
.heat{display:grid;grid-template-columns:44px repeat(24,minmax(0,1fr));gap:2px;align-items:center;font-size:11px}
.heat i{display:block;height:14px;border-radius:2px;background:var(--line)}.heat i.on{background:var(--building)}
.hm-day,.hm-h{color:var(--ink-3);white-space:nowrap}
.rm-grid svg.chart .axis{font-size:18px}
@media (max-width:700px){svg.chart.wide .axis{font-size:44px}.rm-grid svg.chart .axis{font-size:24px}}
@media (max-width:700px){.tl-row{grid-template-columns:90px minmax(0,1fr);gap:8px}
svg.chart .axis{font-size:26px}.tl-mark:nth-child(even){display:none}}
@media (max-width:1000px){.ov-grid{grid-template-columns:minmax(0,1fr)}}
@media (max-width:700px){.top{position:static;padding:0 16px}main{padding:16px}
.board{grid-template-columns:repeat(6,85vw)}.phase-row{grid-template-columns:36px minmax(0,1fr) 40px}
.phase-row .segs{grid-column:1/-1;order:1}.phase-row .dates{display:none}}
"""

# The page reloads itself every minute: what you've unfolded stays unfolded.
KEEP_FOLDS = """<script>(function(){var k="pm-folds",s={};try{s=JSON.parse(localStorage.getItem(k))||{}}catch(e){}
document.querySelectorAll("details[id]").forEach(function(d){if(d.id in s)d.open=s[d.id];
d.addEventListener("toggle",function(){s[d.id]=d.open;try{localStorage.setItem(k,JSON.stringify(s))}catch(e){}})})})()
</script>"""

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
