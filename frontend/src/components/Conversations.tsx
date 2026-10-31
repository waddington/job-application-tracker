import {
  Anchor,
  Badge,
  Card,
  Group,
  Loader,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import dayjs from "dayjs";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

import {
  useConversations,
  type ConversationAgency,
  type ConversationPerson,
  type Conversations,
} from "../api/insightHooks";
import { i18n } from "../i18n";
import { PersonName } from "./GhostMark";
import { formatDate } from "../utils/time";
import { SankeyChart } from "./SankeyChart";
import { daysText } from "./Scorecard";

type Tally = Conversations["total"];

const percent = (rate: number | null | undefined) =>
  rate == null ? "—" : i18n.t("insights:percent", { percent: Math.round(rate * 100) });

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <Paper withBorder p="sm" radius="md">
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
        {label}
      </Text>
      <Text size="xl" fw={700}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </Paper>
  );
}

/** Where applied roles went, as small badges. */
function Outcomes({ tally }: { tally: Tally }) {
  const { t } = useTranslation("insights");
  const parts: [string, number, string, string][] = [
    [
      "progress",
      tally.in_progress,
      t("conversations.outcomes.inProgress", { count: tally.in_progress }),
      "cyan",
    ],
    ["offer", tally.offers, t("conversations.outcomes.offer", { count: tally.offers }), "green"],
    ["closed", tally.closed, t("conversations.outcomes.closed", { count: tally.closed }), "red"],
    ["ghosted", tally.ghosted, t("conversations.outcomes.ghosted", { count: tally.ghosted }), "dark"],
  ];
  const shown = parts.filter(([, n]) => n > 0);
  if (!shown.length) return <Text size="sm">—</Text>;
  return (
    <Group gap={4}>
      {shown.map(([key, , text, color]) => (
        <Badge key={key} size="sm" variant="light" color={color}>
          {text}
        </Badge>
      ))}
    </Group>
  );
}

type View = "people" | "agencies";

