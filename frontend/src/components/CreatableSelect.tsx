import { Select, type SelectProps } from "@mantine/core";
import { useState } from "react";

const NEW = "__new__";

/**
 * A searchable Select that can also add what you typed: when nothing matches, the list offers
 * `+ Add "<name>"`, which calls `onCreate` and selects the result.
 */
export function CreatableSelect({
  items,
  value,
  onChange,
  onCreate,
  creating = false,
  ...props
}: Omit<SelectProps, "data" | "value" | "onChange" | "searchable"> & {
  items: { value: string; label: string }[];
  value: string | null;
  onChange: (value: string | null) => void;
  /** Create a new item called `name` and resolve to its id. */
  onCreate: (name: string) => Promise<string>;
  creating?: boolean;
}) {
  const [search, setSearch] = useState("");
  const typed = search.trim();
  const exists = items.some((i) => i.label.toLowerCase() === typed.toLowerCase());
  const data = typed && !exists ? [...items, { value: NEW, label: `+ Add "${typed}"` }] : items;
  return (
    <Select
      {...props}
      searchable
      data={data}
      value={value}
      searchValue={search}
      onSearchChange={setSearch}
      disabled={props.disabled || creating}
      onChange={(next) => {
        if (next === NEW) {
          onCreate(typed)
            .then((id) => {
              setSearch("");
              onChange(id);
            })
            .catch(() => setSearch(typed)); // the error is shown; keep what was typed to try again
        } else {
          onChange(next);
        }
      }}
    />
  );
}
