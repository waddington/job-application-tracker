import { Badge, Button, Group } from "@mantine/core";
import { IconHourglass, IconMessageCheck } from "@tabler/icons-react";
import dayjs from "dayjs";

import { useUpdateApplication } from "../api/hooks";
import { useSetPersonWaiting } from "../api/peopleHooks";

/** Whole days since `since` (a YYYY-MM-DD in your time zone). */
export function daysWaiting(since: string): number {
  return Math.max(0, dayjs().startOf("day").diff(dayjs(since), "day"));
}

export function waitingLabel(since: string): string {
  const days = daysWaiting(since);
  return days === 0 ? "Waiting since today" : `Waiting ${days} day${days === 1 ? "" : "s"}`;
}

const today = () => dayjs().format("YYYY-MM-DD");

function WaitingToggle({
  since,
  pending,
  onChange,
  compact,
}: {
  since: string | null | undefined;
  pending: boolean;
  onChange: (since: string | null) => void;
  compact?: boolean;
}) {
  if (!since) {
    return (
      <Button
        size={compact ? "compact-xs" : "xs"}
        variant="light"
        color="grape"
        leftSection={<IconHourglass size={14} />}
        loading={pending}
        onClick={() => onChange(today())}
      >
        I've replied, waiting
      </Button>
    );
  }
  return (
    <Group gap={6} wrap="nowrap">
      {!compact && (
        <Badge color="grape" variant="light" leftSection={<IconHourglass size={12} />}>
          {waitingLabel(since)}
        </Badge>
      )}
      <Button
        size={compact ? "compact-xs" : "xs"}
        variant="light"
        color="teal"
        leftSection={<IconMessageCheck size={14} />}
        loading={pending}
        onClick={() => onChange(null)}
      >
        Heard back
      </Button>
    </Group>
  );
}

/** "I've replied, waiting to hear back" for an application; "Heard back" clears it. */
export function ApplicationWaiting({
  id,
  since,
  compact,
}: {
  id: string;
  since: string | null | undefined;
  compact?: boolean;
}) {
  const update = useUpdateApplication();
  return (
    <WaitingToggle
      since={since}
      compact={compact}
      pending={update.isPending}
      onChange={(value) => update.mutate({ id, body: { awaiting_reply_since: value } })}
    />
  );
}

/** The same for a person, for conversations that aren't about one application. */
export function PersonWaiting({
  id,
  since,
  compact,
}: {
  id: string;
  since: string | null | undefined;
  compact?: boolean;
}) {
  const update = useSetPersonWaiting();
  return (
    <WaitingToggle
      since={since}
      compact={compact}
      pending={update.isPending}
      onChange={(value) => update.mutate({ id, since: value })}
    />
  );
}
