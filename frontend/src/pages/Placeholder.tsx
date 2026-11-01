import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { Trans, useTranslation } from "react-i18next";

import type { NavItem } from "../nav";

export function Placeholder({ item }: { item: NavItem }) {
  const { t } = useTranslation();
  return (
    <Stack maw={720}>
      <Group gap="sm">
        <item.icon size={26} stroke={1.6} />
        <Title order={2}>{item.label}</Title>
      </Group>
      <Card withBorder padding="lg">
        <Text>{item.description}</Text>
        <Group mt="md" gap="xs">
          <Badge variant="light">{t("nav.placeholder.comingSoon")}</Badge>
          <Text size="sm" c="dimmed">
            <Trans
              t={t}
              i18nKey="nav.placeholder.roadmapTask"
              components={{ task: <code>{item.task}</code> }}
            />
          </Text>
        </Group>
      </Card>
    </Stack>
  );
}
