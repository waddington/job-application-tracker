import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import { installShadow } from "./i18n/shadow";

// The translation layer runs in shadow mode for now (docs/rfc/i18n.md §15): pages still show
// their own English, and ?i18n=shadow logs how it compares with the text files.
installShadow();

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
