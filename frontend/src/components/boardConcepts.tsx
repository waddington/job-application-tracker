/*
 * DEV ONLY: board concepts for a column per interview round beside the quick view (roadmap task
 * board-rounds-concepts, bug fix-board-round-columns-cramped). DO NOT MERGE: a draft PR for picking one.
 *
 * ?board=N picks a concept (0 is today's board) and remembers it in localStorage; a small floating switch at the
 * bottom left changes it (?switch=0 hides it, for screenshots). Outside a dev server (import.meta.env.DEV false)
 * the concept is always 0 and the switch never renders.
 */
/* eslint-disable i18next/no-literal-string -- dev-only concepts, never translated */
import { Paper, SegmentedControl, Text, Tooltip } from "@mantine/core";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export const BOARD_CONCEPTS = [
  { n: 0, name: "Today's board" },
  { n: 1, name: "Empty columns fold into strips" },
  { n: 2, name: "Rounds grouped under one Interviewing header" },
  { n: 3, name: "Quick view floats over a crowded board" },
  { n: 4, name: "Keep the card in view, with edge hints" },
  { n: 5, name: "Rounds as lanes inside one Interviewing column" },
  { n: 6, name: "5 + 1 + 4: lanes, empty columns as strips, card kept in view" },
] as const;

const KEY = "jat.boardConcept";
const listeners = new Set<() => void>();

function read(): number {
  if (!import.meta.env.DEV) return 0;
  const asked = new URLSearchParams(window.location.search).get("board");
  if (asked !== null && /^\d$/.test(asked)) {
    localStorage.setItem(KEY, asked);
  }
  const n = Number(localStorage.getItem(KEY) ?? 0);
  return BOARD_CONCEPTS.some((c) => c.n === n) ? n : 0;
}

let current = typeof window === "undefined" ? 0 : read();

function set(n: number) {
  current = n;
  localStorage.setItem(KEY, String(n));
  const url = new URL(window.location.href);
  url.searchParams.set("board", String(n));
  window.history.replaceState(window.history.state, "", url);
  listeners.forEach((l) => l());
}

/** The board concept in use: always 0 outside a dev server. */
export function useBoardConcept(): number {
  const n = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return import.meta.env.DEV ? n : 0;
}

/** Concept 4: the edge buttons' words. */
export const moreLabel = (count: number, side: -1 | 1) => (side < 0 ? `← ${count} more` : `${count} more →`);

/** The floating switch, bottom left, on a dev server only. */
export function BoardConceptSwitch() {
  const n = useBoardConcept();
  if (!import.meta.env.DEV) return null;
  if (new URLSearchParams(window.location.search).get("switch") === "0") return null;
  return createPortal(
    <Paper
      shadow="md"
      p={6}
      radius="md"
      withBorder
      style={{
        position: "fixed",
        left: 12,
        bottom: 12,
        zIndex: 400,
        display: "flex",
        gap: 8,
        alignItems: "center",
      }}
    >
      <Text size="xs" fw={600}>
        Board concept
      </Text>
      <SegmentedControl
        size="xs"
        value={String(n)}
        onChange={(v) => set(Number(v))}
        data={BOARD_CONCEPTS.map((c) => ({
          value: String(c.n),
          label: (
            <Tooltip label={c.name} withinPortal>
              <span>{c.n}</span>
            </Tooltip>
          ),
        }))}
      />
      <Text size="xs" c="dimmed" maw={220} lineClamp={1}>
        {BOARD_CONCEPTS[n]?.name}
      </Text>
    </Paper>,
    document.body,
  );
}
