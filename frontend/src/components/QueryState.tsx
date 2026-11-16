import { Button, Group, Skeleton, Stack, Text } from "@mantine/core";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** What QueryState reads from a TanStack Query result. */
export type QueryLike<T> = Pick<UseQueryResult<T>, "data" | "isError" | "isFetching" | "fetchStatus"> & {
  refetch: () => unknown;
};

/**
 * Two queries read as one, for a card that shows both: loaded once both have, failed when either
 * failed before it loaded (Retry tries the failed ones again), loading otherwise.
 */
export function bothQueries<A, B>(a: QueryLike<A>, b: QueryLike<B>): QueryLike<[A, B]> {
  const both = [a, b];
  const failed = both.filter((q) => q.isError && q.data === undefined);
  return {
    data: a.data !== undefined && b.data !== undefined ? [a.data, b.data] : undefined,
    isError: failed.length > 0,
    isFetching: both.some((q) => q.isFetching),
    fetchStatus: both.some((q) => q.fetchStatus === "fetching")
      ? "fetching"
      : both.some((q) => q.fetchStatus === "paused")
        ? "paused"
        : "idle",
    refetch: () => Promise.all(failed.map((q) => q.refetch())),
  };
}

/**
 * A card's or list's loading, failed and empty states, so a query that hasn't answered (or has
 * failed) never shows the "nothing here" text. While it loads: skeleton lines sized like the rows
 * they stand for. On a failed load: a dimmed line with Retry (spinning while it tries again). The
 * empty text only for a list that loaded empty; otherwise the children, with the list. A query that
 * has never started (`enabled: false`) shows nothing. Whole-page loads keep their Loader.
 *
 * `select` turns the query's data into the list to show (a filtered one, say); it defaults to the
 * data itself. `skeleton` stands in for the plain lines when the list has a shape of its own (a
 * chart, or rows under headings).
 */
export function QueryState<T, L extends readonly unknown[] = Extract<T, readonly unknown[]>>({
  query,
  select,
  empty,
  rows = 3,
  rowHeight = 20,
  skeleton,
  children,
}: {
  query: QueryLike<T>;
  select?: (data: T) => L;
  empty: ReactNode;
  /** How many skeleton lines, and how tall each is, so the layout doesn't jump when the rows come. */
  rows?: number;
  rowHeight?: number;
  /** Drawn in place of the skeleton lines while the query loads. */
  skeleton?: ReactNode;
  children: (list: L) => ReactNode;
}) {
  const { t } = useTranslation("common");
  if (query.data === undefined) {
    if (query.isError)
      return (
        <Group gap="xs" role="status">
          <Text size="sm" c="dimmed">
            {t("load.failed")}
          </Text>
          <Button
            size="compact-xs"
            variant="subtle"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            {t("load.retry")}
          </Button>
        </Group>
      );
    if (query.fetchStatus === "idle") return null; // never started: a disabled query
    return (
      <Stack gap="xs" aria-busy="true" data-testid="query-loading">
        {skeleton ??
          Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={rowHeight} radius="sm" />)}
      </Stack>
    );
  }
  const list = select ? select(query.data) : (query.data as unknown as L);
  return list.length === 0 ? empty : children(list);
}
