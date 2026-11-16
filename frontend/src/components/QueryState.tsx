import { Button, Group, Skeleton, Stack, Text, type MantineSpacing } from "@mantine/core";
import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

/** What QueryState reads from a TanStack Query result. */
export type QueryLike<T> = Pick<UseQueryResult<T>, "data" | "isError" | "isFetching" | "fetchStatus"> & {
  refetch: () => unknown;
};

/**
 * Several queries read as one, for a card or page that shows them together: loaded once all have,
 * failed when any failed before it loaded (Retry tries the failed ones again), loading otherwise.
 */
export function allQueries(...queries: QueryLike<unknown>[]): QueryLike<unknown[]> {
  const failed = queries.filter((q) => q.isError && q.data === undefined);
  return {
    data: queries.every((q) => q.data !== undefined) ? queries.map((q) => q.data) : undefined,
    isError: failed.length > 0,
    // Retry spins only for the lists it retries, not for one still on its first load.
    isFetching: (failed.length ? failed : queries).some((q) => q.isFetching),
    fetchStatus: queries.some((q) => q.fetchStatus === "fetching")
      ? "fetching"
      : queries.some((q) => q.fetchStatus === "paused")
        ? "paused"
        : "idle",
    refetch: () => Promise.all(failed.map((q) => q.refetch())),
  };
}

/** Two queries read as one (allQueries), keeping each one's type. */
export function bothQueries<A, B>(a: QueryLike<A>, b: QueryLike<B>): QueryLike<[A, B]> {
  return allQueries(a, b) as QueryLike<[A, B]>;
}

/**
 * What a skeleton sits in while its query loads: busy for screen readers, found by tests. `gap` spaces
 * its pieces as the real ones are (a page's own gap, say).
 */
export function Loading({ children, gap = "xs" }: { children: ReactNode; gap?: MantineSpacing }) {
  return (
    <Stack gap={gap} aria-busy="true" data-testid="query-loading">
      {children}
    </Stack>
  );
}

/**
 * What a query shows before it has data, for a page that decides the rest itself: while it loads,
 * the skeleton; on a failed load, a dimmed line with Retry (spinning while it tries again). A query
 * that has never started (`enabled: false`) shows nothing. Render it only while the query has no data
 * (`data === undefined`): it shows the failed line whenever the query has failed, so after a failed
 * refetch it would replace content that's still good.
 */
export function Pending({ query, skeleton }: { query: QueryLike<unknown>; skeleton: ReactNode }) {
  const { t } = useTranslation("common");
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
  return <Loading>{skeleton}</Loading>;
}

/**
 * A card's or list's loading, failed and empty states, so a query that hasn't answered (or has
 * failed) never shows the "nothing here" text. While it loads: skeleton lines sized like the rows
 * they stand for. On a failed load: a dimmed line with Retry (spinning while it tries again). The
 * empty text only for a list that loaded empty; otherwise the children, with the list. A query that
 * has never started (`enabled: false`) shows nothing. Pages use the same pieces (PageSkeleton.tsx).
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
  if (query.data === undefined)
    return (
      <Pending
        query={query}
        skeleton={
          skeleton ??
          Array.from({ length: rows }, (_, i) => <Skeleton key={i} height={rowHeight} radius="sm" />)
        }
      />
    );
  const list = select ? select(query.data) : (query.data as unknown as L);
  return list.length === 0 ? empty : children(list);
}
