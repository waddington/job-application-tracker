import { Card, Group, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useWholeFlow } from "../api/insightHooks";
import { RoundsNote, RoundsToggle, useShowRounds } from "./RoundsToggle";
import { SankeyChart, SankeySkeleton } from "./SankeyChart";

/**
 * The whole picture: every role from where it came from (a recruiter, a referral, or you found
 * it) to passing on it, still deciding, or applying and where that went, with a spur from each
 * stage to what's still waiting there. Interviewing can be expanded into its rounds.
 */
export function WholePicture({ since }: { since?: string }) {
  const { t } = useTranslation("insights");
  const [rounds, setRounds] = useShowRounds();
  const { data: flow, isLoading, isError, isPlaceholderData } = useWholeFlow(since, rounds);
  return (
    <Card withBorder>
      <Group justify="space-between" align="flex-start" wrap="wrap">
        <Title order={4}>{t("whole.title")}</Title>
        <RoundsToggle checked={rounds} onChange={setRounds} />
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {flow ? t("whole.intro", { count: flow.applications }) : t("whole.introLoading")}
      </Text>
      <RoundsNote on={rounds} flow={flow} placeholder={isPlaceholderData} />
      {isLoading ? (
        <SankeySkeleton />
      ) : isError || !flow ? (
        <Text c="red">{t("whole.loadFailed")}</Text>
      ) : !flow.links.length ? (
        <Text size="sm" c="dimmed">
          {t("whole.empty")}
        </Text>
      ) : (
        <SankeyChart flow={flow} unit="role" label={t("whole.chart", { count: flow.applications })} />
      )}
    </Card>
  );
}
