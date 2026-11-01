import { ActionIcon, Anchor, Badge, Button, Card, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconCalendarEvent, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ApplicationRow } from "../api/client";
import { useContacts } from "../api/hooks";
import { useDeleteInterview, useInterviews, type Interview } from "../api/interviewHooks";
import { i18n } from "../i18n";
import { formatShortWeekday } from "../utils/format";
import { roundLabel } from "../utils/rounds";
import { formatDateTime } from "../utils/time";
import { InterviewFormModal } from "./InterviewFormModal";
import { RescheduleButton, RescheduledBadge, RoundDaysMoved } from "./Reschedule";

type RoundLike = { status: string; starts_at: string | null; deadline_at: string | null };

/** "Coming up", "Done", "Cancelled", or "Awaiting outcome" for a scheduled round whose time has passed. */
export function roundStatus(round: RoundLike): { label: string; color: string } {
  const when = round.starts_at ?? round.deadline_at;
  if (round.status === "scheduled" && when && new Date(when) < new Date()) {
    return { label: i18n.t("interviews:status.awaitingOutcome"), color: "orange" };
  }
  if (round.status === "done") return { label: i18n.t("interviews:status.done"), color: "teal" };
  if (round.status === "cancelled") return { label: i18n.t("interviews:status.cancelled"), color: "gray" };
  return { label: i18n.t("interviews:status.comingUp"), color: "blue" };
}

const shortDate = (iso: string) => formatShortWeekday(iso, i18n.language);

/**
 * The round an application is at ("Round 2 · System design test · Thu 2 Oct"), for cards, rows
 * and headers. Only shown while the application is in an active stage: once there's an offer or
 * a rejection, the last round is history.
 */
export function RoundBadge({
  round,
  stageKind,
  size = "sm",
}: {
  round: ApplicationRow["current_round"];
  stageKind: string;
  size?: "xs" | "sm";
}) {
  useTranslation("interviews"); // re-renders on a language change: roundLabel goes through i18n.t
  if (!round || stageKind !== "active") return null;
  const when = round.starts_at ?? round.deadline_at;
  const upcoming = round.status === "scheduled" && when;
  const label = roundLabel(round);
  return (
    <Tooltip label={when ? formatDateTime(when) : ""} disabled={!when}>
      <Badge
        size={size}
        variant="light"
        color="violet"
        leftSection={<IconCalendarEvent size={12} />}
        // Wrap rather than cut off on narrow board cards.
        h="auto"
        py={2}
        style={{ textTransform: "none", maxWidth: "100%" }}
        styles={{ label: { whiteSpace: "normal", overflow: "visible", textAlign: "left" } }}
      >
        {upcoming ? i18n.t("interviews:badgeWhen", { label, when: shortDate(when) }) : label}
      </Badge>
    </Tooltip>
  );
}

function InterviewItem({
  interview,
  names,
  onEdit,
}: {
  interview: Interview;
  names: Map<string, string>;
  onEdit: () => void;
}) {
  const { t } = useTranslation(["interviews", "common"]);
  const remove = useDeleteInterview();
  const when = interview.starts_at ?? interview.deadline_at;
  const people = interview.interviewer_ids.map((id) => names.get(id)).filter(Boolean);
  const label = roundLabel(interview);
  const whenText = !when
    ? t("notBooked")
    : interview.starts_at
      ? formatDateTime(when)
      : t("due", { when: formatDateTime(when) });
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Group gap="xs">
            <Text fw={600}>{label}</Text>
            <Badge size="xs" variant="light" color={roundStatus(interview).color}>
              {roundStatus(interview).label}
            </Badge>
            <RescheduledBadge interview={interview} size="xs" />
          </Group>
          <Text size="sm" c="dimmed">
            {people.length ? t("card.whenWith", { when: whenText, people: people.join(", ") }) : whenText}
          </Text>
          <RoundDaysMoved interview={interview} />
          {interview.meeting_url && (
            <Anchor href={interview.meeting_url} target="_blank" rel="noreferrer" size="sm">
              {t("card.joinLink")}
            </Anchor>
          )}
          {interview.debrief && (
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }} lineClamp={3}>
              {interview.debrief}
            </Text>
          )}
        </Stack>
        <Group gap={2} wrap="nowrap">
          <RescheduleButton interview={interview} />
          <Tooltip label={t("edit")}>
            <ActionIcon variant="subtle" color="gray" onClick={onEdit} aria-label={t("editNamed", { label })}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t("common:actions.delete")}>
            <ActionIcon
              variant="subtle"
              color="gray"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm(t("deleteConfirm", { label }))) remove.mutate(interview.id);
              }}
              aria-label={t("common:actions.deleteNamed", { name: label })}
            >
              <IconTrash size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>
    </Card>
  );
}

/** Every interview round for one application, in round order, with add and edit. */
export function InterviewsCard({ applicationId }: { applicationId: string }) {
  const { t } = useTranslation("interviews");
  const { data: interviews } = useInterviews({ application_id: applicationId });
  const { data: contacts } = useContacts();
  const [editing, setEditing] = useState<Interview | null | undefined>(undefined); // undefined = closed, null = new
  const names = new Map((contacts ?? []).map((c) => [c.id, c.name]));
  const rounds = [...(interviews ?? [])].sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  const nextRound = Math.max(0, ...rounds.map((i) => i.round ?? 0)) + 1;

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={4}>{t("card.title")}</Title>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setEditing(null)}
          >
            {t("card.addRound", { round: nextRound })}
          </Button>
        </Group>
        {rounds.map((i) => (
          <InterviewItem key={i.id} interview={i} names={names} onEdit={() => setEditing(i)} />
        ))}
        {interviews && !rounds.length && (
          <Text size="sm" c="dimmed">
            {t("card.empty")}
          </Text>
        )}
      </Stack>
      {editing !== undefined && (
        <InterviewFormModal
          key={editing?.id ?? "new"}
          opened
          onClose={() => setEditing(undefined)}
          applicationId={applicationId}
          interview={editing}
          nextRound={nextRound}
        />
      )}
    </Card>
  );
}
