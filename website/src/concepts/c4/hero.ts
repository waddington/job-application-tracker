// The hero: the browser drifts and turns with scroll, and the app inside it is used on a loop
// (Today → board → insights → Today). Everything pauses while the hero is off screen; under reduced
// motion the window holds one pose showing the board.
import { startFlow } from "./flow";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const hero = document.querySelector<HTMLElement>(".c4-hero");
const rig = document.querySelector<HTMLElement>("[data-c4-rig]");
const app = document.querySelector<HTMLElement>("[data-c4-app]");
const canvas = document.querySelector<HTMLCanvasElement>('[data-c4-flow="hero"]');

let visible = true;
if (hero) {
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
  }).observe(hero);
}

// The ambient stream behind the hero: three sources merge, then split into how things ended.
if (canvas) {
  const teal = "#5ef0dc";
  const cyan = "#6cc9ff";
  const violet = "#a594ff";
  const slate = "#6f7f9c";
  startFlow(canvas, {
    nodes: [
      { x: 0, y: 0.5, h: 0.12 }, // 0 source
      { x: 0, y: 0.72, h: 0.16 }, // 1 source
      { x: 0, y: 0.92, h: 0.1 }, // 2 source
      { x: 0.32, y: 0.78, h: 0.14 }, // 3 merged
      { x: 0.62, y: 0.82, h: 0.12 }, // 4 middle
      { x: 1.0, y: 0.64, h: 0.1 }, // 5 offer
      { x: 1.0, y: 0.86, h: 0.12 }, // 6 still going
      { x: 0.86, y: 0.99, h: 0.06 }, // 7 ghosted
    ],
    routes: [
      { path: [0, 3, 4, 5], weight: 2, color: teal },
      { path: [1, 3, 4, 6], weight: 3, color: cyan },
      { path: [2, 3, 4, 6], weight: 2, color: violet },
      { path: [1, 3, 4, 7], weight: 2, color: slate, fade: true },
      { path: [0, 3, 4, 7], weight: 1, color: slate, fade: true },
    ],
    count: 520,
    speed: 0.05,
    size: [1.2, 2.4],
    alpha: 0.7,
    trail: 0.82,
  });
}

// ---------- The window: idle drift plus a scroll-linked turn ----------
if (rig && hero) {
  const narrow = () => innerWidth < 960;
  if (reduce) {
    rig.style.transform = narrow() ? "rotateX(6deg) rotateY(-8deg)" : "rotateX(7deg) rotateY(-18deg)";
  } else {
    const t0 = performance.now();
    const frame = (now: number) => {
      if (visible) {
        const t = (now - t0) / 1000;
        const k = narrow() ? 0.5 : 1;
        const p = Math.max(0, Math.min(1, scrollY / Math.max(1, hero.offsetHeight)));
        const ry = (-20 + Math.sin(t * 0.21) * 6 + p * 26) * k;
        const rx = 7 + Math.sin(t * 0.33 + 1) * 2 - p * 9;
        const rz = Math.sin(t * 0.17) * 0.6;
        const ty = Math.sin(t * 0.5) * 6 - p * 50;
        rig.style.transform = `translate3d(0, ${ty.toFixed(2)}px, 0) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

// ---------- The app being used ----------
if (app) {
  const q = (s: string) => app.querySelector<HTMLElement>(s)!;
  const cursor = q("[data-cursor]");
  const active = q("[data-active]");
  const scroll = q("[data-scroll]");
  const card = q("[data-card]");
  const pages = new Map([...app.querySelectorAll<HTMLElement>("[data-page]")].map((el) => [el.dataset.page!, el]));
  // The sidebar rows, as screenshot y offsets from Today's row.
  const rows: Record<string, number> = { today: 0, board: 115, insights: 502 };
  let current = "today";

  const show = (name: string) => {
    const next = pages.get(name)!;
    const prev = pages.get(current)!;
    if (name === current) return;
    prev.classList.remove("is-on");
    prev.classList.add("is-off");
    next.classList.add("is-on");
    active.style.setProperty("--ay", String(rows[name]));
    current = name;
    setTimeout(() => prev.classList.remove("is-off"), 850);
  };

  if (reduce) {
    show("board");
  } else {
    // A wait that only counts down while the hero is on screen and the tab is showing.
    const wait = (ms: number) =>
      new Promise<void>((done) => {
        let left = ms;
        let last = performance.now();
        const tick = (now: number) => {
          if (visible && !document.hidden) left -= now - last;
          last = now;
          if (left <= 0) done();
          else requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    let cx = 1100;
    let cy = 520;
    const move = async (x: number, y: number, ms?: number) => {
      const d = Math.hypot(x - cx, y - cy);
      const dur = ms ?? Math.round(Math.min(1300, 420 + d * 0.8));
      cursor.style.setProperty("--d", `${dur}ms`);
      cursor.style.setProperty("--cx", String(x));
      cursor.style.setProperty("--cy", String(y));
      cx = x;
      cy = y;
      await wait(dur + 80);
    };
    const click = async () => {
      cursor.classList.remove("is-click");
      void cursor.offsetWidth;
      cursor.classList.add("is-click");
      await wait(240);
    };
    const scrollTo = async (y: number, ms: number) => {
      scroll.style.setProperty("--sd", `${ms}ms`);
      scroll.style.setProperty("--sy", String(y));
      await wait(ms);
    };
    const setCard = (dx: number, ms: number) => {
      card.style.setProperty("--cd", `${ms}ms`);
      card.style.setProperty("--dx", String(dx));
    };

    const run = async () => {
      for (;;) {
        // Today: scroll to the to-dos and tick one.
        await wait(1100);
        await move(760, 420);
        await scrollTo(430, 1500);
        await move(286, 887 - 430 + 2);
        await click();
        app.classList.add("is-done");
        await wait(1100);
        await scrollTo(0, 1100);

        // The board: drag Adventure Works from Applied to Screen.
        await move(120, 201);
        await click();
        show("board");
        await wait(900);
        await move(640, 312);
        cursor.classList.add("is-grab");
        app.classList.add("is-lifted");
        await wait(260);
        setCard(262, 1100);
        cursor.style.setProperty("--d", "1100ms");
        cursor.style.setProperty("--cx", String(640 + 262));
        cx = 902;
        await wait(1150);
        app.classList.add("is-dropped");
        await wait(1500);

        // Insights: hover a flow of the Sankey.
        await move(120, 588);
        await click();
        show("insights");
        await wait(900);
        app.classList.remove("is-done");
        await move(668, 452);
        app.classList.add("is-tip");
        await wait(1900);
        app.classList.remove("is-tip");

        // Back to Today; reset what the board and the to-do changed while they're out of sight.
        await move(120, 86);
        await click();
        show("today");
        await wait(900);
        app.classList.remove("is-lifted", "is-dropped");
        setCard(0, 0);
        await move(1100, 520);
      }
    };
    void run();
  }
}
