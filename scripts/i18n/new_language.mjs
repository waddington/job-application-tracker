// Start a new language: writes frontend/src/locales/<code>/, one JSON file per namespace, and the
// index.ts that gathers them. Each line is the English with TO_TRANSLATE in front, so what's left
// stands out on screen and in a search, and a test fails until none remains. Each count gets the
// plural forms the language uses. docs/guide/adding-a-language.md has the steps. From the repo root:
//   node --experimental-strip-types scripts/i18n/new_language.mjs <code>
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { pluralCategories, TO_TRANSLATE } from "../../frontend/src/i18n/catalog.ts";

const code = process.argv[2];
if (!code || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(code) || code === "en") {
  console.error("Give the language's code, for example: pl or zh-CN");
  process.exit(1);
}
const locales = join(dirname(fileURLToPath(import.meta.url)), "../../frontend/src/locales");
// A second argument writes somewhere else; only the test uses it.
const target = join(process.argv[3] ?? locales, code);
if (existsSync(target)) {
  console.error(`${target} is already there, so nothing was changed.`);
  process.exit(1);
}

const forms = pluralCategories(code);
const marked = (text) => `${TO_TRANSLATE} ${text}`;

/** English's lines, marked. "x_other" stands for a count: it becomes the forms this language uses. */
function toTranslate(tree) {
  const out = {};
  for (const [key, value] of Object.entries(tree)) {
    if (typeof value !== "string") out[key] = toTranslate(value);
    else if (key.endsWith("_other")) {
      const base = key.slice(0, -"_other".length);
      for (const form of forms) out[`${base}_${form}`] = marked(tree[`${base}_${form}`] ?? value);
    } else if (!(key.endsWith("_one") && `${key.slice(0, -"_one".length)}_other` in tree)) {
      out[key] = marked(value);
    }
  }
  return out;
}

// index gathers the others; selftest is the translation layer's own test, not the app's text.
const namespaces = readdirSync(join(locales, "en"))
  .map((file) => file.replace(/\.ts$/, ""))
  .filter((name) => name !== "index" && name !== "selftest")
  .sort();

mkdirSync(target);
for (const name of namespaces) {
  const { default: text } = await import(pathToFileURL(join(locales, "en", `${name}.ts`)).href);
  writeFileSync(join(target, `${name}.json`), `${JSON.stringify(toTranslate(text), null, 2)}\n`);
}
const imports = namespaces.map((name) => `import ${name} from "./${name}.json";`).join("\n");
const list = namespaces.map((name) => `  ${name},`).join("\n");
writeFileSync(join(target, "index.ts"), `${imports}\n\nexport default {\n${list}\n};\n`);
console.log(`Wrote ${namespaces.length} files to translate in ${target}`);
