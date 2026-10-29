import { describe, expect, it } from "vitest";

import en from "../locales/en";
import { baseKey, compare, flatten, placeholders, unusedKeys, usedKeys } from "./catalog";
import { DEFAULT_NS } from ".";

describe("helpers", () => {
  it("flattens nested keys", () => {
    expect(flatten({ a: "1", b: { c: "2", d: { e: "3" } } })).toEqual({ a: "1", "b.c": "2", "b.d.e": "3" });
  });

  it("strips plural suffixes, and only those", () => {
    expect(baseKey("days_one")).toBe("days");
    expect(baseKey("days_few")).toBe("days");
    expect(baseKey("waiting.title")).toBe("waiting.title");
    expect(baseKey("is_done")).toBe("is_done");
  });

  it("finds placeholder names, ignoring formats and spaces", () => {
    expect(placeholders("{{count}} at {{ name }}, {{amount, number}}")).toEqual(
      new Set(["count", "name", "amount"]),
    );
    expect(placeholders("no values")).toEqual(new Set());
  });
});

describe("compare another language with English", () => {
  const english = {
    title: "Waiting on them",
    greeting: "Hello {{name}}",
    days_one: "{{count}} day",
    days_other: "{{count}} days",
    nested: { a: "A" },
  };

  it("is clean when every key and value is there, whatever its plural forms", () => {
    const polish = {
      title: "Czekasz",
      greeting: "Cześć {{name}}",
      days_one: "{{count}} dzień",
      days_few: "{{count}} dni",
      days_many: "{{count}} dni",
      nested: { a: "A" },
    };
    expect(compare(english, polish)).toEqual({ missing: [], extra: [], placeholders: [] });
  });

  it("lists missing and extra keys", () => {
    const result = compare(english, { title: "x", greeting: "{{name}}", days_other: "{{count}}", typo: "y" });
    expect(result.missing).toEqual(["nested.a"]);
    expect(result.extra).toEqual(["typo"]);
  });

  it("flags a dropped or invented placeholder, but allows dropping count", () => {
    const result = compare(english, {
      title: "x",
      greeting: "Cześć", // dropped {{name}}
      days_other: "一天", // no {{count}}: fine
      nested: { a: "{{who}}" }, // invented
    });
    expect(result.placeholders).toEqual([
      { key: "greeting", dropped: ["name"], unknown: [] },
      { key: "nested.a", dropped: [], unknown: ["who"] },
    ]);
  });
});

describe("usedKeys", () => {
  const ns = ["common", "today"];

  it("reads t() and i18nKey in the file's namespace", () => {
    const source = `
      const { t } = useTranslation("today");
      t("waiting.title"); t('waiting.badge', { count }); <Trans i18nKey="waiting.slower" />`;
    expect(usedKeys(source, ns, "common")).toEqual(
      new Set(["today:waiting.title", "today:waiting.badge", "today:waiting.slower"]),
    );
  });

  it("uses the default namespace without useTranslation, and the first of several", () => {
    expect(usedKeys(`t("appName")`, ns, "common")).toEqual(new Set(["common:appName"]));
    expect(usedKeys(`useTranslation(["today", "common"]); t("x")`, ns, "common")).toEqual(
      new Set(["today:x"]),
    );
  });

  it("counts namespaced strings anywhere (typed id-to-key maps, i18n.t outside components)", () => {
    const source = `const LABEL = { a: "today:sources.recruiter" }; i18n.t("common:appName"); "other:x"`;
    expect(usedKeys(source, ns, "common")).toEqual(new Set(["today:sources.recruiter", "common:appName"]));
  });

  it("counts a plural form as its base key, and skips keys built at run time", () => {
    expect(usedKeys("t(`days_one`); t(`stage.${id}`)", ns, "common")).toEqual(new Set(["common:days"]));
  });
});

describe("unusedKeys", () => {
  it("lists English keys no source uses", () => {
    const catalog = { common: { a: "A", b_one: "1", b_other: "n" }, today: { c: "C" } };
    expect(unusedKeys(catalog, [`t("a")`, `t("b", { count })`], "common")).toEqual(["today:c"]);
    expect(unusedKeys(catalog, [`t("a")`], "common", ["today"])).toEqual(["common:b"]);
  });
});

// The real text files. Other languages are JSON next to locales/en (none ship yet).
const others = import.meta.glob<Record<string, string>>("../locales/*/*.json", {
  eager: true,
  import: "default",
});
const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}", "!../locales/**"], {
  eager: true,
  query: "?raw",
  import: "default",
});

describe("the app's text", () => {
  it("has the same keys and placeholders in every language as in English", () => {
    for (const [path, tree] of Object.entries(others)) {
      const ns = path.split("/").pop()!.replace(".json", "") as keyof typeof en;
      expect(en[ns], `${path}: no English namespace "${ns}"`).toBeDefined();
      const result = compare(en[ns], tree);
      // Missing keys fall back to English, so only extra keys and broken placeholders fail.
      expect({ path, extra: result.extra, placeholders: result.placeholders }).toEqual({
        path,
        extra: [],
        placeholders: [],
      });
    }
  });

  it("has no English keys that no code uses", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50); // the scan really read the app
    expect(unusedKeys(en, Object.values(sources), DEFAULT_NS)).toEqual([]);
  });
});
