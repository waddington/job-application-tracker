import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type Announcements,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Paper,
  ScrollArea,
  Skeleton,
  Stack,
  Switch,
  Text,
} from "@mantine/core";
import { useLocalStorage, useViewportSize } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import classes from "./Board.module.css";
import concept from "./boardConcepts.module.css";
import { BoardConceptSwitch, moreLabel, useBoardConcept } from "./boardConcepts";
import { PersonMarks } from "./GhostMark";
import type { ApplicationRow } from "../api/client";
import { i18n } from "../i18n";
import { type Workflow } from "../api/hooks";
import { useMoveAsking } from "./RejectionFeedback";
import {
  buildColumns,
  canDrop,
  columnKey,
  columnTitle,
  isRoundColumn,
  isSuggested,
  planDrop,
  splitByRound,
  visibleColumns,
  type Column,
} from "../utils/board";
import { stageName } from "../utils/stageName";
import { ago } from "../utils/time";
import { RoundBadge, roundBadge } from "./Interviews";

// Space picks a card up and drops it; Enter is left free to open the card.
const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space"] };

/** Screen-reader messages in words (company, stage names) rather than ids. */
export function announcements(rows: ApplicationRow[], titles: Map<string, string>): Announcements {
  const label = (id: UniqueIdentifier) =>
    rows.find((r) => r.id === id)?.company_name ?? i18n.t("applications:board.drag.application");
  // The column's own title, so round columns can be told apart ("Interviewing · Round 2").
  const stage = (id: UniqueIdentifier | undefined) => (id ? (titles.get(String(id)) ?? String(id)) : "");
  return {
    onDragStart: ({ active }) => i18n.t("applications:board.drag.pickedUp", { card: label(active.id) }),
    onDragOver: ({ active, over }) =>
      over
        ? i18n.t("applications:board.drag.over", { card: label(active.id), column: stage(over.id) })
        : i18n.t("applications:board.drag.notOver", { card: label(active.id) }),
    onDragEnd: ({ active, over }) =>
      over
        ? i18n.t("applications:board.drag.droppedOn", { card: label(active.id), column: stage(over.id) })
        : i18n.t("applications:board.drag.dropped", { card: label(active.id) }),
    onDragCancel: ({ active }) => i18n.t("applications:board.drag.cancelled", { card: label(active.id) }),
  };
}

/**
 * Who a card came through, linked to their page: the recruiter's, or the agency's when only the agency
 * is known. The link keeps its click, press and Enter to itself, so following it doesn't also open the
 * card's quick view or start a drag.
 */
function ViaLink({ to, children }: { to: string; children: React.ReactNode }) {
  const keep = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <Anchor
      component={Link}
      to={to}
      inherit
      c="dimmed"
      underline="hover"
      onClick={keep}
      onPointerDown={keep}
      onKeyDown={keep}
    >
      {children}
    </Anchor>
  );
}

