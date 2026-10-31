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
import { Trans, useTranslation } from "react-i18next";

import { PersonMarks } from "./GhostMark";
import type { ApiEvent, ApplicationDetail } from "../api/client";
import { errorText } from "../api/notifyError";
import { eventText } from "./eventText";
import {
  stageLookup,
  useApplication,
  useLogActivity,
  useMoveApplication,
  useUndoMove,
  useWorkflow,
} from "../api/hooks";
import { i18n } from "../i18n";
import { ago, formatDate, formatDateTime } from "../utils/time";
import { AtAGlance } from "./AtAGlance";
import { DuplicateWarning } from "./DuplicateWarning";
import { RoundBadge } from "./Interviews";
import { StageBadge } from "./StageBadge";
import { ApplicationWaiting } from "./Waiting";

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

// An event's kind to its title; a kind not listed shows as it is, capitalised.
const KIND_TITLES = {
  call: "applications:timeline.kinds.call",
  email: "applications:timeline.kinds.email",
  message: "applications:timeline.kinds.message",
  note: "applications:timeline.kinds.note",
  file: "applications:timeline.kinds.file",
  interview: "applications:timeline.kinds.interview",
  manual: "applications:timeline.kinds.manual",
} as const;

const isKnownKind = (kind: string): kind is keyof typeof KIND_TITLES => Object.hasOwn(KIND_TITLES, kind);

function eventTitle(event: ApiEvent, names: Map<string, string>): string {
  if (event.kind === "stage_change") {
    const to = names.get(event.to_stage ?? "") ?? event.to_stage ?? "";
    if (!event.from_stage) return i18n.t("applications:timeline.added", { stage: to });
    const undo = (event.data as { undo_of?: string } | undefined)?.undo_of;
    return undo
      ? i18n.t("applications:timeline.undone", { stage: to })
      : i18n.t("applications:timeline.moved", { from: names.get(event.from_stage) ?? event.from_stage, to });
  }
  if (isKnownKind(event.kind)) return i18n.t(KIND_TITLES[event.kind]);
  return event.kind.charAt(0).toUpperCase() + event.kind.slice(1);
}

// The log button names the kind of activity: "Log call".
const LOG_BUTTON = {
  call: "log.submit.call",
  email: "log.submit.email",
  message: "log.submit.message",
  note: "log.submit.note",
} as const;

function LogActivity({ id }: { id: string }) {
  const { t } = useTranslation("applications");
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
          { value: "call", label: t("log.kinds.call") },
          { value: "email", label: t("log.kinds.email") },
          { value: "message", label: t("log.kinds.message") },
          { value: "note", label: t("log.kinds.note") },
        ]}
      />
      <Textarea
        placeholder={t("log.placeholder")}
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
          {t(LOG_BUTTON[kind])}
        </Button>
      </Group>
    </Stack>
  );
}

/** Title, company, badges, move/undo and key facts. Used by the drawer and the full page. */
export function ApplicationSummary({ app }: { app: ApplicationDetail }) {
  const { t } = useTranslation("applications");
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  const names = new Map([...stages.values()].map((s) => [s.id, s.name]));
  const move = useMoveApplication();
  const undo = useUndoMove();
  // Usual next stages first; with any-to-any moves, every other stage follows.
  const usual = app.allowed_next.filter((id) => app.suggested_next.includes(id));
  const others = app.allowed_next.filter((id) => !app.suggested_next.includes(id));
  const moveItem = (stageId: string) => (
    <Menu.Item
      key={stageId}
      onClick={() => move.mutate({ id: app.id, to_stage: stageId, stageName: names.get(stageId) })}
    >
      {names.get(stageId) ?? stageId}
    </Menu.Item>
  );
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
        <RoundBadge round={app.current_round} stageKind={app.stage_kind} />
        {app.stale && (
          <Badge color="red" variant="light">
            {t("summary.needsChasing")}
          </Badge>
        )}
        {app.archived && <Badge variant="outline">{t("summary.archived")}</Badge>}
        {app.tags.map((tag) => (
          <Badge key={tag} variant="dot" color="gray">
            {tag}
          </Badge>
        ))}
      </Group>
      <DuplicateWarning duplicates={app.duplicates} title={t("summary.alsoApplied")} />

      <Group gap="xs">
        <Menu shadow="md" position="bottom-start">
          <Menu.Target>
            <Button
              size="xs"
              rightSection={<IconArrowRight size={14} />}
              disabled={!app.allowed_next.length}
              loading={move.isPending}
            >
              {t("summary.moveTo")}
            </Button>
          </Menu.Target>
          <Menu.Dropdown>
            {usual.length > 0 && others.length > 0 && <Menu.Label>{t("summary.usualNext")}</Menu.Label>}
            {usual.map(moveItem)}
            {usual.length > 0 && others.length > 0 && (
              <>
                <Menu.Divider />
                <Menu.Label>{t("summary.otherStages")}</Menu.Label>
              </>
            )}
            {others.map(moveItem)}
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
          {t("summary.undoMove")}
        </Button>
        {app.stage_kind === "active" && (
          <ApplicationWaiting id={app.id} since={app.awaiting_reply_since} toRead={app.reply_to_read_since} />
        )}
      </Group>
      <Stack gap={4}>
        <Text size="sm">
          <Trans t={t} i18nKey="summary.route" components={{ b: <b />, route: <RouteLine app={app} /> }} />
        </Text>
        <Text size="sm">
          <Trans
            t={t}
            i18nKey="summary.appliedOn"
            values={{ date: formatDate(app.applied_on) }}
            components={{ b: <b /> }}
          />
        </Text>
        <Text size="sm">
          <Trans
            t={t}
            i18nKey="summary.lastActivity"
            values={{ ago: ago(app.days_since_activity) }}
            components={{ b: <b /> }}
          />
        </Text>
        {app.follow_up_on && (
          <Text size="sm">
            <Trans
              t={t}
              i18nKey="summary.followUpOn"
              values={{ date: formatDate(app.follow_up_on) }}
              components={{ b: <b /> }}
            />
          </Text>
        )}
      </Stack>
    </Stack>
  );
}

