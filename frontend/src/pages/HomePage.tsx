import {
  Accordion,
  Anchor,
  Button,
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

import { stageLookup, useApplications, useContacts, useWorkflow } from "../api/hooks";
import { useTimeline } from "../api/timelineHooks";
import { todoPath } from "../api/todoHooks";
import { HowItWorks, NewApplicationButton } from "../components/HowItWorks";
import { dueLabel } from "../components/Todos";
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

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

export function HomePage() {
  const { data: rows, isLoading, isError } = useApplications({});
  const { data: workflow } = useWorkflow();
  const { data: next, isPending: nextPending, isError: nextFailed } = useNextActions();
  const today = dayjs().format("YYYY-MM-DD"); // so "the last two weeks" moves on at midnight
  const since = useMemo(() => dayjs(today).subtract(14, "day").format(), [today]);
  const { data: recent, isPending: recentPending, isError: recentFailed } = useTimeline({ since });
  const { data: contacts, isPending: contactsPending, isError: contactsFailed } = useContacts();

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
  // Next actions lists rounds with no date yet after the booked ones; they aren't "coming up".
  const booked = (next?.upcoming ?? []).filter((i) => i.starts_at || i.deadline_at);
  const calls = next?.meetings ?? [];
  const toDecide = next?.roles_to_decide ?? [];
  // Your to-dos that want doing now: due today or before, or with no date.
  const todos = (next?.todos ?? []).filter((t) => !t.due_on || t.due_on <= next!.today);
  const waiting = (next?.waiting.length ?? 0) + (next?.waiting_people.length ?? 0);
  const pipeline = (workflow?.stages ?? [])
    .filter((s) => s.kind === "active")
    .map((s) => ({ stage: s, count: active.filter((r) => r.stage === s.id).length }))
    .filter((p) => p.count > 0);
  // What happened, not what was set up: a burst of new companies would crowd it out. Before
  // the first application, though, setting things up is most of what's happened.
  const past = (recent?.items ?? [])
    .filter((i) => (fresh || i.category !== "added") && new Date(i.at) <= new Date(recent!.now))
    .slice(0, 8);
  // Nothing at all yet: just the getting-started steps. Once there are people, calls or roles,
  // show them (with a shorter nudge towards the first application).
  // Wait for all of it before choosing, so the getting-started card doesn't flash up and go;
  // if one of them fails, show the usual Overview rather than claim there's nothing.
  const settling = fresh && (contactsPending || nextPending || recentPending);
  const allLoaded = !contactsFailed && !nextFailed && !recentFailed;
  const blank =
    fresh &&
    allLoaded &&
    !contacts?.length &&
    !toDecide.length &&
    !calls.length &&
    !past.length &&
    !next?.todos?.length;
  const sofar = [
    toDecide.length ? `${plural(toDecide.length, "role")} to decide on` : null,
    calls.length ? `${plural(calls.length, "call")} coming up` : null,
    contacts?.length ? `${contacts.length === 1 ? "1 person" : `${contacts.length} people`} added` : null,
  ].filter(Boolean);

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

      {isLoading || settling ? (
        <Loader />
      ) : isError || rows === undefined ? (
        <Text c="red" size="sm">
          Couldn't load your applications. Is the tracker still running?
        </Text>
      ) : blank ? (
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
          {fresh && (
            <Card withBorder padding="md">
              <Group justify="space-between" wrap="wrap" gap="sm">
                <div>
                  <Title order={3} size="h5">
                    No applications yet
                  </Title>
                  <Text size="sm" c="dimmed">
                    {sofar.length ? `So far: ${sofar.join(", ")}. ` : ""}
                    {toDecide.length
                      ? "Apply for one of the roles and it becomes an application."
                      : "Add one when you go for a role: it only needs a company and a title."}
                  </Text>
                </div>
                <Group gap="xs">
                  {toDecide.length > 0 && (
                    <Button component={Link} to="/roles" variant="light">
                      Roles to decide
                    </Button>
                  )}
                  <NewApplicationButton />
                </Group>
              </Group>
            </Card>
          )}
          <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }}>
            <Stat label="Active" value={active.length} to="/applications" hint="applications in play" />
            <Stat
              label="Needs attention"
              value={next && attention.length + toDecide.length + todos.length}
              to="/next-actions"
              hint="to-dos, follow-ups, gone quiet, roles to decide"
            />
            <Stat
              label="Interviews"
              value={next && booked.length}
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
              {attention.length + toDecide.length + todos.length === 0 ? (
                <Empty>Nothing to chase. Nice.</Empty>
              ) : (
                <Stack gap={6}>
                  {todos.slice(0, 4).map((t) => (
                    <div key={t.id}>
                      <Anchor component={Link} to={todoPath(t) ?? "/next-actions"} size="sm" fw={500}>
                        {t.text}
                      </Anchor>
                      <Text size="xs" c="dimmed">
                        {["To-do", t.about, t.due_on ? dueLabel(t.due_on, next!.today).label : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </div>
                  ))}
                  {todos.length > 4 && (
                    <Anchor component={Link} to="/next-actions" size="xs" c="dimmed">
                      and {todos.length - 4} more to-dos
                    </Anchor>
                  )}
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
                  {toDecide.length > 0 && (
                    <div>
                      <Anchor component={Link} to="/roles" size="sm" fw={500}>
                        {toDecide.length === 1 ? "1 role" : `${toDecide.length} roles`} to decide on
                      </Anchor>
                      <Text size="xs" c="dimmed">
                        Apply or pass:{" "}
                        {toDecide
                          .slice(0, 3)
                          .map((r) => `${r.title} at ${r.company_name}`)
                          .join(", ")}
                        {toDecide.length > 3 ? "…" : ""}
                      </Text>
                    </div>
                  )}
                </Stack>
              )}
            </Panel>
            <Panel title="Coming up" link={{ to: "/interviews", label: "All interviews" }}>
              {booked.length + calls.length + (next?.offer_deadlines.length ?? 0) === 0 ? (
                <Empty>No interviews, calls or offer deadlines in the next two weeks.</Empty>
              ) : (
                <Stack gap={6}>
                  {[
                    ...booked.map((i) => ({
                      key: i.id,
                      at: (i.starts_at ?? i.deadline_at)!,
                      to: `/applications/${i.application_id}`,
                      label: `${i.company_name} · ${i.label}`,
                      when: i.starts_at
                        ? formatDateTime(i.starts_at)
                        : `Due ${formatDateTime(i.deadline_at!)}`,
                    })),
                    ...calls.map((m) => ({
                      key: m.id,
                      at: m.starts_at,
                      to: `/people/${m.contact_id}`,
                      label: m.label,
                      when: formatDateTime(m.starts_at),
                    })),
                  ]
                    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())
                    .slice(0, 6)
                    .map((c) => (
                      <div key={c.key}>
                        <Anchor component={Link} to={c.to} size="sm" fw={500}>
                          {c.label}
                        </Anchor>
                        <Text size="xs" c="dimmed">
                          {c.when}
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
