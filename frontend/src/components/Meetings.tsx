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
import { IconDots, IconPhone } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState, type ReactNode } from "react";

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
const isLink = (v: string) => (!v || /^https?:\/\//.test(v) ? null : "Links start with http:// or https://");

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
  const { data: contacts } = useContacts();
  const { data: apps } = useApplications({});
  const save = useSaveMeeting();
  const form = useForm<Values>({
    initialValues: fromMeeting(meeting, contactId, status),
    validate: {
      contactId: (v) => (v ? null : "Who is it with?"),
      startsAt: (v) => (v ? null : "When is it?"),
      meetingUrl: isLink,
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

  const title = meeting ? (status === "done" ? "How did it go?" : `Edit ${meeting.label}`) : "Book a call";
  return (
    <Modal opened={opened} onClose={onClose} title={title} size="lg">
      <form onSubmit={submit}>
        <Stack>
          <Group grow align="flex-start">
            <Select
              label="With"
              placeholder="Pick a person"
              searchable
              data={(contacts ?? []).map((c) => ({ value: c.id, label: c.name }))}
              disabled={!!contactId && !meeting}
              {...form.getInputProps("contactId")}
            />
            <TextInput
              label="About"
              placeholder="Market catch-up, roles at Contoso…"
              {...form.getInputProps("title")}
            />
          </Group>
          <Group grow align="flex-start">
            <DateTimePicker label="When" valueFormat="D MMM YYYY HH:mm" {...form.getInputProps("startsAt")} />
            <div>
              <Text size="sm" fw={500} mb={4}>
                How
              </Text>
              <SegmentedControl fullWidth data={MEETING_KINDS} {...form.getInputProps("kind")} />
            </div>
          </Group>
          <div>
            <Text size="sm" fw={500} mb={4}>
              Status
            </Text>
            <SegmentedControl
              data={[
                { value: "scheduled", label: "Booked" },
                { value: "done", label: "Happened" },
                { value: "cancelled", label: "Didn't happen" },
              ]}
              {...form.getInputProps("status")}
            />
          </div>
          {form.values.kind === "in_person" ? (
            <TextInput
              label="Where"
              placeholder="Coffee shop, their office…"
              {...form.getInputProps("location")}
            />
          ) : (
            <TextInput
              label={form.values.kind === "video" ? "Meeting link" : "Link (optional)"}
              placeholder="https://…"
              {...form.getInputProps("meetingUrl")}
            />
          )}
          <Select
            label="About an application (optional)"
            description="If it's about one role you've applied for. It then shows on that application's timeline too."
            placeholder="Not about one application"
            searchable
            clearable
            data={(apps ?? []).map((a) => ({ value: a.id, label: `${a.company_name} · ${a.role_title}` }))}
            {...form.getInputProps("applicationId")}
          />
          {!done && (
            <Textarea
              label="Agenda"
              description="What to ask, what to tell them. Markdown works."
              autosize
              minRows={2}
              {...form.getInputProps("agenda")}
            />
          )}
          {done && (
            <Textarea
              label="How did it go?"
              description="What you talked about, roles they mentioned, next steps. Markdown works."
              autosize
              minRows={3}
              data-autofocus
              {...form.getInputProps("notes")}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={save.isPending}>
              {meeting ? "Save" : done ? "Log call" : "Book call"}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  scheduled: { label: "Booked", color: "blue" },
  done: { label: "Happened", color: "teal" },
  cancelled: { label: "Didn't happen", color: "gray" },
};

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
  const where = meeting.agency_name ?? meeting.company_name;
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <div style={{ minWidth: 0 }}>
        <Text fw={600} size="sm" truncate="end">
          {meeting.label}
        </Text>
        <Group gap={6}>
          {showWho && (
            <Anchor component={Link} to={`/people/${meeting.contact_id}`} size="xs">
              {meeting.contact_name}
              {where ? ` · ${where}` : ""}
            </Anchor>
          )}
          {meeting.application_id && (
            <Anchor component={Link} to={`/applications/${meeting.application_id}`} size="xs">
              {meeting.application_company_name} · {meeting.role_title}
            </Anchor>
          )}
          {meeting.meeting_url && meeting.status === "scheduled" && (
            <Anchor href={meeting.meeting_url} target="_blank" rel="noreferrer" size="xs">
              Join link
            </Anchor>
          )}
        </Group>
      </div>
      <Group gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" ta="right">
          {formatDateTime(meeting.starts_at)}
        </Text>
        {action}
      </Group>
    </Group>
  );
}

/** "Happened" (opens the form to say how it went) and "Didn't happen", for a call whose time has passed. */
export function MeetingOutcome({ meeting }: { meeting: Meeting }) {
  const save = useSaveMeeting();
  const [closing, setClosing] = useState(false);
  return (
    <Group gap={4} wrap="nowrap">
      <Button size="compact-xs" variant="light" color="teal" onClick={() => setClosing(true)}>
        Happened
      </Button>
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        loading={save.isPending}
        onClick={() => save.mutate({ id: meeting.id, body: { status: "cancelled" } })}
      >
        Didn't happen
      </Button>
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
  const del = useDeleteMeeting();
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`More for ${meeting.label}`}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onEdit}>Edit</Menu.Item>
        <Menu.Item color="red" onClick={() => del.mutate(meeting.id)}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** A person's calls and meetings: booked ones first, then what happened, with notes. */
export function MeetingsCard({ contactId, name }: { contactId: string; name: string }) {
  const { data: meetings } = useMeetings({ contact_id: contactId });
  const [editing, setEditing] = useState<Meeting | "new" | null>(null);
  const [now] = useState(() => Date.now()); // when the page opened: good enough to split ahead from past
  const all = meetings ?? [];
  const ahead = all.filter((m) => m.status === "scheduled" && new Date(m.starts_at).getTime() >= now);
  const toClose = all.filter((m) => m.status === "scheduled" && new Date(m.starts_at).getTime() < now);
  const past = all.filter((m) => m.status !== "scheduled").reverse(); // newest first

  return (
    <Card withBorder>
      <Group justify="space-between" mb="sm">
        <Title order={4}>Calls and meetings</Title>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPhone size={14} />}
          onClick={() => setEditing("new")}
        >
          Book a call
        </Button>
      </Group>
      {all.length === 0 ? (
        <Text size="sm" c="dimmed">
          No calls with {name} yet. Book one, or log one you've had.
        </Text>
      ) : (
        <Stack gap="sm">
          {[...ahead, ...toClose].map((m) => (
            <MeetingLine
              key={m.id}
              meeting={m}
              showWho={false}
              action={
                <Group gap={4} wrap="nowrap">
                  {toClose.includes(m) && <MeetingOutcome meeting={m} />}
                  <MeetingMenu meeting={m} onEdit={() => setEditing(m)} />
                </Group>
              }
            />
          ))}
          {past.map((m) => (
            <Stack key={m.id} gap={4}>
              <MeetingLine
                meeting={m}
                showWho={false}
                action={
                  <Group gap={4} wrap="nowrap">
                    <Badge size="xs" variant="light" color={STATUS_BADGE[m.status]?.color}>
                      {STATUS_BADGE[m.status]?.label ?? m.status}
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
            </Stack>
          ))}
        </Stack>
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
