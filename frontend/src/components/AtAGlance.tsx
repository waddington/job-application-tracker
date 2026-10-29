import { Box, Card, Group, SimpleGrid, Stack, Text, ThemeIcon, Title } from "@mantine/core";
import { IconAlertCircle, IconCalendarEvent, IconCircleCheck } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

import type { ApplicationDetail } from "../api/client";
import { stageLookup, useWorkflow } from "../api/hooks";
import { useInterviews } from "../api/interviewHooks";
import { useOffers } from "../api/offerHooks";
import { useTodos } from "../api/todoHooks";
import { glance, type GlanceItem } from "../utils/attention";
import { useNow, useToday } from "../utils/useToday";

function Row({ item }: { item: GlanceItem }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="sm" align="flex-start">
      <Group gap={8} wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
        <Box
          aria-hidden
          mt={7}
          w={8}
          h={8}
          style={{ flex: "none", borderRadius: "50%", background: `var(--mantine-color-${item.tone}-6)` }}
        />
        <Text size="sm" style={{ overflowWrap: "anywhere" }}>
          {item.label}
        </Text>
      </Group>
      <Text
        size="sm"
        c={item.tone === "red" ? "red" : "dimmed"}
        fw={item.tone === "red" ? 600 : 400}
        ta="right"
      >
        {item.when}
      </Text>
    </Group>
  );
}

/**
 * What this application needs and how long ago things happened: the same rules as Next
 * actions, for one application, plus its key dates as "3 weeks ago".
 */
export function AtAGlance({ app }: { app: ApplicationDetail }) {
  const { t } = useTranslation("today");
  const { data: workflow } = useWorkflow();
  const { data: interviews, isPending: p1 } = useInterviews({ application_id: app.id });
  const { data: offers, isPending: p2 } = useOffers({ application_id: app.id }); // the newest
  const { data: todos, isPending: p3 } = useTodos({ entity_type: "application", entity_id: app.id });
  const loading = p1 || p2 || p3;
  const today = useToday();
  const now = useNow();
  const g = glance({
    app,
    stage: stageLookup(workflow).get(app.stage),
    interviews: interviews ?? [],
    offers: offers ?? [],
    todos: todos ?? [],
    today,
    now,
  });

  return (
    <Card withBorder>
      <Stack gap="sm">
        <Title order={4}>{t("glance.title")}</Title>
        {loading ? (
          <Text size="sm" c="dimmed">
            {t("glance.loading")}
          </Text>
        ) : (
          <>
            {!g.open && (
              <Text size="sm" c="dimmed">
                {t("glance.nothingToChase", { what: app.archived ? t("glance.archived") : app.stage_name })}
              </Text>
            )}
            {g.attention.length > 0 ? (
              <Stack gap={6}>
                <Group gap={6}>
                  <ThemeIcon aria-hidden size="sm" variant="light" color="red">
                    <IconAlertCircle size={14} />
                  </ThemeIcon>
                  <Text size="sm" fw={600}>
                    {t("glance.needsAttention")}
                  </Text>
                </Group>
                {g.attention.map((item) => (
                  <Row key={item.key} item={item} />
                ))}
              </Stack>
            ) : (
              g.open && (
                <Group gap={6}>
                  <ThemeIcon aria-hidden size="sm" variant="light" color="green">
                    <IconCircleCheck size={14} />
                  </ThemeIcon>
                  <Text size="sm" c="dimmed">
                    {t("glance.nothingNeeded")}
                  </Text>
                </Group>
              )
            )}
          </>
        )}
        {!loading && g.comingUp.length > 0 && (
          <Stack gap={6}>
            <Group gap={6}>
              <ThemeIcon aria-hidden size="sm" variant="light" color="blue">
                <IconCalendarEvent size={14} />
              </ThemeIcon>
              <Text size="sm" fw={600}>
                {t("glance.comingUp")}
              </Text>
            </Group>
            {g.comingUp.map((item) => (
              <Row key={item.key} item={item} />
            ))}
          </Stack>
        )}
        <SimpleGrid
          cols={{ base: 2, sm: 3 }}
          spacing="sm"
          verticalSpacing="xs"
          role="group"
          aria-label={t("glance.keyDates")}
        >
          {g.dates.map((d) => (
            <div key={d.label}>
              <Text size="xs" c="dimmed">
                {d.label}
              </Text>
              <Text size="sm" fw={600}>
                {d.ago}
              </Text>
              <Text size="xs" c="dimmed">
                {d.value}
              </Text>
            </div>
          ))}
        </SimpleGrid>
      </Stack>
    </Card>
  );
}
