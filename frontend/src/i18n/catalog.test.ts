import { describe, expect, it } from "vitest";

import en from "../locales/en";
import {
  baseKey,
  compare,
  flatten,
  placeholders,
  pluralCategories,
  TO_TRANSLATE,
  untranslated,
  unusedKeys,
  usedKeys,
} from "./catalog";
import { DEFAULT_NS } from ".";

describe("helpers", () => {
  it("flattens nested keys", () => {
    expect(flatten({ a: "1", b: { c: "2", d: { e: "3" } } })).toEqual({ a: "1", "b.c": "2", "b.d.e": "3" });
  });

  it("strips plural suffixes, and only those", () => {
    expect(baseKey("days_one")).toBe("days");
    expect(baseKey("days_few")).toBe("days");
    expect(baseKey("place_ordinal_two")).toBe("place");
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
      days_other: "{{count}} dnia", // fractions: 1,5 dnia
      nested: { a: "A" },
    };
    expect(compare(english, polish, "pl")).toEqual({
      missing: [],
      extra: [],
      placeholders: [],
      pluralForms: [],
    });
  });

  it("lists missing and extra keys", () => {
    const result = compare(
      english,
      { title: "x", greeting: "{{name}}", days_other: "{{count}}", typo: "y" },
      "zh",
    );
    expect(result.missing).toEqual(["nested.a"]);
    expect(result.extra).toEqual(["typo"]);
  });

  it("needs every plural form the language uses", () => {
    const missingFew = {
      title: "x",
      greeting: "{{name}}",
      days_one: "1",
      days_many: "n",
      nested: { a: "A" },
    };
    expect(compare(english, missingFew, "pl").pluralForms).toEqual([
      { key: "days", missing: ["few", "other"] },
    ]);
    // Chinese has one form, so days_other alone is complete.
    expect(
      compare(english, { title: "x", greeting: "{{name}}", days_other: "n", nested: { a: "A" } }, "zh")
        .pluralForms,
    ).toEqual([]);
    // English needs one and other.
    expect(
      compare(english, { title: "x", greeting: "{{name}}", days_other: "n", nested: { a: "A" } }, "en")
        .pluralForms,
    ).toEqual([{ key: "days", missing: ["one"] }]);
  });

  it("knows each language's plural forms", () => {
    expect(pluralCategories("en")).toEqual(["one", "other"]);
    expect(pluralCategories("zh")).toEqual(["other"]);
    expect(pluralCategories("pl")).toEqual(expect.arrayContaining(["one", "few", "many", "other"]));
  });

  it("flags a dropped or invented placeholder, but allows dropping count", () => {
    const result = compare(
      english,
      {
        title: "x",
        greeting: "Cześć", // dropped {{name}}
        days_other: "一天", // no {{count}}: fine
        nested: { a: "{{who}}" }, // invented
      },
      "zh",
    );
    expect(result.placeholders).toEqual([
      { key: "greeting", dropped: ["name"], unknown: [] },
      { key: "nested.a", dropped: [], unknown: ["who"] },
    ]);
  });
});

