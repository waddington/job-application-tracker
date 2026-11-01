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
import { Trans, useTranslation } from "react-i18next";

import { InterviewOutcome } from "../components/OutcomeNotes";
import { RescheduleButton } from "../components/Reschedule";
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
import { NewApplicationButton } from "../components/HeaderButtons";
import { HowItWorks } from "../components/HowItWorks";
import { PersonChase, waitingOrChased } from "../components/PersonChase";
import { StageBadge } from "../components/StageBadge";
import { i18n } from "../i18n";
import { formatDay } from "../utils/format";
import { roundLabel } from "../utils/rounds";
import { stageName } from "../utils/stageName";
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
      // The body is for an older server; this one words it and saves its message (docs/rfc/i18n.md).
      await log.mutateAsync({
        id: row.id,
        body: { kind: "manual", summary: "Followed up", data: {} },
        appText: "followed_up",
      });
      await update.mutateAsync({ id: row.id, body: { follow_up_on: null } });
    },
  });
}

function FollowedUpButton({ row }: { row: ApplicationRow }) {
  const { t } = useTranslation("today");
  const done = useFollowedUp();
  return (
    <Button size="compact-xs" variant="light" loading={done.isPending} onClick={() => done.mutate(row)}>
      {t("rows.followedUp")}
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
  const { t } = useTranslation("today");
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
          aria-label={t("rows.open", { company: row.company_name })}
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
          <StageBadge id={row.stage} stage={stages.get(row.stage)} fallback={row.stage_name} />
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
  const { t } = useTranslation("today");
  const when = interview.starts_at ?? interview.deadline_at;
  return (
    <Row
      who={
        <>
          <Text fw={600} size="sm" truncate="end">
            {roundLabel(interview)}
          </Text>
          <Anchor component={Link} to={`/applications/${interview.application_id}`} size="xs">
            {t("rows.where", { company: interview.company_name, role: interview.role_title })}
          </Anchor>
        </>
      }
      status={
        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap" }}>
          {when
            ? interview.starts_at
              ? formatDateTime(when)
              : t("rows.due", { when: formatDateTime(when) })
            : t("rows.notBooked")}
        </Text>
      }
      actions={action}
    />
  );
}

function OfferLine({ offer, today }: { offer: Offer; today: string }) {
  const { t } = useTranslation("today");
  const overdue = offer.respond_by! < today;
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <div style={{ minWidth: 0 }}>
        <Text fw={600} size="sm" truncate="end">
          {headline(offer)}
        </Text>
        <Anchor component={Link} to={`/applications/${offer.application_id}`} size="xs">
          {t("rows.where", { company: offer.company_name, role: offer.role_title })}
        </Anchor>
      </div>
      <Text size="xs" c={overdue ? "red" : "orange"} ta="right" style={{ whiteSpace: "nowrap" }}>
        {t(overdue ? "rows.replyWasDue" : "rows.replyBy", { date: formatDate(offer.respond_by) })}
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
  const { t } = useTranslation("today");
  const [showDone, setShowDone] = useState(false);
  const { data: done } = useTodos({ status: "done" }, showDone);
  return (
    <Stack gap="xs" role="group" aria-label={t("sections.todos")}>
      <SectionLabel title={t("sections.todos")} count={todos.length} hint={t("sections.todosHint")} />
      {todos.length > 0 && (
        <div className={classes.rows}>
          {todos.map((todo) => (
            <TodoLine key={todo.id} todo={todo} />
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
        {showDone ? t("todos.hideDone") : t("todos.doneRecently")}
      </Anchor>
      {showDone &&
        (done?.length ? (
          <div className={classes.rows}>
            {done.slice(0, 10).map((todo) => (
              <TodoLine key={todo.id} todo={todo} />
            ))}
          </div>
        ) : (
          <Text size="xs" c="dimmed">
            {t("todos.noneDone")}
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
  const { t } = useTranslation("today");
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
              aria-label={t("groupBadge", { count, group: title })}
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

/** A stage's colour, one shade darker, for its dot in the pipeline's legend. */
const shade = (color: string) => `${color}.6`;

/**
 * The home page: what's yours to do now, what's coming up and who you're waiting on, under a
 * strip of numbers and the pipeline (PRD FR18, US5). It replaced the separate Overview and Next
 * actions pages, which overlapped.
 */
export function TodayPage() {
  const { t } = useTranslation("today");
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
      node: (
        <InterviewLine
          key={i.id}
          interview={i}
          action={i.starts_at ? <RescheduleButton interview={i} /> : undefined}
        />
      ),
    })),
    ...todosLater.map((todo) => ({
      key: todo.id,
      at: dayjs(todo.due_on).format(),
      node: <TodoLine key={todo.id} todo={todo} />,
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
    rolesToDecide.length ? t("noApplications.rolesToDecide", { count: rolesToDecide.length }) : null,
    meetings.length ? t("noApplications.callsComingUp", { count: meetings.length }) : null,
    contacts?.length ? t("noApplications.peopleAdded", { count: contacts.length }) : null,
  ].filter(Boolean);

  return (
    <Stack maw={1600}>
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>{t("title")}</Title>
          <Text c="dimmed" size="sm">
            {formatDay(today, "weekdayDayMonth", i18n.language)}
          </Text>
        </div>
      </Group>

      {isLoading || waitForApps || settling ? (
        <Loader />
      ) : !data ? (
        <Text c="red" size="sm">
          {t("loadFailed")}
        </Text>
      ) : blank ? (
        <Card withBorder padding="lg">
          <Title order={3} size="h4" mb="xs">
            {t("gettingStarted.title")}
          </Title>
          <Text size="sm" c="dimmed" mb="md">
            {t("gettingStarted.body")}
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
                    {t("noApplications.title")}
                  </Title>
                  <Text size="sm" c="dimmed">
                    {sofar.length
                      ? t("noApplications.soFar", { list: sofar.join(t("noApplications.listJoiner")) })
                      : ""}
                    {rolesToDecide.length ? t("noApplications.applyForRole") : t("noApplications.addOne")}
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
                  <Trans t={t} i18nKey="numbers.active" count={active.length} components={{ b: <b /> }} />
                </Anchor>
                <Anchor component={Link} to="/interviews" size="sm" c="var(--mantine-color-text)">
                  <Trans t={t} i18nKey="numbers.interviews" count={booked.length} components={{ b: <b /> }} />
                </Anchor>
                <Anchor component={Link} to="/offers" size="sm" c="var(--mantine-color-text)">
                  <Trans t={t} i18nKey="numbers.offers" count={offers.length} components={{ b: <b /> }} />
                </Anchor>
              </Group>
              {pipeline.length > 0 && (
                <>
                  <Progress.Root size={16} aria-label={t("numbers.pipeline")}>
                    {pipeline.map(({ stage, count }) => (
                      <Tooltip
                        key={stage.id}
                        label={t("numbers.stageCount", { stage: stageName(stage), count })}
                      >
                        <Progress.Section value={(count / active.length) * 100} color={stage.color}>
                          <Progress.Label>{count}</Progress.Label>
                        </Progress.Section>
                      </Tooltip>
                    ))}
                  </Progress.Root>
                  <Group gap="md" mt={6}>
                    {pipeline.map(({ stage, count }) => (
                      <Text key={stage.id} size="xs" c="dimmed">
                        <Text span c={shade(stage.color)} fw={700}>
                          ●
                        </Text>{" "}
                        {stageName(stage)} {count}
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
                title={t("yourMove.title")}
                hint={t("yourMove.hint")}
                count={yourMove}
                empty={
                  <Group gap="sm" wrap="nowrap">
                    <IconConfetti size={28} stroke={1.4} />
                    <div>
                      <Text fw={600}>{t("yourMove.caughtUp")}</Text>
                      <Text size="sm" c="dimmed">
                        {t("yourMove.caughtUpBody")}
                      </Text>
                    </div>
                  </Group>
                }
              >
                <Section
                  title={t("sections.toRead")}
                  count={toRead.length + toReadPeople.length}
                  hint={t("sections.toReadHint")}
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
                <Section title={t("sections.offers")} count={offers.length} hint={t("sections.offersHint")}>
                  {offers.map((o) => (
                    <OfferLine key={o.id} offer={o} today={data.today} />
                  ))}
                </Section>
                <Section
                  title={t("sections.outcome")}
                  count={data.awaiting_outcome.length + meetingsToClose.length}
                  hint={t("sections.outcomeHint")}
                >
                  {data.awaiting_outcome.map((i) => (
                    <InterviewLine
                      key={i.id}
                      interview={i}
                      action={
                        <>
                          <InterviewOutcome interview={i} />
                          <RescheduleButton interview={i} />
                        </>
                      }
                    />
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
                  title={t("sections.followUp")}
                  count={data.follow_ups.length}
                  hint={t("sections.followUpHint")}
                >
                  {data.follow_ups.map((r) => (
                    <AppLine
                      key={r.id}
                      row={r}
                      onOpen={setOpenId}
                      detail={t("rows.followUpDue", { date: formatDate(r.follow_up_on) })}
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
                  title={t("sections.roles")}
                  count={rolesToDecide.length}
                  hint={t("sections.rolesHint")}
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
                  title={t("comingUp.title")}
                  hint={t("comingUp.hint")}
                  count={comingUp.length}
                  empty={
                    <Text size="sm" c="dimmed">
                      {t("comingUp.none")}
                    </Text>
                  }
                >
                  {comingUp.length > 0 && <div className={classes.rows}>{comingUp.map((c) => c.node)}</div>}
                </Bucket>

                <Bucket
                  id="waiting-on-them"
                  title={t("waitingOn.title")}
                  hint={t("waitingOn.hint")}
                  count={waitingOn}
                  empty={
                    <Text size="sm" c="dimmed">
                      {t("waitingOn.none")}
                    </Text>
                  }
                >
                  <Section
                    title={t("sections.waiting")}
                    count={waiting.length + waitingPeople.length}
                    hint={t("sections.waitingHint")}
                  >
                    {waiting.map((r) => (
                      <AppLine
                        key={r.id}
                        row={r}
                        onOpen={setOpenId}
                        detail={
                          <Text span size="xs" c={overdue(r) ? "red" : "dimmed"}>
                            {waitingLabel(r.awaiting_reply_since!)}
                            {overdue(r) ? t("rows.timeToChase") : ""}
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
                    title={t("sections.stale")}
                    count={data.stale.length}
                    hint={t("sections.staleHint")}
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
              <Accordion.Control>{t("recent.title")}</Accordion.Control>
              <Accordion.Panel>
                {past.length === 0 ? (
                  <Text size="sm" c="dimmed">
                    {t("recent.none")}
                  </Text>
                ) : (
                  past.map((item) => <TimelineRow key={item.id} item={item} showDate />)
                )}
                <Anchor component={Link} to="/timeline" size="sm" mt="xs" display="inline-block">
                  {t("recent.timeline")}
                </Anchor>
              </Accordion.Panel>
            </Accordion.Item>
            <Accordion.Item value="how">
              <Accordion.Control>{t("howItWorksTitle")}</Accordion.Control>
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
