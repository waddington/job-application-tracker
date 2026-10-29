import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";

// Every component under test reads its text through the app's i18n instance (English).
import "../i18n";
import { afterEach } from "vitest";

afterEach(() => cleanup());

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
