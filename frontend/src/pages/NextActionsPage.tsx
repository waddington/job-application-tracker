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
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState, type ReactNode } from "react";

import { api, unwrap, type ApplicationRow, type Contact } from "../api/client";
import { stageLookup, useLogActivity, useUpdateApplication, useWorkflow } from "../api/hooks";
import { useSaveInterview, type Interview } from "../api/interviewHooks";
import { headline, type Offer } from "../api/offerHooks";
import { useTodos, type Todo } from "../api/todoHooks";
import {
  ApplicationWaiting,
  daysWaiting,
  PersonWaiting,
  repliedLabel,
  waitingLabel,
} from "../components/Waiting";
import { ApplicationDrawer } from "../components/ApplicationDrawer";
import { MeetingLine, MeetingOutcome } from "../components/Meetings";
import { RoleLine } from "../components/Roles";
import { AddTodo, TodoLine } from "../components/Todos";
import { ChaseActions } from "../components/ChaseActions";
import { StageBadge } from "../components/StageBadge";
import { ago, formatDate, formatDateTime } from "../utils/time";
import { useToday } from "../utils/useToday";

export function useNextActions() {
  // "Today" is your local day, not UTC's: send the date and the start of it with its offset.
  const today = useToday();
  const since = dayjs(today).format(); // local midnight, e.g. 2026-09-30T00:00:00+01:00
  return useQuery({
    queryKey: ["next-actions", today],
    queryFn: async () =>
      unwrap(await api.GET("/api/v1/next-actions", { params: { query: { today, since } } })),
    refetchInterval: 5 * 60_000, // keeps "coming up" honest if the tab stays open
  });
}

/** You chased it: log that (so it isn't "gone quiet" straight away) and clear the date. */
function useFollowedUp() {
  const log = useLogActivity();
  const update = useUpdateApplication();
  return useMutation({
    mutationFn: async (row: ApplicationRow) => {
      await log.mutateAsync({ id: row.id, body: { kind: "manual", summary: "Followed up", data: {} } });
      await update.mutateAsync({ id: row.id, body: { follow_up_on: null } });
    },
  });
}

