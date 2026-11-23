import { type ComboboxParsedItem, isOptionsGroup, type OptionsFilter } from "@mantine/core";

/**
 * Text compared without case or accents, as every search in the app does: "José" matches "jose", and "jose"
 * matches "José". The server's `jat.textfold.fold` agrees on Latin, Greek and Cyrillic accents; this one also
 * drops other scripts' vowel signs and keeps Greek's final sigma, which nothing compares across the two.
 */
export function fold(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replaceAll("ß", "ss");
}

/** Whether `text` holds `query`, both folded. An empty query matches everything. */
export function foldIncludes(text: string, query: string): boolean {
  return fold(text).includes(fold(query.trim()));
}

/**
 * Mantine's default options filter, folded: every Select, MultiSelect, Autocomplete and TagsInput you can type in
 * (the theme makes it their default) finds "José" from "jose".
 */
export const foldedOptionsFilter: OptionsFilter = ({ options, search, limit }) => {
  const result: ComboboxParsedItem[] = [];
  for (const item of options) {
    if (result.length === limit) break;
    if (isOptionsGroup(item)) {
      const items = foldedOptionsFilter({ options: item.items, search, limit: limit - result.length });
      result.push({ group: item.group, items: items as typeof item.items });
    } else if (foldIncludes(item.label, search)) {
      result.push(item);
    }
  }
  return result;
};
