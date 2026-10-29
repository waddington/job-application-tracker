import {
  Accordion,
  Anchor,
  Badge,
  Button,
  Card,
  Grid,
  Group,
  Loader,
  Progress,
  Stack,
  Text,
  Title,
  Tooltip,
  UnstyledButton,
  VisuallyHidden,
} from "@mantine/core";
import { IconConfetti } from "@tabler/icons-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useMemo, useState, type ReactNode } from "react";

import { InterviewOutcome } from "../components/OutcomeNotes";
import { ReplyHabit } from "../components/ReplyHabit";
import { PersonName } from "../components/GhostMark";
import { api, unwrap, type ApplicationRow, type Contact } from "../api/client";
import {
  stageLookup,
  useApplications,
  useContacts,
  useLogActivity,
  useUpdateApplication,
  useWorkflow,
} from "../api/hooks";
import { useTimeline } from "../api/timelineHooks";
import { type Interview } from "../api/interviewHooks";
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
import { HowItWorks, NewApplicationButton } from "../components/HowItWorks";
import { PersonChase, waitingOrChased } from "../components/PersonChase";
import { StageBadge } from "../components/StageBadge";
import { shadow, shadowValue } from "../i18n/shadow";
import { formatDay } from "../utils/format";
import { ago, formatDate, formatDateTime } from "../utils/time";
import { useToday } from "../utils/useToday";
import { TimelineRow } from "./TimelinePage";
import classes from "./TodayPage.module.css";

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
    <Stack gap="xs" role="group" aria-label={title}>
      <SectionLabel title={title} count={count} hint={hint} />
      <div className={classes.rows}>{children}</div>
    </Stack>
  );
}

/** A section's name and count, small and grey; its explanation shows on hover or focus, and is
 * read out by screen readers. */
function SectionLabel({ title, count, hint }: { title: string; count: number; hint: string }) {
  return (
    <Tooltip
      label={hint}
      position="top-start"
      openDelay={300}
      events={{ hover: true, focus: true, touch: true }}
    >
      <Group gap={6} style={{ alignSelf: "flex-start" }} tabIndex={0}>
        <Title order={4} fz="xs" fw={700} c="dimmed" tt="uppercase" style={{ letterSpacing: "0.04em" }}>
          {title}
        </Title>
        {count > 0 && (
          <Text size="xs" c="dimmed" fw={700}>
            · {count}
          </Text>
        )}
        <VisuallyHidden>{hint}</VisuallyHidden>
      </Group>
    </Tooltip>
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
  const { data: contacts } = useContacts();
  const stages = stageLookup(workflow);
  // Waiting on it: how long its recruiter usually takes.
  const recruiter = row.awaiting_reply_since ? contacts?.find((c) => c.id === row.recruiter_id) : undefined;
  return (
    <Row
      who={
        <UnstyledButton
          onClick={() => onOpen(row.id)}
          style={{ display: "block", minWidth: 0 }}
          aria-label={`Open ${row.company_name}`}
        >
          <Text fw={600} size="sm" truncate="end">
            {row.company_name}
          </Text>
          <Text size="xs" c="dimmed" truncate="end">
            {row.role_title}
            {row.recruiter_name && (
              <>
                {" · "}
                <PersonName id={row.recruiter_id} name={row.recruiter_name} size={12} />
              </>
            )}
          </Text>
        </UnstyledButton>
      }
      habit={
        recruiter && <ReplyHabit contact={{ ...recruiter, awaiting_reply_since: row.awaiting_reply_since }} />
      }
      status={
        <>
          <StageBadge stage={stages.get(row.stage)} fallback={row.stage_name} />
          <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
            {detail}
          </Text>
        </>
      }
      actions={action}
    />
  );
}

/**
 * The shape of a row that needs you: who or what on the left, its stage and status on the
 * right (kept on one line), anything about how they usually reply under the name, and the
 * buttons on their own line, left-aligned, so rows look the same whatever the column's width.
 */
function Row({
  who,
  habit,
  status,
  actions,
}: {
  who: ReactNode;
  habit?: ReactNode;
  status: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <Stack gap={4}>
      <Group justify="space-between" wrap="nowrap" align="flex-start" gap="sm">
        <div style={{ minWidth: 0 }}>{who}</div>
        <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
          {status}
        </Group>
      </Group>
      {habit}
      {actions && (
        <Group gap={6} wrap="wrap" className={classes.actions}>
          {actions}
        </Group>
      )}
    </Stack>
  );
}

function InterviewLine({ interview, action }: { interview: Interview; action?: ReactNode }) {
  const when = interview.starts_at ?? interview.deadline_at;
  return (
    <Row
      who={
        <>
          <Text fw={600} size="sm" truncate="end">
            {interview.label}
          </Text>
          <Anchor component={Link} to={`/applications/${interview.application_id}`} size="xs">
            {interview.company_name} · {interview.role_title}
          </Anchor>
        </>
      }
      status={
        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {when ? `${interview.starts_at ? "" : "Due "}${formatDateTime(when)}` : "Not booked yet"}
        </Text>
      }
      actions={action}
    />
  );
}

function OfferLine({ offer, today }: { offer: Offer; today: string }) {
  const overdue = offer.respond_by! < today;
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <div style={{ minWidth: 0 }}>
        <Text fw={600} size="sm" truncate="end">
          {headline(offer)}
        </Text>
        <Anchor component={Link} to={`/applications/${offer.application_id}`} size="xs">
          {offer.company_name} · {offer.role_title}
        </Anchor>
      </div>
      <Text size="xs" c={overdue ? "red" : "orange"} ta="right" style={{ whiteSpace: "nowrap" }}>
        {overdue ? "Reply was due" : "Reply by"} {formatDate(offer.respond_by)}
      </Text>
    </Group>
  );
}

