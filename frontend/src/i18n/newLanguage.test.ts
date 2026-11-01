import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import en from "../locales/en";
import { compare, flatten, TO_TRANSLATE } from "./catalog";

// scripts/i18n/new_language.mjs, which docs/guide/adding-a-language.md tells translators to run. It
// reads the English files with plain Node, so an import there that Node can't follow breaks it.
const SCRIPT = resolve(process.cwd(), "../scripts/i18n/new_language.mjs");
const run = (...args: string[]) =>
  spawnSync(process.execPath, ["--experimental-strip-types", SCRIPT, ...args], { encoding: "utf8" });

describe("new_language.mjs", () => {
  let out: string;
  beforeEach(() => {
    out = mkdtempSync(join(tmpdir(), "jat-new-language-"));
  });
  afterEach(() => {
    rmSync(out, { recursive: true, force: true });
  });

  const namespaces = Object.fromEntries(Object.entries(en).filter(([name]) => name !== "selftest"));
  const written = (code: string, name: string) =>
    JSON.parse(readFileSync(join(out, code, `${name}.json`), "utf8"));

  // Polish has four plural forms and Chinese one, so these cover a language with more and with fewer.
  it.each([["pl"], ["zh-CN"]])("writes every namespace but selftest, complete, for %s", (code) => {
    const result = run(code, out);
    expect(result.status, result.stderr).toBe(0);
    const names = Object.keys(namespaces).sort();
    expect(readdirSync(join(out, code)).sort()).toEqual(
      [...names.map((name) => `${name}.json`), "index.ts"].sort(),
    );
    for (const [name, text] of Object.entries(namespaces)) {
      expect({ name, ...compare(text, written(code, name), code) }).toEqual({
        name,
        missing: [],
        extra: [],
        placeholders: [],
        pluralForms: [],
      });
    }
    const index = readFileSync(join(out, code, "index.ts"), "utf8");
    for (const name of names) expect(index).toContain(`import ${name} from "./${name}.json";`);
  });

  it("marks every line, and keeps the English beside it", () => {
    expect(run("pl", out).status).toBe(0);
    for (const [name, text] of Object.entries(namespaces)) {
      const english = flatten(text);
      for (const [key, line] of Object.entries(flatten(written("pl", name)))) {
        expect(line.startsWith(`${TO_TRANSLATE} `), `${name}: ${key}`).toBe(true);
        const form = english[key] ?? english[key.replace(/_(few|many|one)$/, "_other")];
        expect(line, `${name}: ${key}`).toBe(`${TO_TRANSLATE} ${form}`);
      }
    }
  });

  it("gives a count only the forms the language uses", () => {
    expect(run("zh-CN", out).status).toBe(0);
    const keys = Object.keys(flatten(written("zh-CN", "common")));
    expect(keys.some((key) => key.endsWith("_other"))).toBe(true);
    expect(keys.filter((key) => key.endsWith("_one"))).toEqual([]);
  });

  it("takes a code with a region", () => {
    expect(run("xx-YY", out).status).toBe(0);
    expect(existsSync(join(out, "xx-YY", "common.json"))).toBe(true);
  });

  it.each([["en"], ["../xx"], ["xx/yy"], ["XX"], [""]])("refuses the code %j and writes nothing", (code) => {
    expect(run(code, out).status).toBe(1);
    expect(readdirSync(out)).toEqual([]);
    expect(existsSync(resolve(out, "../xx"))).toBe(false);
  });

  it("refuses a folder that's already there, and leaves it alone", () => {
    mkdirSync(join(out, "xx"));
    expect(run("xx", out).status).toBe(1);
    expect(readdirSync(join(out, "xx"))).toEqual([]);
  });
});