function CardBody({
  row,
  link = true,
  compact = false,
}: {
  row: ApplicationRow;
  link?: boolean;
  compact?: boolean;
}) {
  const { t } = useTranslation("applications");
  const via =
    row.route === "agency"
      ? row.recruiter_name || row.agency_name
      : row.route === "referral"
        ? t("routes.referral")
        : row.recruiter_name; // an in-house recruiter
  const viaTo = !link
    ? null
    : row.route !== "referral" && row.recruiter_name && row.recruiter_id
      ? `/people/${row.recruiter_id}`
      : row.route === "agency" && !row.recruiter_name && row.agency_name && row.agency_id
        ? `/agencies/${row.agency_id}`
        : null;
  return (
    <>
      <Text fw={600} size="sm" lineClamp={1}>
        {row.company_name}
      </Text>
      <Text size="xs" c="dimmed" lineClamp={2}>
        {row.role_title}
      </Text>
      {/* DEV concepts 2 and 5: under a round's own header, the round's number goes; what and when stay, on one line. */}
      {compact && row.current_round && row.stage_kind === "active" && (
        <Text size="xs" c={`${roundBadge(row.current_round).color}.7`} fw={600} lineClamp={1} mt={4}>
          {roundBadge(row.current_round).text.replace(/^[^·]*·\s*/, "")}
        </Text>
      )}
      {!compact && row.current_round && row.stage_kind === "active" && (
        <Group mt={6}>
          <RoundBadge round={row.current_round} stageKind={row.stage_kind} size="xs" />
        </Group>
      )}
      {row.reply_to_read_since && (
        <Badge mt={6} size="xs" variant="light" color="orange">
          {t("board.replyToRead")}
        </Badge>
      )}
      <Group gap={6} mt={6} justify="space-between" wrap="nowrap">
        {/* On one line in a narrow column; who it came through is cut short instead. */}
        <Text
          size="xs"
          c={row.stale ? "red" : "dimmed"}
          fw={row.stale ? 600 : undefined}
          style={{ whiteSpace: "nowrap", flex: "none" }}
        >
          {ago(row.days_since_activity)}
        </Text>
        {via && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {row.route !== "referral" && row.recruiter_name && (
              <PersonMarks id={row.recruiter_id} size={12} />
            )}
            {viaTo ? <ViaLink to={viaTo}>{via}</ViaLink> : via}
          </Text>
        )}
      </Group>
    </>
  );
}

function DraggableCard({
  row,
  onOpen,
  compact = false,
}: {
  row: ApplicationRow;
  onOpen: (id: string) => void;
  compact?: boolean;
}) {
  const { t } = useTranslation("applications");
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id, data: { row } });
  return (
    <Card
      ref={setNodeRef}
      withBorder
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        borderLeft: row.stale ? "3px solid var(--mantine-color-red-6)" : undefined,
      }}
      aria-label={t("board.card", { company: row.company_name, role: row.role_title })}
      data-panel-opener={row.id} // focus comes back here when the quick view closes, even after a move
      {...attributes}
      {...listeners}
      onClick={() => onOpen(row.id)}
      // Enter opens the card; Space starts a keyboard drag (see KEYBOARD_CODES).
      onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onOpen(row.id);
          return;
        }
        listeners?.onKeyDown?.(e);
      }}
    >
      <CardBody row={row} compact={compact} />
    </Card>
  );
}

/** The width a closed stage's column comes in at when it only shows for a drag. */
const REVEALED_WIDTH = 200;

type DropState = "idle" | "suggested" | "allowed" | "blocked";

// Usual next stages stand out; any other stage still takes the drop (unless the workflow is set to configured
// transitions, when it's faded out).
const dropBorder = (dropState: DropState, isOver: boolean) =>
  dropState === "suggested"
    ? `2px dashed var(--mantine-color-${isOver ? "teal" : "blue"}-5)`
    : dropState === "allowed"
      ? `1px dashed var(--mantine-color-${isOver ? "teal-5" : "gray-5"})`
      : "1px solid transparent";

const frozenStyle = (width: number | undefined) =>
  width !== undefined ? ({ "--board-column-width": `${width}px` } as CSSProperties) : undefined;

