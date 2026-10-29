import { ActionIcon, Button, Group, Menu, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconBellRinging, IconGhost2, IconZzz } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import type { ApplicationRow } from "../api/client";
import { useMoveApplication, useUpdateApplication, useWorkflow } from "../api/hooks";

const inDays = (n: number) => dayjs().add(n, "day").format("YYYY-MM-DD");

// Each choice's label, and what the toast says once it's set ("Contoso: follow up tomorrow").
const FOLLOW_UP = [
  { label: "chase.tomorrow", done: "chase.followUpTomorrow", days: 1 },
  { label: "chase.in3Days", done: "chase.followUpIn3Days", days: 3 },
  { label: "chase.nextWeek", done: "chase.followUpNextWeek", days: 7 },
] as const;
const SNOOZE = [
  { label: "chase.days3", done: "chase.snoozed3Days", days: 3 },
  { label: "chase.week1", done: "chase.snoozed1Week", days: 7 },
  { label: "chase.weeks2", done: "chase.snoozed2Weeks", days: 14 },
] as const;

/**
 * One-click chasing on Today (PRD FR18): set a follow-up date, snooze, or give up and
 * mark it Ghosted. Every move is on the timeline and can be undone from the application.
 */
export function ChaseActions({ row }: { row: ApplicationRow }) {
  const { t } = useTranslation("today");
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
    update.mutate({ id: row.id, body }, { onSuccess: () => notifications.show({ message }) });

  return (
    <Group gap={2} wrap="nowrap">
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Tooltip label={t("chase.followUpOn")}>
            <ActionIcon
              variant="subtle"
              color="blue"
              loading={update.isPending}
              disabled={busy}
              aria-label={t("chase.followUpOnWho", { company: row.company_name })}
            >
              <IconBellRinging size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t("chase.remindMe")}</Menu.Label>
          {FOLLOW_UP.map((o) => (
            <Menu.Item
              key={o.days}
              onClick={() => set({ follow_up_on: inDays(o.days) }, t(o.done, { company: row.company_name }))}
            >
              {t(o.label)}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Tooltip label={t("chase.snooze")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              disabled={busy}
              aria-label={t("chase.snoozeWho", { company: row.company_name })}
            >
              <IconZzz size={16} />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>{t("chase.snoozeFor")}</Menu.Label>
          {SNOOZE.map((o) => (
            <Menu.Item
              key={o.days}
              onClick={() => set({ snoozed_until: inDays(o.days) }, t(o.done, { company: row.company_name }))}
            >
              {t(o.label)}
            </Menu.Item>
          ))}
        </Menu.Dropdown>
      </Menu>
      {ghosted && canGhost && (
        <Tooltip label={t("chase.markAs", { stage: ghosted.name })}>
          <Button
            size="compact-xs"
            variant="subtle"
            color="gray"
            leftSection={<IconGhost2 size={14} />}
            loading={move.isPending}
            disabled={busy}
            aria-label={t("chase.markWhoAs", { company: row.company_name, stage: ghosted.name })}
            onClick={() => {
              if (!window.confirm(t("chase.markConfirm", { company: row.company_name, stage: ghosted.name })))
                return;
              move.mutate(
                // The note is saved on the timeline in English until events carry message keys
                // (docs/rfc/i18n.md, i18n-events).
                { id: row.id, to_stage: ghosted.id, stageName: ghosted.name, note: "No reply" },
                {
                  onSuccess: () =>
                    notifications.show({
                      message: t("chase.marked", { company: row.company_name, stage: ghosted.name }),
                    }),
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
