import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { i18n } from ".";
import { PSEUDO } from "./language";
import {
  FLAG,
  installShadow,
  report,
  resetShadow,
  setShadow,
  setShadowThrows,
  shadow,
  shadowOn,
  shadowTrans,
  shadowValue,
  ShadowMismatchError,
} from "./shadow";

// These tests use the selftest namespace (locales/en/selftest.ts), whose keys only exist for
// self-tests like these.
let debug: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  resetShadow();
  setShadowThrows(false);
  debug = vi.spyOn(console, "debug").mockImplementation(() => {});
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(async () => {
  vi.restoreAllMocks();
  window.localStorage.clear();
  resetShadow();
  await i18n.changeLanguage("en");
});

const row = (key: string) => report().find((r) => r.key === key);

describe("shadow", () => {
  it("always returns the English the page shows", () => {
    expect(shadow("selftest:plain", "Hello")).toBe("Hello");
    expect(shadow("selftest:plain", "Not what the file says")).toBe("Not what the file says");
  });

  it("records a match, with values and plurals", () => {
    shadow("selftest:greeting", "Hello Alex", { name: "Alex" });
    shadow("selftest:days", "1 day", { count: 1 });
    shadow("selftest:days", "3 days", { count: 3 });
    expect(row("selftest:greeting")).toMatchObject({ status: "match", translation: "Hello Alex", checks: 1 });
    expect(row("selftest:days")).toMatchObject({ status: "match", checks: 2 });
    expect(debug).toHaveBeenCalledWith("[i18n shadow] ✓ selftest:greeting", {});
  });

  it("records a mismatch with both texts, and logs it once", () => {
    shadow("selftest:days", "3 day", { count: 3 });
    shadow("selftest:days", "3 day", { count: 3 });
    expect(row("selftest:days")).toMatchObject({
      status: "mismatch",
      english: "3 day",
      translation: "3 days",
    });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith("[i18n shadow] ✗ selftest:days", {
      english: "3 day",
      translation: "3 days",
    });
  });

  it("keeps a mismatch even when the key matches later", () => {
    shadow("selftest:days", "3 day", { count: 3 });
    shadow("selftest:days", "1 day", { count: 1 });
    expect(row("selftest:days")?.status).toBe("mismatch");
  });

  it("records a missing key", () => {
    shadow("selftest:nope" as never, "Hello");
    expect(row("selftest:nope")?.status).toBe("missing");
    expect(warn).toHaveBeenCalledWith("[i18n shadow] ? selftest:nope: no text for this key");
  });

  it("records a lookup that fails: a placeholder with no value", () => {
    shadow("selftest:greeting", "Hello Alex");
    expect(row("selftest:greeting")).toMatchObject({ status: "error", translation: "No value for {{name}}" });
  });

  it("throws under test on anything but a match (the default), so test runs check shadowed text", () => {
    setShadowThrows(true);
    expect(() => shadow("selftest:plain", "Hullo")).toThrow(ShadowMismatchError);
    expect(() => shadow("selftest:plain", "Hullo")).toThrow(
      'i18n shadow mismatch for selftest:plain: page says "Hullo", text file gives "Hello"',
    );
    expect(() => shadow("selftest:plain", "Hello")).not.toThrow();
  });

  it("logs what the current language shows when it isn't English", async () => {
    await i18n.changeLanguage(PSEUDO);
    shadow("selftest:plain", "Hello");
    expect(row("selftest:plain")).toMatchObject({
      status: "match",
      translation: "Hello",
      shown: "[Ĥéļļö ··]",
    });
  });
});

describe("shadowTrans and shadowValue", () => {
  it("compares a sentence's text without its tags", () => {
    shadowTrans("selftest:linked", "Read the guide first");
    expect(row("selftest:linked")?.status).toBe("match");
    shadowTrans("selftest:linked", "Read the guide");
    expect(row("selftest:linked")?.status).toBe("mismatch");
  });

  it("compares a value worked out another way, and returns the English", () => {
    expect(shadowValue("format:x", "5 Mar", () => "5 Mar")).toBe("5 Mar");
    expect(row("format:x")?.status).toBe("match");
    shadowValue("format:y", "5 Mar", (lng) => `Mar 5 (${lng})`);
    expect(row("format:y")).toMatchObject({ status: "mismatch", translation: "Mar 5 (en)" });
  });
});

describe("report", () => {
  it("lists the worst first", () => {
    shadow("selftest:plain", "Hello");
    shadow("selftest:nope" as never, "x");
    shadow("selftest:nested.deeper", "Wrong");
    expect(report().map((r) => r.status)).toEqual(["missing", "mismatch", "match"]);
  });
});

describe("switching it on and off", () => {
  it("is on under test", () => {
    expect(shadowOn()).toBe(true);
  });

  it("checks nothing when off, and still returns the English", () => {
    setShadow(false);
    expect(shadow("selftest:plain", "Hullo")).toBe("Hullo");
    expect(report()).toEqual([]);
  });

  it("?i18n=shadow turns it on and remembers it; ?i18n=off forgets it", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    installShadow("?i18n=shadow");
    expect(window.localStorage.getItem(FLAG)).toBe("1");
    installShadow("?i18n=off");
    expect(window.localStorage.getItem(FLAG)).toBeNull();
    expect(shadowOn()).toBe(false);
  });

  it("puts report, on and off on window.jatI18n", () => {
    const table = vi.spyOn(console, "table").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
    installShadow("");
    const api = (
      window as unknown as { jatI18n: { report: () => unknown[]; on: () => void; off: () => void } }
    ).jatI18n;
    shadow("selftest:plain", "Hello");
    expect(api.report()).toHaveLength(1);
    expect(table).toHaveBeenCalled();
    api.off();
    expect(shadowOn()).toBe(false);
    api.on();
    expect(shadowOn()).toBe(true);
  });
});
