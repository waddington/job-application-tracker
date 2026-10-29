import { ActionIcon, Badge, Button, Group, Text, Tooltip } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconGhost2, IconRefresh, IconSend, IconThumbDown, IconX } from "@tabler/icons-react";
import dayjs from "dayjs";
import { useTranslation } from "react-i18next";

import type { Contact } from "../api/client";
import { useSetPersonReply } from "../api/peopleHooks";
import { i18n } from "../i18n";
import { formatDate } from "../utils/time";

/** "Ghosted" or "Not interested"; anything else is shown as stored. */
export const closedLabel = (closedAs: string) =>
  closedAs === "ghosted"
    ? i18n.t("people:chase.ghosted")
    : closedAs === "not_interested"
      ? i18n.t("people:chase.notInterested")
      : closedAs;

const today = () => dayjs().format("YYYY-MM-DD");

const takenOff = (c: Contact) =>
  c.closed_as === "ghosted"
    ? i18n.t("people:chase.notAGhostDone", { name: c.name })
    : i18n.t("people:chase.removeNotInterestedDone", { name: c.name });

/** Where the conversation stood, so an Undo can put it back exactly. */
const before = (c: Contact) => ({
  awaiting_reply_since: c.awaiting_reply_since ?? null,
  reply_to_read_since: c.reply_to_read_since ?? null,
  chased_on: c.chased_on ?? null,
  closed_as: c.closed_as ?? null,
  closed_on: c.closed_on ?? null,
});

/**
 * Chase someone, or stop expecting anything from them, as small labelled buttons (`compact` in
 * lists): **Chased** (you sent a nudge; you're
 * waiting again from today), **Ghosted** or **Not interested** (they leave Today). Each
 * says what it did, with an Undo.
 */
function useAct(contact: Contact) {
  const update = useSetPersonReply();
  const act = (body: Parameters<typeof update.mutate>[0]["body"], message: string) => {
    const was = before(contact);
    update.mutate(
      { id: contact.id, body },
      {
        onSuccess: () => {
          const id = notifications.show({
            autoClose: 8000, // long enough to reach Undo from the keyboard
            message: (
              <Group justify="space-between" wrap="nowrap" gap="xs">
                <Text size="sm">{message}</Text>
                <Button
                  size="compact-xs"
                  variant="light"
                  onClick={() => {
                    notifications.hide(id);
                    update.mutate({ id: contact.id, body: was });
                  }}
                >
                  {i18n.t("common:actions.undo")}
                </Button>
              </Group>
            ),
          });
        },
      },
    );
  };
  return { act, pending: update.isPending };
}

export function PersonChase({ contact, compact }: { contact: Contact; compact?: boolean }) {
  const { t } = useTranslation("people");
  const { act, pending } = useAct(contact);
  const size = compact ? "compact-xs" : "xs";
  return (
    <Group gap={4} wrap="nowrap">
      <Tooltip label={t("chase.chasedHint")}>
        <Button
          size={size}
          variant="light"
          color="blue"
          leftSection={<IconSend size={14} />}
          disabled={pending}
          onClick={() => act({ chased_on: today() }, t("chase.chasedDone", { name: contact.name }))}
          aria-label={t("chase.chasedWho", { name: contact.name })}
        >
          {t("chase.chased")}
        </Button>
      </Tooltip>
      <Tooltip label={t("chase.ghostedHint")}>
        <Button
          size={size}
          variant="subtle"
          color="gray"
          leftSection={<IconGhost2 size={14} />}
          disabled={pending}
          onClick={() =>
            act({ closed_as: "ghosted", closed_on: today() }, t("chase.ghostedDone", { name: contact.name }))
          }
          aria-label={t("chase.ghostedWho", { name: contact.name })}
        >
          {t("chase.ghosted")}
        </Button>
      </Tooltip>
      <Tooltip label={t("chase.notInterestedHint")}>
        <Button
          size={size}
          variant="subtle"
          color="gray"
          leftSection={<IconThumbDown size={14} />}
          disabled={pending}
          onClick={() =>
            act(
              { closed_as: "not_interested", closed_on: today() },
              t("chase.notInterestedDone", { name: contact.name }),
            )
          }
          aria-label={t("chase.notInterestedWho", { name: contact.name })}
        >
          {t("chase.notInterested")}
        </Button>
      </Tooltip>
    </Group>
  );
}

/** "Chased 2 days ago" when the waiting started with a chase, else "Waiting 5 days". */
export function waitingOrChased(person: Contact, waitingLabel: (since: string) => string): string {
  const since = person.awaiting_reply_since!;
  if (person.chased_on && person.chased_on === since) {
    const days = Math.max(0, dayjs().startOf("day").diff(dayjs(since), "day"));
    return days === 0
      ? i18n.t("people:chase.chasedToday")
      : days === 1
        ? i18n.t("people:chase.chasedYesterday")
        : i18n.t("people:chase.chasedDaysAgo", { count: days });
  }
  return waitingLabel(since);
}

/** "Ghosted · 5 Oct 2026" with a button to take it off, for someone you've stopped expecting anything from. */
export function PersonClosed({ contact }: { contact: Contact }) {
  const { t } = useTranslation("people");
  const { act, pending } = useAct(contact);
  if (!contact.closed_as) return null;
  return (
    <Group gap={6} wrap="nowrap">
      <Badge color="gray" variant="light" style={{ textTransform: "none" }}>
        {contact.closed_on
          ? t("chase.closedOn", { what: closedLabel(contact.closed_as), date: formatDate(contact.closed_on) })
          : closedLabel(contact.closed_as)}
      </Badge>
      <Tooltip
        label={
          contact.closed_as === "ghosted" ? t("chase.notAGhostHint") : t("chase.removeNotInterestedHint")
        }
      >
        <Button
          size="xs"
          variant="light"
          color="gray"
          leftSection={<IconRefresh size={14} />}
          loading={pending}
          onClick={() => act({ closed_as: null }, takenOff(contact))}
        >
          {contact.closed_as === "ghosted" ? t("chase.notAGhost") : t("chase.removeNotInterested")}
        </Button>
      </Tooltip>
    </Group>
  );
}

/** A small undo on a Ghosted or Not interested chip (the Recruiters tiles). */
export function UndoClosed({ contact }: { contact: Contact }) {
  const { t } = useTranslation("people");
  const { act, pending } = useAct(contact);
  const what = contact.closed_as === "ghosted" ? t("chase.ghosted") : t("chase.notInterested");
  return (
    <Tooltip
      label={contact.closed_as === "ghosted" ? t("chase.notAGhostShort") : t("chase.removeNotInterestedHint")}
    >
      <ActionIcon
        size={20}
        variant="subtle"
        color="gray"
        radius="xl"
        aria-label={t("chase.takeOff", { what, name: contact.name })}
        loading={pending}
        onClick={() => act({ closed_as: null }, takenOff(contact))}
      >
        <IconX size={12} />
      </ActionIcon>
    </Tooltip>
  );
}
