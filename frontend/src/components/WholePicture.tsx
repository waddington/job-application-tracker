import { Card, Loader, Text, Title } from "@mantine/core";
import { useTranslation } from "react-i18next";

import { useWholeFlow } from "../api/insightHooks";
import { SankeyChart } from "./SankeyChart";

/**
 * The whole picture: every role from where it came from (a recruiter, a referral, or you found
 * it) to passing on it, still deciding, or applying and where that went, with a spur from each
 * stage to what's still waiting there.
 */
export function WholePicture({ since }: { since?: string }) {
  const { t } = useTranslation("insights");
  const { data: flow, isLoading, isError } = useWholeFlow(since);
  return (
    <Card withBorder>
      <Title order={4}>{t("whole.title")}</Title>
      <Text size="sm" c="dimmed" mb="md">
        {flow ? t("whole.intro", { count: flow.applications }) : t("whole.introLoading")}
      </Text>
      {isLoading ? (
        <Loader />
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