function FollowedUpButton({ row }: { row: ApplicationRow }) {
  const done = useFollowedUp();
  return (
    <Button size="compact-xs" variant="light" loading={done.isPending} onClick={() => done.mutate(row)}>
      Done
    </Button>
  );
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

function OfferLine({ offer, today }: { offer: Offer; today: string }) {
  const overdue = offer.respond_by! < today;
  return (
    <Group justify="space-between" wrap="nowrap">
      <div style={{ minWidth: 0 }}>
        <Text fw={600} size="sm" truncate="end">
          {headline(offer)}
        </Text>
        <Anchor component={Link} to={`/applications/${offer.application_id}`} size="xs">
          {offer.company_name} · {offer.role_title}
        </Anchor>
      </div>
      <Text size="xs" c={overdue ? "red" : "orange"} ta="right">
        {overdue ? "Reply was due" : "Reply by"} {formatDate(offer.respond_by)}
      </Text>
    </Group>
  );
}

function PersonWaitingLine({ person }: { person: Contact }) {
  const where = person.title ?? "";
  return (
    <Group justify="space-between" wrap="nowrap">
      <div style={{ minWidth: 0 }}>
        <Anchor component={Link} to={`/people/${person.id}`} size="sm" fw={600}>
          {person.name}
        </Anchor>
        {where && (
          <Text size="xs" c="dimmed" truncate="end">
            {where}
          </Text>
        )}
      </div>
      <Group gap="xs" wrap="nowrap">
        <Text size="xs" c={person.reply_to_read_since ? "orange" : "dimmed"}>
          {person.reply_to_read_since
            ? repliedLabel(person.reply_to_read_since)
            : waitingLabel(person.awaiting_reply_since!)}
        </Text>
        <PersonWaiting
          id={person.id}
          since={person.awaiting_reply_since}
          toRead={person.reply_to_read_since}
          compact
          who={person.name}
        />
      </Group>
    </Group>
  );
}

function OutcomeButtons({ interview }: { interview: Interview }) {
  const save = useSaveInterview();
  const [clicked, setClicked] = useState<"done" | "cancelled" | null>(null);
  const mark = (status: "done" | "cancelled") => {
    setClicked(status);
    save.mutate({ id: interview.id, body: { status } });
  };
  return (
    <Group gap={4} wrap="nowrap">
      <Button
        size="compact-xs"
        variant="light"
        color="teal"
        loading={save.isPending && clicked === "done"}
        onClick={() => mark("done")}
      >
        Done
      </Button>
      <Button
        size="compact-xs"
        variant="subtle"
        color="gray"
        loading={save.isPending && clicked === "cancelled"}
        onClick={() => mark("cancelled")}
      >
        Didn't happen
      </Button>
    </Group>
  );
}

/** Your own to-dos, always shown (it's where you add one), with what each is about. Ticked-off
 * ones are under "Done recently", so one ticked by mistake (or about nothing) can come back. */
function TodosSection({ todos }: { todos: Todo[] }) {
  const [showDone, setShowDone] = useState(false);
  const { data: done } = useTodos({ status: "done" }, showDone);
  return (
    <Card withBorder>
      <Stack gap="sm">
        <Group justify="space-between">
          <Group gap="xs">
            <Title order={4}>To-dos</Title>
            {todos.length > 0 && <Badge variant="light">{todos.length}</Badge>}
          </Group>
          <Text size="xs" c="dimmed">
            Your own reminders; tick them off when done
          </Text>
        </Group>
        {todos.map((t) => (
          <TodoLine key={t.id} todo={t} />
        ))}
        <AddTodo />
        <Anchor
          component="button"
          type="button"
          size="xs"
          c="dimmed"
          style={{ alignSelf: "flex-start" }}
          onClick={() => setShowDone((v) => !v)}
        >
          {showDone ? "Hide done" : "Done recently"}
        </Anchor>
        {showDone &&
          (done?.length ? (
            done.slice(0, 10).map((t) => <TodoLine key={t.id} todo={t} />)
          ) : (
            <Text size="xs" c="dimmed">
              Nothing ticked off yet.
            </Text>
          ))}
      </Stack>
    </Card>
  );
}

/** Home: what to chase, what's coming up and what needs an outcome (PRD FR18, US5). */
export function NextActionsPage() {
  const { data, isLoading } = useNextActions();
  const [openId, setOpenId] = useState<string | null>(null);
  const offers = data?.offer_deadlines ?? [];
  const waiting = data?.waiting ?? [];
  const waitingPeople = data?.waiting_people ?? [];
  const toRead = data?.to_read ?? [];
  const toReadPeople = data?.to_read_people ?? [];
  const { data: workflow } = useWorkflow();
  const staleAfter = new Map((workflow?.stages ?? []).map((s) => [s.id, s.stale_after_days]));
  // Waited as long as the stage allows: time to chase.
  const overdue = (r: ApplicationRow) => {
    const limit = staleAfter.get(r.stage);
    return limit != null && daysWaiting(r.awaiting_reply_since!) >= limit;
  };
  const meetings = data?.meetings ?? [];
  const meetingsToClose = data?.meetings_to_close ?? [];
  const rolesToDecide = data?.roles_to_decide ?? [];
  // Calls and interviews in one list by time; rounds not booked yet go last.
  const comingUp = [
    ...meetings.map((m) => ({ key: m.id, at: m.starts_at, node: <MeetingLine key={m.id} meeting={m} /> })),
    ...(data?.upcoming ?? []).map((i) => ({
      key: i.id,
      at: i.starts_at ?? i.deadline_at ?? "9999",
      node: <InterviewLine key={i.id} interview={i} />,
    })),
  ].sort((a, b) => (new Date(a.at).getTime() || Infinity) - (new Date(b.at).getTime() || Infinity));
  const total = data
    ? offers.length +
      meetings.length +
      meetingsToClose.length +
      rolesToDecide.length +
      waiting.length +
      waitingPeople.length +
      toRead.length +
      toReadPeople.length +
      data.follow_ups.length +
      data.stale.length +
      data.upcoming.length +
      data.awaiting_outcome.length
    : 0;

  return (
    <Stack maw={1000}>
      <Group gap="sm">
        <IconChecklist size={26} stroke={1.6} />
        <Title order={2}>Next actions</Title>
      </Group>
      {data && (
        <Section
          title="Replies to read"
          count={toRead.length + toReadPeople.length}
          hint="They've replied; oldest first"
        >
          {toRead.map((r) => (
            <AppLine
              key={r.id}
              row={r}
              onOpen={setOpenId}
              detail={
                <Text span size="xs" c="orange">
                  {repliedLabel(r.reply_to_read_since!)}
                </Text>
              }
              action={
                <ApplicationWaiting
                  id={r.id}
                  since={r.awaiting_reply_since}
                  toRead={r.reply_to_read_since}
                  compact
                  who={r.company_name}
                />
              }
            />
          ))}
          {toReadPeople.map((p) => (
            <PersonWaitingLine key={p.id} person={p} />
          ))}
        </Section>
      )}
      {data && <TodosSection todos={data.todos ?? []} />}
      {isLoading || !data ? (
        <Loader />
      ) : !total && !data.todos?.length ? (
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
          <Section title="Offers to answer" count={offers.length} hint="Reply due in the next two weeks">
            {offers.map((o) => (
              <OfferLine key={o.id} offer={o} today={data.today} />
            ))}
          </Section>
          <Section
            title="Waiting to hear back"
            count={waiting.length + waitingPeople.length}
            hint="You replied; red means time to chase"
          >
            {waiting.map((r) => (
              <AppLine
                key={r.id}
                row={r}
                onOpen={setOpenId}
                detail={
                  <Text span size="xs" c={overdue(r) ? "red" : "dimmed"}>
                    {waitingLabel(r.awaiting_reply_since!)}
                    {overdue(r) ? " · time to chase" : ""}
                  </Text>
                }
                action={
                  <Group gap={4} wrap="nowrap">
                    <ApplicationWaiting
                      id={r.id}
                      since={r.awaiting_reply_since}
                      compact
                      who={r.company_name}
                    />
                    <ChaseActions row={r} />
                  </Group>
                }
              />
            ))}
            {waitingPeople.map((p) => (
              <PersonWaitingLine key={p.id} person={p} />
            ))}
          </Section>
          <Section
            title="How did it go?"
            count={data.awaiting_outcome.length + meetingsToClose.length}
            hint="Their time has passed"
          >
            {data.awaiting_outcome.map((i) => (
              <InterviewLine key={i.id} interview={i} action={<OutcomeButtons interview={i} />} />
            ))}
            {meetingsToClose.map((m) => (
              <MeetingLine key={m.id} meeting={m} action={<MeetingOutcome meeting={m} />} />
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
                    <FollowedUpButton row={r} />
                    <ChaseActions row={r} />
                  </Group>
                }
              />
            ))}
          </Section>
          <Section title="Roles to decide" count={rolesToDecide.length} hint="Apply or pass on each">
            {rolesToDecide.map((r) => (
              <RoleLine key={r.id} role={r} />
            ))}
          </Section>
          <Section
            title="Coming up"
            count={comingUp.length}
            hint="Interviews and calls in the next two weeks, then unbooked rounds"
          >
            {comingUp.map((c) => c.node)}
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
