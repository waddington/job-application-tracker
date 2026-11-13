import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n"; // the translation layer, before anything renders
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");
const rootElement = root;

function render(design?: Parameters<typeof App>[0]["design"]) {
  createRoot(rootElement).render(
    <StrictMode>
      <App design={design} />
    </StrictMode>,
  );
}

// DEV ONLY (app-redesign-concepts): a dev server can show a redesign concept (?design=N). A production
// build replaces import.meta.env.DEV with false, so the concepts module isn't in it at all.
if (import.meta.env.DEV) {
  void import("./design/concepts").then((m) => render(m.startDesign()));
} else {
  render();
}
