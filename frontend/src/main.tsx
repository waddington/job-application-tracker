// The app's fonts, bundled with the build and never fetched from the web (docs/rfc/app-redesign.md §9),
// and the design tokens the theme's colours read (theme.ts).
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./tokens.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n"; // the translation layer, before anything renders
import { App } from "./App";
import { startDrift } from "./drift";

// The page's background drifts through its tints, in step with the clock (drift.ts).
startDrift();

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
