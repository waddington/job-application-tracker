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
import { Badge, Card, Group, Paper, ScrollArea, Stack, Switch, Text } from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PersonMarks } from "./GhostMark";
import type { ApplicationRow } from "../api/client";
import { i18n } from "../i18n";
import { useMoveApplication, type Workflow } from "../api/hooks";
import {
  buildColumns,
  canDrop,
  columnKey,
  columnTitle,
  isRoundColumn,
  isSuggested,
  splitByRound,
  stageOfColumn,
  visibleColumns,
  type Column,
} from "../utils/board";
import { ago } from "../utils/time";
import { RoundBadge } from "./Interviews";

// Space picks a card up and drops it; Enter is left free to open the card.
const KEYBOARD_CODES = { start: ["Space"], cancel: ["Escape"], end: ["Space"] };

/** Screen-reader messages in words (company, stage names) rather than ids. */
function announcements(rows: ApplicationRow[], titles: Map<string, string>): Announcements {
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

function CardBody({ row }: { row: ApplicationRow }) {
  const { t } = useTranslation("applications");
  const via =
    row.route === "agency"
      ? row.recruiter_name || row.agency_name
      : row.route === "referral"
        ? t("routes.referral")
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
        <Text size="xs" c={row.stale ? "red" : "dimmed"} fw={row.stale ? 600 : undefined}>
          {ago(row.days_since_activity)}
        </Text>
        {via && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {row.route === "agency" && row.recruiter_name && <PersonMarks id={row.recruiter_id} size={12} />}
            {via}
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
      padding="xs"
      radius="md"
      style={{
        opacity: isDragging ? 0.4 : 1,
        cursor: "grab",
        borderLeft: row.stale ? "3px solid var(--mantine-color-red-6)" : undefined,
      }}
      aria-label={t("board.card", { company: row.company_name, role: row.role_title })}
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

function StageColumn({
  column,
  dropState,
  onOpen,
}: {
  column: Column;
  dropState: "idle" | "suggested" | "allowed" | "blocked";
  onOpen: (id: string) => void;
}) {
  const { t } = useTranslation("applications");
  const { setNodeRef, isOver } = useDroppable({ id: columnKey(column) });
  const closed = column.stage.kind !== "active";
  // Usual next stages stand out; any other stage still takes the drop (unless the workflow
  // is set to configured transitions, when it's faded out).
  const border =
    dropState === "suggested"
      ? `2px dashed var(--mantine-color-${isOver ? "teal" : "blue"}-5)`
      : dropState === "allowed"
        ? `1px dashed var(--mantine-color-${isOver ? "teal-5" : "gray-5"})`
        : "1px solid var(--mantine-color-default-border)";
  return (
    <Paper
      ref={setNodeRef}
      w={closed ? 200 : 250}
      miw={closed ? 200 : 250}
      p="xs"
      radius="md"
      bg="var(--mantine-color-default-hover)"
      style={{ border, opacity: dropState === "blocked" ? 0.45 : 1, transition: "opacity 120ms" }}
      aria-label={t("board.column", { title: columnTitle(column) })}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Badge color={column.stage.color} variant={closed ? "outline" : "light"} radius="sm">
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
  const [showClosed, setShowClosed] = useState(false);
  // Remembered: a column per interview round, or one per stage.
  const [byRound, setByRound] = useLocalStorage<boolean>({
    key: "jat.board.byRound",
    defaultValue: false,
    getInitialValueInEffect: false,
  });
  const move = useMoveApplication();
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

  const onDragStart = (event: DragStartEvent) =>
    setActive((event.active.data.current?.row as ApplicationRow) ?? null);
  const onDragEnd = (event: DragEndEvent) => {
    const row = event.active.data.current?.row as ApplicationRow | undefined;
    setActive(null);
    const over = event.over ? String(event.over.id) : undefined;
    const to = over ? stageOfColumn(over) : undefined;
    if (!row || !to || !over || over === ownColumn(row.id)) return;
    // Within a split stage a card's column is its round, which comes from its interviews; and
    // a card coming in can't skip ahead to a round.
    if (to === row.stage && over !== to) {
      notifications.show({
        color: "orange",
        title: t("board.roundsInOrder"),
        message: t("board.roundFromInterviews"),
      });
      return;
    }
    if (isRoundColumn(over)) {
      notifications.show({
        color: "orange",
        title: t("board.roundsInOrder"),
        message: t("board.dropOnNoRound", { stage: names.get(to) ?? to }),
      });
      return;
    }
    if (to === row.stage) return;
    if (!canDrop(workflow, row.stage, to)) {
      notifications.show({
        color: "orange",
        title: t("board.notAllowed"),
        message: t("board.cantGo", { from: names.get(row.stage) ?? row.stage, to: names.get(to) ?? to }),
      });
      return;
    }
    move.mutate({ id: row.id, to_stage: to, stageName: names.get(to) });
    if (workflow.stages.find((s) => s.id === to)?.kind !== "active") {
      notifications.show({
        message: t("board.moved", { company: row.company_name, stage: names.get(to) ?? to }),
      });
    }
  };

  return (
    <Stack gap="xs">
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
        onDragCancel={() => setActive(null)}
        accessibility={{ announcements: announcements(rows, titles) }}
      >
        <ScrollArea type="auto" offsetScrollbars>
          <Group align="flex-start" wrap="nowrap" gap="sm" pb="sm">
            {columns.map((column) => (
              <StageColumn
                key={columnKey(column)}
                column={column}
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
            <Card withBorder padding="xs" radius="md" shadow="md" w={228}>
              <CardBody row={active} />
            </Card>
          )}
        </DragOverlay>
      </DndContext>
    </Stack>
  );
}
