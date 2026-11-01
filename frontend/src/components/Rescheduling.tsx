import { Card, Loader, Stack, Table, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useRescheduling, type Rescheduling, type RescheduledNamed } from "../api/insightHooks";

function MovedList({ title, rows }: { title: string; rows: RescheduledNamed[] }) {
  const { t } = useTranslation("insights");
  if (!rows.length) return null;
  return (
    <Table aria-label={title}>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>{title}</Table.Th>
          <Table.Th ta="right">{t("rescheduling.roundsMoved")}</Table.Th>
          <Table.Th ta="right">{t("rescheduling.movesColumn")}</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {rows.map((r) => (
          <Table.Tr key={r.id}>
            <Table.Td>{r.name}</Table.Td>
            <Table.Td ta="right">{r.moved_rounds}</Table.Td>
            <Table.Td ta="right">{r.moves}</Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function Moved({ data }: { data: Rescheduling }) {
  const { t } = useTranslation("insights");
  const groups: [string, number][] = [
    [t("rescheduling.who.me"), data.by_me],
    [t("rescheduling.who.them"), data.by_them],
    [t("rescheduling.who.mutual"), data.by_mutual],
    [t("rescheduling.who.neither"), data.by_neither],
    [t("rescheduling.who.notRecorded"), data.not_recorded],
  ];
  const listed = data.companies.length > 0 || data.recruiters.length > 0;
  return (
    <Stack gap="sm">
      <Text size="sm">
        {t("rescheduling.moved", { count: data.booked_rounds, moved: data.moved_rounds })}{" "}
        {t("rescheduling.moves", { count: data.moves })}
      </Text>
      <Table aria-label={t("rescheduling.byWho")} maw={360}>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>{t("rescheduling.byWho")}</Table.Th>
            <Table.Th ta="right">{t("rescheduling.movesColumn")}</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {groups.map(([name, n]) => (
            <Table.Tr key={name}>
              <Table.Td>{name}</Table.Td>
              <Table.Td ta="right">{n}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      {data.not_recorded > 0 && (
        <Text size="sm" c="dimmed">
          {t("rescheduling.notRecordedHint")}
        </Text>
      )}
      {listed && (
        <>
          <Text size="sm" c="dimmed">
            {t("rescheduling.listHint", { count: data.min_rounds_listed })}
          </Text>
          <MovedList title={t("rescheduling.company")} rows={data.companies} />
          <MovedList title={t("rescheduling.recruiter")} rows={data.recruiters} />
        </>
      )}
    </Stack>
  );
}

/** How often booked rounds moved and who needed it: counts only, with no claim about what it caused. */
export function ReschedulingCard({ since }: { since?: string }) {
  const { t } = useTranslation("insights");
  const { data, isLoading, isError } = useRescheduling(since);
  return (
    <Card withBorder>
      <Title order={4}>{t("rescheduling.title")}</Title>
      <Text size="sm" c="dimmed" mb="sm">
        {t("rescheduling.intro")}
      </Text>
      {isLoading ? (
        <Loader />
      ) : isError || !data ? (
        <Text c="red">{t("rescheduling.loadFailed")}</Text>
      ) : !data.booked_rounds ? (
        <Text size="sm" c="dimmed">
          {t("rescheduling.noneBooked")}
        </Text>
      ) : !data.moved_rounds ? (
        <Text size="sm">{t("rescheduling.noneMoved", { count: data.booked_rounds })}</Text>
      ) : (
        <Moved data={data} />
      )}
    </Card>
  );
}
