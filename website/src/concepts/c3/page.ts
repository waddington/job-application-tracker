// Concept 3 (Paper): the page's motion. The page tint follows the section in the middle of the screen, the contents
// rail tracks the chapter, the window stacks fan out as their sections scroll past, figures settle onto the page,
// and the quick-start tabs switch. With reduced motion, everything holds a still pose.

const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (t: number) => {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// --- Page tint and the chapter in view ---------------------------------------------------------------------------
const layers = document.querySelectorAll<HTMLElement>("[data-tint-layer]");
const rail = document.querySelector<HTMLElement>("[data-rail]");
const now = document.querySelector<HTMLElement>("[data-now]");
const middle = { rootMargin: "-48% 0px -48% 0px" };

const tintObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const el = e.target as HTMLElement;
    layers.forEach((l) => l.classList.toggle("on", l.dataset.tintLayer === el.dataset.tint));
    document.body.classList.toggle("c3-dark", el.dataset.tint === "ink");
    rail?.classList.toggle("shown", !el.matches(".c3-cover, .c3-close"));
  }
}, middle);
document.querySelectorAll("[data-tint]").forEach((s) => tintObserver.observe(s));

const chObserver = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    const id = (e.target as HTMLElement).dataset.ch;
    document.querySelectorAll<HTMLAnchorElement>("[data-toc]").forEach((a) => {
      const on = a.dataset.toc === id;
      a.classList.toggle("on", on);
      if (on) {
        a.setAttribute("aria-current", "true");
        if (now) now.textContent = a.textContent?.trim().replace(/^(\d+)/, "$1 ") ?? "";
      } else a.removeAttribute("aria-current");
    });
  }
}, middle);
document.querySelectorAll("[data-ch]").forEach((s) => chObserver.observe(s));

// --- The live app scales to its window ---------------------------------------------------------------------------
const sizer = new ResizeObserver((entries) => {
  for (const e of entries)
    (e.target as HTMLElement).style.setProperty("--k", String(e.contentRect.width / 1440));
});
document.querySelectorAll("[data-live-body]").forEach((b) => sizer.observe(b));

// --- Fans --------------------------------------------------------------------------------------------------------
type Pose = { x: number; y: number; z: number; ry: number; rz: number };
const stacked: Pose[] = [
  { x: 0, y: -7.5, z: -120, ry: 0, rz: -2.4 },
  { x: 0, y: -5, z: -90, ry: 0, rz: 1.6 },
  { x: 0, y: -2.5, z: -60, ry: 0, rz: -1.1 },
  { x: 0, y: 0, z: -30, ry: 0, rz: 2.2 },
];
const fanned = (narrow: boolean): Pose[] =>
  narrow
    ? [
        // On a phone the papers spread down the screen rather than across it.
        { x: -7, y: -58, z: -220, ry: 0, rz: -3 },
        { x: 6, y: -30, z: -110, ry: 0, rz: 2 },
        { x: -6, y: 26, z: -110, ry: 0, rz: -2 },
        { x: 7, y: 50, z: -220, ry: 0, rz: 3 },
      ]
    : [
        { x: -70, y: 8, z: -340, ry: 30, rz: 0 },
        { x: -38, y: 3, z: -170, ry: 16, rz: 0 },
        { x: 38, y: 3, z: -170, ry: -16, rz: 0 },
        { x: 70, y: 8, z: -340, ry: -30, rz: 0 },
      ];

function poseFan(fan: HTMLElement, f: number, narrow: boolean) {
  const to = fanned(narrow);
  fan.querySelectorAll<HTMLElement>("[data-fan-card]").forEach((card) => {
    const i = card.dataset.fanCard;
    if (i === "front") {
      card.style.transform = `translate3d(0, ${lerp(0, 3, f)}%, 0)`;
      return;
    }
    const a = stacked[Number(i)];
    const b = to[Number(i)];
    card.style.transform =
      `translate3d(${lerp(a.x, b.x, f)}%, ${lerp(a.y, b.y, f)}%, ${lerp(a.z, b.z, f)}px) ` +
      `rotateY(${lerp(a.ry, b.ry, f)}deg) rotateZ(${lerp(a.rz, b.rz, f)}deg)`;
  });
  fan.style.setProperty("--labels", String(smooth((f - 0.6) / 0.4)));
}

