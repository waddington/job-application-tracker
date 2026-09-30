import { Anchor, Badge, Card, Group, Loader, SegmentedControl, Table, Text, Title } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { useScorecard, type Score } from "../api/insightHooks";
import { ago } from "../utils/time";

type View = "recruiters" | "agencies";

const percent = (n: number, of: number) => (of ? `${Math.round((100 * n) / of)}%` : "—");

function firstUpdate(days: number | null | undefined) {
  if (days == null) return "—";
  if (days < 1) return "same day";
  return `${days % 1 === 0 ? days : days.toFixed(1)} day${days === 1 ? "" : "s"}`;
}

function lastContact(iso: string | null | undefined) {
  if (!iso) return "—";
  return ago(Math.floor((Date.now() - Date.parse(iso)) / 86_400_000));
}

function Outcomes({ s }: { s: Score }) {
  const parts: [number, string, string][] = [
    [s.active, "active", "blue"],
    [s.success, "accepted", "green"],
    [s.ghosted, "ghosted", "dark"],
    [s.closed, "closed", "red"],
  ];
  return (
    <Group gap={4}>
      {parts
        .filter(([n]) => n > 0)
        .map(([n, label, color]) => (
          <Badge key={label} size="sm" variant="light" color={color}>
            {n} {label}
          </Badge>
        ))}
    </Group>
  );
}

/** Recruiter and agency scorecard (PRD FR20): who sends roles that go somewhere. */
export function ScorecardCard({ since }: { since?: string }) {
  const [view, setView] = useState<View>("recruiters");
  const { data, isLoading, isError } = useScorecard(since);
  const rows = data?.[view] ?? [];
  return (
    <Card withBorder>
      <Group justify="space-between" wrap="wrap" mb="sm">
        <div>
          <Title order={4}>Recruiter scorecard</Title>
          <Text size="sm" c="dimmed">
            For the roles each one put you forward for. First update is the median time from adding an
            application to the first call, email, message or stage move.
          </Text>
        </div>
        <SegmentedControl
          aria-label="Scorecard by"
          size="xs"
          value={view}
          onChange={(v) => setView(v as View)}
          data={[
            { value: "recruiters", label: "Recruiters" },
            { value: "agencies", label: "Agencies" },
          ]}
        />
      </Group>
      {isLoading ? (
        <Loader />
      ) : isError ? (
        <Text c="red">Couldn't load the scorecard.</Text>
      ) : !rows.length ? (
        <Text size="sm" c="dimmed">
          No roles from {view} in this period. Add a recruiter or agency to an application to see it here.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{view === "recruiters" ? "Recruiter" : "Agency"}</Table.Th>
                <Table.Th>Roles</Table.Th>
                <Table.Th>Interviewed</Table.Th>
                <Table.Th>Where they are now</Table.Th>
                <Table.Th>First update</Table.Th>
                <Table.Th>Last contact</Table.Th>
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
                          <Text size="sm">{s.name}</Text>
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