function WhoTable({ data }: { data: Conversations }) {
  const { t } = useTranslation("insights");
  const [view, setView] = useState<View>("people");
  const rows: (ConversationPerson | ConversationAgency)[] = view === "people" ? data.people : data.agencies;
  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap" mb="sm">
        <div>
          <Title order={4}>{t("conversations.who.title")}</Title>
          <Text size="sm" c="dimmed">
            {t("conversations.who.intro")}
          </Text>
        </div>
        <SegmentedControl
          aria-label={t("conversations.who.by")}
          size="xs"
          value={view}
          onChange={(v) => setView(v as View)}
          data={[
            { value: "people", label: t("conversations.who.people") },
            { value: "agencies", label: t("conversations.who.agencies") },
          ]}
        />
      </Group>
      {!rows.length ? (
        <Text size="sm" c="dimmed">
          {view === "people" ? t("conversations.who.noPeople") : t("conversations.who.noAgencies")}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table striped highlightOnHover verticalSpacing="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  {view === "people" ? t("conversations.who.person") : t("conversations.who.agency")}
                </Table.Th>
                <Table.Th ta="right">{t("conversations.who.calls")}</Table.Th>
                <Table.Th>{t("conversations.who.lastCall")}</Table.Th>
                <Table.Th ta="right">{t("conversations.who.pitched")}</Table.Th>
                <Table.Th ta="right">{t("conversations.who.applied")}</Table.Th>
                <Table.Th ta="right">{t("conversations.who.passed")}</Table.Th>
                <Table.Th ta="right">{t("conversations.who.deciding")}</Table.Th>
                <Table.Th ta="right">{t("conversations.who.applyRate")}</Table.Th>
                <Table.Th ta="right">{t("conversations.who.interviews")}</Table.Th>
                <Table.Th>{t("conversations.who.applications")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((r) => (
                <Table.Tr key={r.id}>
                  <Table.Td>
                    {"people" in r ? (
                      <>
                        <Anchor component={Link} to={`/agencies/${r.id}`} size="sm" fw={600}>
                          {r.name}
                        </Anchor>
                        <Text size="xs" c="dimmed">
                          {t("conversations.who.peopleCount", { count: r.people })}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Group gap={6} wrap="nowrap">
                          <Anchor component={Link} to={`/people/${r.id}`} size="sm" fw={600}>
                            <PersonName id={r.id} name={r.name} />
                          </Anchor>
                          {r.closed_as && (
                            <Badge
                              size="xs"
                              variant="light"
                              color={r.closed_as === "ghosted" ? "dark" : "gray"}
                            >
                              {r.closed_as === "ghosted"
                                ? t("conversations.who.ghosted")
                                : t("conversations.who.notInterested")}
                            </Badge>
                          )}
                        </Group>
                        <Text size="xs" c="dimmed">
                          {r.agency_name ?? r.company_name ?? t("conversations.who.independent")}
                        </Text>
                      </>
                    )}
                  </Table.Td>
                  <Table.Td ta="right">{r.calls_held}</Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {r.last_call ? formatDate(dayjs(r.last_call).format("YYYY-MM-DD")) : "—"}
                    </Text>
                  </Table.Td>
                  <Table.Td ta="right">{r.pitched}</Table.Td>
                  <Table.Td ta="right">{r.applied}</Table.Td>
                  <Table.Td ta="right">{r.passed}</Table.Td>
                  <Table.Td ta="right">{r.deciding}</Table.Td>
                  <Table.Td ta="right">{percent(r.apply_rate)}</Table.Td>
                  <Table.Td ta="right">{r.interviewed}</Table.Td>
                  <Table.Td>
                    <Outcomes tally={r} />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}

function PassReasons({ data }: { data: Conversations }) {
  const { t } = useTranslation("insights");
  if (!data.pass_reasons.length) return null;
  return (
    <Card withBorder>
      <Title order={4}>{t("conversations.passed.title")}</Title>
      <Text size="sm" c="dimmed" mb="sm">
        {t("conversations.passed.intro")}
      </Text>
      <Stack gap="xs">
        {data.pass_reasons.map((r) => {
          const company = r.company_name;
          const person = r.person_name;
          const date = r.decided_on ? formatDate(r.decided_on) : null;
          return (
            <div key={r.role_id}>
              <Group gap={6} wrap="wrap">
                <Anchor component={Link} to={`/roles/${r.role_id}`} size="sm" fw={600}>
                  {r.role_title}
                </Anchor>
                <Text size="sm" c="dimmed">
                  {person && date
                    ? t("conversations.passed.companyFromDate", { company, person, date })
                    : person
                      ? t("conversations.passed.companyFrom", { company, person })
                      : date
                        ? t("conversations.passed.companyDate", { company, date })
                        : t("conversations.passed.company", { company })}
                </Text>
              </Group>
              <Text size="sm" style={{ overflowWrap: "anywhere" }}>
                {r.reason}
              </Text>
            </div>
          );
        })}
      </Stack>
    </Card>
  );
}

/**
 * Recruiter conversations: what happens before an application. Calls with people, the roles
 * they pitched, which you applied for or passed on, and how the applications went.
 */
export function ConversationsSection({ since }: { since?: string }) {
  const { t } = useTranslation("insights");
  const { data, isLoading, isError } = useConversations(since);
  if (isLoading) return <Loader />;
  if (isError || !data) return <Text c="red">{t("conversations.loadFailed")}</Text>;
  const total = data.total;
  return (
    <Stack>
      <Card withBorder>
        <Title order={4}>{t("conversations.title")}</Title>
        <Text size="sm" c="dimmed" mb="md">
          {t("conversations.intro")}
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 3, md: 5 }} spacing="sm">
          <Stat
            label={t("conversations.stats.callsHeld")}
            value={total.calls_held}
            hint={
              total.calls_booked ? t("conversations.stats.booked", { booked: total.calls_booked }) : undefined
            }
          />
          <Stat
            label={t("conversations.stats.people")}
            value={data.people_talked_to}
            hint={t("conversations.stats.peopleHint")}
          />
          <Stat label={t("conversations.stats.pitched")} value={total.pitched} />
          <Stat
            label={t("conversations.stats.applied")}
            value={total.applied}
            hint={t("conversations.stats.appliedHint", { percent: percent(total.apply_rate) })}
          />
          <Stat label={t("conversations.stats.passed")} value={total.passed} />
          <Stat label={t("conversations.stats.deciding")} value={total.deciding} />
          <Stat
            label={t("conversations.stats.interviews")}
            value={total.interviewed}
            hint={t("conversations.stats.interviewsHint")}
          />
          <Stat
            label={t("conversations.stats.offers")}
            value={total.offers}
            hint={t("conversations.stats.offersHint")}
          />
          <Stat
            label={t("conversations.stats.time")}
            value={daysText(total.median_decide_days)}
            hint={t("conversations.stats.timeHint")}
          />
          <Stat
            label={t("conversations.stats.ghosted")}
            value={total.ghosted}
            hint={t("conversations.stats.ghostedHint")}
          />
        </SimpleGrid>
        <Title order={5} mt="lg" mb={4}>
          {t("conversations.flow")}
        </Title>
        {total.pitched ? (
          <SankeyChart flow={data.flow} unit="role" />
        ) : (
          <Text size="sm" c="dimmed">
            <Trans t={t} i18nKey="conversations.noPitched" components={{ b: <b /> }} />
          </Text>
        )}
      </Card>
      <WhoTable data={data} />
      <PassReasons data={data} />
    </Stack>
  );
}
