// The journey spine: the glowing line fills to where you are, the stage you've reached lights up (on
// the spine and in the fixed tracker), and square particles travel down it, some leaking out sideways
// at each stage the way roles drop out of a search. Also starts the Sankey of particles at the end.
import { startFlow } from "./flow";

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const journey = document.querySelector<HTMLElement>("[data-c4-journey]");
const spine = journey?.querySelector<HTMLElement>(".c4-spine");
const canvas = document.querySelector<HTMLCanvasElement>("[data-c4-spine-canvas]");
const chapters = [...document.querySelectorAll<HTMLElement>(".c4-chapter")];
const links = [...document.querySelectorAll<HTMLAnchorElement>("[data-stage-link]")];

// ---------- Fill, lit stages and the tracker (cheap, so also under reduced motion) ----------
let inJourney = false;
const update = () => {
  if (!journey || !spine) return;
  const r = spine.getBoundingClientRect();
  const mid = innerHeight * 0.55;
  journey.style.setProperty("--fill", String(Math.max(0, Math.min(1, (mid - r.top) / r.height))));
  let current = -1;
  chapters.forEach((ch, i) => {
    const node = ch.querySelector(".c4-node")!.getBoundingClientRect();
    const lit = node.top < mid;
    ch.classList.toggle("is-lit", lit);
    if (lit) current = i;
  });
  document.body.classList.toggle("is-journey", inJourney && current >= 0);
  links.forEach((a, i) => {
    a.classList.toggle("is-past", i < current);
    if (i === current) a.setAttribute("aria-current", "step");
    else a.removeAttribute("aria-current");
  });
};
if (journey) {
  new IntersectionObserver(([e]) => {
    inJourney = e.isIntersecting;
    canvas?.classList.toggle("is-on", inJourney && !reduce);
    update();
  }).observe(journey);
  addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
  addEventListener("resize", update);
  update();
}

// ---------- Particles down the spine ----------
type P = { y: number; dx: number; v: number; s: number; leak: number; lx: number; a: number };
if (canvas && spine && !reduce) {
  const ctx = canvas.getContext("2d")!;
  let W = 0;
  let H = 0;
  let dpr = 1;
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth;
    H = innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  };
  resize();
  addEventListener("resize", resize);
  const make = (y: number): P => ({
    y,
    dx: (Math.random() - 0.5) * 4,
    v: 50 + Math.random() * 110,
    s: 1.4 + Math.random() * 1.8,
    leak: 0,
    lx: 0,
    a: 1,
  });
  const ps: P[] = Array.from({ length: 110 }, () => make(Math.random() * innerHeight));
  const mix = (f: number) => {
    // teal → cyan → violet along the spine
    const stops = [
      [94, 240, 220],
      [108, 201, 255],
      [165, 148, 255],
    ];
    const x = Math.max(0, Math.min(1, f)) * 2;
    const i = Math.min(1, Math.floor(x));
    const t = x - i;
    const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  };
  let last = 0;
  let lastScroll = scrollY;
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    if (!inJourney) {
      last = 0;
      lastScroll = scrollY;
      return;
    }
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    const ds = scrollY - lastScroll;
    lastScroll = scrollY;
    const r = spine.getBoundingClientRect();
    const x = r.left + r.width / 2;
    const top = Math.max(-20, r.top);
    const bottom = Math.min(H + 20, r.bottom);
    const nodes = chapters.map((ch) => ch.querySelector(".c4-node")!.getBoundingClientRect().top);
    const mid = H * 0.55;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";
    if (bottom <= top) return;
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      const y0 = p.y;
      p.y += p.v * dt + ds * 0.55;
      if (p.leak) {
        p.lx += p.leak * dt;
        p.a -= dt * 0.7;
        p.v *= 0.98;
      } else {
        // At a stage, one in seven drops out of the search and drifts off sideways.
        for (const ny of nodes) {
          if (y0 < ny && p.y >= ny && Math.random() < 0.14) p.leak = 30 + Math.random() * 70;
        }
      }
      if (p.y > bottom || p.y < top - 40 || p.a <= 0) {
        ps[i] = make(ds < 0 ? bottom - Math.random() * 20 : top - Math.random() * 40);
        continue;
      }
      const f = (p.y - r.top) / r.height;
      const lit = p.y < mid ? 1 : 0.35;
      const px = x + p.dx + p.lx + (p.leak ? Math.sin(p.lx / 18) * 3 : 0);
      ctx.globalAlpha = Math.max(0, p.a) * lit * 0.95;
      ctx.fillStyle = mix(f);
      ctx.fillRect(px - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  };
  requestAnimationFrame(frame);
}

// ---------- The Sankey of particles ----------
const sankey = document.querySelector<HTMLCanvasElement>('[data-c4-flow="sankey"]');
if (sankey) {
  const teal = "#5ef0dc";
  const cyan = "#6cc9ff";
  const violet = "#b3a5ff";
  const slate = "#8090b4";
  const rose = "#ff8fa6";
  startFlow(sankey, {
    nodes: [
      { x: 0.02, y: 0.12, h: 0.07 }, // 0 referred
      { x: 0.02, y: 0.36, h: 0.2 }, // 1 you found it
      { x: 0.02, y: 0.7, h: 0.34 }, // 2 through a recruiter
      { x: 0.21, y: 0.5, h: 0.62 }, // 3 interested
      { x: 0.39, y: 0.9, h: 0.08 }, // 4 decided not to apply
      { x: 0.39, y: 0.44, h: 0.44 }, // 5 applied
      { x: 0.59, y: 0.12, h: 0.1 }, // 6 waiting to hear back
      { x: 0.59, y: 0.46, h: 0.2 }, // 7 screen
      { x: 0.79, y: 0.36, h: 0.12 }, // 8 interviewing
      { x: 0.79, y: 0.66, h: 0.05 }, // 9 rejected
      { x: 0.79, y: 0.84, h: 0.07 }, // 10 ghosted
      { x: 0.97, y: 0.3, h: 0.08 }, // 11 offer
    ],
    routes: [
      { path: [0, 3, 5, 7, 8, 11], weight: 2, color: violet },
      { path: [1, 3, 5, 7, 8, 11], weight: 2, color: teal },
      { path: [2, 3, 5, 7, 8, 11], weight: 2, color: cyan },
      { path: [1, 3, 5, 6], weight: 3, color: teal, fade: true },
      { path: [2, 3, 5, 6], weight: 3, color: cyan, fade: true },
      { path: [2, 3, 4], weight: 2, color: slate, fade: true },
      { path: [1, 3, 5, 7, 9], weight: 1.5, color: rose, fade: true },
      { path: [2, 3, 5, 7, 9], weight: 1.5, color: rose, fade: true },
      { path: [2, 3, 5, 10], weight: 2, color: slate, fade: true },
      { path: [0, 3, 5, 7, 10], weight: 1, color: slate, fade: true },
    ],
    count: 1500,
    speed: 0.075,
    size: [1.3, 2.6],
    alpha: 0.9,
    trail: 0.7,
    bars: true,
  });
}
