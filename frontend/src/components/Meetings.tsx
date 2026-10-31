import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { IconDots, IconPhone, IconPlus } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState, type ReactNode } from "react";
import { Trans, useTranslation } from "react-i18next";

import { PersonName } from "./GhostMark";
import { useApplications, useContacts } from "../api/hooks";
import {
  MEETING_KINDS,
  useDeleteMeeting,
  useMeetings,
  useSaveMeeting,
  type Meeting,
  type MeetingKind,
} from "../api/meetingHooks";
import { Markdown } from "./Markdown";
import { MeetingDidntHappen } from "./OutcomeNotes";
import { RoleFormModal, RoleLine } from "./Roles";
import { useRoleSummaries } from "../api/roleHooks";
import { i18n } from "../i18n";
import { callLabel } from "../utils/calls";
import { formatDateTime } from "../utils/time";

type Status = "scheduled" | "done" | "cancelled";

interface Values {
  contactId: string | null;
  kind: NonNullable<MeetingKind>;
  title: string;
  status: Status;
  startsAt: string | null;
  location: string;
  meetingUrl: string;
  applicationId: string | null;
  agenda: string;
  notes: string;
}

const PICKER = "YYYY-MM-DD HH:mm:ss";
const blank = (s: string) => s.trim() || null;
const LINK = /^https?:\/\//;

/** Next whole hour, as a sensible default time for a call you're booking. */
const nextHour = () => dayjs().add(1, "hour").startOf("hour").format(PICKER);

function fromMeeting(
  meeting: Meeting | null,
  contactId: string | undefined,
  status: Status | undefined,
): Values {
  return {
    contactId: meeting?.contact_id ?? contactId ?? null,
    kind: (meeting?.kind as NonNullable<MeetingKind> | undefined) ?? "call",
    title: meeting?.title ?? "",
    status: status ?? (meeting?.status as Status) ?? "scheduled",
    startsAt: meeting ? dayjs(meeting.starts_at).format(PICKER) : nextHour(),
    location: meeting?.location ?? "",
    meetingUrl: meeting?.meeting_url ?? "",
    applicationId: meeting?.application_id ?? null,
    agenda: meeting?.agenda ?? "",
    notes: meeting?.notes ?? "",
  };
}

/**
 * Book a call or meeting with someone, or log one you've had. Mount with a `key` per meeting
 * so the form starts fresh. `status` opens it straight at "done" (to say how it went).
 */