const sections = [...document.querySelectorAll<HTMLElement>("[data-fan-sec]")];

function frame() {
  const vh = innerHeight;
  const narrow = innerWidth < 760;
  for (const sec of sections) {
    const r = sec.getBoundingClientRect();
    if (r.bottom < -vh || r.top > vh * 2) continue;
    const p = clamp(-r.top / Math.max(1, r.height - vh));
    const fan = sec.querySelector<HTMLElement>("[data-fan]")!;
    const tilt = sec.querySelector<HTMLElement>("[data-fan-tilt]")!;
    if (sec.dataset.fanSec === "cover") {
      // Lying on the desk below the headline, then lifted to face you, then fanned out.
      const a = smooth(p / 0.32);
      const f = smooth((p - 0.34) / 0.42);
      const s = lerp(1, narrow ? 0.86 : 0.64, f);
      tilt.style.transform =
        `translate3d(0, ${lerp(narrow ? 0.3 : 0.36, 0, a) * vh}px, 0) ` +
        `rotateX(${lerp(30, 4, a)}deg) rotateZ(${lerp(-5, 0, a)}deg) rotateY(${lerp(-8, 0, a)}deg) scale(${s})`;
      poseFan(fan, f, narrow);
      const text = sec.querySelector<HTMLElement>("[data-cover-text]")!;
      text.style.opacity = String(1 - smooth(p / 0.22));
      text.style.transform = `translateY(${-p * 0.25 * vh}px)`;
      const cap = sec.querySelector<HTMLElement>("[data-fan-caption]")!;
      cap.style.opacity = String(smooth((p - 0.7) / 0.18));
      cap.style.transform = `translateY(${lerp(16, 0, smooth((p - 0.7) / 0.18))}px)`;
    } else {
      const f = smooth((p - 0.12) / 0.6);
      const s = lerp(0.92, narrow ? 0.86 : 0.64, f);
      tilt.style.transform = `rotateX(${lerp(14, 3, f)}deg) scale(${s})`;
      poseFan(fan, f, narrow);
    }
  }
  document.querySelectorAll<HTMLElement>("[data-rise]").forEach((fig) => {
    const r = fig.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh) return;
    const t = smooth((vh - r.top) / (vh * 0.7));
    const win = fig.firstElementChild as HTMLElement;
    win.style.transform = `translateY(${lerp(48, 0, t)}px) rotateX(${lerp(12, 0, t)}deg)`;
  });
}

if (reduce) {
  // Still poses: a loose stack, a little fanned, facing you.
  const narrow = innerWidth < 760;
  for (const sec of sections) {
    const fan = sec.querySelector<HTMLElement>("[data-fan]")!;
    sec.querySelector<HTMLElement>("[data-fan-tilt]")!.style.transform =
      `rotateX(4deg) scale(${narrow ? 0.8 : 0.66})`;
    poseFan(fan, 0.85, narrow);
    fan.style.setProperty("--labels", "1");
  }
} else {
  let ticking = false;
  const request = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      frame();
    });
  };
  addEventListener("scroll", request, { passive: true });
  addEventListener("resize", request);
  frame();
}

// --- Quick-start tabs --------------------------------------------------------------------------------------------
const tabs = document.querySelector<HTMLElement>("[data-tabs]");
if (tabs) {
  const buttons = [...tabs.querySelectorAll<HTMLButtonElement>("[data-tab]")];
  const ind = tabs.querySelector<HTMLElement>("[data-tab-ind]")!;
  const select = (i: number, focus = false) => {
    buttons.forEach((b, j) => {
      const on = i === j;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      document.getElementById(b.getAttribute("aria-controls")!)!.hidden = !on;
      if (on && focus) b.focus();
    });
    ind.style.transform = `translateX(${i * 100}%)`;
  };
  buttons.forEach((b, i) => {
    b.addEventListener("click", () => select(i));
    b.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) select((i + d + buttons.length) % buttons.length, true);
    });
  });
}
