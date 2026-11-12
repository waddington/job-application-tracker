// Square dot particles flowing left to right through stages, like the app's Sankey diagram. Each
// particle follows one route (a list of nodes); between nodes it eases along an S-curve, the way a
// Sankey link bends. Runs only while its canvas is on screen; under reduced motion it draws one still
// frame.

export type FlowNode = { x: number; y: number; h: number }; // 0..1 of the canvas; h is the band height
export type FlowRoute = { path: number[]; weight: number; color: string; fade?: boolean };
export type FlowConfig = {
  nodes: FlowNode[];
  routes: FlowRoute[];
  count: number; // particles at 1440 px wide; scaled with the canvas width
  speed: number; // canvas widths per second
  size: [number, number]; // css px
  alpha: number;
  trail: number; // 0 = no trail, up to ~0.9 for long streaks
  bars?: boolean; // draw the nodes as thin glowing bars
};

type P = { r: number; u: number; lane: number; v: number; s: number; tw: number };

const smooth = (t: number) => t * t * (3 - 2 * t);

export function startFlow(canvas: HTMLCanvasElement, cfg: FlowConfig) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const total = cfg.routes.reduce((a, r) => a + r.weight, 0);
  const pick = () => {
    let x = Math.random() * total;
    for (let i = 0; i < cfg.routes.length; i++) {
      x -= cfg.routes[i].weight;
      if (x <= 0) return i;
    }
    return 0;
  };
  // Stack the routes inside each node like Sankey links: a route's slot in a node is proportional to
  // its weight, ordered by where the route is heading, so ribbons don't cross more than they must.
  const slots = cfg.routes.map(() => new Map<number, { y: number; h: number }>());
  cfg.nodes.forEach((node, n) => {
    const through = cfg.routes
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.path.includes(n))
      .map(({ r, i }) => {
        const k = r.path.indexOf(n);
        const ys = r.path.map((m) => cfg.nodes[m].y);
        const after = ys.slice(k + 1);
        const before = ys.slice(0, k);
        const key =
          (after.length ? after.reduce((a, b) => a + b) / after.length : node.y) * 2 +
          (before.length ? before.reduce((a, b) => a + b) / before.length : node.y);
        return { i, w: r.weight, key };
      })
      .sort((a, b) => a.key - b.key);
    const sum = through.reduce((a, t) => a + t.w, 0);
    let acc = 0;
    for (const t of through) {
      const h = (node.h * t.w) / sum;
      slots[t.i].set(n, { y: node.y - node.h / 2 + acc + h / 2, h });
      acc += h;
    }
  });
  let W = 0;
  let H = 0;
  let dpr = 1;
  let ps: P[] = [];
  const spawn = (anywhere = false): P => {
    const r = pick();
    const path = cfg.routes[r].path;
    const x0 = cfg.nodes[path[0]].x;
    const x1 = cfg.nodes[path[path.length - 1]].x;
    return {
      r,
      u: anywhere ? x0 + Math.random() * (x1 - x0) : x0 - Math.random() * 0.04,
      lane: Math.random() - 0.5,
      v: cfg.speed * (0.7 + Math.random() * 0.6),
      s: cfg.size[0] + Math.random() * (cfg.size[1] - cfg.size[0]),
      tw: Math.random() * Math.PI * 2,
    };
  };
  const resize = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = canvas.clientWidth;
    H = canvas.clientHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const n = Math.round(cfg.count * Math.max(0.35, Math.min(1.2, W / 1440)));
    ps = Array.from({ length: n }, () => spawn(true));
  };

  const place = (p: P) => {
    const route = cfg.routes[p.r];
    const path = route.path;
    const nodes = cfg.nodes;
    const last = nodes[path[path.length - 1]];
    if (p.u >= last.x) return null;
    let i = 0;
    while (i < path.length - 2 && p.u > nodes[path[i + 1]].x) i++;
    const a = nodes[path[i]];
    const b = nodes[path[i + 1]];
    const sa = slots[p.r].get(path[i])!;
    const sb = slots[p.r].get(path[i + 1])!;
    const t = Math.max(0, Math.min(1, (p.u - a.x) / (b.x - a.x || 1)));
    const s = smooth(t);
    const y = sa.y + (sb.y - sa.y) * s + p.lane * (sa.h + (sb.h - sa.h) * s);
    // Fade in at the start, and out at the end of a route that stops short (a leak).
    const first = nodes[path[0]];
    const span = last.x - first.x;
    const k = (p.u - first.x) / span;
    let alpha = Math.min(1, k * 12);
    if (route.fade) alpha *= Math.max(0, Math.min(1, (1 - k) * 4));
    else alpha *= Math.max(0, Math.min(1, (last.x - p.u) * 40));
    return { x: p.u * W, y: y * H, alpha };
  };

  const draw = (dt: number, t: number) => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (cfg.trail > 0 && dt > 0) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = `rgba(0,0,0,${1 - cfg.trail})`;
      ctx.fillRect(0, 0, W, H);
    } else {
      ctx.clearRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = "lighter";
    if (cfg.bars) {
      for (const n of cfg.nodes) {
        const g = ctx.createLinearGradient(0, (n.y - n.h / 2) * H, 0, (n.y + n.h / 2) * H);
        g.addColorStop(0, "rgba(122,245,228,0)");
        g.addColorStop(0.5, "rgba(122,245,228,0.10)");
        g.addColorStop(1, "rgba(122,245,228,0)");
        ctx.fillStyle = g;
        ctx.fillRect(n.x * W - 1.5, (n.y - n.h / 2 - 0.02) * H, 3, (n.h + 0.04) * H);
      }
    }
    for (let i = 0; i < ps.length; i++) {
      const p = ps[i];
      p.u += p.v * dt;
      const at = place(p);
      if (!at) {
        ps[i] = spawn();
        continue;
      }
      const tw = 0.75 + 0.25 * Math.sin(t * 3 + p.tw);
      ctx.globalAlpha = at.alpha * cfg.alpha * tw;
      ctx.fillStyle = cfg.routes[p.r].color;
      ctx.fillRect(at.x - p.s / 2, at.y - p.s / 2, p.s, p.s);
    }
    ctx.globalAlpha = 1;
  };

  // A still frame for reduced motion: a few short steps, so each dot keeps a short tail.
  const still = () => {
    draw(0, 0);
    for (let i = 0; i < 6; i++) draw(0.016, 0);
  };
  resize();
  new ResizeObserver(() => {
    resize();
    if (reduce) still();
  }).observe(canvas);

  if (reduce) {
    still();
    return;
  }
  let visible = false;
  let last = 0;
  let raf = 0;
  const loop = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    draw(dt, now / 1000);
    raf = requestAnimationFrame(loop);
  };
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(raf);
    last = 0;
    if (visible) raf = requestAnimationFrame(loop);
  }).observe(canvas);
}
