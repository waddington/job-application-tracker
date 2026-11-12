// Drives AppWindow.astro: a cursor uses the app (hovers, clicks, drags, types) on real screenshots with the moving
// parts rebuilt in HTML. Two modes: "auto" plays a sequence of pages on a loop (a hero), "manual" goes to whichever
// page the page script asks for (a scroll-driven tour) and replays that page's little scene while it waits.
// Transform and opacity only. Pauses whenever the page says it's off screen.

export type PageName = "today" | "application" | "board" | "role" | "interviews" | "insights";

const NAV_Y: Record<PageName, number> = {
  today: 66,
  application: 181,
  board: 181,
  role: 141,
  interviews: 222,
  insights: 568,
};
const PATH: Record<PageName, string> = {
  today: "/",
  application: "/applications/contoso",
  board: "/applications?view=board",
  role: "/roles/founding-backend",
  interviews: "/interviews",
  insights: "/insights",
};
const ORDER: PageName[] = ["today", "application", "board", "role", "interviews", "insights"];
const EASE = "cubic-bezier(.2,.8,.2,1)";
const MOVE = "cubic-bezier(.5,.05,.2,1)";

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const all = new WeakMap<HTMLElement, AppCtl>();
/** The controller for one AppWindow (created on first use). */
export function app(root: HTMLElement): AppCtl {
  let c = all.get(root);
  if (!c) {
    c = new AppCtl(root);
    all.set(root, c);
  }
  return c;
}

type BoardState = Record<string, string[]>;
const BOARD0: BoardState = {
  interested: ["nw"],
  applied: ["aw", "cw", "fk", "cw2"],
  screen: [],
  interviewing: ["ct"],
  final: [],
};

