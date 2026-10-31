import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Loader,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from "@mantine/core";
import { IconCalendarEvent, IconPencil } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useInterviews, type Interview } from "../api/interviewHooks";
import { InterviewFormModal } from "../components/InterviewFormModal";
import { roundStatus } from "../components/Interviews";
import { RescheduledBadge, RescheduleModal } from "../components/Reschedule";
import { roundLabel } from "../utils/rounds";
import { formatDateTime } from "../utils/time";

/** Edit a round, or move a booked one to another time. */
function RoundActions({ interview }: { interview: Interview }) {
  const { t } = useTranslation("interviews");
  const [open, setOpen] = useState<"edit" | "reschedule" | null>(null);
  const label = roundLabel(interview);
  return (
    <Group gap={4} wrap="nowrap" justify="flex-end">
      {interview.status === "scheduled" && interview.starts_at && (
        <Button
          size="compact-xs"
          variant="light"
          aria-label={t("reschedule.named", { label })}
          onClick={() => setOpen("reschedule")}
        >
          {t("reschedule.action")}
        </Button>
      )}
      <Tooltip label={t("edit")}>
        <ActionIcon variant="subtle" aria-label={t("editNamed", { label })} onClick={() => setOpen("edit")}>
          <IconPencil size={16} />
        </ActionIcon>
      </Tooltip>
      {open === "reschedule" && <RescheduleModal interview={interview} onClose={() => setOpen(null)} />}
      {open === "edit" && (
        <InterviewFormModal
          opened
          onClose={() => setOpen(null)}
          applicationId={interview.application_id}
          interview={interview}
          nextRound={interview.round ?? 1}
        />
      )}
    </Group>
  );
}

function InterviewTable({ interviews, empty }: { interviews: Interview[]; empty: string }) {
  const { t } = useTranslation("interviews");
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
          <Table.Th>{t("page.when")}</Table.Th>
          <Table.Th>{t("page.round")}</Table.Th>
          <Table.Th>{t("page.application")}</Table.Th>
          <Table.Th>{t("page.status")}</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {interviews.map((i) => {
          const when = i.starts_at ?? i.deadline_at;
          return (
            <Table.Tr key={i.id}>
              <Table.Td>
                <Text size="sm">
                  {!when
                    ? t("notBooked")
                    : i.starts_at
                      ? formatDateTime(when)
                      : t("due", { when: formatDateTime(when) })}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm" fw={600}>
                  {roundLabel(i)}
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
                <Group gap={4}>
                  <Badge size="sm" variant="light" color={roundStatus(i).color}>
                    {roundStatus(i).label}
                  </Badge>
                  <RescheduledBadge interview={i} />
                </Group>
              </Table.Td>
              <Table.Td>
                <RoundActions interview={i} />
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
  const { t } = useTranslation("interviews");
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
        <Title order={2}>{t("page.title")}</Title>
      </Group>
      {isLoading ? (
        <Loader />
      ) : (
        <>
          <Card withBorder>
            <Title order={4} mb="sm">
              {t("page.comingUp")}
            </Title>
            <InterviewTable interviews={upcoming ?? []} empty={t("page.comingUpEmpty")} />
          </Card>
          <Card withBorder>
            <Title order={4} mb="sm">
              {t("page.earlier")}
            </Title>
            <InterviewTable interviews={rest} empty={t("page.earlierEmpty")} />
          </Card>
        </>
      )}
    </Stack>
  );
}
