import {
  Box,
  Grid,
  Group,
  SimpleGrid,
  Skeleton,
  Stack,
  type MantineSpacing,
  type SimpleGridProps,
} from "@mantine/core";
import type { ReactNode } from "react";

import { Page } from "./Page";
import { Loading } from "./QueryState";

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

/** A line of text or a heading: a bar as tall as the line, with its line spacing kept around it. */
export function LineSkeleton({ height, width }: { height: number; width: number | string }) {
  return (
    <Box h={height} py={Math.round(height / 6)} w={width} maw="100%">
      <Skeleton height="100%" radius="sm" />
    </Box>
  );
}

/** A row of small buttons (size xs), as a record page's actions are. */
export function ButtonsSkeleton({ count }: { count: number }) {
  return (
    <Group gap="xs">
      {Array.from({ length: count }, (_, i) => (
        <Skeleton key={i} height={30} width={80} radius="xl" />
      ))}
    </Group>
  );
}

type Columns = {
  /** The heights of the first cards in the main column, and in the side one. */
  main: number[];
  side: number[];
  /** How many of the grid's 12 columns the main one takes (on a wide screen). */
  span?: number;
  /** What comes before the main column's cards (an application's summary). */
  top?: ReactNode;
};

/** A record page's two columns while it loads: the first cards of each, as tall as the real ones. */
export function ColumnsSkeleton({ main, side, span = 8, top }: Columns) {
  const cards = (heights: number[]) =>
    heights.map((height, i) => <Skeleton key={i} height={height} radius="xl" />);
  return (
    <Grid gap="lg">
      <Grid.Col span={{ base: 12, md: span }}>
        <Stack>
          {top}
          {cards(main)}
        </Stack>
      </Grid.Col>
      <Grid.Col span={{ base: 12, md: 12 - span }}>
        <Stack>{cards(side)}</Stack>
      </Grid.Col>
    </Grid>
  );
}

/**
 * A record's page (a role, person, company or agency) while its record loads: the link back, which
 * needs nothing, then its header (the name, the lines under it, the action buttons) and the first
 * cards in the page's columns, each as tall as the real ones so the page doesn't jump when it comes.
 */
export function RecordSkeleton({
  back,
  lines = [],
  actions,
  ...columns
}: Columns & {
  back: ReactNode;
  /** The heights of the lines under the name. */
  lines?: number[];
  actions: number;
}) {
  return (
    <Page>
      {back}
      <Loading gap="md">
        <Group justify="space-between" wrap="wrap" align="flex-start">
          <Stack gap={2}>
            <LineSkeleton height={54} width="24rem" />
            {lines.map((height, i) => (
              <LineSkeleton key={i} height={height} width="16rem" />
            ))}
          </Stack>
          <ButtonsSkeleton count={actions} />
        </Group>
        <ColumnsSkeleton {...columns} />
      </Loading>
    </Page>
  );
}
