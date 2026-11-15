import { afterEach, expect, test, vi } from "vitest";

import { DRIFT_CYCLE_MS, DRIFT_STEP_MS, DRIFT_TINTS, driftTint, startDrift } from "./drift";

const light = DRIFT_TINTS.light;
const fifth = DRIFT_CYCLE_MS / 5;

afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute("style");
});

test("five tints in each scheme, lilac and plum night first", () => {
  expect(DRIFT_TINTS.light).toEqual(["#f4f1fb", "#fcf8ea", "#eff8f2", "#eef3fb", "#fcf3ea"]);
  expect(DRIFT_TINTS.dark).toEqual(["#17121f", "#1b1712", "#111a16", "#111722", "#1c1510"]);
});

test("the phase is the clock's: each tint a fifth of ten minutes apart, blended between, round again", () => {
  expect(driftTint(light, 0)).toBe("#f4f1fb");
  expect(driftTint(light, fifth)).toBe("#fcf8ea");
  expect(driftTint(light, 4 * fifth)).toBe("#fcf3ea");
  expect(driftTint(light, DRIFT_CYCLE_MS)).toBe("#f4f1fb");
  // Halfway from lilac (f4 f1 fb) to butter (fc f8 ea).
  expect(driftTint(light, fifth / 2)).toBe("#f8f5f3");
  // Halfway from apricot back to lilac.
  expect(driftTint(light, 4.5 * fifth)).toBe("#f8f2f3");
  // The same moment on another day is the same tint: a reload carries on where it was.
  expect(driftTint(light, 1234 + 50 * DRIFT_CYCLE_MS)).toBe(driftTint(light, 1234));
});

test("a step moves less than one shade of colour", () => {
  for (let t = 0; t < DRIFT_CYCLE_MS; t += DRIFT_STEP_MS) {
    for (const tints of [DRIFT_TINTS.light, DRIFT_TINTS.dark]) {
      const [a, b] = [driftTint(tints, t), driftTint(tints, t + DRIFT_STEP_MS)];
      for (const i of [1, 3, 5]) {
        expect(
          Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)),
        ).toBeLessThanOrEqual(1);
      }
    }
  }
});

test("starts from the clock and steps every six seconds, until stopped", () => {
  vi.useFakeTimers();
  vi.setSystemTime(fifth);
  const root = document.documentElement;
  const stop = startDrift(root);
  expect(root.style.getPropertyValue("--jat-drift-light")).toBe("#fcf8ea");
  expect(root.style.getPropertyValue("--jat-drift-dark")).toBe("#1b1712");
  vi.advanceTimersByTime(fifth);
  expect(root.style.getPropertyValue("--jat-drift-light")).toBe("#eff8f2");
  stop();
  vi.advanceTimersByTime(fifth);
  expect(root.style.getPropertyValue("--jat-drift-light")).toBe("#eff8f2");
});

test("stays still under reduced motion (the stylesheet's still tint shows)", () => {
  const matchMedia = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    ...matchMedia(query),
    matches: query === "(prefers-reduced-motion: reduce)",
  })) as typeof window.matchMedia;
  try {
    const root = document.documentElement;
    const stop = startDrift(root);
    expect(root.style.getPropertyValue("--jat-drift-light")).toBe("");
    expect(root.style.getPropertyValue("--jat-drift-dark")).toBe("");
    stop();
  } finally {
    window.matchMedia = matchMedia;
  }
});
