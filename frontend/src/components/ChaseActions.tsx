import { ActionIcon, Button, Group, Menu, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBellRinging, IconGhost2, IconZzz } from "@tabler/icons-react";
import dayjs from "dayjs";

import type { ApplicationRow } from "../api/client";
import { useMoveApplication, useUpdateApplication, useWorkflow } from "../api/hooks";

const inDays = (n: number) => dayjs().add(n, "day").format("YYYY-MM-DD");

const FOLLOW_UP = [
  { label: "Tomorrow", days: 1 },
  { label: "In 3 days", days: 3 },
  { label: "Next week", days: 7 },
];
const SNOOZE = [
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];

/**
 * One-click chasing for Next actions (PRD FR18): set a follow-up date, snooze, or give up and
 * mark it Ghosted. Every move is on the timeline and can be undone from the application.
 */
export function ChaseActions({ row }: { row: ApplicationRow }) {
  const update = useUpdateApplication();
  const move = useMoveApplication();
  const { data: workflow } = useWorkflow();
  const ghosted = workflow?.stages.find((s) => s.id === "ghosted");
  // Only offer Ghosted where the workflow allows that move (always, with any-to-any moves).
  const canGhost =
    !!ghosted &&
    row.stage !== ghosted.id &&
    (workflow?.transitions === "any" ||
      !!workflow?.stages.find((s) => s.id === row.stage)?.allowed_next.includes(ghosted.id));
  const busy = update.isPending || move.isPending;

  const set = (body: { follow_up_on?: string; snoozed_until?: string }, message: string) =>
    update.mutate(
      { id: row.id, body },
      { onSuccess: () => notifications.show({ message: `${row.company_name}: ${message}` }) },
    );

  return (
    <Group gap={2} wrap="nowrap">
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Tooltip label="Follow up on…">
            <ActionIcon
              variant="subtle"
              color="blue"
              loading={update.isPending}
              disabled={busy}
              aria-label={`Follow up on ${row.company_name}`}
            >
              <IconBellRinging size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Remind me to follow up</Menu.Label>
          {FOLLOW_UP.map((o) => (
            <Menu.Item
              key={o.days}
              onClick={() => set({ follow_up_on: inDays(o.days) }, `follow up ${o.label.toLowerCase()}`)}
            >
              {o.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Tooltip label="Snooze">
            <ActionIcon
              variant="subtle"
              color="gray"
              disabled={busy}
              aria-label={`Snooze ${row.company_name}`}
            >
              <IconZzz size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Snooze for</Menu.Label>
          {SNOOZE.map((o) => (
            <Menu.Item
              key={o.days}
              onClick={() => set({ snoozed_until: inDays(o.days) }, `snoozed for ${o.label}`)}
            >
              {o.label}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      {ghosted && canGhost && (
        <Tooltip label={`Mark as ${ghosted.name}`}>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconGhost2 size={14} />}
            loading={move.isPending}
            disabled={busy}
            aria-label={`Mark ${row.company_name} as ${ghosted.name}`}
            onClick={() => {
              if (
                !window.confirm(
                  `Mark ${row.company_name} as ${ghosted.name}? (You can undo it from the application.)`,
                )
              )
                return;
              move.mutate(
                { id: row.id, to_stage: ghosted.id, stageName: ghosted.name, note: "No reply" },
                {
                  onSuccess: () =>
                    notifications.show({ message: `${row.company_name} marked ${ghosted.name}` }),
                },
              );
            }}
          >
            {ghosted.name}
          </Button>
        </Tooltip>
      )}
    </Group>
  );
}
