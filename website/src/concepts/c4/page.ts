// Page-wide behaviour: the page tint follows the section on screen, chapter windows tilt with scroll
// and start their small loops when in view, and the quick-start tabs.
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- Tint: the section crossing the middle of the screen sets the page's colour ----------
const layers = new Map(
  [...document.querySelectorAll<HTMLElement>("[data-tint-layer]")].map((el) => [el.dataset.tintLayer!, el]),
);
const setTint = (name: string) => layers.forEach((el, key) => el.classList.toggle("is-on", key === name));
const tintIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) if (e.isIntersecting) setTint((e.target as HTMLElement).dataset.tint!);
  },
  { rootMargin: "-50% 0px -50% 0px" },
);
document.querySelectorAll("[data-tint]").forEach((el) => tintIO.observe(el));

// ---------- Chapters: loops run only in view; windows turn as they pass ----------
const chapters = [...document.querySelectorAll<HTMLElement>(".c4-chapter")];
const inIO = new IntersectionObserver(
  (entries) => {
    for (const e of entries) e.target.classList.toggle("is-in", e.isIntersecting);
  },
  { threshold: 0.2 },
);
chapters.forEach((ch) => inIO.observe(ch));

if (!reduce) {
  const tilts = [...document.querySelectorAll<HTMLElement>("[data-c4-tilt]")];
  let queued = false;
  const tilt = () => {
    queued = false;
    const h = innerHeight;
    for (const el of tilts) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > h + 100) continue;
      // -1 as it comes up from below, 0 centred, +1 as it leaves at the top.
      const p = Math.max(-1, Math.min(1, (r.top + r.height / 2 - h / 2) / -h));
      el.style.setProperty("--p", p.toFixed(3));
    }
  };
  addEventListener(
    "scroll",
    () => {
      if (!queued) requestAnimationFrame(tilt);
      queued = true;
    },
    { passive: true },
  );
  tilt();
}

// ---------- Quick-start tabs ----------
const tabs = [...document.querySelectorAll<HTMLButtonElement>('.c4-tabs [role="tab"]')];
const select = (tab: HTMLButtonElement) => {
  for (const t of tabs) {
    const on = t === tab;
    t.setAttribute("aria-selected", String(on));
    t.tabIndex = on ? 0 : -1;
    document.getElementById(t.getAttribute("aria-controls")!)!.hidden = !on;
  }
};
tabs.forEach((t, i) => {
  t.addEventListener("click", () => select(t));
  t.addEventListener("keydown", (e) => {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    const next = tabs[(i + d + tabs.length) % tabs.length];
    select(next);
    next.focus();
  });
});
