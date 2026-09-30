import {
  Anchor,
  Badge,
  Button,
  Divider,
  Drawer,
  Group,
  Loader,
  Menu,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Timeline,
  Title,
} from "@mantine/core";
import {
  IconArrowBackUp,
  IconArrowRight,
  IconMail,
  IconMessage,
  IconNote,
  IconPhone,
  IconProgress,
} from "@tabler/icons-react";
import { useState } from "react";

import type { ApiEvent } from "../api/client";
import {
  stageLookup,
  useApplication,
  useLogActivity,
  useMoveApplication,
  useUndoMove,
  useWorkflow,
} from "../api/hooks";
import { ago, formatDate, formatDateTime } from "../utils/time";
import { StageBadge } from "./StageBadge";

const ACTIVITY_ICONS: Record<string, typeof IconNote> = {
  call: IconPhone,
  email: IconMail,
  message: IconMessage,
  note: IconNote,
  stage_change: IconProgress,
};

function eventTitle(event: ApiEvent, names: Map<string, string>): string {
  if (event.kind === "stage_change") {
    const to = names.get(event.to_stage ?? "") ?? event.to_stage;
    if (!event.from_stage) return `Added as ${to}`;
    const undo = (event.data as { undo_of?: string } | undefined)?.undo_of;
    return undo ? `Undone: back to ${to}` : `${names.get(event.from_stage) ?? event.from_stage} → ${to}`;
  }
  return event.kind.charAt(0).toUpperCase() + event.kind.slice(1);
}

function LogActivity({ id }: { id: string }) {
  const [kind, setKind] = useState<"call" | "email" | "message" | "note">("call");
  const [summary, setSummary] = useState("");
  const log = useLogActivity();
  return (
    <Stack gap="xs">
      <SegmentedControl
        size="xs"
        value={kind}
        onChange={(v) => setKind(v as typeof kind)}
        data={[
          { value: "call", label: "Call" },
          { value: "email", label: "Email" },
          { value: "message", label: "Message" },
          { value: "note", label: "Note" },
        ]}
      />
      <Textarea
        placeholder="What happened?"
        autosize
        minRows={2}
        value={summary}
        onChange={(e) => setSummary(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button
          size="xs"
          disabled={!summary.trim()}
          loading={log.isPending}
          onClick={() =>
            log.mutate(
              { id, body: { kind, summary: summary.trim(), data: {} } },
              { onSuccess: () => setSummary("") },
            )
          }
        >
          Log {kind}
        </Button>
      </Group>
    </Stack>
  );
}

export function ApplicationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: app, isLoading } = useApplication(id);
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const names = new Map([...stages.values()].map((s) => [s.id, s.name]));
  const move = useMoveApplication();
  const undo = useUndoMove();
  const moves = app?.events.filter((e) => e.kind === "stage_change" && e.from_stage) ?? [];

  return (
    <Drawer opened={!!id} onClose={onClose} position="right" size="lg" title="Application">
      {isLoading || !app ? (
        <Loader />
      ) : (
        <Stack>
          <div>
            <Title order={3}>{app.role_title}</Title>
            <Text c="dimmed">{app.company_name}</Text>
          </div>
          <Group gap="xs">
            <StageBadge stage={stages.get(app.stage)} fallback={app.stage_name} />
            {app.stale && (
              <Badge color="red" variant="light">
                Needs chasing
              </Badge>
            )}
            {app.archived && <Badge variant="outline">Archived</Badge>}
            {app.tags.map((t) => (
              <Badge key={t} variant="dot" color="gray">
                {t}
              </Badge>
            ))}
          </Group>
          <Group gap="xs">
            <Menu shadow="md" position="bottom-start">
              <Menu.Target>
                <Button
                  size="xs"
                  rightSection={<IconArrowRight size={14} />}
                  disabled={!app.allowed_next.length}
                  loading={move.isPending}
                >
                  Move to…
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                {app.allowed_next.map((stageId) => (
                  <Menu.Item key={stageId} onClick={() => move.mutate({ id: app.id, to_stage: stageId })}>
                    {names.get(stageId) ?? stageId}
                  </Menu.Item>
                ))}
              </Menu.Dropdown>
            </Menu>
            <Button
              size="xs"
              variant="default"
              leftSection={<IconArrowBackUp size={14} />}
              disabled={!moves.length}
              loading={undo.isPending}
              onClick={() => undo.mutate(app.id)}
            >
              Undo last move
            </Button>
          </Group>

          <Stack gap={4}>
            <Text size="sm">
              <b>Route:</b>{" "}
              {app.route === "agency"
                ? `Through ${[app.recruiter_name, app.agency_name].filter(Boolean).join(" at ") || "an agency"}`
                : app.route === "referral"
                  ? "Referral"
                  : "Applied directly"}
            </Text>
            <Text size="sm">
              <b>Applied on:</b> {formatDate(app.applied_on)}
            </Text>
            <Text size="sm">
              <b>Last activity:</b> {ago(app.days_since_activity)}
            </Text>
            {app.follow_up_on && (
              <Text size="sm">
                <b>Follow up on:</b> {formatDate(app.follow_up_on)}
              </Text>
            )}
          </Stack>

          <Divider label="Log activity" labelPosition="left" />
          <LogActivity id={app.id} />

          <Divider label="Timeline" labelPosition="left" />
          <Timeline active={app.events.length} bulletSize={22} lineWidth={2}>
            {[...app.events].reverse().map((event) => {
              const Icon = ACTIVITY_ICONS[event.kind] ?? IconNote;
              return (
                <Timeline.Item key={event.id} bullet={<Icon size={12} />} title={eventTitle(event, names)}>
                  {event.summary && event.kind !== "stage_change" && <Text size="sm">{event.summary}</Text>}
                  {event.summary && event.kind === "stage_change" && event.from_stage && (
                    <Text size="sm" c="dimmed">
                      {event.summary}
                    </Text>
                  )}
                  <Text size="xs" c="dimmed">
                    {formatDateTime(event.occurred_at)}
                  </Text>
                </Timeline.Item>
              );
            })}
          </Timeline>
          <Anchor size="xs" c="dimmed">
            The full application page (notes, interviews, documents) is coming with later roadmap tasks.
          </Anchor>
        </Stack>
      )}
    </Drawer>
  );
}
