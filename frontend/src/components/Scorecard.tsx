import { Anchor, Badge, Card, Group, Loader, SegmentedControl, Table, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { PersonName } from "./GhostMark";
import { useScorecard, type Score } from "../api/insightHooks";
import { i18n } from "../i18n";
import { ago } from "../utils/time";

type View = "recruiters" | "agencies";

const percent = (n: number, of: number) =>
  of ? i18n.t("insights:percent", { percent: Math.round((100 * n) / of) }) : "—";

function firstUpdate(days: number | null | undefined) {
  if (days == null) return "—";
  if (days < 1) return i18n.t("insights:scorecard.sameDay");
  return i18n.t("insights:scorecard.days", {
    count: days,
    value: days % 1 === 0 ? days : days.toFixed(1),
  });
}

function lastContact(iso: string | null | undefined) {
  if (!iso) return "—";
  // Calendar days, so yesterday evening is "yesterday" this morning.
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return ago(Math.round((day(new Date()) - day(new Date(iso))) / 86_400_000));
}

function Outcomes({ s }: { s: Score }) {
  const { t } = useTranslation("insights");
  const parts: [string, number, string, string][] = [
    ["active", s.active, t("scorecard.active", { count: s.active }), "blue"],
    ["accepted", s.success, t("scorecard.accepted", { count: s.success }), "green"],
    ["ghosted", s.ghosted, t("scorecard.ghosted", { count: s.ghosted }), "dark"],
    ["closed", s.closed, t("scorecard.closed", { count: s.closed }), "red"],
  ];
  return (
    <Group gap={4}>
      {parts
        .filter(([, n]) => n > 0)
        .map(([key, , text, color]) => (
          <Badge key={key} size="sm" variant="light" color={color}>
            {text}
          </Badge>
        ))}
    </Group>
  );
}

/** Recruiter and agency scorecard (PRD FR20): who sends roles that go somewhere. */
export function ScorecardCard({ since }: { since?: string }) {
  const { t } = useTranslation("insights");
  const [view, setView] = useState<View>("recruiters");
  const { data, isLoading, isError } = useScorecard(since);
  const rows = data?.[view] ?? [];
  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap" mb="sm">
        <div>
          <Title order={4}>{t("scorecard.title")}</Title>
          <Text size="sm" c="dimmed">
            {t("scorecard.intro")}
          </Text>
        </div>
        <SegmentedControl
          aria-label={t("scorecard.by")}
          size="xs"
          value={view}
          onChange={(v) => setView(v as View)}
          data={[
            { value: "recruiters", label: t("scorecard.recruiters") },
            { value: "agencies", label: t("scorecard.agencies") },
          ]}
        />
      </Group>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <Text c="red">{t("scorecard.loadFailed")}</Text>
      ) : !rows.length ? (
        <Text size="sm" c="dimmed">
          {view === "recruiters" ? t("scorecard.noneRecruiters") : t("scorecard.noneAgencies")}
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  {view === "recruiters" ? t("scorecard.recruiter") : t("scorecard.agency")}
                </Table.Th>
                <Table.Th>{t("scorecard.roles")}</Table.Th>
                <Table.Th>{t("scorecard.interviewed")}</Table.Th>
                <Table.Th>{t("scorecard.now")}</Table.Th>
                <Table.Th>{t("scorecard.firstUpdate")}</Table.Th>
                <Table.Th>{t("scorecard.lastContact")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {rows.map((s) => {
                const agencyId = view === "agencies" ? s.id : s.agency_id;
                return (
                  <Table.Tr key={s.id}>
                    <Table.Td>
                      {view === "agencies" ? (
                        <Anchor component={Link} to={`/agencies/${s.id}`} size="sm">
                          {s.name}
                        </Anchor>
                      ) : (
                        <>
                          <Text size="sm">
                            <PersonName id={s.id} name={s.name} />
                          </Text>
                          {agencyId && s.agency_name && (
                            <Anchor component={Link} to={`/agencies/${agencyId}`} size="xs" c="dimmed">
                              {s.agency_name}
                            </Anchor>
                          )}
                        </>
                      )}
                    </Table.Td>
                    <Table.Td>{s.roles}</Table.Td>
                    <Table.Td>
                      {s.interviewed}{" "}
                      <Text span size="xs" c="dimmed">
                        ({percent(s.interviewed, s.roles)})
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Outcomes s={s} />
                    </Table.Td>
                    <Table.Td>{firstUpdate(s.median_first_update_days)}</Table.Td>
                    <Table.Td>{lastContact(s.last_contact)}</Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Card>
  );
}
