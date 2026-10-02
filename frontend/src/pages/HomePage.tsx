import {
  Accordion,
  Anchor,
  Card,
  Group,
  Loader,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo, type ReactNode } from "react";

import { stageLookup, useApplications, useWorkflow } from "../api/hooks";
import { useTimeline } from "../api/timelineHooks";
import { HowItWorks, NewApplicationButton } from "../components/HowItWorks";
import { ago, formatDate, formatDateTime } from "../utils/time";
import { useNextActions } from "./NextActionsPage";
import { TimelineRow } from "./TimelinePage";

function Stat({
  label,
  value,
  to,
  hint,
}: {
  label: string;
  value: number | undefined;
  to: string;
  hint: string;
}) {
  return (
    <UnstyledButton component={Link} to={to} aria-label={`${label}: ${value ?? "…"}`}>
      <Card withBorder padding="md" h="100%">
        <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
          {label}
        </Text>
        <Text fz={28} fw={700} lh={1.3}>
          {value ?? "…"}
        </Text>
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      </Card>
    </UnstyledButton>
  );
}

function Panel({
  title,
  link,
  children,
}: {
  title: string;
  link?: { to: string; label: string };
  children: ReactNode;
}) {
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" mb="xs">
        <Title order={3} size="h5">
          {title}
        </Title>
        {link && (
          <Anchor component={Link} to={link.to} size="sm">
            {link.label}
          </Anchor>
        )}
      </Group>
      {children}
    </Card>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <Text size="sm" c="dimmed">
    {children}
  </Text>
);

export function HomePage() {
  const { data: rows, isLoading, isError } = useApplications({});
  const { data: workflow } = useWorkflow();
  const { data: next } = useNextActions();
  const since = useMemo(() => dayjs().startOf("day").subtract(14, "day").format(), []);
  const { data: recent } = useTimeline({ since });

  const stages = stageLookup(workflow);
  const active = (rows ?? []).filter((r) => r.stage_kind === "active");
  const fresh = rows !== undefined && rows.length === 0;

  const attention = [
    ...(next?.follow_ups ?? []).map((r) => ({
      row: r,
      why: `Follow up (due ${formatDate(r.follow_up_on)})`,
    })),
    ...(next?.stale ?? []).map((r) => ({
      row: r,
      why: `Gone quiet: last activity ${ago(r.days_since_activity)}`,
    })),
  ];
  const waiting = (next?.waiting.length ?? 0) + (next?.waiting_people.length ?? 0);
  const pipeline = (workflow?.stages ?? [])
    .filter((s) => s.kind === "active")
    .map((s) => ({ stage: s, count: active.filter((r) => r.stage === s.id).length }))
    .filter((p) => p.count > 0);
  const past = (recent?.items ?? []).filter((i) => new Date(i.at) <= new Date(recent!.now)).slice(0, 8);

  return (
    <Stack>
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Overview</Title>
          <Text c="dimmed" size="sm">
            {dayjs().format("dddd D MMMM")}
          </Text>
        </div>
      </Group>

      {isLoading ? (
        <Loader />
      ) : isError || rows === undefined ? (
        <Text c="red" size="sm">
          Couldn't load your applications. Is the tracker still running?
        </Text>
      ) : fresh ? (
        <Card withBorder padding="lg">
          <Title order={3} size="h4" mb="xs">
            Getting started
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            No applications yet. Start with the first one: you only need a company and a role.
          </Text>
          <HowItWorks />
          <Group mt="md">
            <NewApplicationButton size="md" />
          </Group>
        </Card>
      ) : (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
            <Stat label="Active" value={active.length} to="/applications" hint="applications in play" />
            <Stat
              label="Needs attention"
              value={next && attention.length}
              to="/next-actions"
              hint="follow-ups and gone quiet"
            />
            <Stat
              label="Interviews"
              value={next?.upcoming.length}
              to="/interviews"
              hint="in the next two weeks"
            />
            <Stat label="Waiting" value={next && waiting} to="/next-actions" hint="to hear back" />
            <Stat label="Offers" value={next?.offer_deadlines.length} to="/offers" hint="to answer soon" />
          </SimpleGrid>

          {pipeline.length > 0 && (
            <Panel title="Pipeline" link={{ to: "/applications", label: "Board" }}>
              <Progress.Root size={22} aria-label="Active applications by stage">
                {pipeline.map(({ stage, count }) => (
                  <Tooltip key={stage.id} label={`${stage.name}: ${count}`}>
                    <Progress.Section value={(count / active.length) * 100} color={stage.color}>
                      <Progress.Label>{count}</Progress.Label>
                    </Progress.Section>
                  </Tooltip>
                ))}
              </Progress.Root>
              <Group gap="md" mt="xs">
                {pipeline.map(({ stage, count }) => (
                  <Text key={stage.id} size="sm">
                    <Text span c={`${stage.color}.6`} fw={700}>
                      ●
                    </Text>{" "}
                    {stage.name} {count}
                  </Text>
                ))}
              </Group>
            </Panel>
          )}

          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <Panel title="Needs attention" link={{ to: "/next-actions", label: "All next actions" }}>
              {attention.length === 0 ? (
                <Empty>Nothing to chase. Nice.</Empty>
              ) : (
                <Stack gap={6}>
                  {attention.slice(0, 6).map(({ row, why }) => (
                    <div key={row.id}>
                      <Anchor component={Link} to={`/applications/${row.id}`} size="sm" fw={500}>
                        {row.company_name} · {row.role_title}
                      </Anchor>
                      <Text size="xs" c="dimmed">
                        {stages.get(row.stage)?.name ?? row.stage} · {why}
                      </Text>
                    </div>
                  ))}
                  {attention.length > 6 && <Empty>and {attention.length - 6} more</Empty>}
                </Stack>
              )}
            </Panel>
            <Panel title="Coming up" link={{ to: "/interviews", label: "All interviews" }}>
              {(next?.upcoming.length ?? 0) + (next?.offer_deadlines.length ?? 0) === 0 ? (
                <Empty>No interviews or offer deadlines in the next two weeks.</Empty>
              ) : (
                <Stack gap={6}>
                  {next!.upcoming.slice(0, 6).map((i) => (
                    <div key={i.id}>
                      <Anchor component={Link} to={`/applications/${i.application_id}`} size="sm" fw={500}>
                        {i.company_name} · {i.label}
                      </Anchor>
                      <Text size="xs" c="dimmed">
                        {i.starts_at ? formatDateTime(i.starts_at) : `Due ${formatDateTime(i.deadline_at!)}`}
                      </Text>
                    </div>
                  ))}
                  {next!.offer_deadlines.map((o) => (
                    <div key={o.id}>
                      <Anchor component={Link} to={`/applications/${o.application_id}`} size="sm" fw={500}>
                        {o.company_name} · offer
                      </Anchor>
                      <Text size="xs" c="dimmed">
                        Reply by {formatDate(o.respond_by)}
                      </Text>
                    </div>
                  ))}
                </Stack>
              )}
            </Panel>
          </SimpleGrid>

          <Panel title="Recent activity" link={{ to: "/timeline", label: "Full timeline" }}>
            {past.length === 0 ? (
              <Empty>Nothing in the last two weeks.</Empty>
            ) : (
              past.map((item) => <TimelineRow key={item.id} item={item} showDate />)
            )}
          </Panel>

          <Accordion variant="contained">
            <Accordion.Item value="how">
              <Accordion.Control>How it works</Accordion.Control>
              <Accordion.Panel>
                <HowItWorks />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </>
      )}
    </Stack>
  );
}
