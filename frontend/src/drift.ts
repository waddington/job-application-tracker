/**
 * The page's background drift (docs/rfc/app-redesign.md §2, Frame): one background on every page, fading very
 * slowly through five calm tints over ten minutes. components/Layout.module.css paints it behind the page, the
 * header and the menu.
 *
 * Its phase comes from the clock, so changing pages or reloading never restarts it. It moves in steps, every
 * six seconds, each less than one shade of colour, rather than as a CSS animation: Chrome restyles an animated
 * page every frame even when the animation is stepped (about 60 times a second, all day, for a tracker that's
 * left open), where a step costs one restyle every six seconds (§9, Performance). Still under reduced motion (§8).
 */

export const DRIFT_CYCLE_MS = 600_000;
export const DRIFT_STEP_MS = 6_000;

/** Lilac, butter, mint, sky and apricot; and their plum-night twins. The first is the still one. */
export const DRIFT_TINTS = {
  light: ["#f4f1fb", "#fcf8ea", "#eff8f2", "#eef3fb", "#fcf3ea"],
  dark: ["#17121f", "#1b1712", "#111a16", "#111722", "#1c1510"],
} as const;

const channels = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/** The tint at a moment: the cycle's tints evenly spaced, blended in between, back to the first at the end. */
export function driftTint(tints: readonly string[], now: number): string {
  const at = ((now % DRIFT_CYCLE_MS) / DRIFT_CYCLE_MS) * tints.length;
  const i = Math.floor(at);
  const [from, to] = [channels(tints[i]!), channels(tints[(i + 1) % tints.length]!)];
  const mix = at - i;
  return (
    "#" +
    from
      .map((c, k) =>
        Math.round(c + (to[k]! - c) * mix)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

/** Starts the drift on the page (main.tsx); returns a function that stops it. */
export function startDrift(root: HTMLElement = document.documentElement): () => void {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)");
  const set = () => {
    // Under reduced motion the stylesheet's still tints show (the properties' fallbacks).
    for (const scheme of ["light", "dark"] as const) {
      const name = `--jat-drift-${scheme}`;
      if (still.matches) root.style.removeProperty(name);
      else root.style.setProperty(name, driftTint(DRIFT_TINTS[scheme], Date.now()));
    }
  };
  // A hidden tab's timers slow to once a minute (or stop while the machine sleeps): catch up the moment
  // it's shown again, rather than showing an old tint until the next step.
  const shown = () => {
    if (document.visibilityState === "visible") set();
  };
  set();
  const timer = window.setInterval(set, DRIFT_STEP_MS);
  still.addEventListener("change", set);
  document.addEventListener("visibilitychange", shown);
  return () => {
    window.clearInterval(timer);
    still.removeEventListener("change", set);
    document.removeEventListener("visibilitychange", shown);
  };
}
