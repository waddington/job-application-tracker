import {
  Alert,
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
  IconExternalLink,
  IconMail,
  IconMessage,
  IconNote,
  IconPhone,
  IconProgress,
} from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import type { ApiEvent, ApplicationDetail } from "../api/client";
import {
  stageLookup,
  useApplication,
  useLogActivity,
  useMoveApplication,
  useUndoMove,
  useWorkflow,
} from "../api/hooks";
import { ago, formatDate, formatDateTime } from "../utils/time";
import { DuplicateWarning } from "./DuplicateWarning";
import { StageBadge } from "./StageBadge";

const ACTIVITY_ICONS: Record<string, typeof IconNote> = {
  call: IconPhone,
  email: IconMail,
  message: IconMessage,
  note: IconNote,
  stage_change: IconProgress,
};

function newestFirst(events: ApiEvent[]): ApiEvent[] {
  return [...events].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
}

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

/** Title, company, badges, move/undo and key facts. Used by the drawer and the full page. */
export function ApplicationSummary({ app }: { app: ApplicationDetail }) {
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const names = new Map([...stages.values()].map((s) => [s.id, s.name]));
  const move = useMoveApplication();
  const undo = useUndoMove();
  return (
    <Stack>
      <div>
        <Title order={3}>{app.role_title}</Title>
        <Anchor component={Link} to={`/companies/${app.company_id}`} c="dimmed">
          {app.company_name}
        </Anchor>
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
      <DuplicateWarning duplicates={app.duplicates} title="Also applied for this job" />

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
              <Menu.Item
                key={stageId}
                onClick={() => move.mutate({ id: app.id, to_stage: stageId, stageName: names.get(stageId) })}
              >
                {names.get(stageId) ?? stageId}
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
        <Button
          size="xs"
          variant="default"
          leftSection={<IconArrowBackUp size={14} />}
          disabled={!app.can_undo}
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
    </Stack>
  );
}

export function ApplicationTimeline({ app }: { app: ApplicationDetail }) {
  const { data: workflow } = useWorkflow();
  const names = new Map((workflow?.stages ?? []).map((s) => [s.id, s.name]));
  return (
    <Timeline active={app.events.length} bulletSize={22} lineWidth={2}>
      {newestFirst(app.events).map((event) => {
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
  );
}

export function ApplicationLoadError({ error }: { error: unknown }) {
  return (
    <Alert color="red" title="Couldn't load this application">
      {error instanceof Error ? error.message : "Something went wrong."}
    </Alert>
  );
}

export { LogActivity };

export function ApplicationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: app, isLoading, isError, error } = useApplication(id);
  return (
    <Drawer opened={!!id} onClose={onClose} position="right" size="lg" title="Application">
      {isError ? (
        <ApplicationLoadError error={error} />
      ) : isLoading || !app ? (
        <Loader />
      ) : (
        <Stack>
          <ApplicationSummary app={app} />
          <Button
            component={Link}
            to={`/applications/${app.id}`}
            variant="light"
            size="xs"
            rightSection={<IconExternalLink size={14} />}
            onClick={onClose}
          >
            Open full page
          </Button>
          <Divider label="Log activity" labelPosition="left" />
          <LogActivity key={app.id} id={app.id} />
          <Divider label="Timeline" labelPosition="left" />
          <ApplicationTimeline app={app} />
        </Stack>
      )}
    </Drawer>
  );
}
