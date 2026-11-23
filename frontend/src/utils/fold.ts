import { type ComboboxParsedItem, isOptionsGroup, type OptionsFilter } from "@mantine/core";

/**
 * Text compared without case or accents, the same as every search in the app (and the server's
 * `jat.textfold.fold`): "José" matches "jose", and "jose" matches "José".
 */
export function fold(text: string): string {
  return text.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replaceAll("ß", "ss");
}

/** Whether `text` holds `query`, both folded. An empty query matches everything. */
export function foldIncludes(text: string, query: string): boolean {
  return fold(text).includes(fold(query.trim()));
}

/**
 * Mantine's default options filter, folded: every Select, MultiSelect and Autocomplete you can type in
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
