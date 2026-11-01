import { Card, Group, Loader, SegmentedControl, Select, Stack, Tabs, Text, Title } from "@mantine/core";
import { IconChartSankey } from "@tabler/icons-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { useFlow, useStats, type FlowFilters } from "../api/insightHooks";
import { ConversationsSection } from "../components/Conversations";
import { DocumentPerformanceSection } from "../components/DocumentPerformance";
import { RouteTable, StageTable, WeeklyActivity } from "../components/InsightStats";
import { ReschedulingCard } from "../components/Rescheduling";
import { ScorecardCard } from "../components/Scorecard";
import { SankeyChart } from "../components/SankeyChart";
import { WholePicture } from "../components/WholePicture";

type Range = "all" | "90" | "30";

function sinceFor(range: Range) {
  if (range === "all") return undefined;
  return new Date(Date.now() - Number(range) * 86_400_000).toISOString();
}

type Tab = "whole" | "applications" | "conversations" | "documents";

/**
 * How the search is going (PRD FR19, FR20): the whole picture (every role, from where it came
 * from to where it is now), applications (the Sankey diagram, stage stats,
 * routes, the scorecard, rescheduling), recruiter conversations (calls and the roles people pitch) and CVs and
 * cover letters (version against version), then weekly activity.
 */
export function InsightsPage() {
  const { t } = useTranslation("insights");
  // `since` is fixed when the range is picked, so the query key doesn't change on every render.
  const [range, setRange] = useState<{ range: Range; since?: string }>({ range: "all" });
  const [route, setRoute] = useState("any");
  const [tab, setTab] = useState<Tab>("whole");
  const filters: FlowFilters = {
    since: range.since,
    route: route === "any" ? undefined : (route as FlowFilters["route"]),
  };
  const { data: flow, isLoading, isError } = useFlow(filters);
  const { data: stats, isError: statsError } = useStats(range.since);

  return (
    <Stack maw={1200}>
      <Group justify="space-between" wrap="wrap">
        <Group gap="sm">
          <IconChartSankey size={26} stroke={1.6} />
          <Title order={2}>{t("title")}</Title>
        </Group>
        <SegmentedControl
          aria-label={t("range.label")}
          size="xs"
          data={[
            { value: "all", label: t("range.all") },
            { value: "90", label: t("range.days90") },
            { value: "30", label: t("range.days30") },
          ]}
          value={range.range}
          onChange={(value) => setRange({ range: value as Range, since: sinceFor(value as Range) })}
        />
      </Group>
      <Tabs value={tab} onChange={(v) => setTab((v as Tab) ?? "whole")} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="whole">{t("tabs.whole")}</Tabs.Tab>
          <Tabs.Tab value="applications">{t("tabs.applications")}</Tabs.Tab>
          <Tabs.Tab value="conversations">{t("tabs.conversations")}</Tabs.Tab>
          <Tabs.Tab value="documents">{t("tabs.documents")}</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="whole">
          <WholePicture since={range.since} />
        </Tabs.Panel>
        <Tabs.Panel value="applications">
          <Stack>
            <Card withBorder>
              <Group justify="space-between" mb="md" wrap="wrap">
                <div>
                  <Title order={4}>{t("flow.title")}</Title>
                  <Text size="sm" c="dimmed">
                    {flow ? t("flow.intro", { count: flow.applications }) : t("flow.introLoading")}
                  </Text>
                </div>
                <Select
                  aria-label={t("routes.label")}
                  size="xs"
                  w={150}
                  data={[
                    { value: "any", label: t("routes.any") },
                    { value: "direct", label: t("routes.direct") },
                    { value: "agency", label: t("routes.agency") },
                    { value: "referral", label: t("routes.referral") },
                  ]}
                  value={route}
                  onChange={(value) => setRoute(value ?? "any")}
                  allowDeselect={false}
                />
              </Group>
              {isLoading ? (
                <Loader />
              ) : isError || !flow ? (
                <Text c="red">{t("flow.loadFailed")}</Text>
              ) : !flow.links.length ? (
                <Text size="sm" c="dimmed">
                  {flow.applications ? t("flow.notMoved") : t("flow.noMatch")}
                </Text>
              ) : (
                <SankeyChart flow={flow} />
              )}
            </Card>
            {statsError && <Text c="red">{t("flow.statsFailed")}</Text>}
            {stats && stats.applications > 0 && (
              <>
                <StageTable stats={stats} />
                <RouteTable stats={stats} />
              </>
            )}
            <ScorecardCard since={range.since} />
            <ReschedulingCard since={range.since} />
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="conversations">
          <ConversationsSection since={range.since} />
        </Tabs.Panel>
        <Tabs.Panel value="documents">
          <DocumentPerformanceSection since={range.since} />
        </Tabs.Panel>
      </Tabs>
      <WeeklyActivity />
    </Stack>
  );
}
