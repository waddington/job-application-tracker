import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./i18n"; // the translation layer, before anything renders
import { App } from "./App";

const root = document.getElementById("root");
if (!root) throw new Error("#root element missing from index.html");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
