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
} from "@dnd-kit/core";
import { Badge, Card, Group, Paper, ScrollArea, Stack, Switch, Text } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useState } from "react";

import type { ApplicationRow } from "../api/client";
import { useMoveApplication, type Workflow } from "../api/hooks";
import { buildColumns, canDrop, visibleColumns, type Column } from "../utils/board";
import { ago } from "../utils/time";

function CardBody({ row }: { row: ApplicationRow }) {
  const via =
    row.route === "agency"
      ? row.recruiter_name || row.agency_name
      : row.route === "referral"
        ? "Referral"
        : null;
  return (
    <>
      <Text fw={600} size="sm" lineClamp={1}>
        {row.company_name}
      </Text>
      <Text size="xs" c="dimmed" lineClamp={2}>
        {row.role_title}
      </Text>
      <Group gap={6} mt={6} justify="space-between" wrap="nowrap">
        <Text size="xs" c={row.stale ? "red" : "dimmed"} fw={row.stale ? 600 : undefined}>
          {ago(row.days_since_activity)}
        </Text>
        {via && (
          <Text size="xs" c="dimmed" lineClamp={1}>
            {via}
          </Text>
        )}
      </Group>
    </>
  );
}

function DraggableCard({ row, onOpen }: { row: ApplicationRow; onOpen: (id: string) => void }) {
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
      onClick={() => onOpen(row.id)}
      aria-label={`${row.company_name}: ${row.role_title}`}
      {...attributes}
      {...listeners}
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
  dropState: "idle" | "allowed" | "blocked";
  onOpen: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.stage.id });
  const closed = column.stage.kind !== "active";
  const border =
    dropState === "allowed"
      ? `2px dashed var(--mantine-color-${isOver ? "teal" : "blue"}-5)`
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
      aria-label={`${column.stage.name} column`}
    >
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Badge color={column.stage.color} variant={closed ? "outline" : "light"} radius="sm">
          {column.stage.name}
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
  const [active, setActive] = useState<ApplicationRow | null>(null);
  const [showClosed, setShowClosed] = useState(false);
  const move = useMoveApplication();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), // clicks still open the card
    useSensor(KeyboardSensor),
  );
  const columns = visibleColumns(buildColumns(workflow, rows), { showClosed, dragging: !!active });
  const names = new Map(workflow.stages.map((s) => [s.id, s.name]));

  const onDragStart = (event: DragStartEvent) =>
    setActive((event.active.data.current?.row as ApplicationRow) ?? null);
  const onDragEnd = (event: DragEndEvent) => {
    const row = event.active.data.current?.row as ApplicationRow | undefined;
    setActive(null);
    const to = event.over?.id as string | undefined;
    if (!row || !to || to === row.stage) return;
    if (!canDrop(workflow, row.stage, to)) {
      notifications.show({
        color: "orange",
        title: "That move isn't allowed",
        message: `${names.get(row.stage) ?? row.stage} can't go to ${names.get(to) ?? to}.`,
      });
      return;
    }
    move.mutate({ id: row.id, to_stage: to });
  };

  return (
    <Stack gap="xs">
      <Switch
        label="Show closed stages"
        checked={showClosed}
        onChange={(e) => setShowClosed(e.currentTarget.checked)}
        size="xs"
      />
      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActive(null)}
      >
        <ScrollArea type="auto" offsetScrollbars>
          <Group align="flex-start" wrap="nowrap" gap="sm" pb="sm">
            {columns.map((column) => (
              <StageColumn
                key={column.stage.id}
                column={column}
                onOpen={onOpen}
                dropState={
                  !active || column.stage.id === active.stage
                    ? "idle"
                    : canDrop(workflow, active.stage, column.stage.id)
                      ? "allowed"
                      : "blocked"
                }
              />
            ))}
          </Group>
        </ScrollArea>
        <DragOverlay>
          {active && (
            <Card withBorder padding="xs" radius="md" shadow="md" w={240}>
              <CardBody row={active} />
            </Card>
          )}
        </DragOverlay>
      </DndContext>
    </Stack>
  );
}
