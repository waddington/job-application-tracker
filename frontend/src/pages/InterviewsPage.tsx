import { Anchor, Badge, Card, Group, Loader, Stack, Table, Text, Title } from "@mantine/core";
import { IconCalendarEvent } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";

import { useInterviews, type Interview } from "../api/interviewHooks";
import { roundStatus } from "../components/Interviews";
import { formatDateTime } from "../utils/time";

function InterviewTable({ interviews, empty }: { interviews: Interview[]; empty: string }) {
  if (!interviews.length) {
    return (
      <Text size="sm" c="dimmed">
        {empty}
      </Text>
    );
  }
  return (
    <Table highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>When</Table.Th>
          <Table.Th>Round</Table.Th>
          <Table.Th>Application</Table.Th>
          <Table.Th>Status</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {interviews.map((i) => {
          const when = i.starts_at ?? i.deadline_at;
          return (
            <Table.Tr key={i.id}>
              <Table.Td>
                <Text size="sm">
                  {when ? `${!i.starts_at ? "Due " : ""}${formatDateTime(when)}` : "Not booked yet"}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {i.label}
                </Text>
              </Table.Td>
              <Table.Td>
                <Anchor component={Link} to={`/applications/${i.application_id}`} size="sm">
                  {i.company_name}
                </Anchor>
                <Text size="xs" c="dimmed">
                  {i.role_title}
                </Text>
              </Table.Td>
              <Table.Td>
                <Badge size="sm" variant="light" color={roundStatus(i).color}>
                  {roundStatus(i).label}
                </Badge>
              </Table.Td>
            </Table.Tr>
          );
        })}
      </Table.Tbody>
    </Table>
  );
}

/** Every interview round across applications: what's coming up, then everything else, newest first. */
export function InterviewsPage() {
  // "Upcoming" starts at your local midnight, so this morning's interview still counts today.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const upcomingQuery = useInterviews({ upcoming: true, since: midnight.toISOString() });
  const allQuery = useInterviews({});
  const isLoading = upcomingQuery.isLoading || allQuery.isLoading;
  const upcoming = upcomingQuery.data;
  const upcomingIds = new Set((upcoming ?? []).map((i) => i.id));
  const rest = (allQuery.data ?? []).filter((i) => !upcomingIds.has(i.id)).reverse();

  return (
    <Stack maw={1100}>
      <Group gap="sm">
        <IconCalendarEvent size={26} stroke={1.6} />
        <Title order={2}>Interviews</Title>
      </Group>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <Card withBorder>
            <Title order={4} mb="sm">
              Coming up
            </Title>
            <InterviewTable
              interviews={upcoming ?? []}
              empty="Nothing booked. Add interview rounds from an application's page."
            />
          </Card>
          <Card withBorder>
            <Title order={4} mb="sm">
              Earlier and cancelled
            </Title>
            <InterviewTable interviews={rest} empty="None yet." />
          </Card>
        </>
      )}
    </Stack>
  );
}
