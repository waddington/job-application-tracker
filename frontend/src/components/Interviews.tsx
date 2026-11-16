import { ActionIcon, Anchor, Badge, Button, Card, Group, Stack, Text, Title, Tooltip } from "@mantine/core";
import { IconCalendarEvent, IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import type { ApplicationRow } from "../api/client";
import { useContacts } from "../api/hooks";
import { useDeleteInterview, useInterviews, type Interview } from "../api/interviewHooks";
import { i18n } from "../i18n";
import { formatShortWeekday } from "../utils/format";
import { joinList } from "../utils/list";
import { roundLabel } from "../utils/rounds";
import { formatDateTime } from "../utils/time";
import { InterviewFormModal } from "./InterviewFormModal";
import { InterviewOutcome } from "./OutcomeNotes";
import { QueryState } from "./QueryState";
import { RescheduleButton, RescheduledBadge, RoundDaysMoved, wasText } from "./Reschedule";

type RoundLike = {
  status: string;
  starts_at: string | null;
  deadline_at: string | null;
  needs_new_time_since?: string | null;
};

/**
 * "Coming up", "Done", "Cancelled", "Awaiting outcome" for a scheduled round whose time has passed, or
 * "Needs a new time" for one that can't go ahead at its time.
 */
export function roundStatus(round: RoundLike): { label: string; color: string } {
  if (round.status === "scheduled" && round.needs_new_time_since) {
    return { label: i18n.t("interviews:needsNewTime.badge"), color: "red" };
  }
  const when = round.starts_at ?? round.deadline_at;
  if (round.status === "scheduled" && when && new Date(when) < new Date()) {
    return { label: i18n.t("interviews:status.awaitingOutcome"), color: "orange" };
  }
  if (round.status === "done") return { label: i18n.t("interviews:status.done"), color: "teal" };
  if (round.status === "cancelled") return { label: i18n.t("interviews:status.cancelled"), color: "gray" };
  return { label: i18n.t("interviews:status.comingUp"), color: "blue" };
}

const shortDate = (iso: string) => formatShortWeekday(iso, i18n.language);

// The round an application is at. A server from before `waiting_to_hear_back` doesn't send it:
// such a round shows just its name once done, as before.
type CurrentRound = Omit<NonNullable<ApplicationRow["current_round"]>, "waiting_to_hear_back"> & {
  waiting_to_hear_back?: boolean;
};

// The round's own badge is violet; the badge beside it for a round in between, waiting for a time or
// an answer, is pink: a colour no other badge, pill or stage uses (only the Timeline's lane for calls),
// which reads apart from violet in light and dark mode.
const ROUND_COLOR = "violet";
const STATE_COLOR = "pink";

export type RoundState = "notBooked" | "waiting" | "needsNewTime";

// Whole keys, so the unused-key scanner sees them and a missing one fails the type check.
const STATE_TEXT = {
  notBooked: "interviews:notBooked",
  waiting: "interviews:waitingToHearBack",
  needsNewTime: "interviews:needsNewTime.badge",
} as const;

/**
 * The round an application is at, as its badges say it: the round ("Round 2 · Technical", with its
 * day once booked: "· Thu 2 Oct", also once that has passed until it's marked done), and, for a round
 * in between, what it's waiting for, on a badge of its own. Decided here so every badge agrees:
 * - waiting for a new time: "Needs a new time" (no day: its old time isn't happening);
 * - not booked (no time or deadline, still to happen): "Not booked yet";
 * - done with nothing heard since: "Waiting to hear back". The server works that out
 *   (`waiting_to_hear_back`, see `waiting_to_hear_back` in domain/interviews.py): no stage move,
 *   offer or later round since it happened;
 * - otherwise (booked, or done and something has happened since) no state.
 */
export function roundBadge(round: CurrentRound): {
  text: string;
  color: string;
  state: { id: RoundState; text: string; color: string } | null;
} {
  const label = roundLabel(round);
  const when = round.starts_at ?? round.deadline_at;
  const as = (id: RoundState | null, text = label) => ({
    text,
    color: ROUND_COLOR,
    state: id && { id, text: i18n.t(STATE_TEXT[id]), color: STATE_COLOR },
  });
  if (round.status === "scheduled") {
    if (round.needs_new_time_since) return as("needsNewTime");
    if (when) return as(null, i18n.t("interviews:badgeWhen", { label, when: shortDate(when) }));
    return as("notBooked");
  }
  return as(round.status === "done" && round.waiting_to_hear_back ? "waiting" : null);
}

/**
 * The round an application is at ("Round 2 · System design test · Thu 2 Oct"), for cards, rows
 * and headers, with what it's waiting for beside it when it's in between. Only shown while the
 * application is in an active stage: once there's an offer or a rejection, the last round is history.
 */
export function RoundBadge({
  round,
  stageKind,
  size = "sm",
}: {
  round: CurrentRound | null | undefined;
  stageKind: string;
  size?: "xs" | "sm";
}) {
  useTranslation("interviews"); // re-renders on a language change: roundLabel goes through i18n.t
  if (!round || stageKind !== "active") return null;
  const when = round.starts_at ?? round.deadline_at;
  const pending = round.status === "scheduled" && !!round.needs_new_time_since;
  const { text, color, state } = roundBadge(round);
  return (
    // Side by side, or one under the other on a narrow card.
    <Group gap={4} wrap="wrap" style={{ maxWidth: "100%" }}>
      <Tooltip label={pending ? wasText(round) : when ? formatDateTime(when) : ""} disabled={!when}>
        <Badge
          size={size}
          variant="light"
          color={color}
          data-round-pill
          leftSection={<IconCalendarEvent size={12} />}
          // Wrap rather than cut off on narrow board cards.
          h="auto"
          py={2}
          style={{ textTransform: "none", maxWidth: "100%" }}
          styles={{ label: { whiteSpace: "normal", overflow: "visible", textAlign: "left" } }}
        >
          {text}
        </Badge>
      </Tooltip>
      {state && (
        // Like a card's Reply to read badge: small and light.
        <Badge size={size} variant="light" color={state.color} data-round-state={state.id}>
          {state.text}
        </Badge>
      )}
    </Group>
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
  const people = interview.interviewer_ids
    .map((id) => names.get(id))
    .filter((name): name is string => !!name);
  const label = roundLabel(interview);
  const whenText = interview.needs_new_time_since
    ? wasText(interview)
    : !when
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
            {people.length ? t("card.whenWith", { when: whenText, people: joinList(people) }) : whenText}
          </Text>
          <RoundDaysMoved interview={interview} />
          {/* Its own row, so the buttons on the right don't squeeze the round's details on a phone. */}
          <InterviewOutcome interview={interview} />
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

/** One skeleton block while the rounds load, a round's card's height. */
const ROUND_HEIGHT = 100;

/** Every interview round for one application, in round order, with add and edit. */
export function InterviewsCard({ applicationId }: { applicationId: string }) {
  const { t } = useTranslation("interviews");
  const interviews = useInterviews({ application_id: applicationId });
  const { data: contacts } = useContacts();
  const [editing, setEditing] = useState<Interview | null | undefined>(undefined); // undefined = closed, null = new
  const names = new Map((contacts ?? []).map((c) => [c.id, c.name]));
  const inOrder = (list: Interview[]) => [...list].sort((a, b) => (a.round ?? 0) - (b.round ?? 0));
  const rounds = interviews.data ?? [];
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
            // Until the rounds load it can't know the next round's number, and would offer round 1 again.
            disabled={interviews.data === undefined}
            onClick={() => setEditing(null)}
          >
            {t("card.addRound", { round: nextRound })}
          </Button>
        </Group>
        <QueryState
          query={interviews}
          select={inOrder}
          rows={1}
          rowHeight={ROUND_HEIGHT}
          empty={
            <Text size="sm" c="dimmed">
              {t("card.empty")}
            </Text>
          }
        >
          {(list) =>
            list.map((i) => (
              <InterviewItem key={i.id} interview={i} names={names} onEdit={() => setEditing(i)} />
            ))
          }
        </QueryState>
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