export class AppCtl {
  root: HTMLElement;
  private appEl: HTMLElement;
  private q = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = this.root) =>
    r.querySelector<T>(s)!;
  private pages: Record<PageName, HTMLElement>;
  private cursor: HTMLElement;
  private cx = 700;
  private cy = 620;
  private cur: PageName = "today";
  private wanted: PageName = "today";
  private mode: "auto" | "manual" = "manual";
  private seq: PageName[] = [];
  private seqI = 0;
  private on = false;
  private wake: (() => void) | null = null;
  private started = false;
  private innerT: Record<string, number> = {};
  private innerS: Record<string, number> = {};
  private innerK = 0.14;
  private s = 0.6;
  private w = 864;
  private h = 540;
  private pan = { x: 0, y: 0 };
  private zoomed = false;
  /** App x range the zoomed camera keeps in view, if any. */
  private focus: [number, number] | null = null;
  private raf = 0;
  private cardPos = new Map<string, { x: number; y: number }>();
  private colH = new Map<string, number>();
  private board: BoardState = structuredClone(BOARD0);

  constructor(root: HTMLElement) {
    this.root = root;
    this.appEl = this.q("[data-aw-app]");
    this.cursor = this.q("[data-cursor]");
    this.pages = Object.fromEntries(
      [...root.querySelectorAll<HTMLElement>("[data-page]")].map((p) => [p.dataset.page, p]),
    ) as Record<PageName, HTMLElement>;
    for (const p of ORDER) this.innerT[p] = this.innerS[p] = 0;
    this.q("[data-hl]").style.transform = `translateY(${NAV_Y.today - 56}px)`;
    this.layoutBoard(false);
    document.fonts?.ready.then(() => this.layoutBoard(false));
  }

  // ---------- Public API ----------
  /** Size the screen (below the title bar) in CSS px. Wide boxes fit the app; tall ones zoom in and pan. */
  size(w: number, h: number) {
    this.w = w;
    this.h = h;
    const fit = w / 1440;
    this.zoomed = h / w > (900 / 1440) * 1.12;
    this.s = this.zoomed ? h / 900 : fit;
    this.root.style.setProperty("--s", this.s.toFixed(4));
    this.root.style.setProperty("--sw", `${w}px`);
    this.root.style.setProperty("--sh", `${this.zoomed ? h : Math.round(900 * fit)}px`);
    this.root.style.setProperty("--ci", String(clamp(0.85 / this.s, 1, 1.9)));
    this.root.classList.toggle("is-clip", this.zoomed);
  }
  /** How far apart the layers are (0 together, 1 exploded). */
  explode(x: number) {
    this.root.style.setProperty("--x", x.toFixed(3));
  }
  want(p: PageName) {
    this.mode = "manual";
    this.wanted = p;
    this.start();
  }
  auto(seq: PageName[]) {
    this.mode = "auto";
    this.seq = seq;
    this.wanted = seq[0];
    this.start();
  }
  /** Manual mode: scroll a long page inside the window (app px). */
  inner(p: PageName, px: number) {
    this.innerT[p] = px;
  }
  active(on: boolean) {
    this.on = on;
    if (on) {
      this.wake?.();
      this.wake = null;
      if (!this.raf) this.raf = requestAnimationFrame(this.frame);
    }
  }

  // ---------- Frame loop: inner scrolls and the camera that follows the cursor when zoomed ----------
  private frame = () => {
    for (const p of ORDER) {
      const t = this.innerT[p];
      const v = (this.innerS[p] += (t - this.innerS[p]) * this.innerK);
      if (Math.abs(t - v) < 0.1) this.innerS[p] = t;
      this.q("[data-scroll]", this.pages[p]).style.transform =
        `translateY(${(-this.innerS[p]).toFixed(1)}px)`;
    }
    if (this.zoomed) {
      // The camera follows the cursor, or frames a focus area (the search results) so it fits on screen.
      const vw = this.w / this.s;
      const f = this.focus;
      const centre = f ? (f[1] - f[0] > vw ? f[0] + vw / 2 : (f[0] + f[1]) / 2) : this.cx;
      const tx = -clamp(centre - vw / 2, 0, 1440 - vw) * this.s;
      this.pan.x += (tx - this.pan.x) * (f ? 0.16 : 0.07);
      this.appEl.style.setProperty("--panx", `${this.pan.x.toFixed(1)}px`);
    } else if (this.pan.x) {
      this.pan.x = 0;
      this.appEl.style.setProperty("--panx", "0px");
    }
    this.raf = this.on ? requestAnimationFrame(this.frame) : 0;
  };

  // ---------- The director ----------
  private start() {
    if (this.started) return;
    this.started = true;
    this.director();
  }
  private stale(p: PageName) {
    return !this.on || (this.mode === "manual" && this.wanted !== p);
  }
  private async wait(ms: number, p: PageName) {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (this.stale(p)) return false;
      await sleep(Math.min(80, end - performance.now()));
    }
    return !this.stale(p);
  }
  private async director() {
    for (;;) {
      if (!this.on) await new Promise<void>((r) => (this.wake = r));
      const target = this.mode === "auto" ? this.seq[this.seqI % this.seq.length] : this.wanted;
      if (target !== this.cur) {
        const jump = this.mode === "manual" && Math.abs(ORDER.indexOf(target) - ORDER.indexOf(this.cur)) > 1;
        await this.go(target, jump);
        continue;
      }
      const page = this.cur;
      await this.scenes[page]();
      if (this.mode === "auto" && !this.stale(page)) this.seqI++;
      else if (this.stale(page) && this.cur === page) this.reset(page);
    }
  }

  // ---------- Primitives ----------
  private async anim(el: Element, frames: Keyframe[], duration: number, easing = EASE, delay = 0) {
    const a = el.animate(frames, { duration, easing, delay, fill: "forwards" });
    await a.finished.catch(() => undefined);
    try {
      a.commitStyles();
    } catch {
      /* hidden element */
    }
    a.cancel();
  }
  private fade(el: HTMLElement, to: number, ms = 220) {
    return this.anim(el, [{ opacity: getComputedStyle(el).opacity }, { opacity: to }], ms);
  }
  /** Move the cursor along a slight arc, as a hand would. */
  async moveTo(x: number, y: number, ms = 800) {
    const x0 = this.cx;
    const y0 = this.cy;
    const dx = x - x0;
    const dy = y - y0;
    const bend = Math.min(60, Math.hypot(dx, dy) * 0.08);
    const len = Math.hypot(dx, dy) || 1;
    const mx = x0 + dx * 0.5 + (-dy / len) * bend;
    const my = y0 + dy * 0.5 + (dx / len) * bend;
    this.cx = x;
    this.cy = y;
    await this.anim(
      this.cursor,
      [
        { transform: `translate(${x0}px, ${y0}px)`, offset: 0 },
        { transform: `translate(${mx}px, ${my}px)`, offset: 0.5 },
        { transform: `translate(${x}px, ${y}px)`, offset: 1 },
      ],
      ms,
      MOVE,
    );
  }
  private hand(on: boolean) {
    this.cursor.classList.toggle("is-hand", on);
  }
  async click() {
    const svgs = this.cursor.querySelectorAll("svg");
    svgs.forEach((s) =>
      s.animate([{ scale: "1" }, { scale: "0.84" }, { scale: "1" }], { duration: 240, easing: "ease-out" }),
    );
    await this.anim(
      this.q("[data-ripple]"),
      [
        { transform: "scale(.3)", opacity: 0.95 },
        { transform: "scale(1.6)", opacity: 0 },
      ],
      520,
      "ease-out",
    );
  }
  private reset(p: PageName) {
    const pg = this.pages[p];
    for (const el of pg.querySelectorAll<HTMLElement>(
      "[data-tick],[data-strike],[data-badge],[data-badge] b,[data-ring],[data-cover],[data-hov-todo],[data-hov-apply]",
    )) {
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transform = "";
      el.style.opacity = "";
    }
    for (const sel of ["[data-tip]", "[data-toast]", "[data-results]", "[data-search]"]) {
      const el = this.q(sel);
      el.getAnimations().forEach((a) => a.cancel());
      el.style.opacity = "";
      el.style.transform = "";
    }
    this.q("[data-typed]").textContent = "";
    if (p === "board" && JSON.stringify(this.board) !== JSON.stringify(BOARD0)) {
      this.board = structuredClone(BOARD0);
      this.layoutBoard(false);
    }
    this.hand(false);
  }

  // ---------- Going to a page ----------
  private async go(next: PageName, instant: boolean) {
    const from = this.cur;
    if (instant) {
      this.reset(from);
      this.swap(from, next, false);
      return;
    }
    if (next === "application" && from === "today") {
      await this.search();
    } else {
      const y = NAV_Y[next];
      const nh = this.q("[data-navhov]");
      nh.style.transform = `translateY(${y - 56}px)`;
      await this.moveTo(96 + Math.random() * 30, y + 21, 650);
      this.hand(true);
      nh.style.opacity = "1";
      await sleep(140);
      await this.click();
      nh.style.opacity = "0";
    }
    this.reset(from);
    await this.swap(from, next, true);
    this.hand(false);
  }
  private async swap(from: PageName, to: PageName, animate: boolean) {
    const a = this.pages[from];
    const b = this.pages[to];
    this.q("[data-hl]").style.transform = `translateY(${NAV_Y[to] - 56}px)`;
    this.q("[data-aw-path]").textContent = PATH[to] === "/" ? "/" : PATH[to];
    this.innerT[to] = this.innerS[to] = 0;
    if (to === "insights") this.q("[data-cover]", b).style.transform = "scaleX(1)";
    b.classList.add("is-on");
    this.cur = to;
    if (!animate || from === to) {
      if (from !== to) a.classList.remove("is-on");
      return;
    }
    const load = this.q("[data-aw-load]");
    load.animate(
      [
        { transform: "scaleX(0)", opacity: 1 },
        { transform: "scaleX(.7)", opacity: 1, offset: 0.6 },
        { transform: "scaleX(1)", opacity: 0 },
      ],
      { duration: 700, easing: "ease-out" },
    );
    b.style.zIndex = "2";
    await Promise.all([
      this.anim(
        a,
        [
          { opacity: 1, transform: "none" },
          { opacity: 0, transform: "translateX(-36px) scale(.985)" },
        ],
        420,
      ),
      this.anim(
        b,
        [
          { opacity: 0, transform: "translateX(56px)" },
          { opacity: 1, transform: "none" },
        ],
        640,
        EASE,
        90,
      ),
    ]);
    a.classList.remove("is-on");
    for (const el of [a, b]) {
      el.style.opacity = "";
      el.style.transform = "";
      el.style.zIndex = "";
    }
  }

  /** Click the search box, type, and open the first result. */
  private async search() {
    const field = this.q("[data-search]");
    const typed = this.q("[data-typed]");
    const results = this.q("[data-results]");
    const rows = [...results.querySelectorAll<HTMLElement>("[data-res]")];
    await this.moveTo(1010, 30, 800);
    this.hand(true);
    await sleep(120);
    await this.click();
    this.hand(false);
    // On a zoomed (phone) window, frame the field and its results so none of them is cut off.
    this.focus = [920, 1336];
    field.style.opacity = "1";
    for (const ch of "contoso") {
      typed.textContent += ch;
      await sleep(85 + Math.random() * 70);
    }
    results.style.opacity = "1";
    await this.anim(
      results,
      [
        { opacity: 0, transform: "translateY(-6px) scale(.98)" },
        { opacity: 1, transform: "none" },
      ],
      260,
    );
    rows.forEach((r, i) =>
      this.anim(
        r,
        [
          { opacity: 0, transform: "translateY(6px)" },
          { opacity: 1, transform: "none" },
        ],
        260,
        EASE,
        i * 60,
      ),
    );
    await sleep(380);
    await this.moveTo(1120, 52 + 6 + 24, 650);
    this.hand(true);
    await this.fade(this.q("[data-res-hov]"), 1, 160);
    await sleep(240);
    await this.click();
    await Promise.all([this.fade(results, 0, 200), this.fade(field, 0, 200)]);
    this.q("[data-res-hov]").style.opacity = "";
    rows.forEach((r) => (r.style.opacity = ""));
    this.focus = null;
  }

  // ---------- The board ----------
  private cardEl(id: string) {
    return this.q(`[data-card="${id}"]`, this.pages.board);
  }
  private colEl(id: string) {
    return this.q(`[data-col="${id}"]`, this.pages.board);
  }
  /** Place every card and size every column from `this.board`; animate the differences. */
  private layoutBoard(animate: boolean, skip?: string) {
    const jobs: Promise<unknown>[] = [];
    for (const [col, ids] of Object.entries(this.board)) {
      const c = this.colEl(col);
      const x0 = parseFloat(getComputedStyle(c).getPropertyValue("--cx")) + 11;
      let y = 6 + 41;
      for (const id of ids) {
        const el = this.cardEl(id);
        const target = { x: x0, y };
        y += el.offsetHeight + 10;
        if (id === skip) continue;
        const prev = this.cardPos.get(id);
        this.cardPos.set(id, target);
        const to = `translate(${target.x}px, ${target.y}px)`;
        if (animate && prev && (prev.x !== target.x || prev.y !== target.y)) {
          jobs.push(
            this.anim(el, [{ transform: `translate(${prev.x}px, ${prev.y}px)` }, { transform: to }], 420),
          );
        } else el.style.transform = to;
      }
      const H = ids.length ? y - 10 + 11 - 6 : 112;
      const prevH = this.colH.get(col);
      this.colH.set(col, H);
      const mid = c.querySelector<HTMLElement>("[data-col-mid]")!;
      const bot = c.querySelector<HTMLElement>("[data-col-bot]")!;
      const midT = `scaleY(${((H - 54) / 100).toFixed(4)})`;
      const botT = `translateY(${H - 12}px)`;
      if (animate && prevH !== undefined && prevH !== H) {
        jobs.push(
          this.anim(
            mid,
            [{ transform: `scaleY(${((prevH - 54) / 100).toFixed(4)})` }, { transform: midT }],
            420,
          ),
        );
        jobs.push(this.anim(bot, [{ transform: `translateY(${prevH - 12}px)` }, { transform: botT }], 420));
      } else {
        mid.style.transform = midT;
        bot.style.transform = botT;
      }
      c.querySelector<HTMLElement>("[data-count]")!.textContent = String(ids.length);
    }
    return Promise.all(jobs);
  }
  /** App coordinates of a card's centre-left grip point. */
  private cardPoint(id: string) {
    const p = this.cardPos.get(id)!;
    return { x: 230 + p.x + 96, y: 56 + 172 + p.y + 28 - this.innerS.board };
  }
  private async drag(id: string, from: string, to: string) {
    const card = this.cardEl(id);
    const start = this.cardPos.get(id)!;
    const pt = this.cardPoint(id);
    await this.moveTo(pt.x, pt.y, 850);
    this.hand(true);
    card.classList.add("is-hover");
    await sleep(260);
    // Press and lift.
    card.classList.add("is-lifted");
    this.cursor.animate([{ scale: "1" }, { scale: "0.92" }], { duration: 160, fill: "forwards" });
    const lift = `translate(${start.x + 4}px, ${start.y - 6}px) rotate(2.5deg) scale(1.04)`;
    await this.anim(card, [{ transform: `translate(${start.x}px, ${start.y}px)` }, { transform: lift }], 200);
    // The others close the gap; the target opens one.
    this.board[from] = this.board[from].filter((k) => k !== id);
    this.board[to] = [id, ...this.board[to]];
    const tc = this.colEl(to);
    const drop = tc.querySelector<HTMLElement>("[data-col-drop]")!;
    drop.style.width = "228px";
    drop.style.height = `${card.offsetHeight}px`;
    drop.style.transform = `translate(11px, 41px)`;
    const tx = parseFloat(getComputedStyle(tc).getPropertyValue("--cx")) + 11;
    const dx = tx - start.x;
    const flight = this.anim(
      card,
      [
        { transform: lift },
        {
          transform: `translate(${start.x + dx * 0.55}px, ${start.y - 16}px) rotate(3.5deg) scale(1.05)`,
          offset: 0.5,
        },
        { transform: `translate(${tx + 4}px, ${start.y - 6}px) rotate(1.5deg) scale(1.04)` },
      ],
      1150,
      MOVE,
    );
    const hand = this.moveTo(pt.x + dx + 4, pt.y - 4, 1150);
    await sleep(520);
    const reflow = this.layoutBoard(true, id);
    this.fade(drop, 1, 200);
    await Promise.all([flight, hand, reflow]);
    // Drop.
    this.cursor.getAnimations().forEach((a) => a.cancel());
    this.cursor.style.scale = "";
    this.cursor.style.transform = `translate(${this.cx}px, ${this.cy}px)`;
    const end = { x: tx, y: 6 + 41 };
    this.cardPos.set(id, end);
    await Promise.all([
      this.anim(
        card,
        [
          { transform: `translate(${tx + 4}px, ${start.y - 6}px) rotate(1.5deg) scale(1.04)` },
          { transform: `translate(${end.x}px, ${end.y}px)` },
        ],
        260,
      ),
      this.fade(drop, 0, 260),
    ]);
    card.classList.remove("is-lifted", "is-hover");
    this.hand(false);
  }
  private async undoDrag(id: string, from: string, to: string) {
    this.board[to] = this.board[to].filter((k) => k !== id);
    this.board[from] = [id, ...this.board[from]];
    const card = this.cardEl(id);
    card.classList.add("is-lifted");
    await this.layoutBoard(true);
    card.classList.remove("is-lifted");
  }

  // ---------- Each page's scene ----------
  private scenes: Record<PageName, () => Promise<unknown>> = {
    today: async () => {
      const pg = this.pages.today;
      if (!(await this.wait(350, "today"))) return;
      const sy = this.innerS.today;
      await this.moveTo(991, 456 - sy, 900);
      this.hand(true);
      await this.fade(this.q("[data-hov-todo]", pg), 1, 160);
      await sleep(220);
      await this.click();
      const tick = this.q("[data-tick]", pg);
      await this.anim(
        tick,
        [
          { opacity: 0, transform: "scale(.4)" },
          { opacity: 1, transform: "scale(1.12)", offset: 0.7 },
          { opacity: 1, transform: "scale(1)" },
        ],
        300,
      );
      this.fade(this.q("[data-hov-todo]", pg), 0, 200);
      await this.anim(
        this.q("[data-strike]", pg),
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        420,
      );
      this.hand(false);
      this.moveTo(820, 700, 1100);
      if (this.mode === "auto") {
        this.innerK = 0.05;
        this.innerT.today = 520;
        if (!(await this.wait(2200, "today"))) return;
        this.innerT.today = 0;
        await this.wait(1200, "today");
        this.innerK = 0.14;
        return;
      }
      if (!(await this.wait(2600, "today"))) return;
      await Promise.all([this.fade(tick, 0, 400), this.fade(this.q("[data-strike]", pg), 0, 400)]);
      this.reset("today");
      await this.wait(900, "today");
    },
    application: async () => {
      if (this.mode === "auto") {
        this.innerK = 0.035;
        this.innerT.application = 1100;
        this.moveTo(760, 640, 1600);
        if (!(await this.wait(3600, "application"))) return;
        this.innerK = 0.14;
        return;
      }
      await this.moveTo(700 + Math.random() * 200, 500 + Math.random() * 200, 1600);
      await this.wait(1400, "application");
    },
    board: async () => {
      if (!(await this.wait(350, "board"))) return;
      await this.drag("aw", "applied", "screen");
      const toast = this.q("[data-toast]");
      await this.anim(
        toast,
        [
          { opacity: 0, transform: "translateY(16px) scale(.97)" },
          { opacity: 1, transform: "none" },
        ],
        340,
      );
      if (!(await this.wait(1500, "board"))) return;
      // The toast sits bottom right; its Undo button is its last 60 px.
      await this.moveTo(1440 - 24 - 18 - 30, 900 - 24 - 24, 900);
      this.hand(true);
      await sleep(220);
      await this.click();
      this.fade(toast, 0, 260);
      await this.undoDrag("aw", "applied", "screen");
      this.hand(false);
      await this.moveTo(760, 720, 900);
      await this.wait(1200, "board");
    },
    role: async () => {
      const pg = this.pages.role;
      if (!(await this.wait(400, "role"))) return;
      await this.moveTo(1093, 123, 950);
      this.hand(true);
      await this.fade(this.q("[data-hov-apply]", pg), 1, 160);
      await sleep(260);
      await this.click();
      const badge = this.q("[data-badge]", pg);
      badge.style.opacity = "1";
      await this.anim(
        this.q("b", badge),
        [
          { transform: "scale(.6)", opacity: 0 },
          { transform: "scale(1.1)", opacity: 1, offset: 0.65 },
          { transform: "scale(1)", opacity: 1 },
        ],
        380,
      );
      this.fade(this.q("[data-hov-apply]", pg), 0, 200);
      this.hand(false);
      this.moveTo(820, 640, 1100);
      if (!(await this.wait(2600, "role"))) return;
      if (this.mode === "manual") {
        await this.fade(badge, 0, 400);
        this.reset("role");
        await this.wait(900, "role");
      }
    },
    interviews: async () => {
      const ring = this.q("[data-ring]", this.pages.interviews);
      if (!(await this.wait(400, "interviews"))) return;
      await this.moveTo(414, 510, 900);
      this.hand(true);
      await this.click();
      await this.anim(
        ring,
        [
          { opacity: 0, transform: "scale(.5)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        300,
      );
      if (!(await this.wait(700, "interviews"))) return;
      await this.moveTo(708, 426, 650);
      await this.click();
      await this.anim(ring, [{ transform: "none" }, { transform: "translate(294px,-84px)" }], 420);
      if (!(await this.wait(700, "interviews"))) return;
      await this.moveTo(806, 510, 560);
      await this.click();
      await this.anim(
        ring,
        [{ transform: "translate(294px,-84px)" }, { transform: "translate(392px,0)" }],
        420,
      );
      this.hand(false);
      if (!(await this.wait(2000, "interviews"))) return;
      await this.fade(ring, 0, 400);
      ring.style.transform = "";
      await this.moveTo(900, 720, 900);
      await this.wait(500, "interviews");
    },
    insights: async () => {
      const pg = this.pages.insights;
      const cover = this.q("[data-cover]", pg);
      if (getComputedStyle(cover).transform !== "matrix(0, 0, 0, 1, 0, 0)") {
        await this.anim(
          cover,
          [{ transform: "scaleX(1)" }, { transform: "scaleX(0)" }],
          1500,
          "cubic-bezier(.6,0,.2,1)",
        );
      }
      if (!(await this.wait(300, "insights"))) return;
      const tip = this.q("[data-tip]");
      const y = 399 - this.innerS.insights;
      await this.moveTo(1068, y, 1000);
      this.hand(true);
      tip.style.transform = `translateY(${(y - 400).toFixed(0)}px)`;
      await this.anim(
        tip,
        [
          { opacity: 0, transform: `translateY(${(y - 392).toFixed(0)}px)` },
          { opacity: 1, transform: `translateY(${(y - 400).toFixed(0)}px)` },
        ],
        260,
      );
      if (!(await this.wait(2200, "insights"))) return;
      this.hand(false);
      await this.fade(tip, 0, 260);
      await this.moveTo(620, 600, 1200);
      await this.wait(this.mode === "auto" ? 600 : 1500, "insights");
    },
  };
}
