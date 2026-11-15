/*
 * DEV ONLY: the app redesign concepts (roadmap task app-redesign-concepts), for picking one on a dev server.
 * main.tsx loads this module only when import.meta.env.DEV is true, so a production build has none of it.
 *
 * ?design=N picks a concept (0 is today's look) and remembers it in localStorage; a small floating switch
 * at the bottom right changes it (hide it with ?switch=0, for screenshots). Each concept is a Mantine theme
 * override plus CSS keyed on <html data-design="N">; the page's area (the first part of its path) goes on
 * <html data-area="…"> so a concept can tint each area its own way.
 */
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./concepts.css";

import {
  Badge,
  Button,
  Card,
  createTheme,
  Drawer,
  mergeThemeOverrides,
  virtualColor,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from "@mantine/core";

import { router } from "../router";

// Round 1 had four concepts; 4 (Soft cards) was the pick, so 1-3 are gone (see PR #354's history for them).
// Round 2 varies 4. Each flag becomes a data attribute on <html> that concepts.css keys on:
//   soft: 4's look; oneBg: one background on every page; wide: full width up to a cap; drift: the slow fade;
//   bones: Today in three columns, a full-width board, an application docked beside the list; topbar: the nav
//   as a bar under the header.
type Flag = "soft" | "oneBg" | "wide" | "drift" | "bones" | "topbar";
export const CONCEPTS: { n: number; name: string; flags: Flag[] }[] = [
  { n: 0, name: "Today's look", flags: [] },
  { n: 4, name: "Soft cards (round 1's pick)", flags: ["soft"] },
  { n: 5, name: "Still: 4, one background, full width", flags: ["soft", "oneBg", "wide"] },
  { n: 6, name: "Drift: 5 with a slow colour fade", flags: ["soft", "oneBg", "wide", "drift"] },
  { n: 7, name: "Wide bones: 5 with new page layouts", flags: ["soft", "oneBg", "wide", "bones"] },
  {
    n: 8,
    name: "Top bar: 7's layouts, nav on top, drifting",
    flags: ["soft", "oneBg", "wide", "drift", "bones", "topbar"],
  },
];

const DRIFT_CYCLE_MS = 600_000; // keep in step with the drift animation's 600s in concepts.css

const KEY = "jat.design";

// Plum, the primary colour: in light mode the website's ink (#2a1e3f, at shade 6, Mantine's light primary shade);
// in dark mode its lavender (#c9b8f0, at shade 8, the dark primary shade) with dark text on it.
const plumInk: MantineColorsTuple = [
  "#f4f1fb",
  "#e9e4f8",
  "#d6cdf1",
  "#c9b8f0",
  "#a994dc",
  "#6a5591",
  "#2a1e3f",
  "#3a2c54",
  "#1b1328",
  "#140e1e",
];
const plumGlow: MantineColorsTuple = [
  "#140e1e",
  "#1b1328",
  "#221832",
  "#2a1e3f",
  "#4a3a68",
  "#6a5591",
  "#8c74d8",
  "#a994dc",
  "#c9b8f0",
  "#d9cdf6",
];

// Mantine's dark greys, tinted plum: text at 0, dimmed at 2, borders at 4, cards at 6, the page at 7.
const plumDark: MantineColorsTuple = [
  "#ece8f6",
  "#cbc3dc",
  "#a89fbc",
  "#7f7594",
  "#4a405f",
  "#3a3150",
  "#2d2541",
  "#1d1729",
  "#130e1d",
  "#0d0914",
];

const SANS =
  '"Inter Variable", Inter, system-ui, -apple-system, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", sans-serif';
const MONO = '"JetBrains Mono Variable", ui-monospace, monospace';

const base: MantineThemeOverride = {
  colors: {
    plumInk,
    plumGlow,
    plum: virtualColor({ name: "plum", light: "plumInk", dark: "plumGlow" }),
    dark: plumDark,
  },
  primaryColor: "plum",
  autoContrast: true,
  fontFamily: SANS,
  fontFamilyMonospace: MONO,
  headings: { fontFamily: SANS, fontWeight: "400" },
  components: {
    Button: Button.extend({ defaultProps: { radius: "xl" } }),
    Badge: Badge.extend({ defaultProps: { radius: "xl" } }),
  },
};

// 4's theme, which every round-2 variation shares.
const soft = createTheme({
  ...base,
  defaultRadius: "xl",
  radius: { xs: "8px", sm: "12px", md: "18px", lg: "26px", xl: "34px" },
  shadows: { sm: "0 18px 50px -24px rgb(42 30 63 / 0.28)" },
  components: {
    ...base.components,
    Card: Card.extend({ defaultProps: { radius: "xl", shadow: "sm" } }),
  },
});

// With the new bones, an application's drawer is a panel docked beside the list: no overlay, and the page
// behind it still scrolls, takes clicks (another row swaps what it shows) and keeps the keyboard.
const docked = createTheme({
  components: {
    Drawer: Drawer.extend({
      defaultProps: { withOverlay: false, lockScroll: false, trapFocus: false, closeOnClickOutside: false },
    }),
  },
});

function themeOf(flags: Flag[]): MantineThemeOverride {
  return flags.includes("bones") ? mergeThemeOverrides(soft, docked) : soft;
}

// The drift's phase is the time into its cycle by the clock, so it carries on across reloads; it's set again
// when the colour scheme changes, since that swaps the animation and starts it afresh.
function syncDrift() {
  const html = document.documentElement;
  const set = () => html.style.setProperty("--drift-delay", `-${Date.now() % DRIFT_CYCLE_MS}ms`);
  set();
  new MutationObserver(set).observe(html, {
    attributes: true,
    attributeFilter: ["data-mantine-color-scheme"],
  });
}

function chosen(): number {
  const valid = (n: number) => CONCEPTS.some((c) => c.n === n);
  const param = new URLSearchParams(window.location.search).get("design");
  if (param !== null && valid(Number(param))) {
    localStorage.setItem(KEY, param);
    return Number(param);
  }
  const saved = Number(localStorage.getItem(KEY) ?? 0);
  return valid(saved) ? saved : 0;
}

function pick(n: number) {
  localStorage.setItem(KEY, String(n));
  const url = new URL(window.location.href);
  url.searchParams.set("design", String(n));
  window.location.assign(url.toString());
}

// The floating switch: plain DOM, outside React and Mantine, so it looks the same in every concept.
function mountSwitch(current: number) {
  if (new URLSearchParams(window.location.search).get("switch") === "0") return;
  const bar = document.createElement("div");
  bar.className = "design-switch";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Design concept (dev only)");
  const label = document.createElement("span");
  label.textContent = "Design";
  bar.append(label);
  for (const c of CONCEPTS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = String(c.n);
    b.title = `${c.n}: ${c.name}`;
    if (c.n === current) b.setAttribute("aria-pressed", "true");
    b.addEventListener("click", () => pick(c.n));
    bar.append(b);
  }
  document.body.append(bar);
}

function trackArea() {
  const set = (path: string) => {
    document.documentElement.dataset.area = path.split("/")[1] || "today";
  };
  set(window.location.pathname);
  router.subscribe("onResolved", ({ toLocation }) => set(toLocation.pathname));
}

/** Applies the chosen concept to the page and returns its theme override (none for today's look). */
export function startDesign(): MantineThemeOverride | undefined {
  const n = chosen();
  mountSwitch(n);
  const flags = CONCEPTS.find((c) => c.n === n)?.flags ?? [];
  if (!flags.length) return undefined;
  const html = document.documentElement;
  html.dataset.design = String(n);
  for (const f of flags) html.setAttribute(`data-${f.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`, "");
  if (flags.includes("drift")) syncDrift();
  trackArea();
  return themeOf(flags);
}
