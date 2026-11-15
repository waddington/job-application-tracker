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

import { createElement, StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { router } from "../router";
import { BottomNav } from "./BottomNav";

// Round 1 had four concepts; 4 (Soft cards) was the pick. Rounds 2 and 3 vary it; the concepts that weren't
// kept (1-3, 5, 6, 8) are in PR #354's history. Each flag becomes a data attribute on <html> that concepts.css
// keys on:
//   soft: 4's look; oneBg: one background on every page; wide: full width up to a cap; drift: the slow fade;
//   today3: Today in three columns; wideBoard: the board's columns share the full width; dock: an application
//   opens docked beside the list; subpages: wider layouts for records, notes, documents and interviews;
//   bottomNav: on a phone, a bottom bar instead of the slide-out menu.
type Flag = "soft" | "oneBg" | "wide" | "drift" | "today3" | "wideBoard" | "dock" | "subpages" | "bottomNav";
const PICK: Flag[] = ["soft", "oneBg", "wide", "drift", "today3", "dock", "bottomNav"];
export const CONCEPTS: { n: number; name: string; flags: Flag[] }[] = [
  { n: 0, name: "Today's look", flags: [] },
  { n: 4, name: "Soft cards (round 1's pick)", flags: ["soft"] },
  {
    n: 7,
    name: "Wide bones (round 2)",
    flags: ["soft", "oneBg", "wide", "today3", "wideBoard", "dock"],
  },
  { n: 9, name: "The pick: drift, three-column Today, docked application", flags: PICK },
  { n: 10, name: "9 and a full-width board", flags: [...PICK, "wideBoard"] },
  { n: 11, name: "10 and new sub-page layouts", flags: [...PICK, "wideBoard", "subpages"] },
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

// With dock, every side drawer (the app has one, the application panel) is a panel docked beside the page: no
// overlay, and the page behind it still scrolls, takes clicks (another row swaps what it shows) and keeps the
// keyboard. On a phone (below 768 px when the page loads) drawers stay full-screen overlays.
const onPhone = window.matchMedia("(max-width: 47.99em)").matches;
const docked = createTheme({
  components: {
    Drawer: Drawer.extend({
      defaultProps: onPhone
        ? { size: "100%" }
        : { withOverlay: false, lockScroll: false, trapFocus: false, closeOnClickOutside: false },
    }),
  },
});

function themeOf(flags: Flag[]): MantineThemeOverride {
  return flags.includes("dock") ? mergeThemeOverrides(soft, docked) : soft;
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
    const parts = path.split("/").filter(Boolean);
    document.documentElement.dataset.area = parts[0] ?? "today";
    document.documentElement.dataset.depth = String(parts.length);
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
  if (flags.includes("bottomNav")) {
    const host = document.createElement("div");
    document.body.append(host);
    createRoot(host).render(createElement(StrictMode, null, createElement(BottomNav)));
  }
  trackArea();
  return themeOf(flags);
}
