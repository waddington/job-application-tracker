// Start a new language: writes the English text as JSON into frontend/src/locales/<code>/, one
// file per namespace, ready to translate, and the index.ts that gathers them.
// docs/guide/adding-a-language.md has the steps. From the repo root:
//   node --experimental-strip-types scripts/i18n/new_language.mjs <code>
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const code = process.argv[2];
if (!code || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(code) || code === "en") {
  console.error("Give the language's code, for example: pl or zh-CN");
  process.exit(1);
}
const locales = join(dirname(fileURLToPath(import.meta.url)), "../../frontend/src/locales");
const target = join(locales, code);
if (existsSync(target)) {
  console.error(`${target} is already there, so nothing was changed.`);
  process.exit(1);
}

// index gathers the others; selftest is the translation layer's own test, not the app's text.
const namespaces = readdirSync(join(locales, "en"))
  .map((file) => file.replace(/\.ts$/, ""))
  .filter((name) => name !== "index" && name !== "selftest")
  .sort();

mkdirSync(target);
for (const name of namespaces) {
  const { default: text } = await import(pathToFileURL(join(locales, "en", `${name}.ts`)).href);
  writeFileSync(join(target, `${name}.json`), `${JSON.stringify(text, null, 2)}\n`);
}
const imports = namespaces.map((name) => `import ${name} from "./${name}.json";`).join("\n");
const list = namespaces.map((name) => `  ${name},`).join("\n");
writeFileSync(join(target, "index.ts"), `${imports}\n\nexport default {\n${list}\n};\n`);
console.log(`Wrote ${namespaces.length} files to translate in ${target}`);
