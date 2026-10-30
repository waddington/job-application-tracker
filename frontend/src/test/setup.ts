import "@testing-library/jest-dom/vitest";

import { cleanup, configure } from "@testing-library/react";

// Every component under test reads its text through the app's i18n instance (English).
import "../i18n";
import { afterEach } from "vitest";

afterEach(() => cleanup());

// findBy… and waitFor give up after a second by default: too tight when every file runs at once
// on a busy machine, and a different test failed each time.
configure({ asyncUtilTimeout: 5000 });

// jsdom lacks these browser APIs, which Mantine uses.
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = window.ResizeObserver ?? ResizeObserverStub;
if (!("fonts" in document)) {
  Object.defineProperty(document, "fonts", {
    value: { addEventListener: () => {}, removeEventListener: () => {}, ready: Promise.resolve() },
  });
}
window.scrollTo = () => {};

// jsdom has no scrollIntoView; Mantine's Combobox scrolls the selected option into view.
Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
