import { Box, SimpleGrid, Skeleton, Stack, type MantineSpacing, type SimpleGridProps } from "@mantine/core";

/**
 * The shapes a page's list takes while it loads, inside QueryState's `skeleton` (or `Loading`), under
 * the page's own header and toolbar, which show at once. Each piece is as tall as the real rows or
 * cards it stands for, so the page doesn't jump when they come.
 */

/** A table: its header row, then the first rows. */
export function TableSkeleton({
  rows = 6,
  rowHeight,
  headHeight = 38,
}: {
  rows?: number;
  rowHeight: number;
  headHeight?: number;
}) {
  return (
    <Stack gap={0}>
      {[headHeight, ...Array<number>(rows).fill(rowHeight)].map((height, i) => (
        <Box key={i} h={height} py={Math.round(height / 3)}>
          <Skeleton height="100%" radius="sm" />
        </Box>
      ))}
    </Stack>
  );
}

/** Cards or tiles: a column of them, or a grid with the real one's columns. */
export function CardsSkeleton({
  count,
  height,
  cols,
  gap = "md",
}: {
  count: number;
  height: number;
  cols?: SimpleGridProps["cols"];
  gap?: MantineSpacing;
}) {
  const cards = Array.from({ length: count }, (_, i) => <Skeleton key={i} height={height} radius="md" />);
  return cols ? (
    <SimpleGrid cols={cols} spacing={gap} verticalSpacing={gap}>
      {cards}
    </SimpleGrid>
  ) : (
    <Stack gap={gap}>{cards}</Stack>
  );
}
