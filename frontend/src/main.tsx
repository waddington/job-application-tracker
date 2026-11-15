// The app's fonts, bundled with the build and never fetched from the web (docs/rfc/app-redesign.md §9),
// and the design tokens the theme's colours read (theme.ts).
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./tokens.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n"; // the translation layer, before anything renders
import { App } from "./App";

// The page's background drifts through its tints over ten minutes (components/Layout.module.css), in
// phase with the clock: starting it this far into its cycle means a reload or a new tab carries on
// where it was, rather than starting again from lilac.
const DRIFT_CYCLE_MS = 600_000;
document.documentElement.style.setProperty("--jat-drift-delay", `-${Date.now() % DRIFT_CYCLE_MS}ms`);

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
