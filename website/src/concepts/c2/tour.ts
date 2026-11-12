// Concept 2's tour: scroll moves the glass browser (hero pose → full screen → exploded → shrunk) and picks the
// app's page; a small director then "uses" that page with a cursor (tick a to-do, drag a card, apply to a role…),
// looping while the window is on screen. Transform and opacity only. Reduced motion: nothing here runs.

export {};

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

type Pose = { tx: number; ty: number; sc: number; rx: number; ry: number; rz: number; x: number };
type PageName = "today" | "board" | "role" | "interviews" | "insights";

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel)!;
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [
  ...root.querySelectorAll<T>(sel),
];
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number, a: number, b: number) => {
  const k = clamp((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;

function init() {
  const tour = $("[data-tour]");
  const stage = $("[data-stage]");
  const pose = $("[data-pose]");
  const win = $("[data-win]");
  const app = $("[data-app]");
  const sections = $$("[data-ch]");
  const words = $$("[data-words] span");
  const outro = $("[data-outro]");
  const rail = $$("[data-rail-i]");
  const cursor = $("[data-cursor]");
  const ripple = $("[data-ripple]");
  const hl = $("[data-hl]");
  const tip = $("[data-tip]");
  const pages = Object.fromEntries($$("[data-page]").map((p) => [p.dataset.page, p])) as Record<
    PageName,
    HTMLElement
  >;
  const scroller = (p: PageName) => $("[data-scroll]", pages[p]);
  const b = (k: string) => $(`[data-b="${k}"]`, pages.board);

  // ---------- Layout and poses ----------
  let vw = 0;
  let vh = 0;
  let mobile = false;
  let s = 0.6;
  let sw = 0;
  let keys: [number, Pose][] = [];

  const P = (tx: number, ty: number, sc: number, rx: number, ry: number, rz: number, x = 0): Pose => ({
    tx,
    ty,
    sc,
    rx,
    ry,
    rz,
    x,
  });

  function layout() {
    vw = innerWidth;
    vh = innerHeight;
    mobile = vw < 760;
    if (mobile) {
      sw = vw - 20;
      const sh = Math.round(Math.min(vh * 0.5, 470));
      s = sh / 900;
      win.style.setProperty("--sw", `${sw}px`);
      win.style.setProperty("--sh", `${sh}px`);
    } else {
      s = Math.min((vw - 140) / 1440, (vh - 44 - 130) / 900);
      sw = 1440 * s;
      win.style.removeProperty("--sw");
      win.style.removeProperty("--sh");
    }
    win.style.setProperty("--s", String(s));
    app.style.setProperty("--ci", String(clamp(0.8 / s, 1, 1.9)));
    const H = mobile ? P(0, vh * 0.36, 0.82, 18, -14, 2) : P(vw * 0.2, vh * 0.05, 0.52, 12, -24, 2.5);
    const F = mobile ? P(0, -vh * 0.13, 1, 0, 0, 0) : P(0, 12, 1, 0, 0, 0);
    const E = mobile ? P(0, vh * 0.2, 0.86, 10, -24, 0, 1) : P(vw * 0.15, -vh * 0.04, 0.44, 54, 0, -32, 1);
    const E0 = mobile ? P(0, vh * 0.2, 0.86, 4, -8, 0, 0) : P(vw * 0.17, 14, 0.58, 4, -10, 0, 0);
    const O = mobile ? P(0, -vh * 0.03, 0.55, 10, 0, 0) : P(0, vh * 0.07, 0.38, 12, 0, 0);
    keys = [
      [0, H],
      [0.55, H],
      [1.55, F],
      [7.02, F],
      [7.32, E],
      [7.7, E],
      [7.98, E0],
      [8.42, O],
      [9, O],
    ];
  }

  function poseAt(t: number): Pose {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, p1] = keys[i];
      const [t0, p0] = keys[i - 1];
      if (t <= t1) {
        const k = smooth(t, t0, t1);
        return {
          tx: mix(p0.tx, p1.tx, k),
          ty: mix(p0.ty, p1.ty, k),
          sc: mix(p0.sc, p1.sc, k),
          rx: mix(p0.rx, p1.rx, k),
          ry: mix(p0.ry, p1.ry, k),
          rz: mix(p0.rz, p1.rz, k),
          x: mix(p0.x, p1.x, k),
        };
      }
    }
    return keys[keys.length - 1][1];
  }

  // ---------- Scroll → t (chapter index + progress through it, measured at the middle of the screen) ----------
  function readT() {
    const mid = vh * 0.5;
    let t = 0;
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      const i = Number(sec.dataset.ch);
      if (r.top <= mid) t = i + clamp((mid - r.top) / r.height);
    }
    return t;
  }

  const pageFor = (t: number): PageName =>
    t < 3 ? "today" : t < 4 ? "board" : t < 5 ? "role" : t < 6 ? "interviews" : "insights";
  const order: PageName[] = ["today", "board", "role", "interviews", "insights"];
  const navY: Record<PageName, number> = { today: 66, board: 181, role: 141, interviews: 222, insights: 568 };

  // ---------- The frame loop: pose, inner scrolls, words, rail ----------
  let t = readT();
  let tS = t;
  let active = true;
  let running = false;
  const inner: Record<string, number> = { today: 0, insights: 0, cover: 1 };
  const innerS = { ...inner };
  let cur: PageName = "today";
  let pan = 0;
  let panTarget = 0;
  let cursorX = 700;
  let cursorY = 620;
  let lit = -1;
  let railOn = -1;

  function targets() {
    const lToday = clamp(t - 2);
    inner.today = t < 2 ? 0 : smooth(lToday, 0.35, 0.92) * 720;
    const lIns = clamp(t - 6);
    inner.cover = t < 6 ? 1 : 1 - smooth(lIns, 0.04, 0.42);
    inner.insights = smooth(lIns, 0.55, 0.95) * 100;
  }

  function frame() {
    t = readT();
    targets();
    tS += (t - tS) * 0.16;
    if (Math.abs(t - tS) < 0.0005) tS = t;
    const p = poseAt(tS);
    pose.style.transform = `translate3d(${p.tx.toFixed(1)}px, ${p.ty.toFixed(1)}px, 0) scale(${p.sc.toFixed(4)}) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg)`;
    win.style.setProperty("--x", p.x.toFixed(3));

    for (const k of Object.keys(inner)) innerS[k] += (inner[k] - innerS[k]) * 0.18;
    scroller("today").style.transform = `translateY(${-innerS.today.toFixed(1)}px)`;
    scroller("insights").style.transform = `translateY(${-innerS.insights.toFixed(1)}px)`;
    $("[data-cover]").style.transform = `scaleX(${innerS.cover.toFixed(4)})`;

    if (mobile) {
      const view = sw / s;
      panTarget = -clamp(cursorX - view / 2, 0, 1440 - view) * s;
      pan += (panTarget - pan) * 0.08;
      app.style.setProperty("--pan", `${pan.toFixed(1)}px`);
    } else if (pan !== 0) {
      pan = 0;
      app.style.setProperty("--pan", "0px");
    }

    const n = Math.round(smooth(clamp(t - 1), 0.05, 0.55) * words.length);
    if (n !== lit) {
      words.forEach((w, i) => w.classList.toggle("is-lit", i < n));
      lit = n;
    }
    outro.style.setProperty("--p", smooth(clamp(t - 8), 0.08, 0.5).toFixed(3));
    const r = t >= 2 && t < 8 ? Math.floor(t) : -1;
    if (r !== railOn) {
      rail.forEach((a) => a.classList.toggle("is-on", Number(a.dataset.railI) === r));
      railOn = r;
    }
    document.body.classList.toggle("c2-in-tour", t > 1.7 && t < 8.2);

    if (active) requestAnimationFrame(frame);
    else running = false;
  }
  const kick = () => {
    if (!running && active) {
      running = true;
      requestAnimationFrame(frame);
    }
  };

  // ---------- The director: uses the app, one page at a time ----------
  let wake: (() => void) | null = null;
  const stale = (page: PageName) => !active || pageFor(t) !== page;
  const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));
  async function wait(ms: number, page: PageName) {
    const end = performance.now() + ms;
    while (performance.now() < end) {
      if (stale(page)) return false;
      await tick(Math.min(90, end - performance.now()));
    }
    return !stale(page);
  }
  async function anim(
    el: HTMLElement,
    frames: Keyframe[],
    duration: number,
    easing = "cubic-bezier(.22,.61,.36,1)",
  ) {
    const a = el.animate(frames, { duration, easing, fill: "forwards" });
    await a.finished.catch(() => undefined);
    try {
      a.commitStyles();
    } catch {
      /* element hidden: fine */
    }
    a.cancel();
  }
  async function moveTo(x: number, y: number, duration = 850) {
    const from = `translate(${cursorX}px, ${cursorY}px)`;
    cursorX = x;
    cursorY = y;
    await anim(cursor, [{ transform: from }, { transform: `translate(${x}px, ${y}px)` }], duration);
  }
  async function click() {
    const svg = $("svg", cursor) as unknown as HTMLElement;
    svg.animate([{ scale: "1" }, { scale: "0.82" }, { scale: "1" }], { duration: 260 });
    await anim(
      ripple,
      [
        { transform: "scale(.3)", opacity: 0.9 },
        { transform: "scale(1.5)", opacity: 0 },
      ],
      520,
      "ease-out",
    );
  }
  function reset(page: PageName) {
    for (const el of $$(".c2-b, .c2-tick, .c2-strike, .c2-badge, .c2-badge b, .c2-ring", pages[page])) {
      el.getAnimations().forEach((a) => a.cancel());
      el.style.transform = "";
      el.style.opacity = "";
    }
    tip.style.opacity = "";
    tip.style.transform = "";
  }

  async function switchTo(next: PageName, instant: boolean) {
    const from = pages[cur];
    const to = pages[next];
    reset(next);
    if (instant) {
      from.classList.remove("is-on");
      to.classList.add("is-on");
      hl.style.transform = `translateY(${navY[next] - 56}px)`;
      cur = next;
      return;
    }
    await moveTo(112, navY[next] + 20, 560);
    await click();
    hl.style.transform = `translateY(${navY[next] - 56}px)`;
    to.classList.add("is-on");
    const out = anim(
      from,
      [
        { opacity: 1, transform: "translateX(0)" },
        { opacity: 0, transform: "translateX(-60px)" },
      ],
      380,
    );
    await anim(
      to,
      [
        { opacity: 0, transform: "translateX(70px)" },
        { opacity: 1, transform: "translateX(0)" },
      ],
      520,
    );
    await out;
    from.classList.remove("is-on");
    from.style.opacity = "";
    from.style.transform = "";
    to.style.opacity = "";
    to.style.transform = "";
    reset(cur);
    cur = next;
  }

  const loops: Record<PageName, () => Promise<unknown>> = {
    async today() {
      if (!(await wait(500, "today"))) return;
      await moveTo(991, 456 - innerS.today, 950);
      await click();
      const tk = $("[data-tick]", pages.today);
      await anim(
        tk,
        [
          { opacity: 0, transform: "scale(.4)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        260,
      );
      await anim(
        $("[data-strike]", pages.today),
        [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }],
        420,
      );
      moveTo(760, 700, 1100);
      if (!(await wait(2600, "today"))) return;
      await Promise.all(
        [tk, $("[data-strike]", pages.today)].map((el) => anim(el, [{ opacity: 1 }, { opacity: 0 }], 500)),
      );
      reset("today");
      await wait(900, "today");
    },
    async board() {
      if (!(await wait(400, "board"))) return;
      await moveTo(640, 316, 900);
      const card = b("card");
      card.classList.add("is-lifted");
      b("bg").style.opacity = "1";
      cursor.animate([{ scale: "1" }, { scale: "0.9" }], { duration: 180, fill: "forwards" });
      await anim(
        card,
        [{ transform: "none" }, { transform: "translate(4px,-6px) rotate(2.5deg) scale(1.04)" }],
        220,
      );
      await Promise.all([
        anim(
          card,
          [
            { transform: "translate(4px,-6px) rotate(2.5deg) scale(1.04)" },
            { transform: "translate(266px,-6px) rotate(1.5deg) scale(1.04)" },
          ],
          1150,
          "cubic-bezier(.45,.05,.3,1)",
        ),
        (async () => {
          const from = `translate(${cursorX}px, ${cursorY}px)`;
          cursorX = 902;
          await anim(
            cursor,
            [{ transform: from }, { transform: `translate(902px, 316px)` }],
            1150,
            "cubic-bezier(.45,.05,.3,1)",
          );
        })(),
      ]);
      cursor.getAnimations().forEach((a) => a.cancel());
      cursor.style.transform = `translate(902px, 316px)`;
      await Promise.all([
        anim(
          card,
          [
            { transform: "translate(266px,-6px) rotate(1.5deg) scale(1.04)" },
            { transform: "translate(262px,0)" },
          ],
          240,
        ),
        anim(b("ext"), [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], 300),
        anim(b("sbot"), [{ transform: "translateY(0)" }, { transform: "translateY(92px)" }], 300),
        anim(b("count"), [{ opacity: 0 }, { opacity: 1 }], 300),
      ]);
      card.classList.remove("is-lifted");
      await Promise.all([
        anim(b("below"), [{ transform: "translateY(0)" }, { transform: "translateY(-91px)" }], 420),
        anim(b("abot"), [{ transform: "translateY(0)" }, { transform: "translateY(-91px)" }], 420),
        anim(b("white"), [{ opacity: 0 }, { opacity: 1 }], 200),
      ]);
      moveTo(720, 720, 1000);
      if (!(await wait(2800, "board"))) return;
      // Undo: everything slides back.
      await Promise.all([
        anim(card, [{ transform: "translate(262px,0)" }, { transform: "none" }], 700),
        anim(b("below"), [{ transform: "translateY(-91px)" }, { transform: "translateY(0)" }], 500),
        anim(b("abot"), [{ transform: "translateY(-91px)" }, { transform: "translateY(0)" }], 500),
        anim(b("ext"), [{ transform: "scaleY(1)" }, { transform: "scaleY(0)" }], 500),
        anim(b("sbot"), [{ transform: "translateY(92px)" }, { transform: "translateY(0)" }], 500),
        anim(b("count"), [{ opacity: 1 }, { opacity: 0 }], 300),
      ]);
      reset("board");
      await wait(1200, "board");
    },
    async role() {
      if (!(await wait(500, "role"))) return;
      await moveTo(1093, 122, 1000);
      await click();
      const badge = $("[data-badge]", pages.role);
      badge.style.opacity = "1";
      await anim(
        $("b", badge),
        [
          { transform: "scale(.6)", opacity: 0 },
          { transform: "scale(1.08)", opacity: 1 },
          { transform: "scale(1)", opacity: 1 },
        ],
        380,
      );
      moveTo(820, 640, 1100);
      if (!(await wait(2800, "role"))) return;
      await anim(badge, [{ opacity: 1 }, { opacity: 0 }], 450);
      reset("role");
      await wait(1000, "role");
    },
    async interviews() {
      if (!(await wait(500, "interviews"))) return;
      const ring = $("[data-ring]", pages.interviews);
      await moveTo(414, 510, 950);
      await click();
      await anim(
        ring,
        [
          { opacity: 0, transform: "scale(.5)" },
          { opacity: 1, transform: "scale(1)" },
        ],
        300,
      );
      if (!(await wait(900, "interviews"))) return;
      await moveTo(708, 426, 700);
      await click();
      await anim(ring, [{ transform: "scale(1)" }, { transform: "translate(294px,-84px) scale(1)" }], 380);
      if (!(await wait(900, "interviews"))) return;
      await moveTo(806, 510, 600);
      await click();
      await anim(ring, [{ transform: "translate(294px,-84px)" }, { transform: "translate(392px,0)" }], 380);
      if (!(await wait(2200, "interviews"))) return;
      await anim(ring, [{ opacity: 1 }, { opacity: 0 }], 400);
      reset("interviews");
      await moveTo(900, 720, 900);
      await wait(700, "interviews");
    },
    async insights() {
      if (!(await wait(700, "insights"))) return;
      const y = 399 - innerS.insights;
      await moveTo(1068, y, 1100);
      tip.style.transform = `translate(0, ${(y - 400).toFixed(0)}px)`;
      await anim(tip, [{ opacity: 0 }, { opacity: 1 }], 300);
      if (!(await wait(2400, "insights"))) return;
      await anim(tip, [{ opacity: 1 }, { opacity: 0 }], 300);
      await moveTo(610, 640 - innerS.insights, 1300);
      await wait(1600, "insights");
    },
  };

  async function director() {
    for (;;) {
      if (!active) await new Promise<void>((r) => (wake = r));
      const want = pageFor(t);
      if (want !== cur) {
        // Skipping several chapters at once (a nav link, a fast fling): cut straight to the page.
        await switchTo(want, Math.abs(order.indexOf(want) - order.indexOf(cur)) > 1);
        continue;
      }
      await loops[cur]();
      if (stale(cur)) reset(cur);
    }
  }

  // ---------- Wiring ----------
  layout();
  hl.style.transform = `translateY(${navY.today - 56}px)`;
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", () => {
    layout();
    kick();
  });
  const setActive = (on: boolean) => {
    active = on && !document.hidden;
    stage.classList.toggle("is-paused", !active);
    if (active) {
      kick();
      wake?.();
      wake = null;
    }
  };
  let seen = true;
  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    setActive(seen);
  }).observe(tour);
  document.addEventListener("visibilitychange", () => setActive(seen));
  kick();
  director();
}

if (!reduce) init();
