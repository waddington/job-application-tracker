import { Anchor, Group, Stack, type StackProps } from "@mantine/core";
import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

/** The widest a page's content goes (docs/rfc/app-redesign.md §2, Frame). */
export const PAGE_MAX_WIDTH = 2400;

/**
 * The widest a run of text or a row of a thing and its controls goes inside a full-width page, so lines
 * stay readable and a button stays near what it acts on.
 */
export const READING_WIDTH = "75ch";

/**
 * Every page's outer wrapper: the page fills the width beside the menu, starting right after it, up to
 * 2,400 px, so a wide screen is used whole and a 4K one doesn't get 3,000 px lines. A `wide` page has no
 * cap, for content that fills the window (the Applications board); keep its header and filters in a
 * `PageCapped`, so they sit where they do on other pages.
 */
export function Page({
  children,
  wide = false,
  ...props
}: Omit<StackProps, "maw"> & { children?: ReactNode; wide?: boolean }) {
  return (
    <Stack maw={wide ? undefined : PAGE_MAX_WIDTH} {...props}>
      {children}
    </Stack>
  );
}

/** Part of a `wide` page held to the usual 2,400 px cap, spaced as the page's own children are. */
export function PageCapped({ children }: { children?: ReactNode }) {
  return <Stack maw={PAGE_MAX_WIDTH}>{children}</Stack>;
}

/** A record page's link back to its list, above its header (and its skeleton's, while it loads). */
export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Anchor component={Link} to={to} size="sm">
      <Group gap={4}>
        <IconArrowLeft size={14} /> {children}
      </Group>
    </Anchor>
  );
}
