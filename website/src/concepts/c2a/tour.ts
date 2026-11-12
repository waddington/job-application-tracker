// Concept 2a's tour: scroll poses the glass window (hero → full screen → exploded → shrunk), picks the app's page and
// scrolls long pages inside it; the pointer tilts the world; slabs behind drift at their own depth. The app itself
// is driven by app/engine.ts. Reduced motion: nothing here runs (the page shows stacked stills).
import { app, type PageName } from "./app/engine";

type Pose = { tx: number; ty: number; sc: number; rx: number; ry: number; rz: number; x: number; chips: number };

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v: number, a: number, b: number) => {
  const k = clamp((v - a) / (b - a));
  return k * k * (3 - 2 * k);
};
const mix = (a: number, b: number, k: number) => a + (b - a) * k;
const $ = <T extends HTMLElement = HTMLElement>(s: string) => document.querySelector<T>(s)!;
const $$ = <T extends HTMLElement = HTMLElement>(s: string) => [...document.querySelectorAll<T>(s)];

function init() {
  const tour = $("[data-tour]");
  const stage = $("[data-stage]");
  const world = $("[data-world]");
  const pose = $("[data-pose]");
  const awEl = $("[data-tour] [data-aw]");
  const ctl = app(awEl);
  const sections = $$("[data-ch]");
  const words = $$("[data-words] span");
  const outro = $("[data-outro]");
  const segs = $$("[data-seg]");
  const label = $("[data-progress-label]");
  const slabs = $$("[data-slab]");
  const names = ["", "", "Today", "Search", "The board", "Roles", "Interviews", "Insights", "Under the glass"];

  let vw = 0;
  let vh = 0;
  let keys: [number, Pose][] = [];
  const P = (tx: number, ty: number, sc: number, rx: number, ry: number, rz: number, x = 0, chips = 0): Pose => ({
    tx,
    ty,
    sc,
    rx,
    ry,
    rz,
    x,
    chips,
  });

  function layout() {
    vw = innerWidth;
    vh = innerHeight;
    const mobile = vw < 760;
    if (mobile) ctl.size(vw - 20, Math.round(Math.min(vh * 0.5, 470)));
    else {
      const s = Math.min((vw - 140) / 1440, (vh - 44 - 130) / 900);
      ctl.size(Math.round(1440 * s), Math.round(900 * s));
    }
    const H = mobile ? P(0, vh * 0.36, 0.82, 18, -14, 2, 0, 1) : P(vw * 0.2, vh * 0.05, 0.52, 12, -24, 2.5, 0, 1);
    const F = mobile ? P(0, -vh * 0.13, 1, 0, 0, 0) : P(0, 12, 1, 0, 0, 0);
    const E = mobile ? P(0, vh * 0.2, 0.86, 10, -24, 0, 1) : P(vw * 0.15, -vh * 0.04, 0.44, 54, 0, -32, 1);
    const E0 = mobile ? P(0, vh * 0.2, 0.86, 4, -8, 0) : P(vw * 0.17, 14, 0.58, 4, -10, 0);
    const O = mobile ? P(0, -vh * 0.03, 0.55, 10, 0, 0) : P(0, vh * 0.07, 0.38, 12, 0, 0, 0, 0);
    keys = [
      [0, H],
      [0.55, H],
      [1.55, F],
      [8.02, F],
      [8.32, E],
      [8.7, E],
      [8.98, E0],
      [9.42, O],
      [10, O],
    ];
  }
  function poseAt(t: number): Pose {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      const [t1, p1] = keys[i];
      const [t0, p0] = keys[i - 1];
      if (t <= t1) {
        const k = smooth(t, t0, t1);
        const o = {} as Pose;
        for (const n of Object.keys(p0) as (keyof Pose)[]) o[n] = mix(p0[n], p1[n], k);
        return o;
      }
    }
    return keys[keys.length - 1][1];
  }
  function readT() {
    const mid = vh * 0.5;
    let t = 0;
    for (const sec of sections) {
      const r = sec.getBoundingClientRect();
      if (r.top <= mid) t = Number(sec.dataset.ch) + clamp((mid - r.top) / r.height);
    }
    return t;
  }
  const pageFor = (t: number): PageName =>
    t < 3
      ? "today"
      : t < 4
        ? "application"
        : t < 5
          ? "board"
          : t < 6
            ? "role"
            : t < 7
              ? "interviews"
              : "insights";

  let t = 0;
  let tS = 0;
  let active = true;
  let running = false;
  let lit = -1;
  let seg = -1;
  let px = 0;
  let py = 0;
  let pxS = 0;
  let pyS = 0;

  function frame() {
    t = readT();
    tS += (t - tS) * 0.15;
    if (Math.abs(t - tS) < 0.0005) tS = t;
    const p = poseAt(tS);
    pose.style.transform = `translate3d(${p.tx.toFixed(1)}px, ${p.ty.toFixed(1)}px, 0) scale(${p.sc.toFixed(4)}) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg)`;
    ctl.explode(p.x);
    pose.style.setProperty("--chips", p.chips.toFixed(3));
    pose.style.setProperty("--expl", p.x.toFixed(3));

    // The pointer tilts the world a little; the slabs drift at their own depths as you scroll.
    pxS += (px - pxS) * 0.06;
    pyS += (py - pyS) * 0.06;
    world.style.transform = `rotateX(${(-pyS * 3).toFixed(2)}deg) rotateY(${(pxS * 4).toFixed(2)}deg)`;
    for (const s of slabs) {
      const k = Number(s.dataset.slab);
      s.style.transform = `translateZ(var(--z)) translateY(${(-tS * 9 * k).toFixed(1)}vh) rotate(var(--r))`;
    }

    const page = pageFor(t);
    ctl.want(page);
    ctl.inner("today", t < 2 ? 0 : smooth(clamp(t - 2), 0.35, 0.92) * 720);
    ctl.inner("application", smooth(clamp(t - 3), 0.3, 0.95) * 1150);
    ctl.inner("insights", smooth(clamp(t - 7), 0.5, 0.95) * 100);

    const n = Math.round(smooth(clamp(t - 1), 0.05, 0.55) * words.length);
    if (n !== lit) {
      words.forEach((w, i) => w.classList.toggle("is-lit", i < n));
      lit = n;
    }
    outro.style.setProperty("--p", smooth(clamp(t - 9), 0.08, 0.5).toFixed(3));
    const r = t >= 2 && t < 9 ? Math.floor(t) : -1;
    if (r !== seg) {
      segs.forEach((a) => {
        const i = Number(a.dataset.seg);
        a.classList.toggle("is-on", i === r);
        a.classList.toggle("is-done", i < r);
      });
      label.textContent = r > 0 ? names[r] : "Tour";
      seg = r;
    }
    document.body.classList.toggle("c2a-in-tour", t > 1.7 && t < 9.2);

    if (active) requestAnimationFrame(frame);
    else running = false;
  }
  const kick = () => {
    if (!running && active) {
      running = true;
      requestAnimationFrame(frame);
    }
  };

  layout();
  addEventListener("scroll", kick, { passive: true });
  addEventListener("resize", () => {
    layout();
    kick();
  });
  addEventListener(
    "pointermove",
    (e) => {
      px = e.clientX / innerWidth - 0.5;
      py = e.clientY / innerHeight - 0.5;
      kick();
    },
    { passive: true },
  );
  let seen = true;
  const setActive = () => {
    active = seen && !document.hidden;
    stage.classList.toggle("is-paused", !active);
    ctl.active(active);
    kick();
  };
  new IntersectionObserver(([e]) => {
    seen = e.isIntersecting;
    setActive();
  }).observe(tour);
  document.addEventListener("visibilitychange", setActive);
  setActive();
}

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) init();
