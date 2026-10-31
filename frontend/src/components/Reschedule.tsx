import { Badge, Button, Group, Modal, Stack, Text, Textarea, Tooltip } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import dayjs from "dayjs";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useSaveInterview, type Interview } from "../api/interviewHooks";
import { roundLabel } from "../utils/rounds";
import { formatDateTime } from "../utils/time";

const PICKER = "YYYY-MM-DD HH:mm:ss";

/** "Rescheduled" (or "Rescheduled ×2") on a round that moved, with the time it moved from. */
export function RescheduledBadge({
  interview,
  size = "sm",
}: {
  interview: Pick<Interview, "rescheduled_count" | "rescheduled_from">;
  size?: "xs" | "sm";
}) {
  const { t } = useTranslation("interviews");
  const n = interview.rescheduled_count;
  if (!n) return null;
  const badge = (
    <Badge size={size} variant="light" color="yellow">
      {n > 1 ? t("reschedule.badgeTimes", { times: n }) : t("reschedule.badge")}
    </Badge>
  );
  if (!interview.rescheduled_from) return badge;
  return (
    <Tooltip
      label={t("reschedule.movedFrom", { when: formatDateTime(interview.rescheduled_from) })}
      withArrow
    >
      {badge}
    </Tooltip>
  );
}

/**
 * Move a booked round to a new time, and say why if you like (it goes on the application's
 * timeline). Its end moves with it, so it lasts as long as before.
 */
export function RescheduleModal({ interview, onClose }: { interview: Interview; onClose: () => void }) {
  const { t } = useTranslation(["interviews", "common"]);
  const save = useSaveInterview();
  const [when, setWhen] = useState<string | null>(
    interview.starts_at ? dayjs(interview.starts_at).format(PICKER) : null,
  );
  const [reason, setReason] = useState("");
  // To the minute: a change of seconds or fractions alone is no move.
  const moved = when !== null && !dayjs(when).isSame(dayjs(interview.starts_at), "minute");
  const submit = () => {
    if (!when) return;
    const startsAt = dayjs(when);
    const length = interview.ends_at ? dayjs(interview.ends_at).diff(dayjs(interview.starts_at)) : null;
    save.mutate(
      {
        id: interview.id,
        body: {
          starts_at: startsAt.toISOString(),
          ...(length !== null ? { ends_at: startsAt.add(length, "ms").toISOString() } : {}),
          reschedule_reason: reason.trim() || null,
        },
      },
      { onSuccess: onClose },
    );
  };
  return (
    <Modal
      opened
      onClose={onClose}
      title={t("reschedule.named", { label: roundLabel(interview) })}
      // While saving, nothing closes it: if the save fails, what you typed is still here.
      closeOnEscape={!save.isPending}
      closeOnClickOutside={!save.isPending}
      withCloseButton={!save.isPending}
    >
      <Stack>
        <Text size="sm" c="dimmed">
          {interview.starts_at
            ? t("reschedule.whereWas", {
                company: interview.company_name,
                role: interview.role_title,
                when: formatDateTime(interview.starts_at),
              })
            : t("reschedule.where", { company: interview.company_name, role: interview.role_title })}
        </Text>
        <DateTimePicker label={t("reschedule.newTime")} value={when} onChange={setWhen} data-autofocus />
        <Textarea
          label={t("reschedule.why")}
          placeholder={t("reschedule.whyPlaceholder")}
          maxLength={500}
          autosize
          minRows={2}
          value={reason}
          onChange={(e) => {
            const value = e.currentTarget.value;
            setReason(value);
          }}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            {t("common:actions.cancel")}
          </Button>
          <Button onClick={submit} disabled={!moved} loading={save.isPending}>
            {t("reschedule.action")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
