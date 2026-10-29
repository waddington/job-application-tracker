import { render, screen } from "@testing-library/react";
import { I18nextProvider, Trans, useTranslation } from "react-i18next";
import { describe, expect, it } from "vitest";

import { createI18n, i18n, MissingValueError } from ".";
import { pickLanguage, PSEUDO } from "./language";
import { pseudo, pseudoTree } from "./pseudo";

// Test-only text in three languages with different plural rules: English (one / other), Polish
// (one / few / many) and Chinese (other only). The markers in brackets show which form was
// picked.
const FIXTURE = {
  en: {
    fx: {
      plain: "Hello",
      nested: { deeper: "Nested text" },
      greeting: "Hello {{name}}",
      days_one: "{{count}} day",
      days_other: "{{count}} days",
      onlyEnglish: "Only in English",
      linked: "Read <guide>the guide</guide> first",
    },
  },
  pl: {
    fx: {
      plain: "Cześć",
      greeting: "Cześć {{name}}",
      days_one: "{{count}} dzień (one)",
      days_few: "{{count}} dni (few)",
      days_many: "{{count}} dni (many)",
      days_other: "{{count}} dnia (other)",
    },
  },
  zh: { fx: { plain: "你好", days_other: "{{count}} 天" } },
};

// The fixture's keys aren't in the app's typed English, so call t() untyped here.
type LooseT = (key: string, options?: Record<string, unknown>) => string;
const make = (lng: string, strict = true) => {
  const instance = createI18n({ lng, resources: FIXTURE, strict });
  return { instance, t: instance.t as unknown as LooseT };
};

describe("lookups", () => {
  const { t } = make("en");

  it("finds plain and nested keys", () => {
    expect(t("fx:plain")).toBe("Hello");
    expect(t("fx:nested.deeper")).toBe("Nested text");
  });

  it("fills in placeholders", () => {
    expect(t("fx:greeting", { name: "Alex Morgan" })).toBe("Hello Alex Morgan");
  });

  it("doesn't HTML-escape values (React escapes what it renders)", () => {
    expect(t("fx:greeting", { name: "Riley & <Sam>" })).toBe("Hello Riley & <Sam>");
  });
});

describe("plurals follow each language's rules", () => {
  it("English: one for 1, other for 0 and 2", () => {
    const { t } = make("en");
    expect(t("fx:days", { count: 0 })).toBe("0 days");
    expect(t("fx:days", { count: 1 })).toBe("1 day");
    expect(t("fx:days", { count: 2 })).toBe("2 days");
  });

  it("Polish: one, few (2–4, 22–24) and many (5–21, 0)", () => {
    const { t } = make("pl");
    expect(t("fx:days", { count: 1 })).toBe("1 dzień (one)");
    expect(t("fx:days", { count: 2 })).toBe("2 dni (few)");
    expect(t("fx:days", { count: 4 })).toBe("4 dni (few)");
    expect(t("fx:days", { count: 5 })).toBe("5 dni (many)");
    expect(t("fx:days", { count: 12 })).toBe("12 dni (many)");
    expect(t("fx:days", { count: 22 })).toBe("22 dni (few)");
    expect(t("fx:days", { count: 0 })).toBe("0 dni (many)");
  });

  it("Chinese: one form for every count", () => {
    const { t } = make("zh");
    expect(t("fx:days", { count: 1 })).toBe("1 天");
    expect(t("fx:days", { count: 5 })).toBe("5 天");
  });
});

describe("fallback", () => {
  it("shows English for a key the language doesn't have", () => {
    const { t } = make("pl");
    expect(t("fx:plain")).toBe("Cześć");
    expect(t("fx:onlyEnglish")).toBe("Only in English");
  });

  it("uses English for a language the app doesn't have", () => {
    expect(make("fr").t("fx:plain")).toBe("Hello");
  });

  it("uses English plural forms when the language lacks the key", () => {
    // zh has no greeting: English's text, with the value filled in.
    expect(make("zh").t("fx:greeting", { name: "Jordan" })).toBe("Hello Jordan");
  });
});

describe("a placeholder with no value", () => {
  it("throws when strict (tests and dev)", () => {
    const { t } = make("en", true);
    expect(() => t("fx:greeting")).toThrow(MissingValueError);
    expect(() => t("fx:greeting")).toThrow('No value for {{name}} in "Hello {{name}}"');
  });

  it("doesn't throw in a production build", () => {
    const { t } = make("en", false);
    expect(() => t("fx:greeting")).not.toThrow();
  });

  it("is strict in the app's own instance under test", () => {
    expect(() => (i18n.t as unknown as LooseT)("selftest:greeting")).toThrow(MissingValueError);
  });
});

