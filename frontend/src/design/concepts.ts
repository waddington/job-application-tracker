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
  virtualColor,
  type MantineColorsTuple,
  type MantineThemeOverride,
} from "@mantine/core";

import { router } from "../router";

export const CONCEPTS = [
  { n: 0, name: "Today's look" },
  { n: 1, name: "Faithful" },
  { n: 2, name: "Glass shell" },
  { n: 3, name: "Calm workspace" },
  { n: 4, name: "Soft cards" },
] as const;

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

const OVERRIDES: Record<number, MantineThemeOverride> = {
  1: createTheme({
    ...base,
    defaultRadius: "lg",
    radius: { xs: "6px", sm: "10px", md: "14px", lg: "22px", xl: "34px" },
    shadows: {
      sm: "0 8px 24px -14px rgb(42 30 63 / 0.22)",
      md: "0 14px 40px -18px rgb(42 30 63 / 0.3)",
    },
    components: {
      ...base.components,
      Card: Card.extend({ defaultProps: { radius: "lg", shadow: "sm" } }),
    },
  }),
  2: createTheme({
    ...base,
    defaultRadius: "lg",
    radius: { xs: "6px", sm: "10px", md: "16px", lg: "24px", xl: "32px" },
    shadows: { sm: "0 12px 34px -18px rgb(42 30 63 / 0.28)" },
    components: {
      ...base.components,
      Card: Card.extend({ defaultProps: { radius: "lg", shadow: "sm" } }),
    },
  }),
  3: createTheme({
    ...base,
    defaultRadius: "md",
    radius: { xs: "4px", sm: "6px", md: "10px", lg: "14px", xl: "20px" },
    spacing: { xs: "8px", sm: "10px", md: "14px", lg: "18px", xl: "24px" },
    fontSizes: { xs: "11.5px", sm: "13px", md: "14.5px", lg: "16px", xl: "18px" },
    headings: { fontFamily: SANS, fontWeight: "500" },
    components: {
      ...base.components,
      Button: Button.extend({ defaultProps: { radius: "md" } }),
      Card: Card.extend({ defaultProps: { radius: "md" } }),
    },
  }),
  4: createTheme({
    ...base,
    defaultRadius: "xl",
    radius: { xs: "8px", sm: "12px", md: "18px", lg: "26px", xl: "34px" },
    shadows: { sm: "0 18px 50px -24px rgb(42 30 63 / 0.28)" },
    components: {
      ...base.components,
      Card: Card.extend({ defaultProps: { radius: "xl", shadow: "sm" } }),
    },
  }),
};

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
  if (n === 0) return undefined;
  document.documentElement.dataset.design = String(n);
  trackArea();
  return OVERRIDES[n];
}
