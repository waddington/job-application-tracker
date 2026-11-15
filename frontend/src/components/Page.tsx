import { Stack, type StackProps } from "@mantine/core";
import type { ReactNode } from "react";

/** The widest a page's content goes (docs/rfc/app-redesign.md §2, Frame). */
export const PAGE_MAX_WIDTH = 2400;

/**
 * Every page's outer wrapper: the page fills the width beside the menu, starting right after it, up to
 * 2,400 px, so a wide screen is used whole and a 4K one doesn't get 3,000 px lines.
 */
export function Page({ children, ...props }: Omit<StackProps, "maw"> & { children?: ReactNode }) {
  return (
    <Stack maw={PAGE_MAX_WIDTH} {...props}>
      {children}
    </Stack>
  );
}