function PersonWaitingLine({ person }: { person: Contact }) {
  const where = person.title ?? "";
  return (
    <Row
      who={
        <>
          <Anchor component={Link} to={`/people/${person.id}`} size="sm" fw={600}>
            <PersonName id={person.id} name={person.name} />
          </Anchor>
          {where && (
            <Text size="xs" c="dimmed" truncate="end">
              {where}
            </Text>
          )}
        </>
      }
      habit={!person.reply_to_read_since && <ReplyHabit contact={person} />}
      status={
        <Text size="xs" c={person.reply_to_read_since ? "orange" : "dimmed"} style={{ whiteSpace: "nowrap" }}>
          {person.reply_to_read_since
            ? repliedLabel(person.reply_to_read_since)
            : waitingOrChased(person, waitingLabel)}
        </Text>
      }
      actions={
        <>
          <PersonWaiting
            id={person.id}
            since={person.awaiting_reply_since}
            toRead={person.reply_to_read_since}
            compact
            who={person.name}
          />
          <PersonChase contact={person} compact />
        </>
      }
    />
  );
}

/** Your own to-dos, always shown (it's where you add one), with what each is about. Ticked-off
 * ones are under "Done recently", so one ticked by mistake (or about nothing) can come back. */
function TodosSection({ todos }: { todos: Todo[] }) {
  const [showDone, setShowDone] = useState(false);
  const { data: done } = useTodos({ status: "done" }, showDone);
  return (
    <Stack gap="xs" role="group" aria-label="To-dos">
      <SectionLabel title="To-dos" count={todos.length} hint="Your own reminders; tick them off when done" />
      {todos.length > 0 && (
        <div className={classes.rows}>
          {todos.map((t) => (
            <TodoLine key={t.id} todo={t} />
          ))}
        </div>
      )}
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
          <div className={classes.rows}>
            {done.slice(0, 10).map((t) => (
              <TodoLine key={t.id} todo={t} />
            ))}
          </div>
        ) : (
          <Text size="xs" c="dimmed">
            Nothing ticked off yet.
          </Text>
        ))}
    </Stack>
  );
}