function StageColumn({
  column,
  dropState,
  width,
  collapsed = false,
  onOpen,
}: {
  column: Column;
  dropState: DropState;
  /** Set while a card is dragged: the column's width stays put (see Board.module.css). */
  width?: number;
  /** DEV concept 1: an empty column folded into a narrow strip, which still takes drops. */
  collapsed?: boolean;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("applications");
  const { setNodeRef, isOver } = useDroppable({ id: columnKey(column) });
  const closed = column.stage.kind !== "active";
  if (collapsed)
    return (
      <Paper
        ref={setNodeRef}
        variant="well"
        className={concept.strip}
        data-col-key={columnKey(column)}
        data-collapsed
        data-over={(isOver && dropState !== "blocked") || undefined}
        data-dragging={dropState !== "idle" || undefined}
        radius="lg"
        title={columnTitle(column)}
        style={{ border: dropBorder(dropState, isOver), opacity: dropState === "blocked" ? 0.45 : 1 }}
        aria-label={t("board.column", { title: columnTitle(column) })}
      >
        <Text size="xs" c="dimmed" ta="center">
          0
        </Text>
        <span
          className={concept.stripLabel}
          style={{ color: `var(--mantine-color-${column.stage.color}-7)` }}
        >
          {columnTitle(column)}
        </span>
      </Paper>
    );
  return (
    // A soft well of the page's tint, so its cards stand out.
    <Paper
      ref={setNodeRef}
      variant="well"
      className={classes.column}
      data-col-key={columnKey(column)}
      data-frozen={width !== undefined || undefined}
      p="xs"
      radius="lg"
      style={{
        border: dropBorder(dropState, isOver),
        opacity: dropState === "blocked" ? 0.45 : 1,
        transition: "opacity 120ms",
        ...frozenStyle(width),
      }}
      aria-label={t("board.column", { title: columnTitle(column) })}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Badge color={column.stage.color} variant={closed ? "outline" : "light"}>
          {columnTitle(column)}
        </Badge>
        <Text size="xs" c="dimmed">
          {column.rows.length}
        </Text>
      </Group>
      <Stack gap="xs" mih={60}>
        {column.rows.map((row) => (
          <DraggableCard key={row.id} row={row} onOpen={onOpen} />
        ))}
      </Stack>
    </Paper>
  );
}

/** DEV concepts 2 and 5: a round's short name ("No round", "R2" side by side; "Round 2" in lanes). */
const roundShort = (column: Column, long: boolean) =>
  column.round === null || column.round === undefined
    ? long
      ? "No round yet"
      : "No round"
    : long
      ? `Round ${column.round}`
      : `R${column.round}`;

/** DEV concept 2: one round's sub-column inside the Interviewing group, its own drop target. */
function RoundSubColumn({
  column,
  dropState,
  onOpen,
}: {
  column: Column;
  dropState: DropState;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("applications");
  const { setNodeRef, isOver } = useDroppable({ id: columnKey(column) });
  return (
    <div
      ref={setNodeRef}
      className={concept.sub}
      style={{ border: dropBorder(dropState, isOver), opacity: dropState === "blocked" ? 0.45 : 1 }}
      aria-label={t("board.column", { title: columnTitle(column) })}
      title={columnTitle(column)}
    >
      <Group justify="space-between" mb={6} wrap="nowrap" gap={4}>
        <Text
          size="xs"
          fw={700}
          tt="uppercase"
          c={`${column.stage.color}.7`}
          style={{ whiteSpace: "nowrap" }}
        >
          {roundShort(column, false)}
        </Text>
        <Text size="xs" c="dimmed">
          {column.rows.length}
        </Text>
      </Group>
      <Stack gap="xs" mih={60}>
        {column.rows.map((row) => (
          <DraggableCard key={row.id} row={row} onOpen={onOpen} compact />
        ))}
      </Stack>
    </div>
  );
}

/** DEV concept 5: one round's lane, stacked inside the one Interviewing column, its own drop target. */
function RoundLane({
  column,
  dropState,
  onOpen,
}: {
  column: Column;
  dropState: DropState;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("applications");
  const { setNodeRef, isOver } = useDroppable({ id: columnKey(column) });
  return (
    <div
      ref={setNodeRef}
      className={concept.lane}
      data-empty={!column.rows.length || undefined}
      style={{ border: dropBorder(dropState, isOver), opacity: dropState === "blocked" ? 0.45 : 1 }}
      aria-label={t("board.column", { title: columnTitle(column) })}
    >
      <Group justify="space-between" mb={column.rows.length ? 6 : 0} wrap="nowrap" gap={4}>
        <Text size="xs" fw={700} c={`${column.stage.color}.7`}>
          {roundShort(column, true)}
        </Text>
        <Text size="xs" c="dimmed">
          {column.rows.length}
        </Text>
      </Group>
      {column.rows.length > 0 && (
        // Two cards side by side once the column is wide enough (see .laneCards).
        <div className={concept.laneCards}>
          {column.rows.map((row) => (
            <DraggableCard key={row.id} row={row} onOpen={onOpen} compact />
          ))}
        </div>
      )}
    </div>
  );
}

/** DEV concepts 2 and 5: a split stage's round columns, as one group under the stage's header. */
function RoundGroup({
  columns,
  layout,
  width,
  dropStateFor,
  onOpen,
}: {
  columns: Column[];
  layout: "side" | "lanes";
  width?: number;
  dropStateFor: (column: Column) => DropState;
  onOpen: (id: string) => void;
}) {
  const stage = columns[0]!.stage;
  const total = columns.reduce((n, c) => n + c.rows.length, 0);
  return (
    <Paper
      variant="well"
      className={layout === "side" ? concept.group : concept.lanes}
      data-col-key={`group:${stage.id}`}
      data-frozen={width !== undefined || undefined}
      p="xs"
      radius="lg"
      style={{
        ...(layout === "side" && ({ "--rounds": columns.length } as CSSProperties)),
        ...frozenStyle(width),
      }}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Badge color={stage.color} variant="light">
          {stageName(stage)}
        </Badge>
        <Text size="xs" c="dimmed">
          {total}
        </Text>
      </Group>
      {layout === "side" ? (
        <Group gap={6} wrap="nowrap" align="stretch">
          {columns.map((c) => (
            <RoundSubColumn key={columnKey(c)} column={c} dropState={dropStateFor(c)} onOpen={onOpen} />
          ))}
        </Group>
      ) : (
        <Stack gap={6}>
          {columns.map((c) => (
            <RoundLane key={columnKey(c)} column={c} dropState={dropStateFor(c)} onOpen={onOpen} />
          ))}
        </Stack>
      )}
    </Paper>
  );
}

type Item = { kind: "column"; column: Column } | { kind: "group"; key: string; columns: Column[] };

/** DEV concepts 2 and 5: a split stage's round columns come together as one item. */
function groupRounds(columns: Column[], group: boolean): Item[] {
  const items: Item[] = [];
  for (const column of columns) {
    const last = items.at(-1);
    if (group && column.round !== undefined) {
      if (last?.kind === "group" && last.columns[0]!.stage.id === column.stage.id) last.columns.push(column);
      else items.push({ kind: "group", key: `group:${column.stage.id}`, columns: [column] });
    } else items.push({ kind: "column", column });
  }
  return items;
}

/** The dock's width (Layout's DOCK_WIDTH): 440 px from 992 px, 540 px from 1,200 px. */
const dockWidth = (windowWidth: number) => (windowWidth >= 1200 ? 540 : 440);

export function Board({
  workflow,
  rows,
  onOpen,
  openId = null,
}: {
  workflow: Workflow;
  rows: ApplicationRow[];
  onOpen: (id: string) => void;
  /** The application the quick view shows (DEV concepts 3 and 4 keep its card in view). */
  openId?: string | null;
}) {
  const { t } = useTranslation("applications");
  const n = useBoardConcept();
  const [active, setActive] = useState<ApplicationRow | null>(null);
  // While dragging: each column's width when the card was picked up (by key), and the width a column that only
  // shows for the drag comes in at.
  const [frozen, setFrozen] = useState<{ widths: Map<string, number>; fallback: number } | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [showClosed, setShowClosed] = useState(false);
  // Remembered: a column per interview round, or one per stage.
  const [byRound, setByRound] = useLocalStorage<boolean>({
    key: "jat.board.byRound",
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const move = useMoveAsking(); // a drop on Rejected asks for feedback first; cancelling puts the card back
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // clicks still open the card
    useSensor(KeyboardSensor, { keyboardCodes: KEYBOARD_CODES }),
  );
  const stageColumns = buildColumns(workflow, rows);
  const columns = visibleColumns(byRound ? splitByRound(stageColumns) : stageColumns, {
    showClosed,
    dragging: !!active,
  });
  // Which of the DEV concepts' parts are on: 6 is 5's lanes with 1's strips and 4's keep-in-view and edge hints.
  const lanes = n === 5 || n === 6;
  const folds = n === 1 || n === 6;
  const keepInView = n === 3 || n === 4 || n === 6;
  const edgeHints = n === 4 || n === 6;
  const items = groupRounds(columns, n === 2 || lanes);
  const names = new Map(workflow.stages.map((s) => [s.id, s.name]));
  const titles = new Map(columns.map((c) => [columnKey(c), columnTitle(c)]));
  const ownColumn = (id: string) => {
    const column = columns.find((c) => c.rows.some((r) => r.id === id));
    return column ? columnKey(column) : undefined;
  };
  const dropStateFor = (column: Column): DropState =>
    !active || columnKey(column) === ownColumn(active.id)
      ? "idle"
      : isRoundColumn(columnKey(column)) || column.stage.id === active.stage
        ? "blocked"
        : !canDrop(workflow, active.stage, column.stage.id)
          ? "blocked"
          : isSuggested(workflow, active.stage, column.stage.id)
            ? "suggested"
            : "allowed";
  const widthFor = (key: string) =>
    !frozen ? undefined : (frozen.widths.get(key) ?? Math.min(frozen.fallback, REVEALED_WIDTH));

  // DEV concept 3: with the quick view open over a board that can't fit beside it, the panel floats over the
  // board (which keeps its full width) instead of squeezing it.
  const { width: windowWidth } = useViewportSize();
  const needed = columns.length * 180 + (columns.length - 1) * 12;
  const room = windowWidth - 230 - 2 * 28 + 12 - dockWidth(windowWidth);
  const overlay = n === 3 && !!openId && windowWidth >= 992 && needed > room;
  useEffect(() => {
    if (!overlay) return;
    document.documentElement.setAttribute("data-board-overlay", "");
    return () => document.documentElement.removeAttribute("data-board-overlay");
  }, [overlay]);

  // DEV concepts 3 and 4: when the quick view opens (or shows another card), the board scrolls sideways so the
  // card's column is clear of the panel, once the dock has slid in (350 ms).
  useEffect(() => {
    if (!keepInView || !openId) return;
    const timer = window.setTimeout(() => {
      const viewport = viewportRef.current;
      const card = columnsRef.current?.querySelector(`[data-panel-opener="${CSS.escape(openId)}"]`);
      const column = card?.closest("[data-col-key]");
      if (!viewport || !column) return;
      const view = viewport.getBoundingClientRect();
      const aside = document.querySelector(".mantine-AppShell-aside")?.getBoundingClientRect();
      const right = Math.min(view.right, aside && aside.width ? aside.left : view.right) - 16;
      const box = column.getBoundingClientRect();
      const left = view.left + 8;
      const by = box.right > right ? box.right - right : box.left < left ? box.left - left : 0;
      if (by) viewport.scrollBy({ left: by, behavior: "smooth" });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [keepInView, openId]);

  // DEV concept 4: how many columns are out of sight either side, for the edge fades and their buttons.
  const [hidden, setHidden] = useState({ left: 0, right: 0 });
  const countHidden = () => {
    const viewport = viewportRef.current;
    if (!edgeHints || !viewport || !columnsRef.current) return;
    const view = viewport.getBoundingClientRect();
    let left = 0;
    let right = 0;
    for (const el of columnsRef.current.querySelectorAll(":scope > [data-col-key]")) {
      const box = el.getBoundingClientRect();
      if (box.left < view.left - 1 && box.right - view.left < box.width / 2) left++;
      else if (box.right > view.right + 1 && view.right - box.left < box.width / 2) right++;
    }
    setHidden((h) => (h.left === left && h.right === right ? h : { left, right }));
  };
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!edgeHints || !viewport) return;
    countHidden();
    const observer = new ResizeObserver(countHidden);
    observer.observe(viewport);
    if (columnsRef.current) observer.observe(columnsRef.current);
    return () => observer.disconnect();
  });
  const page = (direction: 1 | -1) => {
    const viewport = viewportRef.current;
    if (viewport) viewport.scrollBy({ left: direction * viewport.clientWidth * 0.8, behavior: "smooth" });
  };

  const onDragStart = (event: DragStartEvent) => {
    // Each column keeps the width it had when the card was picked up.
    const widths = new Map<string, number>();
    let fallback = 0;
    for (const el of columnsRef.current?.querySelectorAll<HTMLElement>(":scope > [data-col-key]") ?? []) {
      if (el.hasAttribute("data-collapsed")) continue;
      const width = el.getBoundingClientRect().width;
      widths.set(el.dataset.colKey!, width);
      if (!fallback) fallback = width;
    }
    setFrozen({ widths, fallback: fallback || 180 });
    setActive((event.active.data.current?.row as ApplicationRow) ?? null);
  };
  const stopDragging = () => {
    setActive(null);
    setFrozen(null);
  };
  const onDragEnd = (event: DragEndEvent) => {
    const row = event.active.data.current?.row as ApplicationRow | undefined;
    stopDragging();
    if (!row) return;
    const over = event.over ? String(event.over.id) : undefined;
    const plan = planDrop(workflow, row, over, ownColumn(row.id));
    if (plan.do === "refuse")
      notifications.show({ color: "orange", title: plan.title, message: plan.message });
    if (plan.do !== "move") return;
    const notice = plan.notice;
    move.request(
      { id: row.id, to_stage: plan.to, stageName: names.get(plan.to) },
      row,
      notice ? () => notifications.show({ message: notice }) : undefined,
    );
  };

  return (
    <Stack gap="xs" className={classes.board}>
      <Group gap="lg">
        <Switch
          label={t("board.showClosed")}
          checked={showClosed}
          onChange={(e) => setShowClosed(e.currentTarget.checked)}
          size="xs"
        />
        <Switch
          label={t("board.byRound")}
          checked={byRound}
          onChange={(e) => setByRound(e.currentTarget.checked)}
          size="xs"
        />
      </Group>
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={stopDragging}
        accessibility={{ announcements: announcements(rows, titles) }}
      >
        <div className={concept.edges}>
          <ScrollArea
            type="auto"
            offsetScrollbars="x"
            classNames={{ content: classes.scroller }}
            viewportRef={viewportRef}
            onScrollPositionChange={countHidden}
          >
            <Group ref={columnsRef} align="flex-start" wrap="nowrap" gap="sm" pb="sm">
              {items.map((item) =>
                item.kind === "group" ? (
                  <RoundGroup
                    key={item.key}
                    columns={item.columns}
                    layout={n === 2 ? "side" : "lanes"}
                    width={widthFor(item.key)}
                    dropStateFor={dropStateFor}
                    onOpen={onOpen}
                  />
                ) : (
                  <StageColumn
                    key={columnKey(item.column)}
                    column={item.column}
                    collapsed={folds && !item.column.rows.length}
                    width={widthFor(columnKey(item.column))}
                    onOpen={onOpen}
                    dropState={dropStateFor(item.column)}
                  />
                ),
              )}
              {/* DEV concept 3: room to scroll the last columns out from under the floating panel. */}
              {overlay && <div aria-hidden style={{ flex: `0 0 ${dockWidth(windowWidth) - 12}px` }} />}
            </Group>
          </ScrollArea>
          {edgeHints && hidden.left > 0 && (
            <div className={concept.fadeLeft}>
              <Button size="compact-xs" variant="default" radius="xl" onClick={() => page(-1)}>
                {moreLabel(hidden.left, -1)}
              </Button>
            </div>
          )}
          {edgeHints && hidden.right > 0 && (
            <div className={concept.fadeRight}>
              <Button size="compact-xs" variant="default" radius="xl" onClick={() => page(1)}>
                {moreLabel(hidden.right, 1)}
              </Button>
            </div>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {active && (
            <Card withBorder mod="nested" shadow="md">
              <CardBody row={active} link={false} />
            </Card>
          )}
        </DragOverlay>
      </DndContext>
      {move.dialog}
      <BoardConceptSwitch />
    </Stack>
  );
}

/** The board while it loads: columns that share the width as the real ones do. */
export function BoardSkeleton() {
  return (
    <Group className={classes.board} gap="sm" wrap="nowrap" align="flex-start" style={{ overflow: "hidden" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className={classes.column} height={420} radius="md" />
      ))}
    </Group>
  );
}
