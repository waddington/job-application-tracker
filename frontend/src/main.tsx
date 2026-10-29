import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n"; // the translation layer, before anything renders
import { App } from "./App";
import { installShadow } from "./i18n/shadow";

// Shadow mode (docs/rfc/i18n.md §15): where an area still shows hard-coded English behind a
// shadow() call, ?i18n=shadow logs how it compares with the text files.
installShadow();

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
