// The dark-mode and contrast pass (docs/rfc/app-redesign.md §8): 4.5:1 for text, 3:1 for a mark or edge that's the
// only cue. These read the tokens, so they're quick; e2e/contrast.spec.ts checks what only computed styles show.
import { DEFAULT_THEME, defaultVariantColorsResolver, mergeMantineTheme } from "@mantine/core";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";
import { CATEGORIES } from "./api/timelineHooks";
import { DRIFT_TINTS } from "./drift";
import { chartColor, cssVariablesResolver, theme, variantColorResolver } from "./theme";

type RGB = number[];
const schemes = ["light", "dark"] as const;
type Scheme = (typeof schemes)[number];

const read = (...path: string[]) =>
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), ...path), "utf8");
const full = mergeMantineTheme(DEFAULT_THEME, theme);
const variables = cssVariablesResolver(full) as Record<Scheme, Record<string, string>>;
const declared = (css: string) =>
  new Map([...css.matchAll(/(--jat-[\w-]+): ([^;]+);/g)].map((m) => [m[1]!, m[2]!]));
const [root, night] = read("tokens.css").split(":root[data-mantine-color-scheme").map(declared) as [
  Map<string, string>,
  Map<string, string>,
];

/** A colour as the stylesheet writes it, followed through the tokens and laid over what's behind it. */
function colour(value: string, scheme: Scheme, behind: RGB = [255, 255, 255]): RGB {
  const name = /^var\((--[\w-]+)(?:, (.+))?\)$/.exec(value);
  if (name) {
    const [, v, fallback] = name as unknown as [string, string, string?];
    const shade = /^--mantine-color-([a-z]+)-(\d)$/.exec(v);
    const found =
      variables[scheme][v] ??
      (scheme === "dark" ? night.get(v) : undefined) ??
      root.get(v) ??
      (shade ? full.colors[shade[1]!]?.[Number(shade[2])] : undefined) ??
      fallback;
    if (!found) throw new Error(`${v} has no ${scheme} value`);
    return colour(found, scheme, behind);
  }
  if (value.startsWith("#")) {
    const hex = value.length === 4 ? value.replace(/\w/g, "$&$&") : value;
    return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  }
  const [r, g, b, a = 1] = value.match(/[\d.]+/g)!.map(Number);
  return mix([r!, g!, b!], a, behind);
}
const mix = (top: RGB, alpha: number, under: RGB) => top.map((c, i) => c * alpha + under[i]! * (1 - alpha));
const linear = (rgb: RGB) =>
  rgb.map((c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
const contrast = (a: RGB, b: RGB) => {
  const y = [a, b].map((c) => linear(c).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i]!, 0));
  return (Math.max(...y) + 0.05) / (Math.min(...y) + 0.05);
};
const of = (token: string, scheme: Scheme, behind?: RGB) => colour(`var(--jat-${token})`, scheme, behind);

const grey = (step: number) => colour(`var(--mantine-color-gray-${step})`, "light");
const plum = (step: number) => colour(full.colors.dark[step]!, "dark");
const card = { light: [255, 255, 255], dark: plum(6) };
const tints = (scheme: Scheme) => DRIFT_TINTS[scheme].map((t) => colour(t, scheme));
// The disc behind the calendar's chosen day.
const disc = (scheme: Scheme) => of("p-plum", scheme, card[scheme]);

test.each(schemes)("%s: placeholders and field errors read at 4.5:1 in their box", (scheme) => {
  expect(contrast(of("placeholder", scheme, card[scheme]), card[scheme])).toBeGreaterThanOrEqual(4.5);
  expect(variables[scheme]["--mantine-color-error"]).toBe("var(--mantine-color-red-text)");
});

test("a grey filled button's white reads at 4.5:1", () => {
  expect(
    contrast(colour("var(--mantine-color-gray-filled)", "light"), [255, 255, 255]),
  ).toBeGreaterThanOrEqual(4.5);
});

