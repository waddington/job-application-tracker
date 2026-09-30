import { Kbd, TextInput } from "@mantine/core";
import { useHotkeys } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useRef, useState } from "react";

/** The search box in the header. Enter opens the results; "/" jumps to it from anywhere. */
export function HeaderSearch() {
  const navigate = useNavigate();
  const current = useRouterState({
    select: (s) => (s.location.pathname === "/search" ? ((s.location.search as { q?: string }).q ?? "") : ""),
  });
  const [value, setValue] = useState(current);
  const [shown, setShown] = useState(current);
  if (current !== shown) {
    // Following a link to /search?q=… (or leaving it) updates the box.
    setShown(current);
    setValue(current);
  }
  const input = useRef<HTMLInputElement>(null);
  useHotkeys([["/", () => input.current?.focus()]]);

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) void navigate({ to: "/search", search: { q } });
      }}
    >
      <TextInput
        ref={input}
        aria-label="Search everything"
        placeholder="Search everything"
        leftSection={<IconSearch size={16} />}
        rightSection={<Kbd size="xs">/</Kbd>}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        w={{ base: 160, sm: 280 }}
      />
    </form>
  );
}