/** One of the page's three groups: what's yours to do, what's ahead, and what you're waiting for. */
function Bucket({
  id,
  title,
  hint,
  count,
  empty,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  count: number;
  empty: ReactNode;
  children: ReactNode;
}) {
  return (
    <Stack gap="sm" id={id} style={{ scrollMarginTop: 72 }}>
      <Group justify="space-between" align="baseline" gap="xs">
        <Group gap="xs">
          <Title order={3}>{title}</Title>
          {count > 0 && (
            <Badge
              variant="filled"
              size="lg"
              circle={count < 10}
              aria-label={shadow("today:groupBadge", `${count} in ${title}`, { count, group: title })}
            >
              {count}
            </Badge>
          )}
        </Group>
        <Text size="sm" c="dimmed">
          {hint}
        </Text>
      </Group>
      <Card withBorder padding="md">
        <div className={classes.sections}>
          {count === 0 && empty}
          {children}
        </div>
      </Card>
    </Stack>
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/**
 * The home page: what's yours to do now, what's coming up and who you're waiting on, under a
 * strip of numbers and the pipeline (PRD FR18, US5). It replaced the separate Overview and Next
 * actions pages, which overlapped.
 */
export function TodayPage() {
  const { data, isLoading } = useNextActions();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: rows, isPending: appsPending, isError: appsFailed } = useApplications({});
  const { data: workflow } = useWorkflow();
  const { data: contacts, isPending: contactsPending, isError: contactsFailed } = useContacts();
  const today = useToday();
  const since = useMemo(() => dayjs(today).subtract(14, "day").format(), [today]);
  const { data: recent, isPending: recentPending, isError: recentFailed } = useTimeline({ since });

  const offers = data?.offer_deadlines ?? [];
  const waiting = data?.waiting ?? [];
  const waitingPeople = data?.waiting_people ?? [];
  const toRead = data?.to_read ?? [];
  const toReadPeople = data?.to_read_people ?? [];
  const staleAfter = new Map((workflow?.stages ?? []).map((s) => [s.id, s.stale_after_days]));
  // Waited as long as the stage allows: time to chase.
  const overdue = (r: ApplicationRow) => {
    const limit = staleAfter.get(r.stage);
    return limit != null && daysWaiting(r.awaiting_reply_since!) >= limit;
  };
  const meetings = data?.meetings ?? [];
  const meetingsToClose = data?.meetings_to_close ?? [];
  const rolesToDecide = data?.roles_to_decide ?? [];
  const todos = data?.todos ?? [];
  // To-dos due today or before, or with no date, are yours to do now; dated ones wait their turn.
  const day = data?.today ?? today;
  const todosNow = todos.filter((t) => !t.due_on || t.due_on <= day);
  const todosLater = todos.filter((t) => t.due_on && t.due_on > day);
  // Calls, interviews and dated to-dos in one list by time; rounds not booked yet go last.
  const comingUp = [
    ...meetings.map((m) => ({ key: m.id, at: m.starts_at, node: <MeetingLine key={m.id} meeting={m} /> })),
    ...(data?.upcoming ?? []).map((i) => ({
      key: i.id,
      at: i.starts_at ?? i.deadline_at ?? "9999",
      node: <InterviewLine key={i.id} interview={i} />,
    })),
    ...todosLater.map((t) => ({
      key: t.id,
      at: dayjs(t.due_on).format(),
      node: <TodoLine key={t.id} todo={t} />,
    })),
  ].sort((a, b) => (new Date(a.at).getTime() || Infinity) - (new Date(b.at).getTime() || Infinity));

  const yourMove =
    toRead.length +
    toReadPeople.length +
    offers.length +
    (data?.awaiting_outcome.length ?? 0) +
    meetingsToClose.length +
    todosNow.length +
    (data?.follow_ups.length ?? 0) +
    rolesToDecide.length;
  const waitingOn = waiting.length + waitingPeople.length + (data?.stale.length ?? 0);

  // The strip and the pipeline come from your applications; the groups only need the next-actions data.
  // With nothing else to show, wait for your applications before choosing between the groups and
  // Getting started, so one doesn't flash up and go. Otherwise show the groups straight away.
  const nothingYet = data !== undefined && yourMove + comingUp.length + waitingOn === 0 && !todos.length;
  const waitForApps = appsPending && !appsFailed && nothingYet;
  const active = (rows ?? []).filter((r) => r.stage_kind === "active");
  const booked = (data?.upcoming ?? []).filter((i) => i.starts_at || i.deadline_at);
  const pipeline = (workflow?.stages ?? [])
    .filter((s) => s.kind === "active")
    .map((s) => ({ stage: s, count: active.filter((r) => r.stage === s.id).length }))
    .filter((p) => p.count > 0);
  const fresh = rows !== undefined && rows.length === 0;
  // What happened, not what was set up: a burst of new companies would crowd it out. Before
  // the first application, though, setting things up is most of what's happened.
  const past = (recent?.items ?? [])
    .filter((i) => (fresh || i.category !== "added") && new Date(i.at) <= new Date(recent!.now))
    .slice(0, 8);
  // Nothing at all yet: just the getting-started steps. Wait for everything before deciding, so
  // the card doesn't flash up and go; if something fails, show the usual page instead.
  const settling = fresh && (contactsPending || recentPending || isLoading);
  const blank =
    fresh &&
    data !== undefined &&
    !contactsFailed &&
    !recentFailed &&
    !contacts?.length &&
    !rolesToDecide.length &&
    !meetings.length &&
    !past.length &&
    !todos.length;
  const sofar = [
    rolesToDecide.length ? `${plural(rolesToDecide.length, "role")} to decide on` : null,
    meetings.length ? `${plural(meetings.length, "call")} coming up` : null,
    contacts?.length ? `${contacts.length === 1 ? "1 person" : `${contacts.length} people`} added` : null,
  ].filter(Boolean);

  return (
    <Stack maw={1600}>
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Today</Title>
          <Text c="dimmed" size="sm">
            {shadowValue("format:weekdayDayMonth", dayjs(today).format("dddd D MMMM"), (lng) =>
              formatDay(today, "weekdayDayMonth", lng),
            )}
          </Text>
        </div>
      </Group>

      {isLoading || waitForApps || settling ? (
        <Loader />
      ) : !data ? (
        <Text c="red" size="sm">
          Couldn't load what's next. Is the tracker still running?
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
                    {rolesToDecide.length
                      ? "Apply for one of the roles and it becomes an application."
                      : "Add one when you go for a role: it only needs a company and a title."}
                  </Text>
                </div>
                <NewApplicationButton />
              </Group>
            </Card>
          )}

          {rows && (
            <Card withBorder padding="sm">
              <Group gap="lg" wrap="wrap" mb={pipeline.length ? 8 : 0}>
                <Anchor component={Link} to="/applications" size="sm" c="var(--mantine-color-text)">
                  <b>{active.length}</b> active
                </Anchor>
                <Anchor component={Link} to="/interviews" size="sm" c="var(--mantine-color-text)">
                  <b>{booked.length}</b> {booked.length === 1 ? "interview" : "interviews"} in the next two
                  weeks
                </Anchor>
                <Anchor component={Link} to="/offers" size="sm" c="var(--mantine-color-text)">
                  <b>{offers.length}</b> {offers.length === 1 ? "offer" : "offers"} to answer
                </Anchor>
              </Group>
              {pipeline.length > 0 && (
                <>
                  <Progress.Root size={16} aria-label="Active applications by stage">
                    {pipeline.map(({ stage, count }) => (
                      <Tooltip key={stage.id} label={`${stage.name}: ${count}`}>
                        <Progress.Section value={(count / active.length) * 100} color={stage.color}>
                          <Progress.Label>{count}</Progress.Label>
                        </Progress.Section>
                      </Tooltip>
                    ))}
                  </Progress.Root>
                  <Group gap="md" mt={6}>
                    {pipeline.map(({ stage, count }) => (
                      <Text key={stage.id} size="xs" c="dimmed">
                        <Text span c={`${stage.color}.6`} fw={700}>
                          ●
                        </Text>{" "}
                        {stage.name} {count}
                      </Text>
                    ))}
                  </Group>
                </>
              )}
            </Card>
          )}

          {/* Wide screens: what to do now on the left, what's ahead and who you're waiting on beside it. */}
          <Grid gap="xl">
            <Grid.Col span={{ base: 12, lg: 7 }}>
              <Bucket
                id="your-move"
                title="Your move"
                hint="Things to do now"
                count={yourMove}
                empty={
                  <Group gap="sm" wrap="nowrap">
                    <IconConfetti size={28} stroke={1.4} />
                    <div>
                      <Text fw={600}>All caught up</Text>
                      <Text size="sm" c="dimmed">
                        Nothing needs you right now. Replies, follow-ups and your to-dos show up here.
                      </Text>
                    </div>
                  </Group>
                }
              >
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
                <Section
                  title="Offers to answer"
                  count={offers.length}
                  hint="Reply due in the next two weeks"
                >
                  {offers.map((o) => (
                    <OfferLine key={o.id} offer={o} today={data.today} />
                  ))}
                </Section>
                <Section
                  title="How did it go?"
                  count={data.awaiting_outcome.length + meetingsToClose.length}
                  hint="Their time has passed"
                >
                  {data.awaiting_outcome.map((i) => (
                    <InterviewLine key={i.id} interview={i} action={<InterviewOutcome interview={i} />} />
                  ))}
                  {meetingsToClose.map((m) => (
                    <MeetingLine
                      key={m.id}
                      meeting={m}
                      action={
                        <Group gap={6} className={classes.actions}>
                          <MeetingOutcome meeting={m} />
                        </Group>
                      }
                    />
                  ))}
                </Section>
                <TodosSection todos={todosNow} />
                <Section
                  title="Follow up"
                  count={data.follow_ups.length}
                  hint="Follow-up date is today or earlier"
                >
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
                <Section
                  title="Roles to decide"
                  count={rolesToDecide.length}
                  hint="Apply, mark interested, or pass on each"
                >
                  {rolesToDecide.map((r) => (
                    <RoleLine key={r.id} role={r} />
                  ))}
                </Section>
              </Bucket>
            </Grid.Col>

            <Grid.Col span={{ base: 12, lg: 5 }}>
              <Stack gap="xl">
                <Bucket
                  id="coming-up"
                  title="Coming up"
                  hint="Interviews, calls and to-dos by date; nothing to do yet"
                  count={comingUp.length}
                  empty={
                    <Text size="sm" c="dimmed">
                      No interviews, calls or dated to-dos ahead.
                    </Text>
                  }
                >
                  {comingUp.length > 0 && <div className={classes.rows}>{comingUp.map((c) => c.node)}</div>}
                </Bucket>

                <Bucket
                  id="waiting-on-them"
                  title="Waiting on them"
                  hint="Red means time to chase"
                  count={waitingOn}
                  empty={
                    <Text size="sm" c="dimmed">
                      You're not waiting on anyone.
                    </Text>
                  }
                >
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
                    title="Gone quiet"
                    count={data.stale.length}
                    hint="No activity for longer than their stage allows"
                  >
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
                </Bucket>
              </Stack>
            </Grid.Col>
          </Grid>

          <Accordion variant="contained" multiple>
            <Accordion.Item value="recent">
              <Accordion.Control>Recent activity</Accordion.Control>
              <Accordion.Panel>
                {past.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    Nothing in the last two weeks.
                  </Text>
                ) : (
                  past.map((item) => <TimelineRow key={item.id} item={item} showDate />)
                )}
                <Anchor component={Link} to="/timeline" size="sm" mt="xs" display="inline-block">
                  Full timeline
                </Anchor>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="how">
              <Accordion.Control>How it works</Accordion.Control>
              <Accordion.Panel>
                <HowItWorks />
              </Accordion.Panel>
            </Accordion.Item>
          </Accordion>
        </>
      )}
      <ApplicationDrawer id={openId} onClose={() => setOpenId(null)} />
    </Stack>
  );
}
