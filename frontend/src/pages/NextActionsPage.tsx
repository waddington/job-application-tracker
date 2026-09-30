import {
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Text,
  Title,
  UnstyledButton,
} from "@mantine/core";
import { IconChecklist, IconConfetti } from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { api, unwrap, type ApplicationRow } from "../api/client";
import { stageLookup, useUpdateApplication, useWorkflow } from "../api/hooks";
import { useSaveInterview, type Interview } from "../api/interviewHooks";
import { ApplicationDrawer } from "../components/ApplicationDrawer";
import { ChaseActions } from "../components/ChaseActions";
import { StageBadge } from "../components/StageBadge";
import { ago, formatDate, formatDateTime } from "../utils/time";

export function useNextActions() {
  // "Today" is your local day, not UTC's.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const since = midnight.toISOString();
  return useQuery({
    queryKey: ["next-actions", since],
    queryFn: async () => unwrap(await api.GET("/api/v1/next-actions", { params: { query: { since } } })),
    refetchInterval: 5 * 60_000, // keeps "coming up" honest if the tab stays open
  });
}

function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  children: ReactNode;
}) {
  if (!count) return null;
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={4}>{title}</Title>
            <Badge variant="light">{count}</Badge>
          </Group>
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        </Group>
        {children}
      </Stack>
    </Card>
  );
}

function AppLine({
  row,
  detail,
  onOpen,
  action,
}: {
  row: ApplicationRow;
  detail: ReactNode;
  onOpen: (id: string) => void;
  action?: ReactNode;
}) {
  const { data: workflow } = useWorkflow();
  const stages = stageLookup(workflow);
  return (
    <Group justify="space-between" wrap="nowrap">
      <UnstyledButton
        onClick={() => onOpen(row.id)}
        style={{ flex: 1, minWidth: 0 }}
        aria-label={`Open ${row.company_name}`}
      >
        <Group gap="xs" wrap="nowrap">
          <div style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" truncate="end">
              {row.company_name}
            </Text>
            <Text size="xs" c="dimmed" truncate="end">
              {row.role_title}
              {row.recruiter_name ? ` · ${row.recruiter_name}` : ""}
            </Text>
          </div>
        </Group>
      </UnstyledButton>
      <Group gap="xs" wrap="nowrap">
        <StageBadge stage={stages.get(row.stage)} fallback={row.stage_name} />
        <Text size="xs" c="dimmed" w={120} ta="right">
          {detail}
        </Text>
        {action}
      </Group>
    </Group>
  );
}

function InterviewLine({ interview, action }: { interview: Interview; action?: ReactNode }) {
  const when = interview.starts_at ?? interview.deadline_at;
  return (
    <Group justify="space-between" wrap="nowrap">
      <div style={{ minWidth: 0 }}>
        <Text fw={600} size="sm" truncate="end">
          {interview.label}
        </Text>
        <Anchor component={Link} to={`/applications/${interview.application_id}`} size="xs">
          {interview.company_name} · {interview.role_title}
        </Anchor>
      </div>
      <Group gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" ta="right">
          {when ? `${interview.starts_at ? "" : "Due "}${formatDateTime(when)}` : "Not booked yet"}
        </Text>
        {action}
      </Group>
    </Group>
  );
}

function OutcomeButtons({ interview }: { interview: Interview }) {
  const save = useSaveInterview();
  return (
    <Group gap={4} wrap="nowrap">
      <Button
        size="compact-xs"
        variant="light"
        color="teal"
        loading={save.isPending}
        onClick={() => save.mutate({ id: interview.id, body: { status: "done" } })}
      >
        Done
      </Button>
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        onClick={() => save.mutate({ id: interview.id, body: { status: "cancelled" } })}
      >
        Didn't happen
      </Button>
    </Group>
  );
}

/** Home: what to chase, what's coming up and what needs an outcome (PRD FR18, US5). */
export function NextActionsPage() {
  const { data, isLoading } = useNextActions();
  const update = useUpdateApplication();
  const [openId, setOpenId] = useState<string | null>(null);
  const total = data
    ? data.follow_ups.length + data.stale.length + data.upcoming.length + data.awaiting_outcome.length
    : 0;

  return (
    <Stack maw={1000}>
      <Group gap="sm">
        <IconChecklist size={26} stroke={1.6} />
        <Title order={2}>Next actions</Title>
      </Group>
      {isLoading || !data ? (
        <Loader />
      ) : !total ? (
        <Card withBorder p="xl">
          <Stack align="center" gap="xs">
            <IconConfetti size={32} stroke={1.4} />
            <Text fw={600}>All caught up</Text>
            <Text size="sm" c="dimmed" ta="center">
              Nothing to chase and nothing booked. Applications that go quiet for longer than their stage
              allows will show up here.
            </Text>
          </Stack>
        </Card>
      ) : (
        <>
          <Section title="How did it go?" count={data.awaiting_outcome.length} hint="Their time has passed">
            {data.awaiting_outcome.map((i) => (
              <InterviewLine key={i.id} interview={i} action={<OutcomeButtons interview={i} />} />
            ))}
          </Section>
          <Section title="Follow up" count={data.follow_ups.length} hint="Follow-up date is today or earlier">
            {data.follow_ups.map((r) => (
              <AppLine
                key={r.id}
                row={r}
                onOpen={setOpenId}
                detail={`due ${formatDate(r.follow_up_on)}`}
                action={
                  <Group gap={4} wrap="nowrap">
                    <Button
                      size="compact-xs"
                      variant="light"
                      onClick={() => update.mutate({ id: r.id, body: { follow_up_on: null } })}
                    >
                      Done
                    </Button>
                    <ChaseActions row={r} />
                  </Group>
                }
              />
            ))}
          </Section>
          <Section title="Coming up" count={data.upcoming.length} hint="Next two weeks, then unbooked rounds">
            {data.upcoming.map((i) => (
              <InterviewLine key={i.id} interview={i} />
            ))}
          </Section>
          <Section title="Gone quiet" count={data.stale.length} hint="Past their stage's threshold">
            {data.stale.map((r) => (
              <AppLine
                key={r.id}
                row={r}
                onOpen={setOpenId}
                detail={ago(r.days_since_activity)}
                action={<ChaseActions row={r} />}
              />
            ))}
          </Section>
        </>
      )}
      <ApplicationDrawer id={openId} onClose={() => setOpenId(null)} />
    </Stack>
  );
}