export function ApplicationTimeline({ app }: { app: ApplicationDetail }) {
  useTranslation("events"); // eventText reads i18n directly: this redraws it when the language changes
  const { data: workflow } = useWorkflow();
  const names = new Map((workflow?.stages ?? []).map((s) => [s.id, s.name]));
  return (
    <Timeline active={app.events.length} bulletSize={22} lineWidth={2}>
      {newestFirst(app.events).map((event) => {
        const Icon = ACTIVITY_ICONS[event.kind] ?? IconNote;
        return (
          <Timeline.Item key={event.id} bullet={<Icon size={12} />} title={eventTitle(event, names)}>
            {event.summary && event.kind !== "stage_change" && <Text size="sm">{eventText(event)}</Text>}
            {event.summary && event.kind === "stage_change" && event.from_stage && (
              <Text size="sm" c="dimmed">
                {eventText(event)}
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
  const { t } = useTranslation("applications");
  return (
    <Alert color="red" title={t("summary.loadFailed")}>
      {error instanceof Error ? errorText(error) : t("summary.somethingWrong")}
    </Alert>
  );
}

export { LogActivity };

export function ApplicationDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { t } = useTranslation("applications");
  const { data: app, isLoading, isError, error } = useApplication(id);
  return (
    <Drawer opened={!!id} onClose={onClose} position="right" size="lg" title={t("summary.drawerTitle")}>
      {isError ? (
        <ApplicationLoadError error={error} />
      ) : isLoading || !app ? (
        <Loader />
      ) : (
        <Stack>
          <ApplicationSummary app={app} />
          <AtAGlance app={app} />
          <Button
            component={Link}
            to={`/applications/${app.id}`}
            variant="light"
            size="xs"
            rightSection={<IconExternalLink size={14} />}
            onClick={onClose}
          >
            {t("summary.openFullPage")}
          </Button>
          <Divider label={t("log.title")} labelPosition="left" />
          <LogActivity key={app.id} id={app.id} />
          <Divider label={t("timeline.title")} labelPosition="left" />
          <ApplicationTimeline app={app} />
        </Stack>
      )}
    </Drawer>
  );
}

/** How the application came about, with the recruiter, agency and company linked to their pages. */
function RouteLine({ app }: { app: ApplicationDetail }) {
  const { t } = useTranslation("applications");
  // A name with no id (shouldn't happen) still shows, just not as a link.
  const person = app.recruiter_name && (
    <>
      <PersonMarks id={app.recruiter_id} />
      {app.recruiter_id ? (
        <Anchor component={Link} to={`/people/${app.recruiter_id}`} inherit>
          {app.recruiter_name}
        </Anchor>
      ) : (
        app.recruiter_name
      )}
    </>
  );
  const agency =
    app.agency_name &&
    (app.agency_id ? (
      <Anchor component={Link} to={`/agencies/${app.agency_id}`} inherit>
        {app.agency_name}
      </Anchor>
    ) : (
      app.agency_name
    ));
  if (app.route === "agency") {
    if (!person && !agency) return <>{t("routeLine.throughAgency")}</>;
    if (person && agency)
      return (
        <Trans
          t={t}
          i18nKey="routeLine.throughBoth"
          components={{ person: <>{person}</>, agency: <>{agency}</> }}
        />
      );
    return <Trans t={t} i18nKey="routeLine.throughOne" components={{ who: <>{person || agency}</> }} />;
  }
  if (app.route === "referral") return <>{t("routeLine.referral")}</>;
  if (!person) return <>{t("routeLine.directly")}</>;
  const company = (
    <Anchor component={Link} to={`/companies/${app.company_id}`} inherit>
      {app.company_name}
    </Anchor>
  );
  return <Trans t={t} i18nKey="routeLine.directlyVia" components={{ person: <>{person}</>, company }} />;
}