export function MeetingFormModal({
  opened,
  onClose,
  meeting,
  contactId,
  status,
}: {
  opened: boolean;
  onClose: () => void;
  meeting: Meeting | null;
  contactId?: string;
  status?: Status;
}) {
  const { t } = useTranslation(["calls", "common"]);
  const { data: contacts } = useContacts();
  const { data: apps } = useApplications({});
  const save = useSaveMeeting();
  const form = useForm<Values>({
    initialValues: fromMeeting(meeting, contactId, status),
    validate: {
      contactId: (v) => (v ? null : t("form.whoError")),
      startsAt: (v) => (v ? null : t("form.whenError")),
      meetingUrl: (v) => (!v || LINK.test(v) ? null : t("form.linkError")),
    },
  });
  const done = form.values.status === "done";

  const submit = form.onSubmit((v) => {
    const body = {
      contact_id: v.contactId!,
      kind: v.kind,
      title: blank(v.title),
      status: v.status,
      starts_at: dayjs(v.startsAt).toISOString(),
      location: blank(v.location),
      meeting_url: blank(v.meetingUrl),
      application_id: v.applicationId,
      agenda: blank(v.agenda),
      notes: blank(v.notes),
    };
    save.mutate(meeting ? { id: meeting.id, body } : { body }, { onSuccess: onClose });
  });

  const title = meeting
    ? status === "done"
      ? t("form.howDidItGoTitle")
      : t("form.editTitle", { label: callLabel(meeting) })
    : t("form.bookTitle");
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg">
      <form onSubmit={submit}>
        <Stack>
          <Group grow align="flex-start">
            <Select
              label={t("form.with")}
              placeholder={t("form.withPlaceholder")}
              searchable
              data={(contacts ?? []).map((c) => ({ value: c.id, label: c.name }))}
              disabled={!!contactId && !meeting}
              {...form.getInputProps("contactId")}
            />
            <TextInput
              label={t("form.about")}
              placeholder={t("form.aboutPlaceholder")}
              {...form.getInputProps("title")}
            />
          </Group>
          <Group grow align="flex-start">
            <DateTimePicker label={t("form.when")} {...form.getInputProps("startsAt")} />
            <div>
              <Text size="sm" fw={500} mb={4}>
                {t("form.how")}
              </Text>
              <SegmentedControl
                fullWidth
                aria-label={t("form.how")}
                data={MEETING_KINDS.map((k) => ({ value: k.value, label: i18n.t(k.key) }))}
                {...form.getInputProps("kind")}
              />
            </div>
          </Group>
          <div>
            <Text size="sm" fw={500} mb={4}>
              {t("form.status")}
            </Text>
            <SegmentedControl
              aria-label={t("form.status")}
              data={[
                { value: "scheduled", label: t("status.scheduled") },
                { value: "done", label: t("status.done") },
                { value: "cancelled", label: t("status.cancelled") },
              ]}
              {...form.getInputProps("status")}
            />
          </div>
          {form.values.kind === "in_person" ? (
            <TextInput
              label={t("form.where")}
              placeholder={t("form.wherePlaceholder")}
              {...form.getInputProps("location")}
            />
          ) : (
            <TextInput
              label={form.values.kind === "video" ? t("form.meetingLink") : t("form.linkOptional")}
              placeholder={t("form.linkPlaceholder")}
              {...form.getInputProps("meetingUrl")}
            />
          )}
          <Select
            label={t("form.application")}
            description={t("form.applicationHint")}
            placeholder={t("form.applicationPlaceholder")}
            searchable
            clearable
            data={(apps ?? []).map((a) => ({
              value: a.id,
              label: t("form.applicationOption", { company: a.company_name, role: a.role_title }),
            }))}
            {...form.getInputProps("applicationId")}
          />
          {!done && (
            <Textarea
              label={t("form.agenda")}
              description={t("form.agendaHint")}
              autosize
              minRows={2}
              {...form.getInputProps("agenda")}
            />
          )}
          {done && (
            <Textarea
              label={t("form.howDidItGo")}
              description={t("form.howDidItGoHint")}
              autosize
              minRows={3}
              data-autofocus
              {...form.getInputProps("notes")}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              {t("common:actions.cancel")}
            </Button>
            <Button type="submit" loading={save.isPending}>
              {meeting ? t("common:actions.save") : done ? t("form.log") : t("form.book")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

const STATUS_BADGE = {
  scheduled: { key: "calls:status.scheduled", color: "blue" },
  done: { key: "calls:status.done", color: "teal" },
  cancelled: { key: "calls:status.cancelled", color: "gray" },
} as const;

/** A past call's badge; a status the app doesn't know shows as saved. */
function statusBadge(status: string): { label: string; color?: string } {
  if (!Object.hasOwn(STATUS_BADGE, status)) return { label: status };
  const badge = STATUS_BADGE[status as keyof typeof STATUS_BADGE];
  return { label: i18n.t(badge.key), color: badge.color };
}

/** One call: what, when, who with; `action` sits on the right. */
export function MeetingLine({
  meeting,
  action,
  showWho = true,
}: {
  meeting: Meeting;
  action?: ReactNode;
  showWho?: boolean;
}) {
  const { t } = useTranslation("calls");
  const where = meeting.agency_name ?? meeting.company_name;
  const who = <PersonName id={meeting.contact_id} name={meeting.contact_name} size={12} />;
  // The date stays on one line beside the title; buttons get a line of their own underneath.
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <div style={{ minWidth: 0 }}>
          <Text fw={600} size="sm" truncate="end">
            {callLabel(meeting)}
          </Text>
          <Group gap={6}>
            {showWho && (
              <Anchor component={Link} to={`/people/${meeting.contact_id}`} size="xs">
                {where ? (
                  <Trans
                    t={t}
                    i18nKey="line.whoAt"
                    // Components, not values: <Trans> would read a "<" in a name as markup.
                    components={{ who, where: <>{where}</> }}
                  />
                ) : (
                  who
                )}
              </Anchor>
            )}
            {meeting.application_id && (
              <Anchor component={Link} to={`/applications/${meeting.application_id}`} size="xs">
                {t("line.application", {
                  company: meeting.application_company_name ?? "",
                  role: meeting.role_title ?? "",
                })}
              </Anchor>
            )}
            {meeting.meeting_url && meeting.status === "scheduled" && (
              <Anchor href={meeting.meeting_url} target="_blank" rel="noreferrer" size="xs">
                {t("line.joinLink")}
              </Anchor>
            )}
          </Group>
        </div>
        <Text size="xs" c="dimmed" ta="right" style={{ whiteSpace: "nowrap" }}>
          {formatDateTime(meeting.starts_at)}
        </Text>
      </Group>
      {action && (
        <Group gap={6} wrap="wrap">
          {action}
        </Group>
      )}
    </Stack>
  );
}

/** "Happened" (opens the form to say how it went) and "Didn't happen", for a call whose time has passed. */
export function MeetingOutcome({ meeting }: { meeting: Meeting }) {
  const { t } = useTranslation("calls");
  const [closing, setClosing] = useState(false);
  return (
    <Group gap={4} wrap="nowrap">
      <Button
        size="compact-xs"
        variant="light"
        color="teal"
        aria-label={t("happenedWho", { label: callLabel(meeting) })}
        onClick={() => setClosing(true)}
      >
        {t("happened")}
      </Button>
      <MeetingDidntHappen meeting={meeting} />
      {closing && (
        <MeetingFormModal
          key={meeting.id}
          opened
          onClose={() => setClosing(false)}
          meeting={meeting}
          status="done"
        />
      )}
    </Group>
  );
}

function MeetingMenu({ meeting, onEdit }: { meeting: Meeting; onEdit: () => void }) {
  const { t } = useTranslation(["calls", "common"]);
  const del = useDeleteMeeting();
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={t("moreFor", { label: callLabel(meeting) })}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onEdit}>{t("edit")}</Menu.Item>
        <Menu.Item color="red" onClick={() => del.mutate(meeting.id)}>
          {t("common:actions.delete")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** A person's calls and meetings: booked ones first, then what happened, with notes. */
export function MeetingsCard({ contactId, name }: { contactId: string; name: string }) {
  const { t } = useTranslation("calls");
  const { data: meetings } = useMeetings({ contact_id: contactId });
  const [editing, setEditing] = useState<Meeting | "new" | null>(null);
  const [addingRoles, setAddingRoles] = useState<string | null>(null); // the call they came up in
  const { data: roles } = useRoleSummaries({ contact_id: contactId });
  const [now] = useState(() => Date.now()); // when the page opened: good enough to split ahead from past
  const all = meetings ?? [];
  const ahead = all.filter((m) => m.status === "scheduled" && new Date(m.starts_at).getTime() >= now);
  const toClose = all.filter((m) => m.status === "scheduled" && new Date(m.starts_at).getTime() < now);
  const past = all.filter((m) => m.status !== "scheduled").reverse(); // newest first

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>{t("card.title")}</Title>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPhone size={14} />}
          onClick={() => setEditing("new")}
        >
          {t("card.book")}
        </Button>
      </Group>
      {all.length === 0 ? (
        <Text size="sm" c="dimmed">
          {t("card.empty", { name })}
        </Text>
      ) : (
        <Stack gap="sm">
          {[...ahead, ...toClose].map((m) => (
            <Stack key={m.id} gap={4}>
              <MeetingLine
                meeting={m}
                showWho={false}
                action={
                  <Group gap={4} wrap="nowrap">
                    {toClose.includes(m) && <MeetingOutcome meeting={m} />}
                    <MeetingMenu meeting={m} onEdit={() => setEditing(m)} />
                  </Group>
                }
              />
              {m.agenda && (
                <Text size="sm" component="div" c="dimmed">
                  <Markdown>{m.agenda}</Markdown>
                </Text>
              )}
              {(roles ?? [])
                .filter((r) => r.meeting_id === m.id)
                .map((r) => (
                  <RoleLine key={r.id} role={r} showSource={false} />
                ))}
            </Stack>
          ))}
          {past.map((m) => (
            <Stack key={m.id} gap={4}>
              <MeetingLine
                meeting={m}
                showWho={false}
                action={
                  <Group gap={4} wrap="nowrap">
                    <Badge size="xs" variant="light" color={statusBadge(m.status).color}>
                      {statusBadge(m.status).label}
                    </Badge>
                    <MeetingMenu meeting={m} onEdit={() => setEditing(m)} />
                  </Group>
                }
              />
              {m.notes && (
                <Text size="sm" component="div" c="dimmed">
                  <Markdown>{m.notes}</Markdown>
                </Text>
              )}
              {m.status === "done" && (
                <Stack
                  gap={4}
                  pl="sm"
                  style={{ borderLeft: "2px solid var(--mantine-color-default-border)" }}
                >
                  {(roles ?? [])
                    .filter((r) => r.meeting_id === m.id)
                    .map((r) => (
                      <RoleLine key={r.id} role={r} showSource={false} />
                    ))}
                  <Button
                    size="compact-xs"
                    variant="subtle"
                    leftSection={<IconPlus size={12} />}
                    onClick={() => setAddingRoles(m.id)}
                    style={{ alignSelf: "flex-start" }}
                  >
                    {t("card.addRoles")}
                  </Button>
                </Stack>
              )}
            </Stack>
          ))}
        </Stack>
      )}
      {addingRoles && (
        <RoleFormModal
          opened
          onClose={() => setAddingRoles(null)}
          contactId={contactId}
          meetingId={addingRoles}
        />
      )}
      {editing && (
        <MeetingFormModal
          key={editing === "new" ? "new" : editing.id}
          opened
          onClose={() => setEditing(null)}
          meeting={editing === "new" ? null : editing}
          contactId={contactId}
        />
      )}
    </Card>
  );
}
