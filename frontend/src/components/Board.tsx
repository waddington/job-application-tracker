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
import { Anchor, Badge, Card, Group, Paper, ScrollArea, Skeleton, Stack, Switch, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { Link } from "@tanstack/react-router";
import { useRef, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import classes from "./Board.module.css";
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
import { ago } from "../utils/time";
import { RoundBadge } from "./Interviews";

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

function CardBody({ row, link = true }: { row: ApplicationRow; link?: boolean }) {
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
      {row.current_round && row.stage_kind === "active" && (
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

function DraggableCard({ row, onOpen }: { row: ApplicationRow; onOpen: (id: string) => void }) {
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
      <CardBody row={row} />
    </Card>
  );
}

/** The width a closed stage's column comes in at when it only shows for a drag. */
const REVEALED_WIDTH = 200;

function StageColumn({
  column,
  dropState,
  width,
  onOpen,
}: {
  column: Column;
  dropState: "idle" | "suggested" | "allowed" | "blocked";
  /** Set while a card is dragged: the column's width stays put (see Board.module.css). */
  width?: number;
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("applications");
  const { setNodeRef, isOver } = useDroppable({ id: columnKey(column) });
  const closed = column.stage.kind !== "active";
  // Usual next stages stand out; any other stage still takes the drop (unless the workflow
  // is set to configured transitions, when it's faded out).
  const border =
    dropState === "suggested"
      ? `2px dashed var(--jat-chart-${isOver ? "teal" : "blue"})`
      : dropState === "allowed"
        ? `1px dashed var(--jat-chart-${isOver ? "teal" : "gray"})`
        : "1px solid transparent";
  return (
    // A soft well of the page's tint, so its cards stand out.
    <Paper
      ref={setNodeRef}
      variant="well"
      className={classes.column}
      data-frozen={width !== undefined || undefined}
      p="xs"
      radius="lg"
      style={{
        border,
        opacity: dropState === "blocked" ? 0.45 : 1,
        transition: "opacity 120ms",
        ...(width !== undefined && ({ "--board-column-width": `${width}px` } as CSSProperties)),
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

export function Board({
  workflow,
  rows,
  onOpen,
}: {
  workflow: Workflow;
  rows: ApplicationRow[];
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("applications");
  const [active, setActive] = useState<ApplicationRow | null>(null);
  // While dragging: the columns' widths when the card was picked up, and which columns were showing then.
  const [frozen, setFrozen] = useState<{ width: number; shown: Set<string> } | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
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
  const names = new Map(workflow.stages.map((s) => [s.id, s.name]));
  const titles = new Map(columns.map((c) => [columnKey(c), columnTitle(c)]));
  const ownColumn = (id: string) => {
    const column = columns.find((c) => c.rows.some((r) => r.id === id));
    return column ? columnKey(column) : undefined;
  };

  const onDragStart = (event: DragStartEvent) => {
    // Every column has the one flex rule (.column in Board.module.css: the same basis, minimum and maximum), so
    // they are all the same width and the first one says what they all are.
    const width = columnsRef.current?.firstElementChild?.getBoundingClientRect().width;
    if (width) setFrozen({ width, shown: new Set(columns.map(columnKey)) });
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
        <ScrollArea type="auto" offsetScrollbars="x" classNames={{ content: classes.scroller }}>
          <Group ref={columnsRef} align="flex-start" wrap="nowrap" gap="sm" pb="sm">
            {columns.map((column) => (
              <StageColumn
                key={columnKey(column)}
                column={column}
                width={
                  !frozen
                    ? undefined
                    : frozen.shown.has(columnKey(column))
                      ? frozen.width
                      : Math.min(frozen.width, REVEALED_WIDTH)
                }
                onOpen={onOpen}
                dropState={
                  !active || columnKey(column) === ownColumn(active.id)
                    ? "idle"
                    : isRoundColumn(columnKey(column)) || column.stage.id === active.stage
                      ? "blocked"
                      : !canDrop(workflow, active.stage, column.stage.id)
                        ? "blocked"
                        : isSuggested(workflow, active.stage, column.stage.id)
                          ? "suggested"
                          : "allowed"
                }
              />
            ))}
          </Group>
        </ScrollArea>
        <DragOverlay dropAnimation={null}>
          {active && (
            <Card withBorder mod="nested" shadow="md">
              <CardBody row={active} link={false} />
            </Card>
          )}
        </DragOverlay>
      </DndContext>
      {move.dialog}
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
