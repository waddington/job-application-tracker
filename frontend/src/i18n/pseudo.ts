// The pseudo-language (docs/rfc/i18n.md §12): every string accented, about 35% longer and in
// brackets, so English that skipped the translation layer stands out, and so does text that
// would overflow in a longer language. Placeholders ({{name}}), tags (<link>…</link>) and
// nesting ($t(key)) are kept exactly, or the app would break in pseudo where it doesn't in
// English.

// prettier-ignore
const ACCENTED: Record<string, string> = {
  a: "à", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "î", j: "ĵ", k: "ķ", l: "ļ",
  m: "ɱ", n: "ñ", o: "ö", p: "þ", q: "ǫ", r: "ŕ", s: "š", t: "ţ", u: "û", v: "ṽ", w: "ŵ", x: "ẋ",
  y: "ý", z: "ž", A: "À", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Î", J: "Ĵ",
  K: "Ķ", L: "Ļ", M: "Ṁ", N: "Ñ", O: "Ö", P: "Þ", Q: "Ǫ", R: "Ŕ", S: "Š", T: "Ţ", U: "Û", V: "Ṽ",
  W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

// Things to copy through untouched: {{placeholders}}, $t(nesting), and <tags> / </tags>.
const KEEP = /(\{\{[^}]*\}\}|\$t\([^)]*\)|<\/?[A-Za-z0-9]+\s*\/?>)/;

/** "Hello {{name}}" → "[Ĥéļļö {{name}} ··]". */
export function pseudo(text: string): string {
  let letters = 0;
  const parts = text.split(KEEP).map((part, i) => {
    if (i % 2 === 1) return part; // a kept token (split puts captures at odd indexes)
    return Array.from(part, (ch) => {
      if (/[A-Za-z]/.test(ch)) letters += 1;
      return ACCENTED[ch] ?? ch;
    }).join("");
  });
  const padding = "·".repeat(Math.ceil(letters * 0.35));
  return `[${parts.join("")}${padding ? ` ${padding}` : ""}]`;
}

type Tree = { readonly [key: string]: string | Tree };

/** The same tree of strings, every string run through pseudo(). */
export function pseudoTree<T extends Tree>(tree: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(tree)) {
    out[key] = typeof value === "string" ? pseudo(value) : pseudoTree(value);
  }
  return out as T;
}
