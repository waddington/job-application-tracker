import { ActionIcon, Anchor, Badge, Button, Card, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconCalendarEvent, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";

import type { ApplicationRow } from "../api/client";
import { useContacts } from "../api/hooks";
import { useDeleteInterview, useInterviews, type Interview } from "../api/interviewHooks";
import { formatDateTime } from "../utils/time";
import { InterviewFormModal } from "./InterviewFormModal";

const STATUS_COLOR: Record<string, string> = { scheduled: "blue", done: "teal", cancelled: "gray" };
const STATUS_LABEL: Record<string, string> = { scheduled: "Coming up", done: "Done", cancelled: "Cancelled" };

/** The round an application is at ("Round 2 · System design test"), for cards, rows and headers. */
export function RoundBadge({
  round,
  size = "sm",
}: {
  round: ApplicationRow["current_round"];
  size?: "xs" | "sm";
}) {
  if (!round) return null;
  const when = round.starts_at ?? round.deadline_at;
  return (
    <Tooltip
      label={when ? formatDateTime(when) : STATUS_LABEL[round.status]}
      disabled={!when && round.status !== "done"}
    >
      <Badge
        size={size}
        variant="light"
        color="violet"
        leftSection={<IconCalendarEvent size={12} />}
        style={{ textTransform: "none", maxWidth: "100%" }}
      >
        {round.label}
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
  const remove = useDeleteInterview();
  const when = interview.starts_at ?? interview.deadline_at;
  const people = interview.interviewer_ids.map((id) => names.get(id)).filter(Boolean);
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={4}>
          <Group gap="xs">
            <Text fw={600}>{interview.label}</Text>
            <Badge size="xs" variant="light" color={STATUS_COLOR[interview.status]}>
              {STATUS_LABEL[interview.status]}
            </Badge>
          </Group>
          <Text size="sm" c="dimmed">
            {[
              when
                ? `${interview.deadline_at && !interview.starts_at ? "Due " : ""}${formatDateTime(when)}`
                : "Not booked yet",
              people.length ? `with ${people.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </Text>
          {interview.meeting_url && (
            <Anchor href={interview.meeting_url} target="_blank" rel="noreferrer" size="sm">
              Join link
            </Anchor>
          )}
          {interview.debrief && (
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }} lineClamp={3}>
              {interview.debrief}
            </Text>
          )}
        </Stack>
        <Group gap={2} wrap="nowrap">
          <Tooltip label="Edit">
            <ActionIcon variant="subtle" color="gray" onClick={onEdit} aria-label={`Edit ${interview.label}`}>
              <IconPencil size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Delete">
            <ActionIcon
              variant="subtle"
              color="gray"
              loading={remove.isPending}
              onClick={() => {
                if (window.confirm(`Delete ${interview.label}?`)) remove.mutate(interview.id);
              }}
              aria-label={`Delete ${interview.label}`}
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
          <Title order={4}>Interviews</Title>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconPlus size={14} />}
            onClick={() => setEditing(null)}
          >
            Add round {nextRound}
          </Button>
        </Group>
        {rounds.map((i) => (
          <InterviewItem key={i.id} interview={i} names={names} onEdit={() => setEditing(i)} />
        ))}
        {interviews && !rounds.length && (
          <Text size="sm" c="dimmed">
            No interviews yet. Add each round as it's booked: "Round 1 · Recruiter screen", "Round 2 ·
            Engineering manager chat"…
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