describe("untranslated", () => {
  it("lists the lines still holding the marker, wherever they are", () => {
    const tree = {
      done: "Czekasz",
      left: `${TO_TRANSLATE} Waiting`,
      nested: { left: `Czekasz ${TO_TRANSLATE} on them`, done: "A" },
    };
    expect(untranslated(tree)).toEqual(["left", "nested.left"]);
    expect(untranslated({ done: "Czekasz" })).toEqual([]);
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

  it("uses the default namespace without useTranslation, and every one of a list", () => {
    expect(usedKeys(`t("appName")`, ns, "common")).toEqual(new Set(["common:appName"]));
    expect(usedKeys(`useTranslation(["today", "common"]); t("x")`, ns, "common")).toEqual(
      new Set(["today:x", "common:x"]),
    );
  });

  it("counts namespaced strings anywhere (i18n.t outside components)", () => {
    const source = `i18n.t("today:sources.recruiter"); i18n.t("common:appName"); "other:x"`;
    expect(usedKeys(source, ns, "common")).toEqual(new Set(["today:sources.recruiter", "common:appName"]));
  });

  it("doesn't count keys that only appear in comments", () => {
    const source = `/** e.g. "nav.items.today" */\n// t("nav.items.roles")\nconst x = "nav.items.offers";`;
    expect(usedKeys(source, ns, "common")).toEqual(new Set(["common:nav.items.offers"]));
  });

  it("credits bare dotted strings (typed id-to-key maps) to the file's namespaces", () => {
    expect(usedKeys(`const KEYS = { Today: "nav.items.today", x: "no-dots" }`, ns, "common")).toEqual(
      new Set(["common:nav.items.today"]),
    );
    expect(usedKeys(`useTranslation("today"); const M = { a: "sources.recruiter" }`, ns, "common")).toEqual(
      new Set(["today:sources.recruiter"]),
    );
  });

  it("credits unqualified keys to every namespace the file declares", () => {
    const source = `
      function A() { const { t } = useTranslation("today"); return t("x"); }
      function B() { const { t } = useTranslation("common"); return t("y"); }`;
    expect(usedKeys(source, ns, "common")).toEqual(new Set(["today:x", "common:x", "today:y", "common:y"]));
  });

  it("uses ns= on a <Trans>, before or after its other props, and backtick keys", () => {
    const source = `
      useTranslation("common");
      <Trans ns="today" i18nKey="a" components={{ b: <b /> }} />
      <Trans i18nKey={\`c\`} components={{ b: <b /> }} ns="today" />
      <Trans i18nKey="d" />`;
    expect(usedKeys(source, ns, "common")).toEqual(new Set(["today:a", "today:c", "common:d"]));
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
  // Passes trivially until a second language ships JSON files (multi-language). Then a missing
  // key, namespace or plural form fails the build, rather than quietly showing English.
  it("has every key, namespace and plural form in every language, and nothing English lacks", () => {
    const byLanguage = new Map<string, Map<string, Record<string, string>>>();
    for (const [path, tree] of Object.entries(others)) {
      const [lang, file] = path.split("/").slice(-2) as [string, string];
      byLanguage.set(lang, (byLanguage.get(lang) ?? new Map()).set(file.replace(".json", ""), tree));
    }
    for (const [lang, files] of byLanguage) {
      expect({ lang, namespaces: [...files.keys()].sort() }).toEqual({
        lang,
        namespaces: Object.keys(en)
          .filter((n) => n !== "selftest")
          .sort(),
      });
      for (const [ns, tree] of files) {
        expect(en[ns as keyof typeof en], `${lang}/${ns}.json: no English namespace "${ns}"`).toBeDefined();
        const result = compare(en[ns as keyof typeof en], tree, lang);
        expect({ file: `${lang}/${ns}.json`, ...result }).toEqual({
          file: `${lang}/${ns}.json`,
          missing: [],
          extra: [],
          placeholders: [],
          pluralForms: [],
        });
      }
    }
  });

  // Only this test fails: a half-done language still shows in `pnpm dev`, so you can try it as you go.
  it("has no line still waiting to be translated", () => {
    const left = Object.entries(others).flatMap(([path, tree]) => {
      const file = path.split("/").slice(-2).join("/");
      return untranslated(tree).map((key) => `${file}: ${key}`);
    });
    expect(
      left,
      `Still to translate: ${left.length}. Translate each line below and delete its ${TO_TRANSLATE} (search for it in frontend/src/locales/)`,
    ).toEqual([]);
  });

  it("has no English keys that no code uses", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50); // the scan really read the app
    // An error's text is looked up by the code the API sends, and the type check ties those to ErrorCode.
    const unused = unusedKeys(en, Object.values(sources), DEFAULT_NS);
    expect(unused.filter((key) => !key.startsWith("errors:codes."))).toEqual([]);
  });
});
