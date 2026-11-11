import {
  Anchor,
  Badge,
  Card,
  Group,
  Loader,
  SegmentedControl,
  Stack,
  Table,
  Text,
  Title,
} from "@mantine/core";
import { useLocalStorage } from "@mantine/hooks";
import { IconCalendarEvent } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useInterviews, type Interview } from "../api/interviewHooks";
import { useDesign } from "../components/CalendarConcepts";
import { InterviewCalendar } from "../components/InterviewCalendar";
import { roundStatus } from "../components/Interviews";
import { RescheduledBadge, wasText } from "../components/Reschedule";
import { RecruiterLine } from "../components/RecruiterLine";
import { RoundActions } from "../components/RoundActions";
import { toBook } from "../utils/calendar";
import { roundLabel } from "../utils/rounds";
import text from "../text.module.css";
import { formatDateTime } from "../utils/time";

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
    // On a phone the row is wider than the card: it scrolls sideways, so its buttons can be reached.
    <Table.ScrollContainer minWidth={640}>
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
                  <Text size="sm" className={text.keepWords}>
                    {i.needs_new_time_since
                      ? wasText(i)
                      : !when
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
                    <RecruiterLine id={i.recruiter_id} name={i.recruiter_name}>
                      {i.role_title}
                    </RecruiterLine>
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
    </Table.ScrollContainer>
  );
}

type View = "calendar" | "list";

/**
 * Every interview round across applications: a calendar (the first choice), with the rounds still to
 * book under it; or the list, what's coming up, then everything else, newest first.
 */
export function InterviewsPage() {
  const { t } = useTranslation("interviews");
  const [view, setView] = useLocalStorage<View>({
    key: "jat.interviews.view",
    defaultValue: "calendar",
    getInitialValueInEffect: false, // no flash of the calendar when the list was chosen
  });
  // ?view=list or ?view=calendar in the address opens that view (and remembers it), as on Applications.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("view");
    if (requested !== "list" && requested !== "calendar") return;
    setView(requested);
    const url = new URL(window.location.href);
    url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url);
  }, [setView]);
  // "Upcoming" starts at your local midnight, so this morning's interview still counts today.
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const upcomingQuery = useInterviews({ upcoming: true, since: midnight.toISOString() });
  const allQuery = useInterviews({});
  const isLoading = upcomingQuery.isLoading || allQuery.isLoading;
  const all = allQuery.data ?? [];
  const upcoming = upcomingQuery.data;
  const upcomingIds = new Set((upcoming ?? []).map((i) => i.id));
  // Waiting for a new time: on top, since it's yours to sort out. Their old time isn't coming up.
  const waiting = all.filter((i) => i.status === "scheduled" && i.needs_new_time_since);
  const rest = all.filter((i) => !upcomingIds.has(i.id) && !waiting.includes(i)).reverse();
  // On the calendar: those waiting for a new time and those with no time yet, under it.
  const unbooked = toBook(all);
  const { design, designSwitch } = useDesign();

  return (
    <Stack maw={1100}>
      <Group justify="space-between">
        <Group gap="sm">
          <IconCalendarEvent size={26} stroke={1.6} />
          <Title order={2}>{t("page.title")}</Title>
        </Group>
        <SegmentedControl
          value={view}
          onChange={(v) => setView(v as View)}
          data={[
            { value: "calendar", label: t("page.view.calendar") },
            { value: "list", label: t("page.view.list") },
          ]}
          aria-label={t("page.view.label")}
        />
      </Group>
      {isLoading ? (
        <Loader />
      ) : view === "calendar" ? (
        <>
          {designSwitch}
          <InterviewCalendar rounds={all} design={design} />
          {unbooked.length > 0 && (
            <Card withBorder>
              <Title order={4} mb="sm">
                {t("calendar.toBook")}
              </Title>
              <InterviewTable interviews={unbooked} empty="" />
            </Card>
          )}
        </>
      ) : (
        <>
          {waiting.length > 0 && (
            <Card withBorder>
              <Title order={4} mb="sm">
                {t("page.needsNewTime")}
              </Title>
              <InterviewTable interviews={waiting} empty="" />
            </Card>
          )}
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