test("dark: dimmed text reads at 4.5:1 on every wash an alert has", () => {
  const rule = /\.alert \{\s*--mantine-color-dimmed: var\(--mantine-color-dark-(\d)\);/.exec(
    read("theme.module.css"),
  );
  const dimmed = plum(Number(rule?.[1] ?? 2));
  for (const behind of [card.dark, plum(7), ...tints("dark")]) {
    for (const name of ["blue", "green", "yellow", "red", "orange", "teal"]) {
      const wash = mix(colour(`var(--mantine-color-${name}-5)`, "dark"), 0.24, behind);
      expect(contrast(dimmed, wash), name).toBeGreaterThanOrEqual(4.5);
    }
  }
});

test("Today's faint buttons read at 4.5:1 at rest, and stay quieter than pointed at", () => {
  const css = read("pages", "TodayPage.module.css");
  const faint = [...css.matchAll(/--today-faint: ([\d.]+);/g)].map((m) => Number(m[1]));
  expect(faint).toHaveLength(2);
  schemes.forEach((scheme, i) => {
    const tile = scheme === "light" ? grey(1) : mix(plum(5), 0.5, plum(6));
    // Each kind of button a row has: its wash (none for a subtle grey one) and its text.
    const kinds = ["plum", "teal", "orange", "blue", "gray"].map((name): [RGB, RGB] => {
      const ink = colour(`var(--mantine-color-${name}-light-color)`, scheme);
      if (name === "gray") return [tile, ink];
      if (scheme === "light" || name === "plum") return [of(`p-${name}`, scheme, tile), ink];
      return [mix(colour(`var(--mantine-color-${name}-5)`, scheme), 0.24, tile), ink];
    });
    const quietest = (o: number) =>
      Math.min(...kinds.map(([wash, ink]) => contrast(mix(ink, o, tile), mix(wash, o, tile))));
    expect(quietest(faint[i]!), scheme).toBeGreaterThanOrEqual(4.5);
    expect(quietest(faint[i]!), scheme).toBeLessThan(quietest(1) * 0.75);
  });
});

test.each(schemes)("%s: marks that are the only cue show at 3:1", (scheme) => {
  const star =
    scheme === "light" ? [card.light, grey(1), grey(2), of("row-hover", scheme)] : [card.dark, plum(5)];
  for (const behind of star) expect(contrast(of("star", scheme), behind), "star").toBeGreaterThanOrEqual(3);
  for (const behind of [card[scheme], ...tints(scheme)]) {
    for (const state of ["teal", "yellow"]) {
      expect(contrast(of(`status-${state}`, scheme), behind), state).toBeGreaterThanOrEqual(3);
    }
  }
  // The CV bar: its range on the track.
  const track = scheme === "light" ? of("ink-faint", scheme, card[scheme]) : plum(4);
  expect(contrast(of("range", scheme), track), "range").toBeGreaterThanOrEqual(3);
  // A picked segment's ring, on the control's trough.
  const trough = scheme === "light" ? grey(1) : plum(8);
  expect(contrast(of("input-border", scheme), trough), "segment").toBeGreaterThanOrEqual(3);
  for (const { color } of CATEGORIES) {
    const dot = colour(`var(--jat-dot-${color}, var(--mantine-color-${color}-6))`, scheme);
    expect(contrast(dot, card[scheme]), `Timeline ${color}`).toBeGreaterThanOrEqual(3);
  }
});

test.each(schemes)("%s: the calendar's dots show at 3:1 and their numbers read at 4.5:1", (scheme) => {
  for (const tone of ["orange", "blue", "teal", "gray"]) {
    const dot = of(`day-${tone}`, scheme);
    expect(contrast(dot, card[scheme]), tone).toBeGreaterThanOrEqual(3);
    expect(contrast(dot, disc(scheme)), `${tone}, chosen`).toBeGreaterThanOrEqual(3);
    expect(contrast(of("day-ink", scheme), dot), `${tone}'s number`).toBeGreaterThanOrEqual(4.5);
  }
});

// Colour distance as the dataviz validator measures it: OKLab ×100, colour blindness after Machado et al. (2009).
const SIGHT = {
  normal: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  protan: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998],
  deutan: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881],
  tritan: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039],
};
function oklab(rgb: RGB, m: number[]) {
  const c = linear(rgb);
  const [r, g, b] = [0, 3, 6].map((i) =>
    Math.min(1, Math.max(0, m[i]! * c[0]! + m[i + 1]! * c[1]! + m[i + 2]! * c[2]!)),
  ) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const n = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * n - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * n + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * n - 0.808675766 * s,
  ];
}

test.each([
  // The closest pair each kind of sight may have, and how uneven the six may be beside each other.
  ["light", { normal: 19.4, protan: 9.7, deutan: 11, tritan: 8 }, 3],
  ["dark", { normal: 18.1, protan: 10.1, deutan: 9.6, tritan: 9 }, 2],
] as const)("%s: Weekly activity's six stand out evenly, every pair apart", (scheme, floor, spread) => {
  const six = ["added", "applied", "moves", "interviews", "calls", "pitched"].map((s) =>
    of(`weekly-${s}`, scheme),
  );
  const strength = six.map((c) => contrast(c, card[scheme]));
  expect(Math.min(...strength)).toBeGreaterThanOrEqual(3);
  expect(Math.max(...strength) / Math.min(...strength)).toBeLessThan(spread);
  for (const [sight, m] of Object.entries(SIGHT)) {
    const seen = six.map((c) => oklab(c, m));
    const gaps = seen.flatMap((a, i) =>
      seen.slice(i + 1).map((b) => 100 * Math.hypot(...a.map((v, k) => v - b[k]!))),
    );
    expect(Math.min(...gaps), sight).toBeGreaterThanOrEqual(floor[sight as keyof typeof floor]);
  }
});

test("a stage colour of your own is never swapped on its badge; a chart, which can't draw it, uses grey", () => {
  for (const color of ["purple", "#800080", "grape.7", "blue.3"]) {
    for (const variant of ["light", "outline"]) {
      expect(variantColorResolver({ color, variant, theme: full }), `${variant} ${color}`).toEqual(
        defaultVariantColorsResolver({ color, variant, theme: full }),
      );
    }
  }
  for (const color of ["#800080", "grape.7"]) expect(chartColor(color)).toBe("var(--jat-chart-gray)");
});
