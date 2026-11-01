import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import en from "../locales/en";

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

  it("writes every namespace but selftest, word for word, and the index that gathers them", () => {
    const result = run("xx", out);
    expect(result.status, result.stderr).toBe(0);
    const namespaces = Object.fromEntries(Object.entries(en).filter(([name]) => name !== "selftest"));
    const names = Object.keys(namespaces).sort();
    expect(readdirSync(join(out, "xx")).sort()).toEqual(
      [...names.map((name) => `${name}.json`), "index.ts"].sort(),
    );
    for (const [name, text] of Object.entries(namespaces)) {
      expect(JSON.parse(readFileSync(join(out, "xx", `${name}.json`), "utf8"))).toEqual(text);
    }
    const index = readFileSync(join(out, "xx", "index.ts"), "utf8");
    for (const name of names) expect(index).toContain(`import ${name} from "./${name}.json";`);
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