describe("in React", () => {
  function Greeting({ name }: { name: string }) {
    const { t } = useTranslation("fx" as never); // a fixture namespace, not one of the app's
    return <p>{(t as unknown as LooseT)("greeting", { name })}</p>;
  }

  it("useTranslation reads the namespace's keys", () => {
    const { instance } = make("pl");
    render(
      <I18nextProvider i18n={instance}>
        <Greeting name="Sam" />
      </I18nextProvider>,
    );
    expect(screen.getByText("Cześć Sam")).toBeInTheDocument();
  });

  it("Trans puts markup inside a translated sentence", () => {
    const { instance } = make("en");
    render(
      <I18nextProvider i18n={instance}>
        <p data-testid="p">
          <Trans i18n={instance} i18nKey={"fx:linked" as never} components={{ guide: <a href="/guide" /> }} />
        </p>
      </I18nextProvider>,
    );
    expect(screen.getByTestId("p")).toHaveTextContent("Read the guide first");
    expect(screen.getByRole("link", { name: "the guide" })).toHaveAttribute("href", "/guide");
  });

  it("renders values as text, never as HTML", () => {
    const { instance } = make("en");
    const { container } = render(
      <I18nextProvider i18n={instance}>
        <Greeting name="<b>bold</b>" />
      </I18nextProvider>,
    );
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getByText("Hello <b>bold</b>")).toBeInTheDocument();
  });
});

describe("the app's English", () => {
  it("is loaded and type-checked (selftest namespace)", () => {
    expect(i18n.language).toBe("en");
    expect(i18n.t("selftest:plain")).toBe("Hello");
    expect(i18n.t("selftest:nested.deeper")).toBe("Nested text");
    expect(i18n.t("selftest:greeting", { name: "Alex" })).toBe("Hello Alex");
    expect(i18n.t("selftest:days", { count: 1 })).toBe("1 day");
    expect(i18n.t("selftest:days", { count: 3 })).toBe("3 days");
  });
});

describe("pseudo-language", () => {
  it("accents letters, pads about 35% and brackets the text", () => {
    expect(pseudo("Hello")).toBe("[Ĥéļļö ··]");
    expect(pseudo("")).toBe("[]");
  });

  it("keeps placeholders, tags and nesting exactly", () => {
    const out = pseudo("Hi {{name}}, read <guide>the guide</guide> and $t(other.key)");
    expect(out).toContain("{{name}}");
    expect(out).toContain("<guide>");
    expect(out).toContain("</guide>");
    expect(out).toContain("$t(other.key)");
    expect(out).toContain("ţĥé ĝûîðé"); // the text between tags is still accented
  });

  it("maps a whole tree", () => {
    expect(pseudoTree({ a: "Hi", b: { c: "Bye" } })).toEqual({ a: "[Ĥî ·]", b: { c: "[Ɓýé ··]" } });
  });

  it("works as a language, still filling in values and plurals", () => {
    const { t } = make(PSEUDO);
    expect(t("fx:greeting", { name: "Alex" })).toBe("[Ĥéļļö Alex ··]");
    expect(t("fx:days", { count: 2 })).toBe("[2 ðàýš ··]");
    expect(t("fx:days", { count: 1 })).toBe("[1 ðàý ··]");
  });
});

describe("pickLanguage", () => {
  it("prefers the saved choice, then the browser, then English", () => {
    expect(pickLanguage({ stored: "en", browser: ["fr-FR"] })).toBe("en");
    expect(pickLanguage({ browser: ["fr-FR", "en-GB"] })).toBe("en");
    expect(pickLanguage({ browser: ["fr-FR"] })).toBe("en");
    expect(pickLanguage({})).toBe("en");
  });

  it("ignores a saved language the app doesn't ship", () => {
    expect(pickLanguage({ stored: "xx", browser: ["en-US"] })).toBe("en");
  });

  it("reads ?lang= only in dev", () => {
    expect(pickLanguage({ search: "?lang=pseudo", dev: true })).toBe(PSEUDO);
    expect(pickLanguage({ search: "?lang=pseudo", dev: false })).toBe("en");
    expect(pickLanguage({ search: "?lang=EN-gb", dev: true })).toBe("en");
  });
});
